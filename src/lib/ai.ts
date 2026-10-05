// Every AI feature in one place. Each action asks the server first and falls
// back to the deterministic engine ("basic mode") when AI isn't available.
import { create } from "zustand";
import type {
  AiTask,
  BulletCoaching,
  Course,
  CourseSearch,
  CoverLetter,
  LinkedInExtract,
  Gap,
  Insights,
  InterviewQuestion,
  JDAnalysis,
  Match,
  Profile,
  ProofCheck,
  Requirement,
  TailoredResume,
  Verification,
} from "../../shared/types";
import { useApp } from "../store/app";
import {
  localAnalyzeJD,
  localCoach,
  localCoverLetter,
  localInterview,
  localMatch,
  localPlan,
  localTailor,
  localVerify,
  mergeVerifications,
  scoreMatch,
  sourceText,
} from "./engine";
import { isPdf, MAX_UPLOAD_BYTES, pdfText, proofImage, resumeText } from "./extract";
import { extractedAnything, parseLinkedInText } from "./linkedinPdf";
import {
  normalizeCoaching,
  normalizeCourses,
  normalizeLinkedIn,
  normalizeInsights,
  normalizeInterview,
  normalizeJD,
  normalizePlan,
  normalizeProfile,
  normalizeProofCheck,
  normalizeRequirements,
  normalizeResume,
  normalizeVerifications,
} from "./normalize";
import { parsedEnough, parseResumeText } from "./resumeParser";
import { idToken } from "./session";

export type AiMode = "live" | "basic";

/**
 * Whether this deployment has AI configured. Asked once per page load.
 * `reason` explains why AI is off, so errors can say something useful.
 */
export const useAiStatus = create<{ available: boolean | null; reason: "" | "not_configured" | "unreachable" | "failing" }>()(() => ({
  available: null,
  reason: "",
}));

let statusRequest: Promise<boolean> | null = null;
export function checkAi(): Promise<boolean> {
  statusRequest ??= fetch("/api/ai", { headers: { Accept: "application/json" } })
    .then(async (r) => {
      if (!r.ok) return { ai: false, reason: "unreachable" as const };
      const body = (await r.json()) as { ai?: boolean };
      return { ai: Boolean(body.ai), reason: body.ai ? ("" as const) : ("not_configured" as const) };
    })
    .catch(() => ({ ai: false, reason: "unreachable" as const }))
    .then(({ ai, reason }) => {
      useAiStatus.setState({ available: ai, reason });
      if (!ai) console.warn(`[ai] Live AI is off (${reason}). Check ANTHROPIC_API_KEY / OPENROUTER_API_KEY on the server.`);
      return ai;
    });
  return statusRequest;
}

const AI_OFF: Record<string, string> = {
  not_configured: "Live AI isn’t set up on the server yet",
  unreachable: "Nevora’s AI service didn’t respond",
  failing: "Live AI isn’t working right now",
};
export const aiOffMessage = () => AI_OFF[useAiStatus.getState().reason] ?? "Live AI isn’t available right now";

export function aiMode(): AiMode {
  return useAiStatus.getState().available ? "live" : "basic";
}

export function useAiMode(): AiMode | null {
  const available = useAiStatus((s) => s.available);
  if (available === null) return null;
  return available ? "live" : "basic";
}

/** Returns the parsed JSON, or null when the caller should use basic mode. */
async function ask(task: AiTask, input: unknown, image?: string): Promise<unknown | null> {
  if (useApp.getState().mode !== "cloud") return null;
  if (!(await checkAi())) return null;
  const token = await idToken();
  if (!token) return null;
  let res: Response;
  try {
    res = await fetch("/api/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ task, input, ...(image ? { image } : {}) }),
    });
  } catch {
    throw new Error("Couldn't reach Nevora. Check your connection and try again.");
  }
  const body = (await res.json().catch(() => ({}))) as { data?: unknown; error?: { code?: string; message?: string } };
  if (res.ok) return body.data ?? null;
  if (body.error?.code === "ai_unavailable") {
    useAiStatus.setState({ available: false, reason: "failing" });
    return null;
  }
  throw Object.assign(new Error(body.error?.message || "Something went wrong. Try again."), { code: body.error?.code ?? "" });
}

const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Basic mode answers instantly; a short pause keeps the progress steps readable. */
async function withPace<T>(work: () => Promise<T>): Promise<T> {
  const started = Date.now();
  const result = await work();
  if (aiMode() !== "live") await pause(Math.max(0, 700 - (Date.now() - started)));
  return result;
}

