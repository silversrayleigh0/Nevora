import { useState } from "react";
import type { Profile, TailoredBullet, TailoredResume, ToggleSection, Verification } from "../../../shared/types";
import { Placeholders } from "../../components/ui";
import { contactLine, SECTION_TITLES } from "../../lib/pdf";

const SectionTitle = ({ children }: { children: string }) => (
  <h3 className="mb-1.5 border-b border-hair pb-[3px] text-[11px] font-bold tracking-[0.08em]">{children}</h3>
);

const MARK = "rounded-[3px] bg-metric px-1 text-inherit print:bg-transparent";

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

export default function ResumePreview({
  resume,
  profile,
  hidden,
  verifications,
  onEditBullet,
}: {
  resume: TailoredResume;
  profile: Profile;
  hidden: ToggleSection[];
  verifications: Verification[] | null;
  onEditBullet: (id: string, text: string) => void;
}) {
  const show = (key: ToggleSection) => !hidden.includes(key);
  const flagFor = (id: string) => verifications?.find((v) => v.bulletId === id);
  return (
    <article
      id="resume-print"
      aria-label="Resume preview"
      className="mx-auto flex w-full max-w-[640px] flex-col gap-3.5 rounded-md bg-white px-8 py-10 text-[11.5px] leading-normal text-ink shadow-[0_12px_40px_rgba(0,0,0,0.08)] sm:px-[52px] sm:py-12 print:max-w-none print:px-[18mm] print:py-[16mm]"
      style={{ fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif", minHeight: 905 }}
    >
      <header>
        <h2 className="text-2xl font-bold tracking-[-0.01em]">{profile.basics.name || "Your name"}</h2>
        <p className="mt-[3px] text-[#515154]">{contactLine(profile, " · ")}</p>
      </header>
      {show("summary") && resume.summary && (
        <section>
          <SectionTitle>SUMMARY</SectionTitle>
          <p>
            <Placeholders text={resume.summary} className={MARK} />
          </p>
        </section>
      )}
      {show("skills") && resume.skills.some((g) => g.items.length) && (
        <section>
          <SectionTitle>SKILLS</SectionTitle>
          {resume.skills
            .filter((g) => g.items.length)
            .map((g) => (
              <p key={g.category}>
                <b>{g.category}:</b> {g.items.join(", ")}
              </p>
            ))}
        </section>
      )}
      {resume.sections
        .filter((s) => show(s.key) && s.items.length)
        .map((s) => (
          <section key={s.key}>
            <SectionTitle>{SECTION_TITLES[s.key]}</SectionTitle>
            <div className="flex flex-col gap-1.5">
              {s.items.map((item) => (
                <div key={item.refId || item.heading}>
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
              ))}
            </div>
          </section>
        ))}
    </article>
  );
}
