import { useRef, useState, type ReactNode } from "react";
import type { Bullet, Profile, SkillCategory } from "../../../shared/types";
import { AwardIcon, CloseIcon, UploadIcon } from "../../components/icons";
import { Button, Chip, TextField } from "../../components/ui";
import { parseCertificate } from "../../lib/ai";
import { newId } from "../../store/app";
import { toast } from "../../store/toast";

type Update = (fn: (p: Profile) => Profile) => void;

function Section({ id, title, subtitle, action, highlight, children }: { id: string; title: string; subtitle?: string; action?: ReactNode; highlight?: boolean; children: ReactNode }) {
  return (
    <section id={id} className={`scroll-mt-24 rounded-[22px] p-7 ${highlight ? "border-2 border-brand" : "border border-line"}`}>
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold tracking-[-0.01em]">{title}</h2>
          {subtitle && <p className="mt-1 text-[15px] text-muted">{subtitle}</p>}
        </div>
        {action}
      </div>
      <div className="flex flex-col gap-5">{children}</div>
    </section>
  );
}

const AddLink = ({ onClick, children }: { onClick: () => void; children: string }) => (
  <button type="button" onClick={onClick} className="shrink-0 text-[15px] text-brand hover:text-brand-hover">
    + {children}
  </button>
);

const RemoveButton = ({ onClick, label }: { onClick: () => void; label: string }) => (
  <button
    type="button"
    onClick={onClick}
    aria-label={label}
    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted hover:bg-surface hover:text-ink"
  >
    <CloseIcon />
  </button>
);

function Bullets({ bullets, parent, onChange }: { bullets: Bullet[]; parent: string; onChange: (b: Bullet[]) => void }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium">What you did</span>
      {bullets.map((b, i) => (
        <div key={b.id} className="flex items-start gap-2">
          <label htmlFor={b.id} className="sr-only">
            Bullet {i + 1}
          </label>
          <textarea
            id={b.id}
            rows={2}
            className="input"
            value={b.text}
            onChange={(e) => onChange(bullets.map((x) => (x.id === b.id ? { ...x, text: e.target.value } : x)))}
          />
          <RemoveButton label={`Remove bullet ${i + 1}`} onClick={() => onChange(bullets.filter((x) => x.id !== b.id))} />
        </div>
      ))}
      <button
        type="button"
        className="self-start text-sm text-brand hover:text-brand-hover"
        onClick={() => onChange([...bullets, { id: newId(`${parent}_b`), text: "" }])}
      >
        + Add a bullet
      </button>
    </div>
  );
}

function ImpactHint({ bullets }: { bullets: Bullet[] }) {
  if (!bullets.length || bullets.some((b) => /\d/.test(b.text))) return null;
  return <p className="rounded-[14px] bg-warn-soft px-4 py-3 text-sm text-warn">Add the result or impact. Numbers help recruiters — users, speed, accuracy, team size.</p>;
}

const CATEGORIES: { id: SkillCategory; label: string }[] = [
  { id: "language", label: "Languages" },
  { id: "framework", label: "Frameworks" },
  { id: "tool", label: "Tools" },
  { id: "concept", label: "Concepts" },
  { id: "soft", label: "Soft skills" },
];

function Skills({ profile, update }: { profile: Profile; update: Update }) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState<SkillCategory>("tool");
  const add = () => {
    const value = name.trim();
    if (!value || profile.skills.some((s) => s.name.toLowerCase() === value.toLowerCase())) return setName("");
    update((p) => ({ ...p, skills: [...p.skills, { id: newId("skill"), name: value, category }] }));
    setName("");
  };
  return (
    <Section id="skills" title={`Skills · ${profile.skills.length}`}>
      {CATEGORIES.map((c) => {
        const items = profile.skills.filter((s) => s.category === c.id);
        if (!items.length) return null;
        return (
          <div key={c.id} className="flex flex-col gap-2 sm:flex-row sm:items-baseline sm:gap-4">
            <span className="w-28 shrink-0 text-sm text-muted">{c.label}</span>
            <div className="flex flex-wrap gap-2">
              {items.map((s) => (
                <Chip key={s.id} onRemove={() => update((p) => ({ ...p, skills: p.skills.filter((x) => x.id !== s.id) }))}>
                  {s.name}
                </Chip>
              ))}
            </div>
          </div>
        );
      })}
      <div className="flex flex-col gap-2 sm:flex-row">
        <label htmlFor="add-skill" className="sr-only">
          Add a skill
        </label>
        <input
          id="add-skill"
          className="input"
          placeholder="Add a skill, e.g. Tailwind CSS"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
        />
        <label htmlFor="skill-cat" className="sr-only">
          Category
        </label>
        <select id="skill-cat" className="input sm:w-44" value={category} onChange={(e) => setCategory(e.target.value as SkillCategory)}>
          {CATEGORIES.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
        <Button variant="dark" onClick={add} className="h-[52px] shrink-0">
          Add
        </Button>
      </div>
    </Section>
  );
}

