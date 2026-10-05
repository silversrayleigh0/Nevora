// Deterministic logic that runs in the browser: match scoring, profile strength,
// and honest "basic mode" fallbacks used when AI isn't available. Nothing here
// invents facts: every output is derived from the profile or the job text.
import type {
  BulletCoaching,
  CoverLetter,
  Gap,
  InterviewQuestion,
  JDAnalysis,
  Match,
  MatchStatus,
  Profile,
  Requirement,
  RequirementType,
  TailoredBullet,
  TailoredResume,
  Verification,
} from "../../shared/types";

export const KNOWN_SKILLS = [
  "JavaScript", "TypeScript", "Python", "Java", "C++", "C#", "Go", "SQL", "HTML", "CSS", "React", "Next.js",
  "Angular", "Vue", "Node.js", "Express", "Django", "Flask", "Spring", "REST APIs", "GraphQL", "Git", "Docker",
  "Kubernetes", "AWS", "Azure", "Firebase", "MongoDB", "PostgreSQL", "MySQL", "Tailwind CSS", "Jest", "Figma",
  "Excel", "Power BI", "Tableau", "pandas", "Machine learning", "Data structures", "Linux",
];
const SOFT_SKILLS = ["Communication", "Teamwork", "Leadership", "Problem solving", "Ownership"];

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const ALIASES: Record<string, string> = {
  "REST APIs": "rest(ful)?( apis?)?|apis?",
  "Node.js": "node(\\.js)?",
  "Data structures": "data structures|dsa",
  "Machine learning": "machine learning|ml",
  "Next.js": "next\\.?js",
};

/** Whole-word, case-insensitive skill mention ("C++" and "C#" included). */
export function mentions(text: string, skill: string): boolean {
  const pattern = ALIASES[skill] ?? escapeRegex(skill.toLowerCase());
  return new RegExp(`(^|[^a-z0-9])(${pattern})(?=$|[^a-z0-9+#])`, "i").test(text);
}

// ---------- Match scoring ----------

export const WEIGHTS: Record<RequirementType, number> = { must: 0.6, nice: 0.2, soft: 0.1, education: 0.1 };
const STATUS_VALUE: Record<MatchStatus, number> = { strong: 1, partial: 0.5, missing: 0 };

/** Weighted score. Groups the job doesn't mention are left out and their weight is shared by the rest. */
export function scoreMatch(requirements: Requirement[]): Match {
  const breakdown: Record<RequirementType, number> = { must: 0, nice: 0, soft: 0, education: 0 };
  let total = 0;
  let weight = 0;
  for (const type of ["must", "nice", "soft", "education"] as RequirementType[]) {
    const group = requirements.filter((r) => r.type === type);
    if (!group.length) {
      breakdown[type] = 100;
      continue;
    }
    const pct = (group.reduce((sum, r) => sum + STATUS_VALUE[r.status], 0) / group.length) * 100;
    breakdown[type] = Math.round(pct);
    total += pct * WEIGHTS[type];
    weight += WEIGHTS[type];
  }
  return { score: weight ? Math.round(total / weight) : 0, breakdown, requirements };
}

/** Score if the given requirements (or all of them) became strong. */
export function potentialScore(requirements: Requirement[], skills?: string[]): number {
  const lifted = requirements.map((r) =>
    r.status !== "strong" && (!skills || skills.some((s) => s.toLowerCase() === r.requirement.toLowerCase()))
      ? { ...r, status: "strong" as const }
      : r,
  );
  return scoreMatch(lifted).score;
}

export const pointsFor = (requirements: Requirement[], skill: string) =>
  potentialScore(requirements, [skill]) - scoreMatch(requirements).score;

export function fitLabel(score: number): string {
  return score >= 80 ? "Strong fit." : score >= 60 ? "Good fit." : score >= 40 ? "Partial fit." : "Early fit.";
}

// ---------- Profile helpers ----------

