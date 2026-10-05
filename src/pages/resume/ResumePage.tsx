import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router";
import type { Application, ResumeItem, ResumeVersion, TailoredResume, ToggleSection } from "../../../shared/types";
import { PencilIcon } from "../../components/icons";
import { FlowPage } from "../../components/layout";
import { Button, ErrorBox, Segmented, Steps } from "../../components/ui";
import { tailor, verify } from "../../lib/ai";
import { fileSafe, resumePdf, resumeText } from "../../lib/pdf";
import { newId, useApp } from "../../store/app";
import { toast } from "../../store/toast";
import CoverLetterDialog from "./CoverLetterDialog";
import { ChangesPanel, VerifiedPanel, verificationSummary } from "./Panels";
import ResumePreview from "./ResumePreview";
import TemplatePicker, { TemplateThumb } from "./TemplatePicker";
import { templateFor } from "../../lib/templates";

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

const MAX_VERSIONS = 12;
const VERSION_LABEL: Record<ResumeVersion["kind"], string> = { generated: "Generated", edited: "Edited", downloaded: "Downloaded" };

/** Saved copies are named after the job: "Frontend Developer Intern – Acme Labs". */
export const roleName = (app: Application) => [app.jd?.title, app.jd?.company].filter(Boolean).join(" – ") || app.name;

/** Drops empty lines and skills left behind while editing. */
function tidy(resume: TailoredResume): TailoredResume {
  return {
    ...resume,
    skills: resume.skills
      .map((g) => ({ category: g.category.trim(), items: g.items.map((i) => i.trim()).filter(Boolean) }))
      .filter((g) => g.category && g.items.length),
    sections: resume.sections.map((sec) => ({
      ...sec,
      items: sec.items.map((i) => ({ ...i, heading: i.heading.trim(), bullets: i.bullets.map((b) => ({ ...b, text: b.text.trim() })).filter((b) => b.text) })),
    })),
  };
}

