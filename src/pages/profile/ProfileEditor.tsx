import { useRef, useState, type ReactNode } from "react";
import type { Bullet, Profile, Proof, ProofCheck, SkillCategory } from "../../../shared/types";
import { Dropdown } from "../../components/Dropdown";
import { MonthYearField, SelectField, SkillPicker, YearField } from "../../components/form";
import { AwardIcon, CheckIcon, CloseIcon, ShieldIcon, UploadIcon } from "../../components/icons";
import { Button, Chip, TextField } from "../../components/ui";
import { verifyDocument, type ProofKind } from "../../lib/ai";
import { PROOF_ACCEPT } from "../../lib/extract";
import { BRANCHES, categorize, DEGREES } from "../../lib/options";
import { profilePhoto } from "../../lib/templates";
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
  const [category, setCategory] = useState<SkillCategory>("tool");
  const add = (name: string, known?: SkillCategory) => {
    const value = name.trim();
    if (!value || profile.skills.some((s) => s.name.toLowerCase() === value.toLowerCase())) return;
    update((p) => ({ ...p, skills: [...p.skills, { id: newId("skill"), name: value, category: known ?? category }] }));
  };
  return (
    <Section id="skills" title={`Skills · ${profile.skills.length}`} subtitle="Pick from the list, or type a skill that isn’t there.">
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
        <SkillPicker taken={profile.skills.map((s) => s.name)} onPick={(name, known) => add(name, known ?? (categorize(name) !== "tool" ? categorize(name) : undefined))} />
        <label htmlFor="skill-cat" className="sr-only">
          Category for new skills you type
        </label>
        <Dropdown
          id="skill-cat"
          ariaLabel="Category for skills you type yourself"
          className="sm:w-44"
          value={category}
          options={CATEGORIES.map((c) => ({ value: c.id, label: c.label }))}
          onChange={(v) => setCategory(v as SkillCategory)}
        />
      </div>
    </Section>
  );
}

