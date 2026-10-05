// LinkedIn import: connect (OpenID Connect identity) + the member's "Save to PDF" export,
// compared with the profile so only what's missing is suggested.
import { create } from "zustand";
import type { LinkedInIdentity, Profile, SkillCategory } from "../../shared/types";
import { newId } from "../store/app";
import { mentions } from "./engine";
import { categorize } from "./options";
import { idToken } from "./session";

export const useLinkedInStatus = create<{ configured: boolean | null }>()(() => ({ configured: null }));

let statusRequest: Promise<boolean> | null = null;
export function checkLinkedIn(): Promise<boolean> {
  statusRequest ??= fetch("/api/linkedin", { headers: { Accept: "application/json" } })
    .then(async (r) => (r.ok ? Boolean(((await r.json()) as { configured?: boolean }).configured) : false))
    .catch(() => false)
    .then((configured) => {
      useLinkedInStatus.setState({ configured });
      return configured;
    });
  return statusRequest;
}

/** Sends the browser to LinkedIn's sign-in page; it comes back to `returnTo`. */
export async function startLinkedIn(returnTo: string): Promise<void> {
  const token = await idToken();
  if (!token) throw new Error("Sign in again, then connect LinkedIn.");
  let res: Response;
  try {
    res = await fetch("/api/linkedin", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ returnTo }),
    });
  } catch {
    throw new Error("Couldn't reach Nevora. Check your connection and try again.");
  }
  const body = (await res.json().catch(() => ({}))) as { url?: string; error?: { message?: string } };
  if (!res.ok || !body.url) throw new Error(body.error?.message || "LinkedIn connect isn't available right now.");
  window.location.assign(body.url);
}

const RETURN_ERRORS: Record<string, string> = {
  cancelled: "LinkedIn connect was cancelled.",
  denied: "LinkedIn didn’t share your profile. Try again and choose Allow.",
  expired: "That LinkedIn sign-in expired. Try connecting again.",
  token: "LinkedIn didn’t accept the sign-in. Try again in a moment.",
  profile: "LinkedIn didn’t return your profile. Try again in a moment.",
};

/** Reads (and removes) the result LinkedIn's callback left in the URL fragment. */
export function takeLinkedInReturn(uid: string | null): { identity?: LinkedInIdentity; error?: string } | null {
  const hash = window.location.hash;
  const ok = /^#linkedin=([A-Za-z0-9_-]+)$/.exec(hash);
  const bad = /^#linkedin_error=([a-z_]+)$/.exec(hash);
  if (!ok && !bad) return null;
  history.replaceState(null, "", window.location.pathname + window.location.search);
  if (bad) return { error: RETURN_ERRORS[bad[1]] ?? RETURN_ERRORS.denied };
  try {
    const json = atob(ok![1].replace(/-/g, "+").replace(/_/g, "/"));
    const data = JSON.parse(new TextDecoder().decode(Uint8Array.from(json, (c) => c.charCodeAt(0)))) as Partial<LinkedInIdentity> & { uid?: string };
    if (!data.sub || (uid && data.uid !== uid)) return { error: RETURN_ERRORS.expired };
    return { identity: { sub: data.sub, name: data.name ?? "", email: data.email ?? "", picture: data.picture ?? "", connectedAt: Date.now() } };
  } catch {
    return { error: RETURN_ERRORS.profile };
  }
}

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

/** "A. Kumar" matches "Arun Kumar"; different surnames don't. */
export function namesMatch(a: string, b: string): boolean {
  const pa = norm(a).split(" ").filter(Boolean);
  const pb = norm(b).split(" ").filter(Boolean);
  if (!pa.length || !pb.length) return true;
  const [short, long] = pa.length <= pb.length ? [pa, pb] : [pb, pa];
  return short.every((w) => long.some((v) => v === w || (w.length === 1 && v.startsWith(w)) || (v.length === 1 && w.startsWith(v))));
}

export const sameSkill = (a: string, b: string) => norm(a) === norm(b) || mentions(a, b) || mentions(b, a);
export const hasSkill = (profile: Profile, skill: string) => profile.skills.some((s) => sameSkill(s.name, skill));

export type SuggestionKind = "skill" | "experience" | "project" | "education" | "certification" | "achievement" | "summary";

export type Suggestion = {
  key: string;
  kind: SuggestionKind;
  label: string;
  detail: string;
  apply: (p: Profile) => Profile;
};

const reId = <T extends { id: string }>(items: T[], prefix: string) => items.map((b) => ({ ...b, id: newId(prefix) }));

/** Everything in the LinkedIn export that the profile doesn't already have. */
export function compareWithProfile(current: Profile, imported: Profile, dismissed: string[] = []): Suggestion[] {
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

  for (const pr of imported.projects) {
    if (!pr.name.trim() || current.projects.some((c) => same(c.name, pr.name))) continue;
    out.push({
      key: `project:${norm(pr.name)}`,
      kind: "project",
      label: pr.name,
      detail: pr.tech.length ? pr.tech.join(", ") : "Project",
      apply: (p) => ({ ...p, projects: [...p.projects, { ...pr, id: newId("proj"), bullets: reId(pr.bullets, "b") }] }),
    });
  }

  for (const ed of imported.education) {
    if (!ed.institution.trim() || current.education.some((c) => same(c.institution, ed.institution))) continue;
    out.push({
      key: `education:${norm(ed.institution)}`,
      kind: "education",
      label: ed.institution,
      detail: [ed.degree, ed.field, [ed.start, ed.end].filter(Boolean).join(" – ")].filter(Boolean).join(" · "),
      apply: (p) => ({ ...p, education: [...p.education, { ...ed, id: newId("edu") }] }),
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

  for (const a of imported.achievements) {
    if (!a.text.trim() || current.achievements.some((x) => same(x.text, a.text))) continue;
    out.push({
      key: `achievement:${norm(a.text).slice(0, 60)}`,
      kind: "achievement",
      label: a.text,
      detail: "Achievement",
      apply: (p) => ({ ...p, achievements: [...p.achievements, { id: newId("ach"), text: a.text }] }),
    });
  }

  if (!current.summary.trim() && imported.summary.trim()) {
    out.push({ key: "summary", kind: "summary", label: "About section", detail: imported.summary.slice(0, 140), apply: (p) => (p.summary.trim() ? p : { ...p, summary: imported.summary }) });
  }

  const skip = new Set(dismissed);
  return out.filter((s) => !skip.has(s.key));
}

export const applySuggestions = (profile: Profile, chosen: Suggestion[]) => chosen.reduce((p, s) => s.apply(p), profile);
