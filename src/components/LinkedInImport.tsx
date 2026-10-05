import { useEffect, useMemo, useRef, useState } from "react";
import type { LinkedInData } from "../../shared/types";
import { parseResume } from "../lib/ai";
import { applySuggestions, checkLinkedIn, compareWithProfile, namesMatch, sameSkill, startLinkedIn, takeLinkedInReturn, useLinkedInStatus, type Suggestion } from "../lib/linkedin";
import { useApp } from "../store/app";
import { toast } from "../store/toast";
import { CheckIcon } from "./icons";
import { Button, ErrorBox, Steps } from "./ui";

const KIND_LABEL: Record<Suggestion["kind"], string> = {
  skill: "Skills",
  experience: "Experience",
  project: "Projects",
  education: "Education",
  certification: "Certifications",
  achievement: "Achievements",
  summary: "About",
};

/**
 * Connect LinkedIn (identity) and import the LinkedIn PDF export, then add whatever
 * the profile is missing. `gapSkills` puts skills that close this job's gaps first.
 */
export default function LinkedInImport({ returnTo, gapSkills = [], onApplied }: { returnTo: string; gapSkills?: string[]; onApplied?: (added: Suggestion[]) => void }) {
  const uid = useApp((s) => s.uid);
  const account = useApp((s) => s.account);
  const profile = useApp((s) => s.profile);
  const setAccount = useApp((s) => s.setAccount);
  const setProfile = useApp((s) => s.setProfile);
  const configured = useLinkedInStatus((s) => s.configured);
  const [busy, setBusy] = useState<"" | "connect" | "import">("");
  const [error, setError] = useState("");
  const [unchecked, setUnchecked] = useState<Record<string, boolean>>({});
  const fileInput = useRef<HTMLInputElement>(null);
  const linkedin: LinkedInData = useMemo(() => account?.linkedin ?? {}, [account?.linkedin]);

  const saveLinkedIn = (patch: Partial<LinkedInData>) => {
    const a = useApp.getState().account;
    if (a) setAccount({ ...a, linkedin: { ...(a.linkedin ?? {}), ...patch } });
  };

  useEffect(() => {
    void checkLinkedIn();
  }, []);

  // Back from LinkedIn's sign-in page.
  useEffect(() => {
    if (!account) return;
    const result = takeLinkedInReturn(uid);
    if (!result) return;
    setTimeout(() => document.getElementById("linkedin")?.scrollIntoView({ behavior: "smooth", block: "center" }), 100);
    if (result.error) setError(result.error);
    if (result.identity) {
      saveLinkedIn({ identity: result.identity });
      toast("LinkedIn connected");
    }
  }, [Boolean(account), uid]);

  const gapKey = (s: Suggestion) => s.kind === "skill" && gapSkills.some((g) => sameSkill(s.label, g));
  const suggestions = useMemo(() => {
    if (!profile || !linkedin.imported) return [];
    const list = compareWithProfile(profile, linkedin.imported, linkedin.dismissed);
    return [...list.filter(gapKey), ...list.filter((s) => !gapKey(s))];
  }, [profile, linkedin.imported, linkedin.dismissed, gapSkills.join("|")]);

  if (!profile || !account) return null;
  const identity = linkedin.identity;
  const owner = identity?.name || profile.basics.name;
  const importedName = linkedin.imported?.basics.name ?? "";
  const nameWarning = importedName && owner && !namesMatch(importedName, owner) ? `This PDF is for “${importedName}”, not ${owner}. Only import your own LinkedIn profile.` : "";
  const chosen = suggestions.filter((s) => !unchecked[s.key]);

  const connect = async () => {
    setBusy("connect");
    setError("");
    try {
      await startLinkedIn(returnTo);
    } catch (err) {
      setError((err as Error).message);
      setBusy("");
    }
  };

  const importPdf = async (file: File) => {
    if (!/\.pdf$/i.test(file.name) && file.type !== "application/pdf") return setError("Choose the PDF you saved from LinkedIn.");
    setBusy("import");
    setError("");
    try {
      const imported = await parseResume(file, "");
      saveLinkedIn({ imported, importedAt: Date.now(), fileName: file.name, dismissed: [] });
      setUnchecked({});
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy("");
    }
  };

  const add = () => {
    if (!chosen.length) return;
    setProfile(applySuggestions(profile, chosen));
    const skipped = suggestions.filter((s) => unchecked[s.key]).map((s) => s.key);
    saveLinkedIn({ dismissed: [...(linkedin.dismissed ?? []), ...skipped] });
    setUnchecked({});
    toast(`Added ${chosen.length} item${chosen.length > 1 ? "s" : ""} from LinkedIn to your profile`);
    onApplied?.(chosen);
  };

  const dismissAll = () => saveLinkedIn({ dismissed: [...(linkedin.dismissed ?? []), ...suggestions.map((s) => s.key)] });

  const groups = suggestions.reduce<Record<string, Suggestion[]>>((g, s) => ({ ...g, [s.kind]: [...(g[s.kind] ?? []), s] }), {});

  return (
    <section id="linkedin" className="rounded-[26px] border border-line p-6 md:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#0a66c2] text-[17px] font-bold text-white" aria-hidden="true">
            in
          </span>
          <div>
            <h2 className="text-[22px] font-semibold tracking-[-0.02em]">Import from LinkedIn</h2>
            <p className="mt-1 max-w-xl text-[15px] text-muted">
              Find skills and experience that are on your LinkedIn but missing from your resume. Anything already there is skipped.
            </p>
          </div>
        </div>
        {identity ? (
          <div className="flex items-center gap-3 rounded-full bg-surface py-1.5 pl-1.5 pr-4 text-sm">
            {identity.picture ? <img src={identity.picture} alt="" className="h-7 w-7 rounded-full object-cover" referrerPolicy="no-referrer" /> : null}
            <span>
              Connected as <b className="font-medium">{identity.name || identity.email}</b>
            </span>
            <button type="button" className="text-muted hover:text-ink" onClick={() => saveLinkedIn({ identity: undefined })}>
              Disconnect
            </button>
          </div>
        ) : configured ? (
          <Button variant="secondary" size="sm" loading={busy === "connect"} onClick={connect}>
            Connect LinkedIn
          </Button>
        ) : null}
      </div>

      {!identity && configured === false && (
        <p className="mt-4 text-[13px] text-muted">LinkedIn sign-in isn’t set up on this server yet. You can still import your LinkedIn PDF below.</p>
      )}

      <div className="mt-5 flex flex-col gap-3 rounded-[18px] bg-surface p-5">
        <p className="text-[15px]">
          <b className="font-medium">{linkedin.imported ? "Imported " : "Step 1. "}</b>
          {linkedin.imported ? (
            <>
              {linkedin.fileName ?? "LinkedIn PDF"}
              {linkedin.importedAt ? <span className="text-muted"> · {new Date(linkedin.importedAt).toLocaleDateString()}</span> : null}
            </>
          ) : (
            <>
              On LinkedIn, open your profile, choose <b className="font-medium">Resources → Save to PDF</b>, then upload that file here.
            </>
          )}
        </p>
        <p className="text-[13px] text-muted">
          LinkedIn only shares your name, email and photo with apps, so your skills and positions come from your own PDF export. Nevora reads it once and never invents anything.
        </p>
        <div>
          <input
            ref={fileInput}
            type="file"
            accept="application/pdf,.pdf"
            className="sr-only"
            aria-label="Upload your LinkedIn PDF"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) void importPdf(f);
            }}
          />
          <Button variant={linkedin.imported ? "secondary" : "primary"} size="sm" loading={busy === "import"} onClick={() => fileInput.current?.click()}>
            {linkedin.imported ? "Upload a newer PDF" : "Upload LinkedIn PDF"}
          </Button>
        </div>
      </div>

      {busy === "import" && (
        <div className="mt-5">
          <Steps steps={["Reading your LinkedIn PDF", "Comparing it with your resume", "Finding what’s missing"]} />
        </div>
      )}
      {error && (
        <div className="mt-5">
          <ErrorBox message={error} />
        </div>
      )}
      {nameWarning && <p className="mt-5 rounded-2xl bg-warn-soft px-5 py-4 text-[15px] text-warn">{nameWarning}</p>}

      {linkedin.imported && busy !== "import" && (
        <div className="mt-6">
          {suggestions.length ? (
            <>
              <p className="text-[15px] font-semibold">
                {suggestions.length} thing{suggestions.length > 1 ? "s" : ""} on LinkedIn {suggestions.length > 1 ? "aren’t" : "isn’t"} on your resume
              </p>
              <div className="mt-3 flex flex-col gap-5">
                {Object.entries(groups).map(([kind, items]) => (
                  <div key={kind}>
                    <p className="text-[13px] text-muted">{KIND_LABEL[kind as Suggestion["kind"]]}</p>
                    <ul className="mt-2 flex flex-col gap-1.5">
                      {items.map((s) => {
                        const on = !unchecked[s.key];
                        return (
                          <li key={s.key}>
                            <button
                              type="button"
                              role="checkbox"
                              aria-checked={on}
                              onClick={() => setUnchecked({ ...unchecked, [s.key]: on })}
                              className="flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-surface"
                            >
                              <span className={`mt-0.5 flex h-[20px] w-[20px] shrink-0 items-center justify-center rounded-[6px] border-[1.5px] border-brand ${on ? "bg-brand text-white" : ""}`}>
                                {on && <CheckIcon size={11} />}
                              </span>
                              <span className="flex flex-1 flex-col">
                                <span className="flex flex-wrap items-center gap-2 text-[15px] font-medium">
                                  {s.label}
                                  {gapKey(s) && <span className="rounded-full bg-learn-soft px-2 py-0.5 text-[12px] font-medium text-learn-ink">Closes a gap for this job</span>}
                                </span>
                                <span className="text-[13px] text-muted">{s.detail}</span>
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </div>
              <div className="mt-5 flex flex-wrap gap-3">
                <Button onClick={add} disabled={!chosen.length || Boolean(nameWarning)}>
                  Add {chosen.length} to my profile
                </Button>
                <Button variant="ghost" onClick={dismissAll}>
                  Not now
                </Button>
              </div>
            </>
          ) : (
            <p className="flex items-center gap-2 text-[15px] text-ok">
              <CheckIcon /> Your profile already has everything from your LinkedIn PDF.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