/** Upload a document and show whether it checked out. */
function ProofRow({
  proof,
  label,
  hint,
  kind,
  expected,
  onChecked,
}: {
  proof?: Proof;
  label: string;
  hint: string;
  kind: ProofKind;
  expected: () => { name: string; org?: string; role?: string; start?: string; end?: string };
  onChecked: (check: ProofCheck, proof: Proof) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const upload = async (file?: File) => {
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      const check = await verifyDocument(file, kind, expected());
      const result: Proof = {
        status: check.verdict === "verified" ? "verified" : "rejected",
        reason: [check.reason, ...check.concerns].filter(Boolean).join(" "),
        fileName: file.name,
        checkedAt: Date.now(),
        documentType: check.documentType,
      };
      onChecked(check, result);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };
  const verified = proof?.status === "verified";
  return (
    <div className={`flex flex-col gap-2 rounded-2xl p-4 ${verified ? "bg-ok-soft" : proof ? "bg-warn-soft" : "border-[1.5px] border-dashed border-[#C7C7CC]"}`}>
      <div className="flex items-center gap-3.5">
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${verified ? "bg-white text-ok" : "bg-brand-soft text-brand"}`}>
          {verified ? <ShieldIcon size={20} /> : <UploadIcon size={18} />}
        </span>
        <div className="min-w-0 flex-1">
          <div className={`text-[15px] font-medium ${verified ? "text-ok" : proof ? "text-warn" : ""}`}>
            {verified ? `Verified${proof?.documentType ? ` · ${proof.documentType}` : ""}` : proof ? "Couldn’t verify" : label}
          </div>
          <div className="mt-0.5 text-sm text-muted">{proof ? proof.reason || proof.fileName : hint}</div>
        </div>
        <input ref={input} type="file" accept={PROOF_ACCEPT} className="sr-only" onChange={(e) => upload(e.target.files?.[0])} aria-label={label} />
        <Button variant="secondary" size="sm" loading={busy} onClick={() => input.current?.click()}>
          {busy ? "Checking" : proof ? "Replace" : "Upload"}
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-bad">
          {error}
        </p>
      )}
    </div>
  );
}

function Certifications({ profile, update }: { profile: Profile; update: Update }) {
  const verified = profile.certifications.filter((c) => c.proof?.status === "verified").length;
  const addFromCheck = (check: ProofCheck, proof: Proof, existingId?: string) => {
    if (proof.status !== "verified") {
      if (existingId) update((p) => ({ ...p, certifications: p.certifications.map((c) => (c.id === existingId ? { ...c, proof } : c)) }));
      else toast("That certificate couldn’t be verified, so it wasn’t added.");
      return;
    }
    const details = { name: check.title || check.documentType, issuer: check.issuer, date: check.date, credential: "" };
    update((p) => {
      const match = existingId ?? p.certifications.find((c) => c.name.toLowerCase() === details.name.toLowerCase())?.id;
      return match
        ? { ...p, certifications: p.certifications.map((c) => (c.id === match ? { ...c, ...details, proof } : c)) }
        : { ...p, certifications: [...p.certifications, { id: newId("cert"), ...details, proof }] };
    });
    toast(`Verified ${details.name}`);
  };
  const [lastRejected, setLastRejected] = useState<Proof | undefined>();
  return (
    <Section
      id="certifications"
      highlight={!verified}
      title="Certifications"
      subtitle="Upload a photo, scan or PDF of each certificate. Nevora reads it, checks it’s issued to you, and adds it. Only verified certificates appear on your resumes."
    >
      {profile.certifications.map((c) => {
        const ok = c.proof?.status === "verified";
        return (
          <div key={c.id} className="flex flex-col gap-3 rounded-2xl bg-surface px-4 py-4">
            <div className="flex items-center gap-3.5">
              <span className={`flex h-10 w-10 items-center justify-center rounded-xl bg-white ${ok ? "text-ok" : "text-brand"}`}>{ok ? <CheckIcon size={18} /> : <AwardIcon />}</span>
              <div className="min-w-0 flex-1">
                <div className="font-semibold">{c.name}</div>
                <div className="mt-0.5 text-sm text-muted">
                  {[c.issuer, c.date].filter(Boolean).join(" · ")}
                  {ok ? <span className="text-ok"> · Verified</span> : <span className="text-warn"> · Not verified — hidden from resumes</span>}
                </div>
              </div>
              <RemoveButton label={`Remove ${c.name}`} onClick={() => update((p) => ({ ...p, certifications: p.certifications.filter((x) => x.id !== c.id) }))} />
            </div>
            {!ok && (
              <ProofRow
                proof={c.proof}
                kind="certificate"
                label="Verify this certificate"
                hint="Upload the certificate to show it on your resumes."
                expected={() => ({ name: profile.basics.name })}
                onChecked={(check, proof) => addFromCheck(check, proof, c.id)}
              />
            )}
          </div>
        );
      })}
      <ProofRow
        proof={lastRejected}
        kind="certificate"
        label="Upload a certificate"
        hint="PNG, JPG or PDF. We’ll read the name, issuer and date for you."
        expected={() => ({ name: profile.basics.name })}
        onChecked={(check, proof) => {
          setLastRejected(proof.status === "verified" ? undefined : proof);
          addFromCheck(check, proof);
        }}
      />
    </Section>
  );
}

function PhotoField({ photo, onChange }: { photo?: string; onChange: (photo: string | undefined) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");
  const pick = async (file?: File) => {
    if (!file) return;
    setError("");
    try {
      onChange(await profilePhoto(file));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      if (input.current) input.current.value = "";
    }
  };
  return (
    <div className="flex items-center gap-4 rounded-2xl bg-surface p-4">
      {photo ? (
        <img src={photo} alt="Your profile photo" className="h-16 w-16 shrink-0 rounded-full object-cover" />
      ) : (
        <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-white text-muted">
          <UploadIcon size={20} />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <div className="text-[15px] font-medium">Profile photo <span className="font-normal text-muted">(optional)</span></div>
        <div className="mt-0.5 text-sm text-muted">Only used by the photo templates. A clear, front-facing headshot works best.</div>
        {error && (
          <p role="alert" className="mt-1 text-sm text-bad">
            {error}
          </p>
        )}
      </div>
      <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" aria-label="Upload a profile photo" onChange={(e) => pick(e.target.files?.[0])} />
      <div className="flex shrink-0 flex-col gap-1.5 sm:flex-row">
        <Button variant="secondary" size="sm" onClick={() => input.current?.click()}>
          {photo ? "Change" : "Upload"}
        </Button>
        {photo && (
          <Button variant="ghost" size="sm" onClick={() => onChange(undefined)}>
            Remove
          </Button>
        )}
      </div>
    </div>
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
        <PhotoField
          photo={b.photo}
          onChange={(photo) =>
            update((p) => {
              const basics = { ...p.basics };
              if (photo) basics.photo = photo;
              else delete basics.photo;
              return { ...p, basics };
            })
          }
        />
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
                <SelectField id={`${e.id}-deg`} label="Degree" placeholder="Select degree" options={DEGREES} value={e.degree} onChange={(v) => set({ degree: v })} />
                <SelectField id={`${e.id}-field`} label="Branch or field" placeholder="Select branch" options={BRANCHES} value={e.field} onChange={(v) => set({ field: v })} />
                <TextField id={`${e.id}-score`} label="CGPA or percentage" optional placeholder="e.g. CGPA 8.4 or 82%" value={e.score} onChange={(ev) => set({ score: ev.target.value })} />
                <div className="grid grid-cols-2 gap-3.5">
                  <YearField id={`${e.id}-start`} label="Start year" value={e.start} onChange={(v) => set({ start: v })} />
                  <YearField id={`${e.id}-end`} label="End year" value={e.end} onChange={(v) => set({ end: v })} />
                </div>
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
        subtitle="Internships, part-time work, freelance or volunteering. Add proof so recruiters can trust it."
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
          // Changing what the proof vouches for clears the old check.
          const set = (patch: Partial<Profile["experience"][number]>) =>
            update((p) => ({
              ...p,
              experience: p.experience.map((x) => {
                if (x.id !== ex.id) return x;
                const next = { ...x, ...patch };
                const claimChanged = ["role", "org", "start", "end"].some((k) => k in patch && patch[k as keyof typeof patch] !== x[k as keyof typeof x]);
                if (claimChanged && next.proof) delete next.proof;
                return next;
              }),
            }));
          return (
            <div key={ex.id} className={`flex flex-col gap-3.5 ${i ? "border-t border-[#EDEDF0] pt-5" : ""}`}>
              <div className="flex items-start gap-2">
                <div className="grid flex-1 gap-3.5 sm:grid-cols-2">
                  <TextField id={`${ex.id}-role`} label="Role" value={ex.role} onChange={(e) => set({ role: e.target.value })} />
                  <TextField id={`${ex.id}-org`} label="Organization" value={ex.org} onChange={(e) => set({ org: e.target.value })} />
                  <MonthYearField id={`${ex.id}-start`} label="Start" value={ex.start} onChange={(v) => set({ start: v })} />
                  <MonthYearField id={`${ex.id}-end`} label="End" value={ex.end} onChange={(v) => set({ end: v })} allowPresent />
                </div>
                <RemoveButton label={`Remove ${ex.role || "experience"}`} onClick={() => remove(ex.role || "experience", (p) => ({ ...p, experience: p.experience.filter((x) => x.id !== ex.id) }))} />
              </div>
              <Bullets bullets={ex.bullets} parent={ex.id} onChange={(bullets) => set({ bullets })} />
              <ProofRow
                proof={ex.proof}
                kind="experience"
                label="Add proof of this role"
                hint="Offer letter, internship certificate or experience letter (PNG, JPG or PDF)."
                expected={() => ({ name: profile.basics.name, org: ex.org, role: ex.role, start: ex.start, end: ex.end })}
                onChecked={(_, proof) => update((p) => ({ ...p, experience: p.experience.map((x) => (x.id === ex.id ? { ...x, proof } : x)) }))}
              />
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
      return !p.experience.length ? "empty" : p.experience.every((x) => x.proof?.status === "verified") ? "done" : "attention";
    case "skills":
      return p.skills.length >= 3 ? "done" : "attention";
    case "certifications":
      return p.certifications.some((c) => c.proof?.status === "verified") ? "done" : "attention";
    case "achievements":
      return p.achievements.length ? "done" : "empty";
    case "links":
      return p.basics.links.length ? "done" : "empty";
  }
}
