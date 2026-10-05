import { useState } from "react";
import type { Profile, ResumeItem, TailoredBullet, TailoredResume, ToggleSection, Verification } from "../../../shared/types";
import { CloseIcon } from "../../components/icons";
import { Placeholders } from "../../components/ui";
import { contactLine, SECTION_TITLES } from "../../lib/pdf";
import { templateFor, type TemplateSpec } from "../../lib/templates";
import { newId } from "../../store/app";

function SectionTitle({ children, spec }: { children: string; spec: TemplateSpec }) {
  const color = spec.accent === "#1d1d1f" ? undefined : spec.accent;
  const border = spec.heading === "accent" ? { borderBottom: `1.5px solid ${spec.accent}` } : spec.heading === "rule" ? { borderBottom: "1px solid #d2d2d7" } : {};
  return (
    <h3 className="mb-1.5 pb-[3px] text-[11px] font-bold tracking-[0.08em]" style={{ color, ...border }}>
      {children}
    </h3>
  );
}

function Photo({ src, spec, size }: { src?: string; spec: TemplateSpec; size: number }) {
  const radius = spec.photoShape === "circle" ? "9999px" : "12%";
  if (!src)
    return (
      <div
        className="flex shrink-0 items-center justify-center bg-[#f2f2f5] text-center text-[9px] leading-tight text-[#8e8e93] print:hidden"
        style={{ width: size, height: size, borderRadius: radius }}
      >
        Add a photo in your profile
      </div>
    );
  return <img src={src} alt="" className="shrink-0 object-cover" style={{ width: size, height: size, borderRadius: radius }} />;
}

const MARK = "rounded-[3px] bg-metric px-1 text-inherit print:bg-transparent";

/** Resume-styled input used in edit mode, so editing looks like the page itself. */
const FIELD = "min-w-0 rounded-md border border-line bg-brand-soft/30 px-2 py-1 font-[inherit] leading-normal outline-none focus:border-brand focus:bg-white";

/** Fields fill their row unless a fixed width (w-…) is given. */
function Field({ value, onChange, label, className = "", multiline }: { value: string; onChange: (v: string) => void; label: string; className?: string; multiline?: boolean }) {
  const width = /(^|\s)w-/.test(className) ? "" : "w-full flex-1";
  return multiline ? (
    <textarea aria-label={label} rows={2} value={value} onChange={(e) => onChange(e.target.value)} className={`${FIELD} ${width} resize-y ${className}`} />
  ) : (
    <input aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} className={`${FIELD} ${width} ${className}`} />
  );
}

const IconButton = ({ label, onClick }: { label: string; onClick: () => void }) => (
  <button type="button" aria-label={label} title={label} onClick={onClick} className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-muted hover:bg-surface hover:text-ink">
    <CloseIcon size={12} />
  </button>
);

/** Click-to-edit line used outside edit mode. */
function Line({ bullet, flag, onEdit }: { bullet: TailoredBullet; flag?: Verification; onEdit: (text: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(bullet.text);
  if (editing)
    return (
      <li className="no-print list-none">
        <label htmlFor={`edit-${bullet.id}`} className="sr-only">
          Edit line
        </label>
        <textarea
          id={`edit-${bullet.id}`}
          autoFocus
          rows={2}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            setEditing(false);
            if (draft.trim() && draft !== bullet.text) onEdit(draft.trim());
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              (e.target as HTMLTextAreaElement).blur();
            }
            if (e.key === "Escape") {
              setDraft(bullet.text);
              setEditing(false);
            }
          }}
          className="w-full rounded-md border border-brand bg-brand-soft/40 px-2 py-1 font-[inherit] text-[11.5px] leading-normal outline-none"
        />
      </li>
    );
  const flagged = flag && !flag.supported;
  return (
    <li className="ml-3.5 list-disc">
      <button
        type="button"
        onClick={() => {
          setDraft(bullet.text);
          setEditing(true);
        }}
        title="Click to edit"
        className={`block w-full rounded-[3px] px-0.5 text-left transition hover:bg-surface print:hover:bg-transparent ${
          flagged ? "bg-bad-soft text-[#9A0015] print:bg-transparent print:text-inherit" : ""
        }`}
      >
        <Placeholders text={bullet.text} className={MARK} />
      </button>
    </li>
  );
}

export const resumeHeader = (resume: TailoredResume, profile: Profile) => ({
  name: resume.header?.name ?? profile.basics.name,
  contact: resume.header?.contact ?? contactLine(profile, " · "),
});

