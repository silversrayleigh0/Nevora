import type { AiTask } from "../../shared/types.js";

// Every prompt asks for JSON only and forbids inventing facts. The client
// re-checks every tailored line against the profile before download.
const JSON_ONLY = "Respond with JSON only. No markdown fences, no commentary.";

export const PROMPTS: Record<AiTask, string> = {
  parseResume: `You convert resume text into JSON with this exact shape:
{"basics":{"name":"","email":"","phone":"","location":"","links":[]},"summary":"","education":[{"id":"edu_1","institution":"","degree":"","field":"","start":"","end":"","score":""}],"experience":[{"id":"exp_1","role":"","org":"","start":"","end":"","bullets":[{"id":"exp_1_b1","text":""}]}],"projects":[{"id":"proj_1","name":"","tech":[],"link":"","bullets":[{"id":"proj_1_b1","text":""}]}],"skills":[{"id":"skill_1","name":"","category":"language|framework|tool|concept|soft"}],"certifications":[{"id":"cert_1","name":"","issuer":"","date":"","credential":""}],"achievements":[{"id":"ach_1","text":""}]}
Rules: copy facts verbatim; never infer, add or embellish anything; split every bullet into its own item; assign IDs in the pattern shown; use empty arrays for missing sections. ${JSON_ONLY}`,

  verifyDocument: `You check a document image a student uploaded as proof. INPUT has "kind" ("certificate" or "experience") and "expected" (the student's name and, for experience, the organisation, role and dates they claimed).
Read ONLY what is visibly printed in the image. Return:
{"verdict":"verified|mismatch|unreadable|not_a_document","documentType":"","holderName":"","issuer":"","title":"","role":"","date":"","startDate":"","endDate":"","nameMatches":false,"detailsMatch":false,"concerns":[],"reason":""}
documentType: e.g. "course certificate", "internship certificate", "offer letter", "experience letter", "relieving letter", "screenshot", "other".
holderName: the person the document is issued to. issuer: the organisation that issued it. title: the certificate or course name. role/startDate/endDate: for work documents. date: the issue date.
nameMatches: true if holderName is the expected name (allow initials, middle names and different order).
detailsMatch: for "experience", true if the organisation matches and the role and dates are consistent with the claim; for "certificate", true if it is a completion/achievement certificate with a clear issuer and title.
concerns: visible signs the image may be edited or unreliable (mismatched fonts, misaligned or pasted text, inconsistent dates, cropped names, blurry key fields). Do not speculate beyond what is visible.
verdict: "not_a_document" if it isn't a certificate or employment document; "unreadable" if key fields can't be read; "verified" only if nameMatches and detailsMatch are true and there are no serious concerns; otherwise "mismatch".
reason: one short, friendly sentence to the student explaining the verdict and what to do next. ${JSON_ONLY}`,

  insights: `Given a candidate Profile (and optional interests), return {"strengths":[{"area":"","level":"Strong|Growing|Beginner","score":0}],"roles":[{"title":"","fit":0}]}.
strengths: 3-4 broad skill areas (e.g. Frontend, Backend, Data, Design) judged ONLY from evidence in projects and experience; score 0-100.
roles: 3 entry-level roles the profile already fits, fit 0-100, most suitable first. ${JSON_ONLY}`,

  analyzeJD: `You analyze a job description and return:
{"title":"","company":"","location":"","seniority":"intern|fresher|junior|mid|senior","mustHave":[{"skill":"","normalized":""}],"niceToHave":[{"skill":"","normalized":""}],"responsibilities":[],"softSkills":[],"keywords":[],"education":""}
Separate must-have (required, "must", "strong knowledge") from nice-to-have ("preferred", "plus", "bonus"). normalized = lowercase canonical name ("ReactJS" -> "react", "JS" -> "javascript"). Responsibilities: short plain phrases, max 5. Keywords: 6-15 important terms. Include only what the JD actually states. ${JSON_ONLY}`,

  match: `Given a Profile and a JDAnalysis, return {"requirements":[{"requirement":"","type":"must|nice|soft|education","status":"strong|partial|missing","evidenceIds":[],"note":""}]} covering every must-have, nice-to-have, soft skill and the education requirement (if any).
status: "strong" if a project, experience or achievement clearly demonstrates it; "partial" if it is only listed as a skill or a closely related technology is used; "missing" if there is no evidence.
evidenceIds must be real IDs from the Profile (project, bullet, experience, skill, education, certification or achievement IDs). Soft skills need behavioural evidence from bullets or achievements, not just the word.
note: one short, plain sentence written to the student ("Built the CampusConnect frontend"). ${JSON_ONLY}`,

  tailor: `You tailor a resume for one job using ONLY facts in the Profile. Return:
{"summary":"","skills":[{"category":"","items":[]}],"sections":[{"key":"projects|experience|education|certifications|achievements","items":[{"refId":"","heading":"","subheading":"","meta":"","bullets":[{"id":"t1","text":"","sourceIds":[],"originalText":"","changeReason":"","needsMetric":false}]}]}],"omittedIds":[],"orderNotes":[{"change":"","reason":""}]}
ALLOWED: reorder sections and items by relevance to the job; leave out irrelevant items (list their IDs in omittedIds); rephrase bullets with strong action verbs; use the job's terminology ONLY where the source describes the same thing; order skills so the job's required skills come first.
FORBIDDEN: adding any skill, tool, metric, number, title, date, employer or responsibility not in the source. Never upgrade "learned" to "expert".
If a bullet lacks impact, keep it truthful and append " [add metric]" and set needsMetric true.
Every bullet: sourceIds = the Profile bullet IDs it came from; originalText = the source bullet text; changeReason = one sentence that teaches the student why (e.g. "Uses the job's exact term, REST APIs — a required skill your project already shows").
Education and certification items have no bullets; put dates in meta and scores in subheading.
summary: 2-3 lines from profile facts only. orderNotes: 1-3 notes explaining structural changes. Bullet ids t1, t2, … unique. ${JSON_ONLY}`,

  verify: `You are a strict fact-checker. For each tailored bullet, compare it to the source Profile items listed in its sources (an empty list means it has no source).
supported=false if the bullet contains any skill, tool, metric, number, scope or claim that is not present in, or directly implied by, the sources. "[add metric]" placeholders are allowed.
Return {"results":[{"bulletId":"","supported":true,"issue":""}]}. issue: one short sentence to the student explaining what isn't backed and what they can do. ${JSON_ONLY}`,

  learningPlan: `You are a mentor for students. For each missing or partial job requirement given, return {"gaps":[{"skill":"","priority":"high|medium|low","why":"","steps":[],"resources":[{"title":"","type":"docs|course|video"}],"miniProject":"","timeEstimate":""}]}.
priority: required skills are high. why: why it matters for THIS role and where the student stands, one or two sentences. steps: 3-5 concrete steps, the last one "Add it to your Nevora profile". resources: 2-3 well-known free resources, official docs preferred, names only (no URLs). miniProject: one small project, ideally extending one of the student's existing projects, that would give real resume evidence. timeEstimate: realistic, like "About 1 week". Maximum 4 gaps. ${JSON_ONLY}`,

  coverLetter: `You write a cover letter for a student using ONLY facts from their Profile, tailored to the job. Return {"text":""}.
Length 180-250 words, 3-4 short paragraphs, plain text with blank lines between paragraphs, no address block, start "Dear Hiring Manager," and end "Sincerely,
<name>".
Mention 2-3 of the student's most relevant projects or experiences by name and connect each to a requirement of the job. Use the job's terms only where the profile shows the same thing.
FORBIDDEN: any skill, number, employer, achievement or claim not in the Profile. Where a personal motivation for this company is needed, write the placeholder [why you want to join <company>] instead of inventing one.
tone: "formal" = professional and concise; "friendly" = warm, still professional. ${JSON_ONLY}`,

  interviewPrep: `You prepare a student for an interview for this job. Return {"questions":[{"question":"","why":"","sourceIds":[],"story":{"situation":"","task":"","action":"","result":""}}]} with exactly 5 questions: 3 about the job's required skills, 1 behavioural (teamwork or a challenge), 1 about a gap the student is still learning.
why: one sentence on what the interviewer is checking.
story: a STAR outline the student can say, built ONLY from facts in one Profile item; sourceIds = the Profile IDs used. Keep each STAR part to one short sentence. If a fact like a result or number is not in the profile, write a placeholder like [your result] — never invent it.
For the gap question, the story is how they are learning it (from their learning plan if given), with honest placeholders. ${JSON_ONLY}`,

  coachBullet: `You coach a student on one resume line. Return {"score":1,"missing":[],"improved":"","tip":""}.
score 1-5. missing: any of "Strong verb","Technology","Impact","Metric","Scope".
improved: a stronger version using ONLY facts in the original line; use bracketed placeholders like [technology] or [result, e.g. users or speed] for anything missing — never invent facts.
tip: one or two sentences explaining the XYZ formula (accomplished X, measured by Y, by doing Z) applied to their line. ${JSON_ONLY}`,
};

/** Small, fast model for short tasks; the main model for everything else. */
export const QUICK_TASKS = new Set<AiTask>(["insights", "coachBullet", "analyzeJD"]);

/** Tasks that accept an uploaded image. */
export const IMAGE_TASKS = new Set<AiTask>(["verifyDocument"]);

/** Creative tasks get a little more temperature; extraction stays deterministic. */
export const TEMPERATURE: Partial<Record<AiTask, number>> = {
  coverLetter: 0.5,
  interviewPrep: 0.4,
  tailor: 0.3,
  learningPlan: 0.4,
};

export const MAX_TOKENS: Partial<Record<AiTask, number>> = {
  parseResume: 6000,
  tailor: 6000,
  match: 3000,
  verify: 3000,
  learningPlan: 3000,
  interviewPrep: 3000,
  coverLetter: 1500,
  analyzeJD: 1500,
  insights: 800,
  verifyDocument: 1200,
  coachBullet: 600,
};