/** Short, human name for a profile ID ("CampusConnect", "Internship", "Skills"). */
export function sourceLabel(profile: Profile | null, id: string): string {
  if (!profile) return id;
  for (const p of profile.projects) if (p.id === id || p.bullets.some((b) => b.id === id)) return p.name.split(" — ")[0];
  for (const e of profile.experience) if (e.id === id || e.bullets.some((b) => b.id === id)) return /intern/i.test(e.role) ? "Internship" : "Experience";
  if (profile.skills.some((s) => s.id === id)) return "Skills";
  if (profile.education.some((e) => e.id === id)) return "Education";
  if (profile.certifications.some((c) => c.id === id)) return "Certifications";
  if (profile.achievements.some((a) => a.id === id)) return "Achievements";
  return id;
}

/** The profile text behind an ID, used to fact-check tailored lines. */
export function sourceText(profile: Profile, id: string): string {
  for (const p of profile.projects) {
    if (p.id === id) return `${p.name} ${p.tech.join(" ")} ${p.bullets.map((b) => b.text).join(" ")}`;
    const b = p.bullets.find((x) => x.id === id);
    if (b) return `${b.text} ${p.tech.join(" ")} ${p.name}`;
  }
  for (const e of profile.experience) {
    if (e.id === id) return `${e.role} ${e.org} ${e.bullets.map((b) => b.text).join(" ")}`;
    const b = e.bullets.find((x) => x.id === id);
    if (b) return `${b.text} ${e.role}`;
  }
  const skill = profile.skills.find((s) => s.id === id);
  if (skill) return skill.name;
  const ach = profile.achievements.find((a) => a.id === id);
  if (ach) return ach.text;
  const edu = profile.education.find((e) => e.id === id);
  if (edu) return `${edu.degree} ${edu.field} ${edu.institution}`;
  const cert = profile.certifications.find((c) => c.id === id);
  return cert ? `${cert.name} ${cert.issuer}` : "";
}

export function profileStrength(profile: Profile | null): { score: number; tips: string[] } {
  if (!profile) return { score: 0, tips: ["Add your resume to get started"] };
  let score = 0;
  const tips: string[] = [];
  if (profile.basics.name && profile.basics.email) score += 10;
  else tips.push("Add your name and email");
  if (profile.education.length) score += 15;
  else tips.push("Add your education");
  score += Math.min(profile.projects.length, 3) * 8;
  if (profile.projects.length < 2) tips.push("Add at least 2 projects");
  if (profile.experience.length) score += 10;
  else tips.push("Add an internship or experience");
  score += Math.min(profile.skills.length, 10);
  if (profile.skills.length < 6) tips.push("List at least 6 skills");
  if (profile.certifications.length) score += 8;
  else tips.push("Add a certification");
  if (profile.achievements.length) score += 5;
  else tips.push("Add an achievement");
  const bullets = [...profile.projects.flatMap((p) => p.bullets), ...profile.experience.flatMap((e) => e.bullets)];
  const withNumbers = bullets.filter((b) => /\d/.test(b.text)).length;
  const without = bullets.length - withNumbers;
  score += bullets.length ? Math.round((withNumbers / bullets.length) * 10) : 0;
  if (without > 0) tips.unshift(`Add impact to ${without} bullet${without > 1 ? "s" : ""}`);
  if (!profile.basics.links.some((l) => /github/i.test(l))) tips.push("Add your GitHub link");
  return { score: Math.min(100, score), tips: tips.slice(0, 3) };
}

// ---------- Basic-mode fallbacks ----------