const EMPTY_CERT = { name: "", issuer: "", date: "", credential: "" };

function Certifications({ profile, update }: { profile: Profile; update: Update }) {
  const [draft, setDraft] = useState(EMPTY_CERT);
  const [reading, setReading] = useState(false);
  const [message, setMessage] = useState("");
  const file = useRef<HTMLInputElement>(null);
  const save = () => {
    if (!draft.name.trim()) return setMessage("Add the certificate name.");
    update((p) => ({ ...p, certifications: [...p.certifications, { ...draft, name: draft.name.trim(), id: newId("cert") }] }));
    toast(`Added ${draft.name.trim()}`);
    setDraft(EMPTY_CERT);
    setMessage("");
  };
  const read = async (f?: File) => {
    if (!f) return;
    setReading(true);
    setMessage("");
    try {
      setDraft({ ...EMPTY_CERT, ...(await parseCertificate(f)) });
      setMessage("We filled in the details from your certificate. Check them, then save.");
    } catch (err) {
      setMessage((err as Error).message);
    } finally {
      setReading(false);
      if (file.current) file.current.value = "";
    }
  };
  return (
    <Section id="certifications" highlight={!profile.certifications.length} title="Certifications" subtitle="Certificates strengthen your profile for specific roles. Add any you’ve earned.">
      {profile.certifications.map((c) => (
        <div key={c.id} className="flex items-center gap-3.5 rounded-2xl bg-surface px-4 py-4">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-brand">
            <AwardIcon />
          </span>
          <div className="min-w-0 flex-1">
            <div className="font-semibold">{c.name}</div>
            <div className="mt-0.5 text-sm text-muted">{[c.issuer, c.date, c.credential ? "Credential linked" : ""].filter(Boolean).join(" · ")}</div>
          </div>
          <RemoveButton label={`Remove ${c.name}`} onClick={() => update((p) => ({ ...p, certifications: p.certifications.filter((x) => x.id !== c.id) }))} />
        </div>
      ))}
      <h3 className="text-[15px] font-semibold">Add a certification</h3>
      <div className="grid gap-3.5 sm:grid-cols-2">
        <TextField label="Certificate name" placeholder="e.g. Meta Front-End Developer" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
        <TextField label="Issuing organization" placeholder="e.g. Coursera" value={draft.issuer} onChange={(e) => setDraft({ ...draft, issuer: e.target.value })} />
        <TextField label="Issue date" placeholder="Month and year" value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} />
        <TextField label="Credential ID or link" optional placeholder="https://" value={draft.credential} onChange={(e) => setDraft({ ...draft, credential: e.target.value })} />
      </div>
      <div className="flex items-center gap-3.5 rounded-2xl border-[1.5px] border-dashed border-[#C7C7CC] p-4">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-soft text-brand">
          <UploadIcon size={18} />
        </span>
        <div className="flex-1">
          <div className="text-[15px] font-medium">Or upload the certificate</div>
          <div className="mt-0.5 text-sm text-muted">PDF or image. We’ll fill in the details for you.</div>
        </div>
        <input ref={file} type="file" accept="application/pdf,image/png,image/jpeg,image/webp" className="sr-only" id="cert-file" onChange={(e) => read(e.target.files?.[0])} />
        <Button variant="secondary" size="sm" loading={reading} onClick={() => file.current?.click()}>
          Upload
        </Button>
      </div>
      {message && (
        <p role="status" className="text-sm text-muted">
          {message}
        </p>
      )}
      <div className="flex justify-end">
        <Button variant="dark" onClick={save}>
          Save certification
        </Button>
      </div>
    </Section>
  );
}

const findLink = (links: string[], re: RegExp) => links.find((l) => re.test(l)) ?? "";

