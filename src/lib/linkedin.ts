// LinkedIn import: read the member's "Save to PDF" export (in the browser, no AI when
// possible) and suggest only the skills, experience and certifications the profile lacks.
import type { LinkedInExtract, Profile, SkillCategory } from "../../shared/types";
import { newId } from "../store/app";
import { mentions } from "./engine";
import { categorize } from "./options";

// ---------- Comparing a LinkedIn export with the profile ----------

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9+#]+/g, " ")
    .trim();

const same = (a: string, b: string) => {
  const x = norm(a);
  const y = norm(b);
  return Boolean(x && y) && (x === y || (Math.min(x.length, y.length) >= 4 && (x.includes(y) || y.includes(x))));
};

export const sameSkill = (a: string, b: string) => norm(a) === norm(b) || mentions(a, b) || mentions(b, a);
export const hasSkill = (profile: Pick<Profile, "skills">, skill: string) => profile.skills.some((s) => sameSkill(s.name, skill));

export type SuggestionKind = "skill" | "experience" | "certification";

export type Suggestion = {
  key: string;
  kind: SuggestionKind;
  label: string;
  detail: string;
  apply: (p: Profile) => Profile;
};

const reId = <T extends { id: string }>(items: T[], prefix: string) => items.map((b) => ({ ...b, id: newId(prefix) }));

/** Everything in the LinkedIn export that the profile doesn't already have. */
export function compareWithProfile(current: Profile, imported: LinkedInExtract, dismissed: string[] = []): Suggestion[] {
  const out: Suggestion[] = [];

  for (const s of imported.skills) {
    if (!s.name.trim() || hasSkill(current, s.name)) continue;
    const category: SkillCategory = s.category || categorize(s.name);
    out.push({
      key: `skill:${norm(s.name)}`,
      kind: "skill",
      label: s.name,
      detail: "Listed on LinkedIn, not on your resume",
      apply: (p) => (hasSkill(p, s.name) ? p : { ...p, skills: [...p.skills, { id: newId("skill"), name: s.name.trim(), category }] }),
    });
  }

  for (const e of imported.experience) {
    if (!e.role.trim() && !e.org.trim()) continue;
    const known = current.experience.some((c) => (e.org.trim() ? same(c.org, e.org) && (!c.role || !e.role || same(c.role, e.role)) : same(c.role, e.role)));
    if (known) continue;
    out.push({
      key: `experience:${norm(e.org)}:${norm(e.role)}`,
      kind: "experience",
      label: [e.role, e.org].filter(Boolean).join(" at "),
      detail: [[e.start, e.end].filter(Boolean).join(" – "), e.bullets.length ? `${e.bullets.length} line${e.bullets.length > 1 ? "s" : ""}` : ""].filter(Boolean).join(" · "),
      apply: (p) => ({ ...p, experience: [...p.experience, { id: newId("exp"), role: e.role, org: e.org, start: e.start, end: e.end, bullets: reId(e.bullets, "b") }] }),
    });
  }

  for (const c of imported.certifications) {
    if (!c.name.trim() || current.certifications.some((x) => same(x.name, c.name))) continue;
    out.push({
      key: `certification:${norm(c.name)}`,
      kind: "certification",
      label: c.name,
      detail: `${c.issuer ? `${c.issuer} · ` : ""}Upload the certificate to show it on resumes`,
      // No proof yet: it stays off resumes until the certificate image is verified.
      apply: (p) => ({ ...p, certifications: [...p.certifications, { id: newId("cert"), name: c.name, issuer: c.issuer, date: c.date, credential: "" }] }),
    });
  }

  const skip = new Set(dismissed);
  return out.filter((s) => !skip.has(s.key));
}

export const applySuggestions = (profile: Profile, chosen: Suggestion[]) => chosen.reduce((p, s) => s.apply(p), profile);
