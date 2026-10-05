// AI output is untrusted: coerce every response into the exact shape the UI expects.
import type {
  BulletCoaching,
  Course,
  LinkedInExtract,
  Gap,
  Insights,
  InterviewQuestion,
  JDAnalysis,
  Profile,
  Proof,
  ProofCheck,
  Requirement,
  SectionKey,
  SkillCategory,
  TailoredResume,
  Verification,
} from "../../shared/types";
import { categorize } from "./options";

type Obj = Record<string, unknown>;
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const str = (v: unknown): string => (typeof v === "string" ? v : typeof v === "number" ? String(v) : "");
const obj = (v: unknown): Obj => (v && typeof v === "object" && !Array.isArray(v) ? (v as Obj) : {});
const num = (v: unknown, lo = 0, hi = 100): number => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? Math.max(lo, Math.min(hi, Math.round(n))) : lo;
};
const oneOf = <T extends string>(v: unknown, options: readonly T[], fallback: T): T =>
  options.includes(v as T) ? (v as T) : fallback;
const strings = (v: unknown) => arr(v).map(str).map((s) => s.trim()).filter(Boolean);

export const emptyProfile = (name = "", email = ""): Profile => ({
  basics: { name, email, phone: "", location: "", links: [] },
  summary: "",
  education: [],
  experience: [],
  projects: [],
  skills: [],
  certifications: [],
  achievements: [],
});

const SKILL_CATEGORIES: SkillCategory[] = ["language", "framework", "tool", "concept", "soft"];

/** Keeps a stored proof result only if it has the expected shape. */
function normalizeProof(v: unknown): Proof | undefined {
  const o = obj(v);
  if (o.status !== "verified" && o.status !== "rejected") return undefined;
  return { status: o.status, reason: str(o.reason), fileName: str(o.fileName), checkedAt: Number(o.checkedAt) || 0, documentType: str(o.documentType) };
}
const withProof = <T extends object>(item: T, proof: Proof | undefined): T => (proof ? { ...item, proof } : item);

/** Normalizes a parsed or stored profile and guarantees unique, stable IDs. */
export function normalizeProfile(input: unknown): Profile {
  const p = obj(input);
  const basics = obj(p.basics);
  const used = new Set<string>();
  const uid = (raw: unknown, fallback: string) => {
    let id = str(raw).trim() || fallback;
    while (used.has(id)) id = `${id}x`;
    used.add(id);
    return id;
  };
  const bullets = (v: unknown, prefix: string) =>
    arr(v)
      .map((b, i) => ({ id: uid(obj(b).id, `${prefix}_b${i + 1}`), text: str(typeof b === "string" ? b : obj(b).text).trim() }))
      .filter((b) => b.text);
  return {
    basics: {
      name: str(basics.name),
      email: str(basics.email),
      phone: str(basics.phone),
      location: str(basics.location),
      links: strings(basics.links),
      ...(typeof basics.photo === "string" && /^data:image\/(jpeg|png);base64,/.test(basics.photo) && basics.photo.length < 300_000 ? { photo: basics.photo } : {}),
    },
    summary: str(p.summary),
    education: arr(p.education).map((e, i) => {
      const o = obj(e);
      return {
        id: uid(o.id, `edu_${i + 1}`),
        institution: str(o.institution),
        degree: str(o.degree),
        field: str(o.field),
        start: str(o.start),
        end: str(o.end),
        score: str(o.score),
      };
    }),
    experience: arr(p.experience).map((e, i) => {
      const o = obj(e);
      const id = uid(o.id, `exp_${i + 1}`);
      return withProof({ id, role: str(o.role), org: str(o.org), start: str(o.start), end: str(o.end), bullets: bullets(o.bullets, id) }, normalizeProof(o.proof));
    }),
    projects: arr(p.projects).map((e, i) => {
      const o = obj(e);
      const id = uid(o.id, `proj_${i + 1}`);
      return { id, name: str(o.name), tech: strings(o.tech), link: str(o.link), bullets: bullets(o.bullets, id) };
    }),
    skills: arr(p.skills)
      .map((s, i) => {
        const o = obj(s);
        return { id: uid(o.id, `skill_${i + 1}`), name: str(typeof s === "string" ? s : o.name).trim(), category: oneOf(o.category, SKILL_CATEGORIES, "tool") };
      })
      .filter((s) => s.name),
    certifications: arr(p.certifications)
      .map((c, i) => {
        const o = obj(c);
        return withProof(
          { id: uid(o.id, `cert_${i + 1}`), name: str(o.name), issuer: str(o.issuer), date: str(o.date), credential: str(o.credential) },
          normalizeProof(o.proof),
        );
      })
      .filter((c) => c.name),
    achievements: bullets(p.achievements, "ach").map((a, i) => ({ ...a, id: a.id.startsWith("ach") ? a.id : `ach_${i + 1}` })),
  };
}

