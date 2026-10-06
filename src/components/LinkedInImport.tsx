import { useMemo, useRef, useState, type ReactNode } from "react";
import type { LinkedInData } from "../../shared/types";
import { importLinkedIn } from "../lib/ai";
import { applySuggestions, compareWithProfile, sameSkill, type Suggestion } from "../lib/linkedin";
import { useApp } from "../store/app";
import { toast } from "../store/toast";
import { CheckIcon, UploadIcon } from "./icons";
import { Button, ErrorBox, Steps } from "./ui";

const KIND_LABEL: Record<Suggestion["kind"], string> = { skill: "Skills", experience: "Experience", certification: "Certifications" };

/** Three-step guide to LinkedIn's "Save to PDF", with tiny mock-ups of what to click. */
export function LinkedInPdfGuide() {
  const step = (n: number, title: string, body: string, mock: ReactNode) => (
    <li className="frost flex flex-col gap-3 rounded-[20px] p-4">
      <div className="flex h-[74px] items-center justify-center rounded-[14px] bg-surface" aria-hidden="true">
        {mock}
      </div>
      <div>
        <p className="text-[13px] font-semibold text-brand">Step {n}</p>
        <p className="text-[15px] font-medium">{title}</p>
        <p className="mt-0.5 text-[13px] leading-snug text-muted">{body}</p>
      </div>
    </li>
  );
  const chip = (text: string, on = false) => (
    <span className={`rounded-full px-3 py-1 text-[12px] font-medium ${on ? "bg-[#0a66c2] text-white" : "border border-hair bg-card text-ink"}`}>{text}</span>
  );
  return (
    <ol className="grid gap-3 sm:grid-cols-3">
      {step(
        1,
        "Open your LinkedIn profile",
        "On a computer, go to linkedin.com and click Me → View profile.",
        <span className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-[#0a66c2] text-[12px] font-bold text-white">in</span>
          {chip("View profile", true)}
        </span>,
      )}
      {step(
        2,
        "Click Resources → Save to PDF",
        "It’s the button next to “Open to” under your name. On some profiles it says More.",
        <span className="flex flex-col items-start gap-1.5">
          {chip("Resources")}
          <span className="ml-3 rounded-lg border border-hair bg-card px-3 py-1 text-[12px] font-medium shadow-sm">Save to PDF</span>
        </span>,
      )}
      {step(
        3,
        "Upload Profile.pdf here",
        "LinkedIn downloads a file called Profile.pdf. The mobile app can’t do this, so use a browser.",
        <span className="flex items-center gap-2 text-[13px] font-medium">
          <span className="flex h-9 w-7 items-end justify-center rounded-sm border border-hair bg-card pb-1 text-[8px] text-bad">PDF</span>
          Profile.pdf
        </span>,
      )}
    </ol>
  );
}

/**
 * Upload the LinkedIn PDF, then add the skills, experience and certifications that
 * the profile doesn't have. `gapSkills` puts skills that close this job's gaps first.
 */
export default function LinkedInImport({
  gapSkills = [],
  onApplied,
  showGuide = false,
}: {
  gapSkills?: string[];
  onApplied?: (added: Suggestion[]) => void;
  showGuide?: boolean;
}) {
  const account = useApp((s) => s.account);
  const profile = useApp((s) => s.profile);
  const setAccount = useApp((s) => s.setAccount);
  const setProfile = useApp((s) => s.setProfile);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [guide, setGuide] = useState(showGuide);
  const [unchecked, setUnchecked] = useState<Record<string, boolean>>({});
  const fileInput = useRef<HTMLInputElement>(null);
  const linkedin: LinkedInData = useMemo(() => account?.linkedin ?? {}, [account?.linkedin]);
  const gapList = gapSkills.join("|");

  const saveLinkedIn = (patch: Partial<LinkedInData>) => {
    const a = useApp.getState().account;
    if (a) setAccount({ ...a, linkedin: { ...(a.linkedin ?? {}), ...patch } });
  };

  const closesGap = (s: Suggestion) => s.kind === "skill" && gapSkills.some((g) => sameSkill(s.label, g));
  const suggestions = useMemo(() => {
    if (!profile || !linkedin.imported) return [];
    const list = compareWithProfile(profile, linkedin.imported, linkedin.dismissed);
    return [...list.filter(closesGap), ...list.filter((s) => !closesGap(s))];
    // closesGap depends only on gapSkills, tracked through gapList.
  }, [profile, linkedin.imported, linkedin.dismissed, gapList]);

  if (!profile || !account) return null;
  const chosen = suggestions.filter((s) => !unchecked[s.key]);

  const upload = async (file: File) => {
    setBusy(true);
    setError("");
    try {
      const imported = await importLinkedIn(file, profile.basics.name);
      saveLinkedIn({ imported, importedAt: Date.now(), fileName: file.name, dismissed: [] });
      setUnchecked({});
      setGuide(false);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
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

  const groups = suggestions.reduce<Partial<Record<Suggestion["kind"], Suggestion[]>>>((g, s) => ({ ...g, [s.kind]: [...(g[s.kind] ?? []), s] }), {});

  return (
    <section id="linkedin" className="rounded-[26px] border border-line p-6 md:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#0a66c2] text-[17px] font-bold text-white" aria-hidden="true">
            in
          </span>
          <div>
            <h2 className="flex flex-wrap items-center gap-2.5 text-[22px] font-semibold tracking-[-0.02em]">
              Add what’s on your LinkedIn
              <span className="rounded-full bg-surface px-2.5 py-0.5 text-[12px] font-medium tracking-normal text-muted">Optional</span>
            </h2>
            <p className="mt-1 max-w-xl text-[15px] text-muted">
              Upload your LinkedIn PDF. Nevora finds skills, experience and certifications that aren’t on your resume yet and skips everything that already is.
            </p>
          </div>
        </div>
        {!guide && (
          <button type="button" className="text-sm font-medium text-brand hover:underline" onClick={() => setGuide(true)}>
            How do I get the PDF?
          </button>
        )}
      </div>

      {guide && (
        <div className="mt-5">
          <LinkedInPdfGuide />
        </div>
      )}

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-[18px] bg-surface px-5 py-4">
        <p className="text-[15px]">
          {linkedin.imported ? (
            <>
              <b className="font-medium">Imported</b> {linkedin.fileName ?? "LinkedIn PDF"}
              {linkedin.importedAt ? <span className="text-muted"> · {new Date(linkedin.importedAt).toLocaleDateString()}</span> : null}
            </>
          ) : (
            <span className="text-muted">Read in your browser. Nothing is invented.</span>
          )}
        </p>
        <input
          ref={fileInput}
          type="file"
          accept="application/pdf,.pdf"
          className="sr-only"
          aria-label="Upload your LinkedIn PDF"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) void upload(f);
          }}
        />
        <Button variant={linkedin.imported ? "secondary" : "primary"} size="sm" loading={busy} onClick={() => fileInput.current?.click()}>
          {!busy && <UploadIcon size={16} />}
          {linkedin.imported ? "Upload a newer PDF" : "Upload LinkedIn PDF"}
        </Button>
      </div>

      {busy && (
        <div className="mt-5">
          <Steps steps={["Reading your LinkedIn PDF", "Comparing it with your resume", "Finding what’s missing"]} />
        </div>
      )}
      {error && (
        <div className="mt-5">
          <ErrorBox message={error} />
        </div>
      )}

      {linkedin.imported && !busy && (
        <div className="mt-6">
          {suggestions.length ? (
            <>
              <p className="text-[15px] font-semibold">
                {suggestions.length} thing{suggestions.length > 1 ? "s" : ""} on LinkedIn {suggestions.length > 1 ? "aren’t" : "isn’t"} on your resume
              </p>
              <div className="mt-3 flex flex-col gap-5">
                {(Object.keys(KIND_LABEL) as Suggestion["kind"][])
                  .filter((k) => groups[k]?.length)
                  .map((kind) => (
                    <div key={kind}>
                      <p className="text-[13px] text-muted">{KIND_LABEL[kind]}</p>
                      <ul className="mt-2 flex flex-col gap-1.5">
                        {groups[kind]!.map((s) => {
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
                                    {closesGap(s) && <span className="rounded-full bg-learn-soft px-2 py-0.5 text-[12px] font-medium text-learn-ink">Closes a gap for this job</span>}
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
                <Button onClick={add} disabled={!chosen.length}>
                  Add {chosen.length} to my profile
                </Button>
                <Button variant="ghost" onClick={() => saveLinkedIn({ dismissed: [...(linkedin.dismissed ?? []), ...suggestions.map((s) => s.key)] })}>
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