// ---------- Actions ----------

export function parseResume(file: File | null, text: string): Promise<Profile> {
  return withPace(async () => {
    let source = text;
    if (file) {
      if (file.size > MAX_UPLOAD_BYTES) throw new Error("That file is over 5 MB. Try a smaller file.");
      try {
        source = await resumeText(file);
      } catch (err) {
        throw new Error((err as Error).message.startsWith("Choose") ? (err as Error).message : "We couldn't open that file. Try another one, or paste the text instead.");
      }
      if (source.trim().length < 40) throw new Error("We couldn't read text from this file. It may be a scanned image — paste the text instead.");
    }
    if (!source.trim()) throw new Error("Add a PDF or paste your resume text.");
    let aiError: Error | null = null;
    try {
      const data = await ask("parseResume", source.slice(0, 20_000));
      if (data) {
        const parsed = normalizeProfile(data);
        if (parsedEnough(parsed)) return parsed;
      }
    } catch (err) {
      aiError = err as Error;
    }
    // Without AI (or if it failed), read the text directly. Nothing is invented either way.
    const local = parseResumeText(source);
    if (parsedEnough(local)) return local;
    throw aiError ?? new Error("We couldn't find sections in that text. Add headings like Education, Skills and Projects, or choose “Build from scratch”.");
  });
}

export type ProofKind = "certificate" | "experience";

/** Checks an uploaded certificate or work document against what the profile claims. */
export async function verifyDocument(
  file: File,
  kind: ProofKind,
  expected: { name: string; org?: string; role?: string; start?: string; end?: string },
): Promise<ProofCheck> {
  const image = await proofImage(file);
  if (useApp.getState().mode !== "cloud" || !(await checkAi())) throw new Error(`${aiOffMessage()}, so documents can’t be checked yet. Try again later.`);
  const data = await ask("verifyDocument", { kind, expected }, image);
  if (!data) throw new Error(`${aiOffMessage()}, so documents can’t be checked yet. Try again later.`);
  return normalizeProofCheck(data, kind);
}

/** Only verified certificates appear on tailored resumes. */
export const resumeProfile = (p: Profile): Profile => ({ ...p, certifications: p.certifications.filter((c) => c.proof?.status === "verified") });

export function insights(profile: Profile, interests: string[] | undefined): Promise<Insights | null> {
  return withPace(async () => {
    const data = await ask("insights", { profile, interests });
    return data ? normalizeInsights(data) : null;
  });
}

export function analyzeJD(text: string): Promise<JDAnalysis> {
  return withPace(async () => {
    if (text.trim().length < 60) throw new Error("Paste the full job description — it looks too short.");
    const data = await ask("analyzeJD", text.slice(0, 15_000));
    return data ? normalizeJD(data) : localAnalyzeJD(text);
  });
}

export function match(profile: Profile, jd: JDAnalysis): Promise<Match> {
  return withPace(async () => {
    profile = resumeProfile(profile);
    const data = await ask("match", { profile, jd });
    const requirements: Requirement[] | null = data ? normalizeRequirements(data, profile) : null;
    return scoreMatch(requirements?.length ? requirements : localMatch(profile, jd));
  });
}

export function tailor(profile: Profile, jd: JDAnalysis, m: Match | null): Promise<TailoredResume> {
  return withPace(async () => {
    profile = resumeProfile(profile);
    const data = await ask("tailor", { profile, jd, match: m });
    const resume = data ? normalizeResume(data) : null;
    return resume?.sections.length ? resume : localTailor(profile, jd);
  });
}

export function verify(profile: Profile, resume: TailoredResume): Promise<Verification[]> {
  return withPace(async () => {
    const local = localVerify(profile, resume);
    const bullets = resume.sections
      .flatMap((s) => s.items.flatMap((i) => i.bullets))
      .map((b) => ({ bulletId: b.id, text: b.text, sources: b.sourceIds.map((id) => ({ id, text: sourceText(profile, id) })) }));
    if (!bullets.length) return [];
    const data = await ask("verify", { bullets });
    return mergeVerifications(local, data ? normalizeVerifications(data) : null);
  });
}

export function learningPlan(profile: Profile, jd: JDAnalysis, gaps: Requirement[]): Promise<Gap[]> {
  return withPace(async () => {
    if (!gaps.length) return [];
    const data = await ask("learningPlan", { role: jd.title, company: jd.company, gaps, projects: profile.projects });
    const plan = data ? normalizePlan(data) : [];
    return plan.length ? plan : localPlan(gaps);
  });
}

