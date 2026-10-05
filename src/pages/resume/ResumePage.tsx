import { useCallback, useEffect, useRef, useState } from "react";
import type { Application, ResumeItem, TailoredResume, ToggleSection } from "../../../shared/types";
import { PencilIcon } from "../../components/icons";
import { FlowPage } from "../../components/layout";
import { Button, ErrorBox, Segmented, Steps } from "../../components/ui";
import { tailor, verify } from "../../lib/ai";
import { fileSafe, resumePdf, resumeText } from "../../lib/pdf";
import { useApp } from "../../store/app";
import { toast } from "../../store/toast";
import CoverLetterDialog from "./CoverLetterDialog";
import { ChangesPanel, VerifiedPanel, verificationSummary } from "./Panels";
import ResumePreview from "./ResumePreview";

const TOGGLES: [ToggleSection, string][] = [
  ["summary", "Summary"],
  ["skills", "Skills"],
  ["projects", "Projects"],
  ["experience", "Experience"],
  ["education", "Education"],
  ["certifications", "Certifications"],
  ["achievements", "Achievements"],
];

const SAVE_LABEL = { idle: "Saved", saved: "Saved", saving: "Saving…", offline: "Saved offline", error: "Not saved" };

function ResumeStep({ app }: { app: Application }) {
  const profile = useApp((s) => s.profile);
  const mode = useApp((s) => s.mode);
  const saveState = useApp((s) => s.saveState);
  const updateApplication = useApp((s) => s.updateApplication);
  const [panel, setPanel] = useState<"changes" | "verified">("changes");
  const [busy, setBusy] = useState<"" | "tailor" | "verify">("");
  const [error, setError] = useState("");
  const [renaming, setRenaming] = useState(false);
  const [copied, setCopied] = useState("");
  const [confirmRegen, setConfirmRegen] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [letterOpen, setLetterOpen] = useState(false);
  const started = useRef(false);

  const runVerify = useCallback(
    async (resume: TailoredResume) => {
      if (!profile) return;
      setBusy("verify");
      try {
        updateApplication(app.id, { verifications: await verify(profile, resume) });
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setBusy("");
      }
    },
    [app.id, profile, updateApplication],
  );

  const generate = useCallback(async () => {
    if (!profile || !app.jd) return;
    setError("");
    setBusy("tailor");
    try {
      const resume = await tailor(profile, app.jd, app.match);
      updateApplication(app.id, { resume, verifications: null });
      await runVerify(resume);
    } catch (err) {
      setError((err as Error).message);
      setBusy("");
    }
  }, [app.id, app.jd, app.match, profile, updateApplication, runVerify]);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (!app.resume) void generate();
    else if (!app.verifications) void runVerify(app.resume);
  }, [app.resume, app.verifications, generate, runVerify]);

  if (!profile) return null;
  const resume = app.resume;
  if (!resume)
    return (
      <main className="mx-auto max-w-[560px] px-6 py-24">
        <h1 className="text-[34px] font-semibold tight">Building your resume</h1>
        <p className="mb-8 mt-2 text-muted">Only facts from your profile are used.</p>
        {busy ? (
          <Steps steps={["Choosing your most relevant projects", "Rewriting lines in the job’s language", "Checking every line against your profile"]} />
        ) : error ? (
          <ErrorBox message={error} onRetry={generate} />
        ) : null}
      </main>
    );

  const summary = verificationSummary(resume, app.verifications);
  const canDownload = !busy && !summary.bad.length && !summary.pending.length;

  const editBullet = (id: string, text: string) => {
    const next: TailoredResume = {
      ...resume,
      sections: resume.sections.map((s) => ({
        ...s,
        items: s.items.map((i) => ({ ...i, bullets: i.bullets.map((b) => (b.id === id ? { ...b, text, needsMetric: /\[/.test(text) } : b)) })),
      })),
    };
    updateApplication(app.id, { resume: next, verifications: (app.verifications ?? []).filter((v) => v.bulletId !== id) });
    setPanel("verified");
  };
  const removeBullet = (id: string) => {
    const before = { resume, verifications: app.verifications };
    const next: TailoredResume = {
      ...resume,
      sections: resume.sections.map((s) => ({ ...s, items: s.items.map((i) => ({ ...i, bullets: i.bullets.filter((b) => b.id !== id) })) })),
    };
    updateApplication(app.id, { resume: next, verifications: (app.verifications ?? []).filter((v) => v.bulletId !== id) });
    toast("Line removed", { label: "Undo", run: () => updateApplication(app.id, before) });
  };
  const addBack = (refId: string) => {
    const project = profile.projects.find((p) => p.id === refId);
    const job = profile.experience.find((e) => e.id === refId);
    const source = project ?? job;
    if (!source) return;
    const key = project ? "projects" : "experience";
    const item: ResumeItem = {
      refId,
      heading: project ? project.name : `${job!.role} — ${job!.org}`,
      meta: project ? project.tech.join(", ") : [job!.start, job!.end].filter(Boolean).join(" – "),
      bullets: source.bullets.map((b) => ({
        id: `${b.id}_t`,
        text: b.text.replace(/\.$/, ""),
        sourceIds: [b.id],
        originalText: b.text,
        changeReason: "Added back as written.",
        needsMetric: false,
      })),
    };
    const sections = resume.sections.some((s) => s.key === key)
      ? resume.sections.map((s) => (s.key === key ? { ...s, items: [...s.items, item] } : s))
      : [...resume.sections, { key: key as "projects" | "experience", items: [item] }];
    const next = { ...resume, sections, omittedIds: resume.omittedIds.filter((id) => id !== refId) };
    updateApplication(app.id, { resume: next });
    toast(`Added back ${item.heading.split(" — ")[0]}`);
    void runVerify(next);
  };
  const copyText = async () => {
    try {
      await navigator.clipboard.writeText(resumeText(resume, profile, app.hiddenSections));
      setCopied("Copied");
    } catch {
      setCopied("Copy blocked");
    }
    setTimeout(() => setCopied(""), 1600);
  };
  const download = async () => {
    setDownloading(true);
    setError("");
    try {
      await resumePdf(resume, profile, app.hiddenSections, fileSafe(`${profile.basics.name}_${app.name}`) || "Resume");
    } catch {
      setError("Couldn't create the PDF. Try Copy text instead.");
    } finally {
      setDownloading(false);
    }
  };
  const toggle = (key: ToggleSection) =>
    updateApplication(app.id, {
      hiddenSections: app.hiddenSections.includes(key) ? app.hiddenSections.filter((k) => k !== key) : [...app.hiddenSections, key],
    });
  const leftOut = resume.omittedIds
    .map((id) => profile.projects.find((p) => p.id === id) ?? profile.experience.find((e) => e.id === id))
    .filter((x): x is NonNullable<typeof x> => Boolean(x));

  return (
    <div className="min-h-[calc(100vh-64px)] bg-surface print:bg-white">
      <div className="no-print border-b border-line bg-white">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-4 px-6 py-3.5 md:px-8">
          <div className="min-w-0">
            {renaming ? (
              <>
                <label htmlFor="rname" className="sr-only">
                  Resume name
                </label>
                <input
                  id="rname"
                  autoFocus
                  defaultValue={app.name}
                  className="input h-10 w-[320px] max-w-full text-base"
                  onBlur={(e) => {
                    const next = e.target.value.trim();
                    if (next && next !== app.name) {
                      updateApplication(app.id, { name: next });
                      toast("Renamed");
                    }
                    setRenaming(false);
                  }}
                  onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                />
              </>
            ) : (
              <button type="button" onClick={() => setRenaming(true)} className="flex items-center gap-2 text-[17px] font-semibold" aria-label={`Rename ${app.name}`}>
                {app.name} <PencilIcon className="text-muted" />
              </button>
            )}
            <p className="mt-0.5 text-xs text-muted">
              {mode === "demo" ? "Saved in this browser" : SAVE_LABEL[saveState]} · Match {app.match?.score}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <Button variant="secondary" size="sm" onClick={() => setLetterOpen(true)}>
              Cover letter
            </Button>
            <Button variant="secondary" size="sm" onClick={copyText}>
              {copied || "Copy text"}
            </Button>
            {confirmRegen ? (
              <>
                <span className="text-sm text-muted">Replace your edits?</span>
                <Button
                  variant="dark"
                  size="sm"
                  onClick={() => {
                    setConfirmRegen(false);
                    void generate();
                  }}
                >
                  Regenerate
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setConfirmRegen(false)}>
                  Cancel
                </Button>
              </>
            ) : (
              <Button variant="secondary" size="sm" onClick={() => setConfirmRegen(true)} disabled={Boolean(busy)}>
                Regenerate
              </Button>
            )}
            <Button size="sm" onClick={download} loading={downloading} disabled={!canDownload} title={canDownload ? "Save as PDF" : "Fix or check flagged lines first"}>
              Download PDF
            </Button>
          </div>
        </div>
      </div>
      <div className="mx-auto flex max-w-[1440px] flex-col gap-6 px-4 py-7 md:px-8 xl:flex-row">
        <aside className="no-print order-3 flex shrink-0 flex-col gap-4 xl:order-none xl:w-[240px]">
          <div className="flex flex-col gap-3 rounded-[22px] bg-white p-5">
            <h2 className="text-sm font-semibold">Sections</h2>
            {TOGGLES.map(([key, label]) => {
              const on = !app.hiddenSections.includes(key);
              return (
                <button key={key} type="button" role="switch" aria-checked={on} onClick={() => toggle(key)} className="flex items-center justify-between text-[15px]">
                  <span>{label}</span>
                  <span className={`flex h-[22px] w-[38px] items-center rounded-full p-0.5 transition ${on ? "justify-end bg-ok-dot" : "justify-start bg-[#E5E5EA]"}`}>
                    <span className="h-[18px] w-[18px] rounded-full bg-white shadow" />
                  </span>
                </button>
              );
            })}
          </div>
          {leftOut.length > 0 && (
            <div className="flex flex-col gap-2.5 rounded-[22px] bg-white p-5">
              <h2 className="text-sm font-semibold">Left out for this role</h2>
              {leftOut.map((x) => (
                <div key={x.id}>
                  <p className="text-[15px]">{"name" in x ? x.name : x.role}</p>
                  <button type="button" className="text-sm text-brand" onClick={() => addBack(x.id)}>
                    Add it back
                  </button>
                </div>
              ))}
              <p className="text-[13px] leading-snug text-muted">Still saved in your profile.</p>
            </div>
          )}
          <p className="rounded-[22px] bg-white p-5 text-[13px] leading-snug text-muted">Click any line on the resume to edit it. Edited lines are checked again before download.</p>
        </aside>
        <main className="order-1 min-w-0 flex-1 xl:order-none">
          <ResumePreview resume={resume} profile={profile} hidden={app.hiddenSections} verifications={app.verifications} onEditBullet={editBullet} />
        </main>
        <aside className="no-print order-2 flex w-full shrink-0 flex-col gap-4 self-start rounded-[22px] bg-white p-5 xl:order-none xl:w-[390px]">
          <Segmented
            className="w-full"
            label="Panel"
            value={panel}
            onChange={setPanel}
            options={[
              { value: "changes", label: "Changes" },
              { value: "verified", label: `Verified ${busy === "verify" ? "…" : `${summary.ok}/${summary.total}`}` },
            ]}
          />
          {error && <ErrorBox message={error} onRetry={() => runVerify(resume)} />}
          {panel === "changes" ? (
            <ChangesPanel resume={resume} />
          ) : (
            <VerifiedPanel
              resume={resume}
              profile={profile}
              verifications={app.verifications}
              checking={busy === "verify"}
              onRemove={removeBullet}
              onRecheck={() => runVerify(resume)}
            />
          )}
          {!canDownload && panel === "changes" && summary.bad.length > 0 && (
            <button type="button" onClick={() => setPanel("verified")} className="rounded-2xl bg-bad-soft p-4 text-left text-sm text-[#9A0015]">
              {summary.bad.length} line{summary.bad.length > 1 ? "s aren’t" : " isn’t"} backed by your profile. Review ›
            </button>
          )}
          <Button variant="learn" href="/new/grow">
            See what to learn next
          </Button>
        </aside>
      </div>
      {letterOpen && <CoverLetterDialog app={app} onClose={() => setLetterOpen(false)} />}
    </div>
  );
}

export default function ResumePage() {
  return <FlowPage step="resume">{(app) => <ResumeStep key={app.id} app={app} />}</FlowPage>;
}