export function normalizeInsights(v: unknown): Insights {
  const o = obj(v);
  return {
    strengths: arr(o.strengths)
      .map((s) => ({ area: str(obj(s).area), level: oneOf(obj(s).level, ["Strong", "Growing", "Beginner"] as const, "Growing"), score: num(obj(s).score) }))
      .filter((s) => s.area)
      .slice(0, 4),
    roles: arr(o.roles)
      .map((r) => ({ title: str(obj(r).title), fit: num(obj(r).fit) }))
      .filter((r) => r.title)
      .slice(0, 3),
  };
}

const jdSkills = (v: unknown) =>
  arr(v)
    .map((s) => {
      const skill = str(typeof s === "string" ? s : obj(s).skill).trim();
      return { skill, normalized: (str(obj(s).normalized) || skill).toLowerCase() };
    })
    .filter((s) => s.skill);

export function normalizeJD(v: unknown): JDAnalysis {
  const o = obj(v);
  const mustHave = jdSkills(o.mustHave);
  return {
    title: str(o.title).trim() || "Untitled role",
    company: str(o.company).trim() || undefined,
    location: str(o.location).trim() || undefined,
    seniority: oneOf(o.seniority, ["intern", "fresher", "junior", "mid", "senior"] as const, "fresher"),
    mustHave,
    niceToHave: jdSkills(o.niceToHave).filter((n) => !mustHave.some((m) => m.normalized === n.normalized)),
    responsibilities: strings(o.responsibilities).slice(0, 5),
    softSkills: strings(o.softSkills),
    keywords: strings(o.keywords).slice(0, 15),
    education: str(o.education).trim() || undefined,
  };
}

/** Keeps only evidence IDs that really exist in the profile. */
export function normalizeRequirements(v: unknown, profile: Profile): Requirement[] {
  const ids = new Set<string>([
    ...profile.projects.flatMap((p) => [p.id, ...p.bullets.map((b) => b.id)]),
    ...profile.experience.flatMap((e) => [e.id, ...e.bullets.map((b) => b.id)]),
    ...profile.skills.map((s) => s.id),
    ...profile.education.map((e) => e.id),
    ...profile.certifications.map((c) => c.id),
    ...profile.achievements.map((a) => a.id),
  ]);
  const seen = new Set<string>();
  return arr(obj(v).requirements)
    .map((r): Requirement => {
      const o = obj(r);
      const evidenceIds = strings(o.evidenceIds).filter((id) => ids.has(id));
      let status = oneOf(o.status, ["strong", "partial", "missing"] as const, "missing");
      if (status !== "missing" && !evidenceIds.length) status = "missing";
      return {
        requirement: str(o.requirement).trim(),
        type: oneOf(o.type, ["must", "nice", "soft", "education"] as const, "must"),
        status,
        evidenceIds,
        note: str(o.note) || (status === "missing" ? "Not found in your profile" : ""),
      };
    })
    .filter((r) => r.requirement && !seen.has(r.requirement.toLowerCase()) && seen.add(r.requirement.toLowerCase()));
}

const SECTION_KEYS: SectionKey[] = ["projects", "experience", "education", "certifications", "achievements"];

export function normalizeResume(v: unknown): TailoredResume {
  const o = obj(v);
  const bulletIds = new Set<string>();
  let n = 0;
  return {
    summary: str(o.summary),
    skills: arr(o.skills)
      .map((g) => ({ category: str(obj(g).category), items: strings(obj(g).items) }))
      .filter((g) => g.category && g.items.length),
    sections: arr(o.sections)
      .map((s) => ({
        key: oneOf(obj(s).key, SECTION_KEYS, "projects"),
        items: arr(obj(s).items).map((it) => {
          const i = obj(it);
          return {
            refId: str(i.refId),
            heading: str(i.heading),
            subheading: str(i.subheading) || undefined,
            meta: str(i.meta) || undefined,
            bullets: arr(i.bullets)
              .map((b) => {
                const x = obj(b);
                let id = str(x.id) || `t${++n}`;
                while (bulletIds.has(id)) id = `t${++n}`;
                bulletIds.add(id);
                return {
                  id,
                  text: str(x.text).trim(),
                  sourceIds: strings(x.sourceIds),
                  originalText: str(x.originalText),
                  changeReason: str(x.changeReason),
                  needsMetric: Boolean(x.needsMetric) || /\[add metric\]/i.test(str(x.text)),
                };
              })
              .filter((b) => b.text),
          };
        }),
      }))
      .filter((s) => s.items.length),
    omittedIds: strings(o.omittedIds),
    orderNotes: arr(o.orderNotes)
      .map((x) => ({ change: str(obj(x).change), reason: str(obj(x).reason) }))
      .filter((x) => x.change)
      .slice(0, 3),
  };
}

export function normalizeVerifications(v: unknown): Verification[] {
  return arr(obj(v).results).map((r) => ({
    bulletId: str(obj(r).bulletId),
    supported: obj(r).supported === true,
    issue: str(obj(r).issue) || undefined,
  }));
}