export default function ProfileEditor({ profile, onChange }: { profile: Profile; onChange: (p: Profile) => void }) {
  const update: Update = (fn) => onChange(fn(profile));
  const remove = (label: string, fn: (p: Profile) => Profile) => {
    const before = profile;
    onChange(fn(profile));
    toast(`Removed ${label}`, { label: "Undo", run: () => onChange(before) });
  };
  const b = profile.basics;
  const setBasics = (patch: Partial<Profile["basics"]>) => update((p) => ({ ...p, basics: { ...p.basics, ...patch } }));
  const setLink = (re: RegExp, value: string) => setBasics({ links: [...b.links.filter((l) => !re.test(l)), value].filter(Boolean) });
  const otherLinks = b.links.filter((l) => !/linkedin|github/i.test(l));

  return (
    <div className="flex flex-col gap-4">
      <Section id="basics" title="Basics">
        <div className="grid gap-3.5 sm:grid-cols-2">
          <TextField label="Full name" value={b.name} onChange={(e) => setBasics({ name: e.target.value })} />
          <TextField label="Email" type="email" value={b.email} onChange={(e) => setBasics({ email: e.target.value })} />
          <TextField label="Phone" value={b.phone} onChange={(e) => setBasics({ phone: e.target.value })} />
          <TextField label="City" value={b.location} onChange={(e) => setBasics({ location: e.target.value })} />
        </div>
      </Section>

      <Section
        id="education"
        title="Education"
        action={
          <AddLink onClick={() => update((p) => ({ ...p, education: [...p.education, { id: newId("edu"), institution: "", degree: "", field: "", start: "", end: "", score: "" }] }))}>
            Add
          </AddLink>
        }
      >
        {!profile.education.length && <p className="text-muted">Add your college and degree.</p>}
        {profile.education.map((e) => {
          const set = (patch: Partial<Profile["education"][number]>) =>
            update((p) => ({ ...p, education: p.education.map((x) => (x.id === e.id ? { ...x, ...patch } : x)) }));
          return (
            <div key={e.id} className="flex items-start gap-2">
              <div className="grid flex-1 gap-3.5 sm:grid-cols-2">
                <TextField id={`${e.id}-inst`} label="College" value={e.institution} onChange={(ev) => set({ institution: ev.target.value })} />
                <TextField id={`${e.id}-deg`} label="Degree" placeholder="e.g. B.Tech" value={e.degree} onChange={(ev) => set({ degree: ev.target.value })} />
                <TextField id={`${e.id}-field`} label="Branch or field" value={e.field} onChange={(ev) => set({ field: ev.target.value })} />
                <TextField id={`${e.id}-score`} label="CGPA or percentage" optional value={e.score} onChange={(ev) => set({ score: ev.target.value })} />
                <TextField id={`${e.id}-start`} label="Start year" value={e.start} onChange={(ev) => set({ start: ev.target.value })} />
                <TextField id={`${e.id}-end`} label="End year" value={e.end} onChange={(ev) => set({ end: ev.target.value })} />
              </div>
              <RemoveButton label="Remove education" onClick={() => remove(e.institution || "education", (p) => ({ ...p, education: p.education.filter((x) => x.id !== e.id) }))} />
            </div>
          );
        })}
      </Section>

      <Section
        id="projects"
        title={`Projects · ${profile.projects.length}`}
        action={
          <AddLink
            onClick={() =>
              update((p) => ({ ...p, projects: [...p.projects, { id: newId("proj"), name: "", tech: [], link: "", bullets: [{ id: newId("proj_b"), text: "" }] }] }))
            }
          >
            Add project
          </AddLink>
        }
      >
        {!profile.projects.length && <p className="text-muted">Projects are the strongest evidence for students. Add at least two.</p>}
        {profile.projects.map((pr, i) => {
          const set = (patch: Partial<Profile["projects"][number]>) =>
            update((p) => ({ ...p, projects: p.projects.map((x) => (x.id === pr.id ? { ...x, ...patch } : x)) }));
          return (
            <div key={pr.id} className={`flex flex-col gap-3.5 ${i ? "border-t border-[#EDEDF0] pt-5" : ""}`}>
              <div className="flex items-start gap-2">
                <div className="grid flex-1 gap-3.5 sm:grid-cols-2">
                  <TextField id={`${pr.id}-name`} label="Project name" value={pr.name} onChange={(e) => set({ name: e.target.value })} />
                  <TextField
                    id={`${pr.id}-tech`}
                    label="Technologies used"
                    placeholder="React, Node.js, MongoDB"
                    value={pr.tech.join(", ")}
                    onChange={(e) => set({ tech: e.target.value.split(",").map((t) => t.trimStart()) })}
                    onBlur={(e) => set({ tech: e.target.value.split(",").map((t) => t.trim()).filter(Boolean) })}
                  />
                  <TextField id={`${pr.id}-link`} className="sm:col-span-2" label="Link" optional placeholder="https://" value={pr.link} onChange={(e) => set({ link: e.target.value })} />
                </div>
                <RemoveButton label={`Remove ${pr.name || "project"}`} onClick={() => remove(pr.name || "project", (p) => ({ ...p, projects: p.projects.filter((x) => x.id !== pr.id) }))} />
              </div>
              <Bullets bullets={pr.bullets} parent={pr.id} onChange={(bullets) => set({ bullets })} />
              <ImpactHint bullets={pr.bullets} />
            </div>
          );
        })}
      </Section>

      <Section
        id="experience"
        title="Experience"
        subtitle="Internships, part-time work, freelance or volunteering."
        action={
          <AddLink
            onClick={() =>
              update((p) => ({ ...p, experience: [...p.experience, { id: newId("exp"), role: "", org: "", start: "", end: "", bullets: [{ id: newId("exp_b"), text: "" }] }] }))
            }
          >
            Add
          </AddLink>
        }
      >
        {!profile.experience.length && <p className="text-muted">No experience yet? That’s fine — strong projects count.</p>}
        {profile.experience.map((ex, i) => {
          const set = (patch: Partial<Profile["experience"][number]>) =>
            update((p) => ({ ...p, experience: p.experience.map((x) => (x.id === ex.id ? { ...x, ...patch } : x)) }));
          return (
            <div key={ex.id} className={`flex flex-col gap-3.5 ${i ? "border-t border-[#EDEDF0] pt-5" : ""}`}>
              <div className="flex items-start gap-2">
                <div className="grid flex-1 gap-3.5 sm:grid-cols-2">
                  <TextField id={`${ex.id}-role`} label="Role" value={ex.role} onChange={(e) => set({ role: e.target.value })} />
                  <TextField id={`${ex.id}-org`} label="Organization" value={ex.org} onChange={(e) => set({ org: e.target.value })} />
                  <TextField id={`${ex.id}-start`} label="Start" placeholder="Jun 2025" value={ex.start} onChange={(e) => set({ start: e.target.value })} />
                  <TextField id={`${ex.id}-end`} label="End" placeholder="Jul 2025 or Present" value={ex.end} onChange={(e) => set({ end: e.target.value })} />
                </div>
                <RemoveButton label={`Remove ${ex.role || "experience"}`} onClick={() => remove(ex.role || "experience", (p) => ({ ...p, experience: p.experience.filter((x) => x.id !== ex.id) }))} />
              </div>
              <Bullets bullets={ex.bullets} parent={ex.id} onChange={(bullets) => set({ bullets })} />
            </div>
          );
        })}
      </Section>

      <Skills profile={profile} update={update} />
      <Certifications profile={profile} update={update} />

      <Section
        id="achievements"
        title="Achievements"
        subtitle="Hackathons, awards, leadership, clubs."
        action={<AddLink onClick={() => update((p) => ({ ...p, achievements: [...p.achievements, { id: newId("ach"), text: "" }] }))}>Add</AddLink>}
      >
        {profile.achievements.map((a, i) => (
          <div key={a.id} className="flex items-center gap-2">
            <label htmlFor={a.id} className="sr-only">
              Achievement {i + 1}
            </label>
            <input
              id={a.id}
              className="input"
              value={a.text}
              onChange={(e) => update((p) => ({ ...p, achievements: p.achievements.map((x) => (x.id === a.id ? { ...x, text: e.target.value } : x)) }))}
            />
            <RemoveButton label={`Remove achievement ${i + 1}`} onClick={() => update((p) => ({ ...p, achievements: p.achievements.filter((x) => x.id !== a.id) }))} />
          </div>
        ))}
      </Section>

      <Section id="links" title="Links">
        <div className="grid gap-3.5 sm:grid-cols-3">
          <TextField label="LinkedIn" placeholder="linkedin.com/in/" value={findLink(b.links, /linkedin/i)} onChange={(e) => setLink(/linkedin/i, e.target.value)} />
          <TextField label="GitHub" placeholder="github.com/" value={findLink(b.links, /github/i)} onChange={(e) => setLink(/github/i, e.target.value)} />
          <TextField
            label="Portfolio"
            placeholder="https://"
            value={otherLinks[0] ?? ""}
            onChange={(e) => setBasics({ links: [...b.links.filter((l) => /linkedin|github/i.test(l)), e.target.value].filter(Boolean) })}
          />
        </div>
      </Section>
    </div>
  );
}

export const PROFILE_SECTIONS = [
  ["basics", "Basics"],
  ["education", "Education"],
  ["projects", "Projects"],
  ["experience", "Experience"],
  ["skills", "Skills"],
  ["certifications", "Certifications"],
  ["achievements", "Achievements"],
  ["links", "Links"],
] as const;

export function sectionStatus(p: Profile, key: (typeof PROFILE_SECTIONS)[number][0]): "done" | "attention" | "empty" {
  switch (key) {
    case "basics":
      return p.basics.name && p.basics.email ? "done" : "attention";
    case "education":
      return p.education.length ? "done" : "attention";
    case "projects":
      return p.projects.length && !p.projects.some((x) => x.bullets.length && !x.bullets.some((b) => /\d/.test(b.text))) ? "done" : "attention";
    case "experience":
      return p.experience.length ? "done" : "empty";
    case "skills":
      return p.skills.length >= 3 ? "done" : "attention";
    case "certifications":
      return p.certifications.length ? "done" : "attention";
    case "achievements":
      return p.achievements.length ? "done" : "empty";
    case "links":
      return p.basics.links.length ? "done" : "empty";
  }
}