type Props = {
  resume: TailoredResume;
  profile: Profile;
  hidden: ToggleSection[];
  verifications: Verification[] | null;
  editing: boolean;
  spec?: TemplateSpec;
  onEditBullet: (id: string, text: string) => void;
  /** Edit mode: replace the whole resume. Bullet ids that changed are reported so they can be re-checked. */
  onChange: (next: TailoredResume, changedBulletIds: string[]) => void;
};

export default function ResumePreview({ resume, profile, hidden, verifications, editing, spec = templateFor(), onEditBullet, onChange }: Props) {
  const compact = spec.density === "compact";
  const center = spec.align === "center" || spec.photo === "center";
  const nameColor = spec.accent === "#1d1d1f" ? undefined : spec.accent;
  const show = (key: ToggleSection) => !hidden.includes(key);
  const flagFor = (id: string) => verifications?.find((v) => v.bulletId === id);
  const header = resumeHeader(resume, profile);

  const setItem = (key: string, index: number, patch: Partial<ResumeItem>, changed: string[] = []) =>
    onChange(
      { ...resume, sections: resume.sections.map((s) => (s.key === key ? { ...s, items: s.items.map((it, i) => (i === index ? { ...it, ...patch } : it)) } : s)) },
      changed,
    );
  const setBullet = (key: string, index: number, item: ResumeItem, id: string, text: string) =>
    setItem(key, index, { bullets: item.bullets.map((b) => (b.id === id ? { ...b, text, needsMetric: /\[/.test(text) } : b)) }, [id]);
  const addBullet = (key: string, index: number, item: ResumeItem) => {
    // A new line is checked against everything in the project or job it sits under.
    const bullet: TailoredBullet = { id: newId("t"), text: "", sourceIds: item.refId ? [item.refId] : [], originalText: "", changeReason: "Added by you.", needsMetric: false };
    setItem(key, index, { bullets: [...item.bullets, bullet] }, [bullet.id]);
  };
  const setSkills = (skills: TailoredResume["skills"]) => onChange({ ...resume, skills }, []);

  return (
    <article
      id="resume-print"
      aria-label="Resume preview"
      className={`paper mx-auto flex w-full max-w-[640px] flex-col overflow-hidden rounded-md bg-white px-8 py-10 leading-normal text-ink shadow-[0_12px_40px_rgba(0,0,0,0.08)] sm:px-[52px] sm:py-12 print:max-w-none print:px-[18mm] print:py-[16mm] ${
        compact ? "gap-2.5 text-[11px]" : "gap-3.5 text-[11.5px]"
      } ${editing ? "ring-2 ring-brand/40" : ""}`}
      style={{ fontFamily: spec.font === "serif" ? "Georgia, 'Times New Roman', Times, serif" : "'Helvetica Neue', Helvetica, Arial, sans-serif", minHeight: 905 }}
    >
      <header
        className={`flex gap-4 ${spec.photo === "center" ? "flex-col items-center" : spec.photo === "right" ? "flex-row-reverse items-center" : "items-center"} ${
          spec.band ? "-mx-8 -mt-10 px-8 pb-5 pt-10 sm:-mx-[52px] sm:-mt-12 sm:px-[52px] sm:pt-12" : ""
        }`}
        style={spec.band ? { background: spec.band } : undefined}
      >
        {spec.photo && <Photo src={profile.basics.photo} spec={spec} size={spec.photo === "center" ? 84 : 76} />}
        <div className={`flex min-w-0 flex-1 flex-col gap-1 ${center ? "items-center text-center" : ""} ${spec.photo === "center" ? "w-full" : ""}`}>
          {editing ? (
            <>
              <Field label="Name" value={header.name} onChange={(name) => onChange({ ...resume, header: { ...header, name } }, [])} className={`text-2xl font-bold ${center ? "text-center" : ""}`} />
              <Field label="Contact line" value={header.contact} onChange={(contact) => onChange({ ...resume, header: { ...header, contact } }, [])} className={`text-[#515154] ${center ? "text-center" : ""}`} />
            </>
          ) : (
            <>
              <h2 className={`${compact ? "text-[22px]" : "text-2xl"} font-bold tracking-[-0.01em]`} style={{ color: nameColor }}>
                {header.name || "Your name"}
              </h2>
              <p className="text-[#515154]">{header.contact}</p>
            </>
          )}
        </div>
      </header>

      {show("summary") && (resume.summary || editing) && (
        <section>
          <SectionTitle spec={spec}>SUMMARY</SectionTitle>
          {editing ? (
            <Field label="Summary" multiline value={resume.summary} onChange={(summary) => onChange({ ...resume, summary }, [])} />
          ) : (
            <p>
              <Placeholders text={resume.summary} className={MARK} />
            </p>
          )}
        </section>
      )}

      {show("skills") && (resume.skills.some((g) => g.items.length) || editing) && (
        <section>
          <SectionTitle spec={spec}>SKILLS</SectionTitle>
          {editing ? (
            <div className="flex flex-col gap-1.5">
              {resume.skills.map((g, i) => (
                <div key={i} className="flex items-start gap-1.5">
                  <Field
                    label="Skill group"
                    value={g.category}
                    onChange={(category) => setSkills(resume.skills.map((x, j) => (j === i ? { ...x, category } : x)))}
                    className="w-32 shrink-0 font-bold"
                  />
                  <Field
                    label={`${g.category || "Skill"} items, separated by commas`}
                    value={g.items.join(", ")}
                    onChange={(v) => setSkills(resume.skills.map((x, j) => (j === i ? { ...x, items: v.split(",").map((t) => t.trimStart()) } : x)))}
                  />
                  <IconButton label={`Remove ${g.category || "skill group"}`} onClick={() => setSkills(resume.skills.filter((_, j) => j !== i))} />
                </div>
              ))}
              <button type="button" className="self-start text-[11px] text-brand" onClick={() => setSkills([...resume.skills, { category: "Other", items: [] }])}>
                + Add skill group
              </button>
            </div>
          ) : (
            resume.skills
              .filter((g) => g.items.filter(Boolean).length)
              .map((g) => (
                <p key={g.category}>
                  <b>{g.category}:</b> {g.items.filter(Boolean).join(", ")}
                </p>
              ))
          )}
        </section>
      )}

      {resume.sections
        .filter((s) => show(s.key) && s.items.length)
        .map((s) => (
          <section key={s.key}>
            <SectionTitle spec={spec}>{SECTION_TITLES[s.key]}</SectionTitle>
            <div className={`flex flex-col ${editing ? "gap-3" : "gap-1.5"}`}>
              {s.items.map((item, index) =>
                editing ? (
                  <div key={item.refId || index} className="flex flex-col gap-1">
                    <div className="flex gap-1.5">
                      <Field label="Heading" value={item.heading} onChange={(heading) => setItem(s.key, index, { heading })} className="font-bold" />
                      <Field label="Dates or details" value={item.meta ?? ""} onChange={(meta) => setItem(s.key, index, { meta })} className="w-40 shrink-0 text-[#515154]" />
                    </div>
                    {(item.subheading !== undefined || s.key === "education") && (
                      <Field label="Details line" value={item.subheading ?? ""} onChange={(subheading) => setItem(s.key, index, { subheading })} />
                    )}
                    {item.bullets.map((b) => (
                      <div key={b.id} className="flex items-start gap-1.5 pl-3">
                        <span aria-hidden="true" className="mt-1">
                          •
                        </span>
                        <Field label="Line" multiline value={b.text} onChange={(text) => setBullet(s.key, index, item, b.id, text)} />
                        <IconButton label="Remove line" onClick={() => setItem(s.key, index, { bullets: item.bullets.filter((x) => x.id !== b.id) }, [])} />
                      </div>
                    ))}
                    {(s.key === "projects" || s.key === "experience") && (
                      <button type="button" className="self-start pl-3 text-[11px] text-brand" onClick={() => addBullet(s.key, index, item)}>
                        + Add a line
                      </button>
                    )}
                  </div>
                ) : (
                  <div key={item.refId || index}>
                    <div className="flex justify-between gap-4">
                      <b>{item.heading}</b>
                      {item.meta && <span className="shrink-0 text-[#515154]">{item.meta}</span>}
                    </div>
                    {item.subheading && <p>{item.subheading}</p>}
                    {item.bullets.length > 0 && (
                      <ul>
                        {item.bullets.map((b) => (
                          <Line key={b.id} bullet={b} flag={flagFor(b.id)} onEdit={(text) => onEditBullet(b.id, text)} />
                        ))}
                      </ul>
                    )}
                  </div>
                ),
              )}
            </div>
          </section>
        ))}
    </article>
  );
}