export function normalizePlan(v: unknown): Gap[] {
  return arr(obj(v).gaps)
    .map((g) => {
      const o = obj(g);
      return {
        skill: str(o.skill),
        priority: oneOf(o.priority, ["high", "medium", "low"] as const, "medium"),
        why: str(o.why),
        steps: strings(o.steps).slice(0, 6),
        resources: arr(o.resources)
          .map((r) => ({ title: str(typeof r === "string" ? r : obj(r).title), type: oneOf(obj(r).type, ["docs", "course", "video"] as const, "docs") }))
          .filter((r) => r.title)
          .slice(0, 3),
        miniProject: str(o.miniProject),
        timeEstimate: str(o.timeEstimate) || "About 1 week",
      };
    })
    .filter((g) => g.skill && g.steps.length)
    .slice(0, 4);
}

export function normalizeInterview(v: unknown): InterviewQuestion[] {
  return arr(obj(v).questions)
    .map((q) => {
      const o = obj(q);
      const s = obj(o.story);
      return {
        question: str(o.question),
        why: str(o.why),
        sourceIds: strings(o.sourceIds),
        story: { situation: str(s.situation), task: str(s.task), action: str(s.action), result: str(s.result) },
      };
    })
    .filter((q) => q.question)
    .slice(0, 5);
}

export function normalizeCoaching(v: unknown): BulletCoaching {
  const o = obj(v);
  return { score: num(o.score, 1, 5), missing: strings(o.missing), improved: str(o.improved), tip: str(o.tip) };
}

const VERDICTS = ["verified", "mismatch", "unreadable", "not_a_document"] as const;

/** A document is only "verified" when every check the model reported passed. */
export function normalizeProofCheck(v: unknown, kind: "certificate" | "experience"): ProofCheck {
  const o = obj(v);
  const check: ProofCheck = {
    verdict: oneOf(o.verdict, VERDICTS, "unreadable"),
    documentType: str(o.documentType),
    holderName: str(o.holderName),
    issuer: str(o.issuer),
    title: str(o.title),
    role: str(o.role),
    date: str(o.date),
    startDate: str(o.startDate),
    endDate: str(o.endDate),
    nameMatches: o.nameMatches === true,
    detailsMatch: o.detailsMatch === true,
    concerns: strings(o.concerns).slice(0, 4),
    reason: str(o.reason),
  };
  if (check.verdict === "verified" && (!check.nameMatches || !check.detailsMatch || (kind === "certificate" && !check.title))) {
    check.verdict = "mismatch";
    if (!check.reason) check.reason = check.nameMatches ? "The details on the document don't match what you entered." : "The name on the document doesn't match your profile name.";
  }
  if (!check.reason) {
    check.reason =
      check.verdict === "verified"
        ? "Looks good — the document matches your profile."
        : check.verdict === "not_a_document"
          ? "This doesn't look like a certificate or work document."
          : "We couldn't read the key details. Try a clearer photo or the original PDF.";
  }
  return check;
}

/** Courses from web search, grouped under the gap skills asked for. The server already dropped links not seen in search results. */
export function normalizeCourses(v: unknown, skills: string[]): Record<string, Course[]> {
  const out: Record<string, Course[]> = {};
  const seen = new Set<string>();
  arr(obj(v).courses)
    .map(obj)
    .forEach((c, i) => {
      const skill = skills.find((s) => s.toLowerCase() === str(c.skill).trim().toLowerCase()) ?? (skills.length === 1 ? skills[0] : "");
      const course: Course = {
        id: `course_${i}_${str(c.url).replace(/[^a-z0-9]/gi, "").slice(-24)}`,
        skill,
        title: str(c.title).trim(),
        provider: str(c.provider).trim(),
        url: str(c.url).trim(),
        free: typeof c.free === "boolean" ? c.free : null,
        level: str(c.level).trim(),
        duration: str(c.duration).trim(),
        why: str(c.why).trim(),
        source: "web",
      };
      if (!skill || !course.title || !/^https:\/\//.test(course.url) || seen.has(course.url)) return;
      seen.add(course.url);
      (out[skill.toLowerCase()] ??= []).push(course);
    });
  return out;
}

/** Skills, experience and certifications from an AI read of a LinkedIn PDF (fallback only). */
export function normalizeLinkedIn(v: unknown): LinkedInExtract {
  const o = obj(v);
  return {
    skills: strings(o.skills).slice(0, 60).map((name, i) => ({ id: `li_skill_${i + 1}`, name, category: categorize(name) })),
    experience: arr(o.experience)
      .map(obj)
      .map((e, i) => ({
        id: `li_exp_${i + 1}`,
        role: str(e.role).trim(),
        org: str(e.org).trim(),
        start: str(e.start).trim(),
        end: str(e.end).trim(),
        bullets: strings(e.bullets).map((text, b) => ({ id: `li_exp_${i + 1}_b${b + 1}`, text })),
      }))
      .filter((e) => e.role || e.org),
    certifications: arr(o.certifications)
      .map(obj)
      .map((c, i) => ({ id: `li_cert_${i + 1}`, name: str(c.name).trim(), issuer: str(c.issuer).trim(), date: "", credential: "" }))
      .filter((c) => c.name),
  };
}