export function localAnalyzeJD(text: string): JDAnalysis {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const [title, company] = (lines[0] ?? "Untitled role").split(/\s[—–-]\s/);
  const niceStart = lines.findIndex((l) => /nice to have|preferred|bonus|plus/i.test(l));
  const required = (niceStart === -1 ? lines : lines.slice(0, niceStart)).join("\n");
  const nice = niceStart === -1 ? "" : lines.slice(niceStart).join("\n");
  const toSkill = (skill: string) => ({ skill, normalized: skill.toLowerCase() });
  const mustHave = KNOWN_SKILLS.filter((s) => mentions(required, s)).map(toSkill);
  const niceToHave = KNOWN_SKILLS.filter((s) => mentions(nice, s) && !mustHave.some((m) => m.skill === s)).map(toSkill);
  const respStart = lines.findIndex((l) => /what you('|’)?ll do|responsibilit|you will/i.test(l));
  const responsibilities: string[] = [];
  if (respStart !== -1) {
    for (const l of lines.slice(respStart + 1)) {
      if (!/^[•\-*]/.test(l)) break;
      responsibilities.push(l.replace(/^[•\-*]\s*/, ""));
    }
  }
  return {
    title: title?.trim() || "Untitled role",
    company: company?.replace(/\(.*\)/, "").trim() || undefined,
    seniority: /intern/i.test(text) ? "intern" : /senior/i.test(text) ? "senior" : "fresher",
    mustHave,
    niceToHave,
    responsibilities: responsibilities.slice(0, 5),
    softSkills: SOFT_SKILLS.filter((s) => mentions(text, s)),
    keywords: [...mustHave, ...niceToHave].map((s) => s.skill).slice(0, 12),
    education: /degree|b\.?tech|bachelor/i.test(text) ? "Degree in a related field" : undefined,
  };
}

export function localMatch(profile: Profile, jd: JDAnalysis): Requirement[] {
  const evidenceFor = (skill: string) => {
    const ids: string[] = [];
    for (const p of profile.projects) {
      if (p.tech.some((t) => mentions(t, skill)) || mentions(p.name, skill)) ids.push(p.id);
      p.bullets.forEach((b) => mentions(b.text, skill) && ids.push(b.id));
    }
    for (const e of profile.experience) e.bullets.forEach((b) => mentions(b.text, skill) && ids.push(b.id));
    return { ids: [...new Set(ids)], listed: profile.skills.find((s) => mentions(s.name, skill)) };
  };
  const hard = (skill: string, type: RequirementType): Requirement => {
    const { ids, listed } = evidenceFor(skill);
    if (ids.length) return { requirement: skill, type, status: "strong", evidenceIds: ids.slice(0, 3), note: "Shown in your projects or experience" };
    if (listed) return { requirement: skill, type, status: "partial", evidenceIds: [listed.id], note: "Listed as a skill, not shown in a project yet" };
    return { requirement: skill, type, status: "missing", evidenceIds: [], note: "Not found in your profile" };
  };
  const softPatterns: Record<string, RegExp> = {
    Communication: /present|explain|led|review|communicat/i,
    Teamwork: /team|club|together|collaborat/i,
    Leadership: /led|lead|captain|head/i,
  };
  const lines = [...profile.projects.flatMap((p) => p.bullets), ...profile.experience.flatMap((e) => e.bullets), ...profile.achievements];
  const soft = jd.softSkills.map((s): Requirement => {
    const hit = lines.find((b) => (softPatterns[s] ?? new RegExp(escapeRegex(s), "i")).test(b.text));
    return hit
      ? { requirement: s, type: "soft", status: "strong", evidenceIds: [hit.id], note: hit.text.replace(/\.$/, "") }
      : { requirement: s, type: "soft", status: "partial", evidenceIds: [], note: "Add a bullet that shows this" };
  });
  const edu = profile.education[0];
  const education: Requirement[] = jd.education
    ? [
        {
          requirement: jd.education,
          type: "education",
          status: edu ? "strong" : "missing",
          evidenceIds: edu ? [edu.id] : [],
          note: edu ? `${edu.degree} ${edu.field ?? ""}`.trim() : "Add your education",
        },
      ]
    : [];
  return [...jd.mustHave.map((s) => hard(s.skill, "must")), ...jd.niceToHave.map((s) => hard(s.skill, "nice")), ...soft, ...education];
}

export function localTailor(profile: Profile, jd: JDAnalysis): TailoredResume {
  const jobSkills = [...jd.mustHave, ...jd.niceToHave].map((s) => s.skill);
  const relevance = (text: string) => jobSkills.filter((s) => mentions(text, s)).length;
  let n = 0;
  const keep = (b: { id: string; text: string }): TailoredBullet => ({
    id: `t${++n}`,
    text: b.text.replace(/\.$/, ""),
    sourceIds: [b.id],
    originalText: b.text,
    changeReason: "Kept as written. Rewriting in the job's language needs Live AI.",
    needsMetric: !/\d/.test(b.text),
  });
  const ranked = profile.projects
    .map((p) => ({ p, r: relevance(`${p.tech.join(" ")} ${p.bullets.map((b) => b.text).join(" ")}`) }))
    .sort((a, b) => b.r - a.r);
  const kept = ranked.filter((x, i) => x.r > 0 || i < 2);
  const skillsSorted = [...profile.skills].sort(
    (a, b) => Number(jobSkills.some((s) => mentions(b.name, s))) - Number(jobSkills.some((s) => mentions(a.name, s))),
  );
  const group = (cat: string, label: string) => ({ category: label, items: skillsSorted.filter((s) => s.category === cat).map((s) => s.name) });
  const edu = profile.education[0];
  const sections: TailoredResume["sections"] = [
    { key: "projects" as const, items: kept.map(({ p }) => ({ refId: p.id, heading: p.name, meta: p.tech.join(", "), bullets: p.bullets.map(keep) })) },
    {
      key: "experience" as const,
      items: profile.experience.map((e) => ({
        refId: e.id,
        heading: [e.role, e.org].filter(Boolean).join(" — "),
        meta: [e.start, e.end].filter(Boolean).join(" – "),
        bullets: e.bullets.map(keep),
      })),
    },
    {
      key: "education" as const,
      items: profile.education.map((e) => ({
        refId: e.id,
        heading: `${e.degree}${e.field ? `, ${e.field}` : ""}${e.institution ? ` — ${e.institution}` : ""}`,
        meta: [e.start, e.end].filter(Boolean).join(" – "),
        subheading: e.score,
        bullets: [],
      })),
    },
    {
      key: "certifications" as const,
      items: profile.certifications.map((c) => ({ refId: c.id, heading: `${c.name}${c.issuer ? ` — ${c.issuer}` : ""}`, meta: c.date, bullets: [] })),
    },
    { key: "achievements" as const, items: profile.achievements.map((a) => ({ refId: a.id, heading: a.text, bullets: [] })) },
  ].filter((s) => s.items.length);
  return {
    summary:
      profile.summary ||
      (edu ? `${edu.degree}${edu.field ? ` in ${edu.field}` : ""} student with hands-on project experience.` : "").replace(/\s+/g, " ").trim(),
    skills: [group("language", "Languages"), group("framework", "Frameworks"), group("tool", "Tools"), group("concept", "Concepts")].filter(
      (g) => g.items.length,
    ),
    sections,
    omittedIds: ranked.filter((x) => !kept.includes(x)).map((x) => x.p.id),
    orderNotes: [{ change: "Most relevant projects placed first", reason: "They use the most skills this job asks for." }],
  };
}

/**
 * Fact check that always runs, with or without AI: a line must point at profile
 * content, and may not name a tool or a number that its sources don't contain.
 */
export function localVerify(profile: Profile, resume: TailoredResume): Verification[] {
  return resume.sections
    .flatMap((s) => s.items.flatMap((i) => i.bullets))
    .map((b): Verification => {
      if (!b.sourceIds.length) {
        const tool = KNOWN_SKILLS.find((s) => mentions(b.text, s));
        return {
          bulletId: b.id,
          supported: false,
          issue: `This line isn't linked to anything in your profile${tool ? `, and ${tool} isn't in your projects or experience` : ""}. Remove it, or add it to your profile first.`,
        };
      }
      const source = b.sourceIds.map((id) => sourceText(profile, id)).join(" ");
      if (!source.trim()) return { bulletId: b.id, supported: false, issue: "The profile item this line came from was removed. Remove the line or add it back to your profile." };
      const tool = KNOWN_SKILLS.find((s) => mentions(b.text, s) && !mentions(source, s));
      if (tool) return { bulletId: b.id, supported: false, issue: `${tool} isn't mentioned in the source. Remove it, or add it to that project first.` };
      const number = (b.text.replace(/\[[^\]]*\]/g, "").match(/\d+(\.\d+)?%?/g) ?? []).find((num) => !source.includes(num.replace(/%$/, "")));
      if (number) return { bulletId: b.id, supported: false, issue: `The number ${number} doesn't appear in your profile. Use a real figure or a placeholder.` };
      return { bulletId: b.id, supported: true };
    });
}

/** A line passes only if both the AI fact-checker and the local check agree. */
export function mergeVerifications(local: Verification[], ai: Verification[] | null): Verification[] {
  if (!ai) return local;
  return local.map((l) => {
    const a = ai.find((x) => x.bulletId === l.bulletId);
    if (!l.supported) return l;
    if (!a) return { bulletId: l.bulletId, supported: false, issue: "This line couldn't be checked. Try checking again." };
    return a.supported ? l : { bulletId: l.bulletId, supported: false, issue: a.issue || "This line isn't backed by your profile." };
  });
}

export function localPlan(gaps: Requirement[]): Gap[] {
  return gaps.slice(0, 4).map((g) => ({
    skill: g.requirement,
    priority: g.type === "must" ? "high" : "medium",
    why:
      g.status === "partial"
        ? `You've listed ${g.requirement}, but no project shows it yet.`
        : `The job asks for ${g.requirement} and it isn't in your profile yet.`,
    steps: [
      `Learn the fundamentals of ${g.requirement}`,
      "Follow one official tutorial end to end",
      `Use ${g.requirement} in one of your projects`,
      "Add it to your Nevora profile",
    ],
    resources: [{ title: `${g.requirement} official documentation`, type: "docs" }],
    miniProject: `Add a small ${g.requirement} feature to your strongest project.`,
    timeEstimate: "About 1 week",
  }));
}

export function localCoach(line: string): BulletCoaching {
  const missing: string[] = [];
  if (!/^(built|developed|designed|led|created|implemented|improved|launched|automated|reduced|increased)/i.test(line.trim())) missing.push("Strong verb");
  if (!KNOWN_SKILLS.some((s) => mentions(line, s))) missing.push("Technology");
  if (!/\d/.test(line)) missing.push("Metric");
  if (!/(so that|to |for |which|resulting|improv|reduc|increas)/i.test(line)) missing.push("Impact");
  const core = line.trim().replace(/\.$/, "").replace(/^(worked on|helped with|did|made)\s+/i, "");
  return {
    score: Math.max(1, 5 - missing.length),
    missing,
    improved: `${missing.includes("Strong verb") ? "Developed " : ""}${core}${missing.includes("Technology") ? " using [technology]" : ""}${
      missing.includes("Metric") || missing.includes("Impact") ? ", [result, e.g. users or speed]" : ""
    }`,
    tip: "Use the XYZ formula: accomplished X, measured by Y, by doing Z. Start with a strong verb, name the tool, and end with the result.",
  };
}

type Story = { id: string; kind: "project" | "experience"; name: string; text: string; bullets: { id: string; text: string }[]; skills: string[] };

function storiesFor(profile: Profile, jd: JDAnalysis): Story[] {
  const jobSkills = [...jd.mustHave, ...jd.niceToHave].map((s) => s.skill);
  return [
    ...profile.projects.map((p) => ({ id: p.id, kind: "project" as const, name: p.name.split(" — ")[0], text: `${p.tech.join(" ")} ${p.bullets.map((b) => b.text).join(" ")}`, bullets: p.bullets })),
    ...profile.experience.map((e) => ({ id: e.id, kind: "experience" as const, name: `${e.role} at ${e.org}`, text: e.bullets.map((b) => b.text).join(" "), bullets: e.bullets })),
  ]
    .map((s) => ({ ...s, skills: jobSkills.filter((k) => mentions(s.text, k)) }))
    .sort((a, b) => b.skills.length - a.skills.length);
}

const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
const trimDot = (s: string) => s.trim().replace(/\.$/, "");

export function localCoverLetter(profile: Profile, jd: JDAnalysis, tone: CoverLetter["tone"]): CoverLetter {
  const company = jd.company || "your team";
  const stories = storiesFor(profile, jd).filter((s) => s.bullets.length).slice(0, 2);
  const edu = profile.education[0];
  const opening =
    tone === "friendly"
      ? `I was excited to see the ${jd.title} role at ${company}. [why you want to join ${company}]`
      : `I am writing to apply for the ${jd.title} position at ${company}. [why you want to join ${company}]`;
  const background = edu
    ? `I am a ${edu.degree}${edu.field ? ` ${edu.field}` : ""} student at ${edu.institution}${edu.end ? `, graduating in ${edu.end}` : ""}.`
    : "";
  const body = stories
    .map((s, i) => {
      const skills = s.skills.slice(0, 2).join(" and ");
      const lead = s.kind === "project" ? `${i ? "In" : "On"} my ${s.name} project` : `As a ${s.name}`;
      const tie = skills ? (i === 0 ? ` That is where I built the ${skills} experience this role asks for.` : ` It gave me more practice with ${skills}.`) : "";
      return `${lead}, I ${lowerFirst(trimDot(s.bullets[0].text)).replace(/^i /, "")}${s.bullets[1] ? `, and ${lowerFirst(trimDot(s.bullets[1].text))}` : ""}.${tie}`;
    })
    .join(" ");
  const closing =
    tone === "friendly"
      ? `I would love to bring this hands-on approach to ${company} and keep growing with your team. Thank you for considering my application.`
      : `I would welcome the opportunity to contribute to ${company} and to discuss how my experience fits your needs. Thank you for your consideration.`;
  return {
    tone,
    text: `Dear Hiring Manager,\n\n${opening} ${background}\n\n${body}\n\n${closing}\n\nSincerely,\n${profile.basics.name || "[Your name]"}`.replace(/\n\n\n+/g, "\n\n"),
  };
}

export function localInterview(profile: Profile, jd: JDAnalysis, match: Match | null, plan: Gap[] | null): InterviewQuestion[] {
  const stories = storiesFor(profile, jd);
  const storyFor = (skill: string) => stories.find((s) => mentions(s.text, skill)) ?? stories[0];
  const star = (s: Story | undefined, topic: string) => ({
    situation: s ? `While working on ${s.name}.` : "[a project or course where this came up]",
    task: `I needed to deliver the part that involved ${topic}.`,
    action: s?.bullets[0] ? `${trimDot(s.bullets[0].text)}.` : "[what you did, step by step]",
    result: (() => {
      const withNumber = s?.bullets.find((b) => /\d+\s*(%|percent|users|downloads|ms|seconds|x\b|times|hours)/i.test(b.text));
      return withNumber ? `${trimDot(withNumber.text)}.` : "[your result — a number if you have one]";
    })(),
  });
  const skillQuestions = jd.mustHave.slice(0, 3).map(({ skill }) => {
    const s = storyFor(skill);
    return { question: `Tell me about a time you used ${skill}.`, why: `They want proof you can apply ${skill}, not just name it.`, sourceIds: s ? [s.id] : [], story: star(s, skill) };
  });
  const team = stories.find((s) => /team|led|club|review/i.test(s.text)) ?? stories[0];
  const gap = match?.requirements.find((r) => r.status === "missing") ?? match?.requirements.find((r) => r.status === "partial");
  const gapPlan = gap && plan?.find((p) => p.skill.toLowerCase() === gap.requirement.toLowerCase());
  return [
    ...skillQuestions,
    {
      question: "Describe a time you worked in a team to deliver something.",
      why: "They are checking communication and how you handle shared work.",
      sourceIds: team ? [team.id] : [],
      story: star(team, "working with others"),
    },
    {
      question: gap ? `This role mentions ${gap.requirement}. How familiar are you with it?` : "What are you learning right now?",
      why: "They want honesty and a clear plan, not a bluff.",
      sourceIds: [],
      story: {
        situation: gap ? `I noticed ${gap.requirement} is part of this role.` : "I keep a learning plan for the roles I apply to.",
        task: "I wanted to close that gap properly.",
        action: gapPlan ? `${gapPlan.steps.slice(0, 2).join(", then ")}.` : "[the steps you are taking]",
        result: gapPlan ? `My next step: ${lowerFirst(trimDot(gapPlan.miniProject))}.` : "[what you have finished so far]",
      },
    },
  ];
}