export function coverLetter(profile: Profile, jd: JDAnalysis, tone: CoverLetter["tone"]): Promise<CoverLetter> {
  return withPace(async () => {
    profile = resumeProfile(profile);
    const data = (await ask("coverLetter", { tone, profile, jd })) as { text?: unknown } | null;
    return typeof data?.text === "string" && data.text.trim() ? { tone, text: data.text.trim() } : localCoverLetter(profile, jd, tone);
  });
}

export function interviewPrep(profile: Profile, jd: JDAnalysis, m: Match | null, plan: Gap[] | null): Promise<InterviewQuestion[]> {
  return withPace(async () => {
    const data = await ask("interviewPrep", { profile, jd, gaps: m?.requirements.filter((r) => r.status !== "strong"), plan });
    const questions = data ? normalizeInterview(data) : [];
    return questions.length ? questions : localInterview(profile, jd, m, plan);
  });
}

export function coachBullet(line: string): Promise<BulletCoaching> {
  return withPace(async () => {
    if (!line.trim()) throw new Error("Paste a line from your resume first.");
    const data = await ask("coachBullet", line.slice(0, 600));
    const coaching = data ? normalizeCoaching(data) : null;
    return coaching?.improved ? coaching : localCoach(line);
  });
}

/** Search pages on well-known course sites. Used when web search isn't available; nothing is made up. */
export function courseSearchLinks(skill: string): Course[] {
  const q = encodeURIComponent(skill);
  const sites: [string, string, boolean | null][] = [
    ["Coursera", `https://www.coursera.org/search?query=${q}`, null],
    ["edX", `https://www.edx.org/search?q=${q}`, null],
    ["freeCodeCamp", `https://www.freecodecamp.org/news/search/?query=${q}`, true],
    ["YouTube", `https://www.youtube.com/results?search_query=${encodeURIComponent(`${skill} full course`)}`, true],
    ["Udemy", `https://www.udemy.com/courses/search/?q=${q}`, null],
  ];
  return sites.map(([provider, url, free]) => ({
    id: `search_${provider.toLowerCase()}_${skill.toLowerCase().replace(/[^a-z0-9]/g, "")}`,
    skill,
    title: `${skill} courses on ${provider}`,
    provider,
    url,
    free,
    level: "",
    duration: "",
    why: "",
    source: "search" as const,
  }));
}

/**
 * Suggests real, current courses for several gap skills in ONE web-search call (fewer tokens
 * than one call per skill). Without AI or web search, returns search links on course sites.
 */
export async function findCourses(skills: string[], role: string): Promise<Record<string, CourseSearch>> {
  const list = [...new Set(skills.map((s) => s.trim()).filter(Boolean))].slice(0, 4);
  const now = Date.now();
  let found: Record<string, Course[]> = {};
  try {
    const data = list.length ? await ask("findCourses", { skills: list, role }) : null;
    if (data) found = normalizeCourses(data, list);
  } catch (err) {
    if ((err as { code?: string }).code !== "search_unavailable") throw err;
  }
  return Object.fromEntries(
    list.map((skill) => {
      const web = found[skill.toLowerCase()];
      return [skill.toLowerCase(), web?.length ? { courses: web, searchedAt: now, source: "web" as const } : { courses: courseSearchLinks(skill), searchedAt: now, source: "search" as const }];
    }),
  );
}

/**
 * Reads a LinkedIn PDF export. The layout is fixed, so it is read in the browser first;
 * the AI (a short, low-effort task) is only asked when that finds nothing.
 */
export async function importLinkedIn(file: File, name: string): Promise<LinkedInExtract> {
  if (!isPdf(file)) throw new Error("Choose the PDF you saved from LinkedIn.");
  if (file.size > MAX_UPLOAD_BYTES) throw new Error("That file is over 5 MB. Try a smaller file.");
  let text: string;
  try {
    text = await pdfText(file, 6);
  } catch {
    throw new Error("We couldn't open that PDF. Save it from LinkedIn again and retry.");
  }
  if (text.trim().length < 40) throw new Error("We couldn't read text from this PDF. Use LinkedIn’s Save to PDF, not a screenshot.");
  const local = parseLinkedInText(text, name);
  if (extractedAnything(local)) return local;
  const data = await ask("parseLinkedIn", text.slice(0, 12_000));
  const ai = data ? normalizeLinkedIn(data) : null;
  if (ai && extractedAnything(ai)) return ai;
  throw new Error("We couldn’t find Skills, Experience or Certifications in that PDF. Make sure it’s the Save to PDF file from your LinkedIn profile.");
}