function formatWhen(ts: number) {
  return new Date(ts).toLocaleString(undefined, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}

function ResumeStep({ app }: { app: Application }) {
  const profile = useApp((s) => s.profile);
  const saveState = useApp((s) => s.saveState);
  const sync = useApp((s) => s.sync);
  const updateApplication = useApp((s) => s.updateApplication);
  const [panel, setPanel] = useState<"changes" | "verified">("changes");
  const [busy, setBusy] = useState<"" | "tailor" | "verify">("");
  const [error, setError] = useState("");
  const [renaming, setRenaming] = useState(false);
  const [copied, setCopied] = useState("");
  const [confirmRegen, setConfirmRegen] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [letterOpen, setLetterOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const navigate = useNavigate();
  const beforeEdit = useRef<{ resume: TailoredResume; verifications: Application["verifications"] } | null>(null);
  const started = useRef(false);

  /** Keeps a named copy of a resume in this application's history. */
  const saveVersion = useCallback(
    (kind: ResumeVersion["kind"], resume: TailoredResume, hiddenSections: ToggleSection[]) => {
      const current = useApp.getState().applications.find((a) => a.id === app.id);
      if (!current) return;
      const versions = current.versions ?? [];
      const latest = versions[0];
      // Skip exact repeats of the most recent copy.
      if (latest && JSON.stringify(latest.resume) === JSON.stringify(resume) && latest.kind === kind) return;
      const version: ResumeVersion = {
        id: newId("ver"),
        name: roleName(current),
        createdAt: Date.now(),
        kind,
        resume: structuredClone(resume),
        hiddenSections: [...hiddenSections],
        template: current.template ?? "classic",
      };
      updateApplication(app.id, { versions: [version, ...versions].slice(0, MAX_VERSIONS) });
    },
    [app.id, updateApplication],
  );

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
      const previous = useApp.getState().applications.find((a) => a.id === app.id);
      // Keep the current resume before it's replaced.
      if (previous?.resume) saveVersion("edited", previous.resume, previous.hiddenSections);
      const resume = await tailor(profile, app.jd, app.match);
      updateApplication(app.id, { resume, verifications: null });
      saveVersion("generated", resume, previous?.hiddenSections ?? []);
      await runVerify(resume);
    } catch (err) {
      setError((err as Error).message);
      setBusy("");
    }
  }, [app.id, app.jd, app.match, profile, updateApplication, runVerify, saveVersion]);

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
  const spec = templateFor(app.template);
  const canDownload = !editing && !busy && !summary.bad.length && !summary.pending.length;

  const startEditing = () => {
    beforeEdit.current = { resume, verifications: app.verifications };
    setEditing(true);
  };
  /** Edit mode: lines that changed lose their check and are checked again when editing ends. */
  const changeResume = (next: TailoredResume, changed: string[]) =>
    updateApplication(app.id, {
      resume: next,
      verifications: changed.length ? (app.verifications ?? []).filter((v) => !changed.includes(v.bulletId)) : app.verifications,
    });
  const finishEditing = async () => {
    const clean = tidy(resume);
    const ids = new Set(clean.sections.flatMap((s) => s.items.flatMap((i) => i.bullets.map((b) => b.id))));
    const verifications = (app.verifications ?? []).filter((v) => ids.has(v.bulletId));
    updateApplication(app.id, { resume: clean, verifications });
    setEditing(false);
    const before = beforeEdit.current?.resume;
    beforeEdit.current = null;
    if (before && JSON.stringify(before) !== JSON.stringify(clean)) {
      saveVersion("edited", clean, app.hiddenSections);
      toast("Edits saved");
    }
    const pending = [...ids].some((id) => !verifications.some((v) => v.bulletId === id));
    if (pending) {
      setPanel("verified");
      await runVerify(clean);
    }
  };
  const cancelEditing = () => {
    if (beforeEdit.current) updateApplication(app.id, beforeEdit.current);
    beforeEdit.current = null;
    setEditing(false);
  };
  const openVersion = (v: ResumeVersion) => {
    saveVersion("edited", resume, app.hiddenSections);
    updateApplication(app.id, { resume: structuredClone(v.resume), hiddenSections: v.hiddenSections, template: v.template ?? app.template, verifications: null });
    toast(`Opened the ${VERSION_LABEL[v.kind].toLowerCase()} version from ${formatWhen(v.createdAt)}`);
    void runVerify(v.resume);
  };

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
      await resumePdf(resume, profile, app.hiddenSections, fileSafe(`${resume.header?.name ?? profile.basics.name}_${roleName(app)}`) || "Resume", spec);
      saveVersion("downloaded", resume, app.hiddenSections);
      // The resume is finished: go back home, where it's listed under My resumes.
      toast(`Downloaded “${roleName(app)}”. It’s saved in My resumes.`);
      navigate("/home#resumes");
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
          <div className="flex min-w-0 items-center gap-3">
            <Link
              to="/home"
              aria-label="Back to home"
              title="Back to home"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface text-lg hover:bg-line"
            >
              ←
            </Link>
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
              {sync === "device" ? "Saved on this device" : SAVE_LABEL[saveState]} · Match {app.match?.score} · {spec.name} template
            </p>
          </div>
          </div>
          {editing ? (
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="text-sm text-muted">Editing — changes save as you type</span>
              <Button variant="ghost" size="sm" onClick={cancelEditing}>
                Discard changes
              </Button>
              <Button size="sm" onClick={finishEditing}>
                Done editing
              </Button>
            </div>
          ) : (
          <div className="flex flex-wrap items-center gap-2.5">
            <Button variant="secondary" size="sm" onClick={startEditing} disabled={Boolean(busy)}>
              <PencilIcon /> Edit resume
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setLetterOpen(true)}>
              Cover letter
            </Button>
            <Button variant="secondary" size="sm" onClick={copyText}>
              {copied || "Copy text"}
            </Button>
            {confirmRegen ? (
              <>
                <span className="text-sm text-muted">Write a fresh version? This one stays in history.</span>
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
            <Button size="sm" onClick={download} loading={downloading} disabled={!canDownload} title={canDownload ? "Save as PDF" : editing ? "Finish editing first" : "Fix or check flagged lines first"}>
              Download PDF
            </Button>
          </div>
          )}
        </div>
      </div>
      <div className="mx-auto flex max-w-[1440px] flex-col gap-6 px-4 py-7 md:px-8 xl:flex-row">
        <aside className="no-print order-3 flex shrink-0 flex-col gap-4 xl:order-none xl:w-[240px]">
          <div className="flex flex-col gap-3 rounded-[22px] bg-white p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">Template</h2>
              <span className="text-[13px] text-muted">{spec.name}</span>
            </div>
            <button type="button" onClick={() => setPickerOpen(true)} className="mx-auto w-[120px] transition hover:-translate-y-0.5" aria-label="Change template">
              <TemplateThumb spec={spec} photo={profile.basics.photo} />
            </button>
            <Button variant="secondary" size="sm" onClick={() => setPickerOpen(true)}>
              Change template
            </Button>
            {spec.photo && !profile.basics.photo && (
              <Link to="/profile#basics" className="text-[13px] leading-snug text-brand">
                Add a profile photo for this template ›
              </Link>
            )}
          </div>
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
          {(app.versions?.length ?? 0) > 0 && (
            <div className="flex flex-col gap-2.5 rounded-[22px] bg-white p-5">
              <h2 className="text-sm font-semibold">Saved versions · {app.versions!.length}</h2>
              <ul className="flex max-h-[320px] flex-col gap-2 overflow-y-auto">
                {app.versions!.map((v) => (
                  <li key={v.id} className="flex items-start justify-between gap-2 rounded-xl bg-surface px-3 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-medium" title={v.name}>
                        {v.name}
                      </p>
                      <p className="text-xs text-muted">
                        {VERSION_LABEL[v.kind]} · {formatWhen(v.createdAt)}
                      </p>
                    </div>
                    <button type="button" className="shrink-0 text-[13px] text-brand disabled:text-muted" disabled={editing || Boolean(busy)} onClick={() => openVersion(v)}>
                      Open
                    </button>
                  </li>
                ))}
              </ul>
              <p className="text-[13px] leading-snug text-muted">Every generated, edited and downloaded resume is kept here.</p>
            </div>
          )}
          <p className="rounded-[22px] bg-white p-5 text-[13px] leading-snug text-muted">
            {editing
              ? "Edit any part of the resume. When you’re done, changed lines are checked against your profile before you can download."
              : "Use Edit resume to change anything, or click a single line to edit it. Edited lines are checked again before download."}
          </p>
        </aside>
        <main className="order-1 min-w-0 flex-1 xl:order-none">
          {editing && (
            <p className="no-print mx-auto mb-3 max-w-[640px] rounded-2xl bg-brand-soft px-4 py-3 text-sm text-brand-ink">
              You’re editing. Change any text, add or remove lines, then press <b>Done editing</b> to check it and unlock the download.
            </p>
          )}
          <ResumePreview
            resume={resume}
            profile={profile}
            hidden={app.hiddenSections}
            verifications={app.verifications}
            editing={editing}
            spec={spec}
            onEditBullet={editBullet}
            onChange={changeResume}
          />
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
      {pickerOpen && (
        <TemplatePicker
          value={spec.id}
          photo={profile.basics.photo}
          onPick={(template) => {
            updateApplication(app.id, { template });
            setPickerOpen(false);
            toast(`${templateFor(template).name} template applied`);
          }}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </div>
  );
}

export default function ResumePage() {
  return <FlowPage step="resume">{(app) => <ResumeStep key={app.id} app={app} />}</FlowPage>;
}
