// Every AI feature in one place. Each action asks the server first and falls
// back to the deterministic engine ("basic mode") when AI isn't available.
import { create } from "zustand";
import type {
  AiTask,
  BulletCoaching,
  CertificateDetails,
  CoverLetter,
  Gap,
  Insights,
  InterviewQuestion,
  JDAnalysis,
  Match,
  Profile,
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
import { fileToDataUrl, isPdf, MAX_UPLOAD_BYTES, pdfText, resumeText } from "./extract";
import {
  normalizeCertificate,
  normalizeCoaching,
  normalizeInsights,
  normalizeInterview,
  normalizeJD,
  normalizePlan,
  normalizeProfile,
  normalizeRequirements,
  normalizeResume,
  normalizeVerifications,
} from "./normalize";
import { idToken } from "./session";

export type AiMode = "live" | "basic";

/** Whether this deployment has AI configured. Asked once per page load. */
export const useAiStatus = create<{ available: boolean | null }>()(() => ({ available: null }));

let statusRequest: Promise<boolean> | null = null;
export function checkAi(): Promise<boolean> {
  statusRequest ??= fetch("/api/ai", { headers: { Accept: "application/json" } })
    .then((r) => (r.ok ? r.json() : { ai: false }))
    .then((b: { ai?: boolean }) => Boolean(b.ai))
    .catch(() => false)
    .then((ai) => {
      useAiStatus.setState({ available: ai });
      return ai;
    });
  return statusRequest;
}

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
    useAiStatus.setState({ available: false });
    return null;
  }
  throw new Error(body.error?.message || "Something went wrong. Try again.");
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
    const data = await ask("parseResume", source.slice(0, 20_000));
    if (!data) throw new Error("Reading a resume needs Live AI, which isn't available right now. Choose “Build from scratch” to fill in your profile yourself.");
    return normalizeProfile(data);
  });
}

export async function parseCertificate(file: File): Promise<CertificateDetails> {
  if (file.size > 3 * 1024 * 1024) throw new Error("That file is over 3 MB. Try a smaller one.");
  let data: unknown | null;
  if (isPdf(file)) {
    const text = await pdfText(file, 2).catch(() => "");
    if (!text.trim()) throw new Error("We couldn't read that PDF. Type the details instead.");
    data = await ask("parseCertificate", text);
  } else if (/^image\/(png|jpe?g|webp|gif)$/.test(file.type)) {
    data = await ask("parseCertificate", "", await fileToDataUrl(file));
  } else {
    throw new Error("Choose a PDF or an image of the certificate.");
  }
  if (!data) throw new Error("Reading certificates needs Live AI. Type the details instead.");
  return normalizeCertificate(data);
}

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
    const data = await ask("match", { profile, jd });
    const requirements: Requirement[] | null = data ? normalizeRequirements(data, profile) : null;
    return scoreMatch(requirements?.length ? requirements : localMatch(profile, jd));
  });
}

export function tailor(profile: Profile, jd: JDAnalysis, m: Match | null): Promise<TailoredResume> {
  return withPace(async () => {
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
