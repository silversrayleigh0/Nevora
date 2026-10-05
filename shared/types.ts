// Data model shared by the web app and the AI endpoint.

export type Bullet = { id: string; text: string };

export type SkillCategory = "language" | "framework" | "tool" | "concept" | "soft";

export type Profile = {
  basics: { name: string; email: string; phone: string; location: string; links: string[] };
  summary: string;
  education: {
    id: string;
    institution: string;
    degree: string;
    field: string;
    start: string;
    end: string;
    score: string;
  }[];
  experience: { id: string; role: string; org: string; start: string; end: string; bullets: Bullet[] }[];
  projects: { id: string; name: string; tech: string[]; link: string; bullets: Bullet[] }[];
  skills: { id: string; name: string; category: SkillCategory }[];
  certifications: { id: string; name: string; issuer: string; date: string; credential: string }[];
  achievements: Bullet[];
};

export type CareerStatus = "student" | "grad" | "early" | "switch";

export type Account = {
  name: string;
  email: string;
  phone: string;
  city: string;
  status: CareerStatus;
  gradYear: string;
  interests: string[];
};

export type Insights = {
  strengths: { area: string; level: "Strong" | "Growing" | "Beginner"; score: number }[];
  roles: { title: string; fit: number }[];
};

export type JDSkill = { skill: string; normalized: string };

export type JDAnalysis = {
  title: string;
  company?: string;
  location?: string;
  seniority: "intern" | "fresher" | "junior" | "mid" | "senior";
  mustHave: JDSkill[];
  niceToHave: JDSkill[];
  responsibilities: string[];
  softSkills: string[];
  keywords: string[];
  education?: string;
};

export type RequirementType = "must" | "nice" | "soft" | "education";
export type MatchStatus = "strong" | "partial" | "missing";

export type Requirement = {
  requirement: string;
  type: RequirementType;
  status: MatchStatus;
  evidenceIds: string[];
  note: string;
};

export type Match = {
  score: number;
  breakdown: Record<RequirementType, number>;
  requirements: Requirement[];
};

export type TailoredBullet = {
  id: string;
  text: string;
  sourceIds: string[];
  originalText: string;
  changeReason: string;
  needsMetric: boolean;
};

export type SectionKey = "projects" | "experience" | "education" | "certifications" | "achievements";

export type ResumeItem = {
  refId: string;
  heading: string;
  subheading?: string;
  meta?: string;
  bullets: TailoredBullet[];
};

export type TailoredResume = {
  summary: string;
  skills: { category: string; items: string[] }[];
  sections: { key: SectionKey; items: ResumeItem[] }[];
  omittedIds: string[];
  orderNotes: { change: string; reason: string }[];
};

export type Verification = { bulletId: string; supported: boolean; issue?: string };

export type Gap = {
  skill: string;
  priority: "high" | "medium" | "low";
  why: string;
  steps: string[];
  resources: { title: string; type: "docs" | "course" | "video" }[];
  miniProject: string;
  timeEstimate: string;
};

export type CoverLetter = { tone: "formal" | "friendly"; text: string };

export type InterviewQuestion = {
  question: string;
  why: string;
  sourceIds: string[];
  story: { situation: string; task: string; action: string; result: string };
};

export type BulletCoaching = { score: number; missing: string[]; improved: string; tip: string };

export type CertificateDetails = { name: string; issuer: string; date: string; credential: string };

export type ToggleSection = "summary" | "skills" | SectionKey;

export type Application = {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  jdText: string;
  jd: JDAnalysis | null;
  match: Match | null;
  resume: TailoredResume | null;
  verifications: Verification[] | null;
  plan: Gap[] | null;
  planDone: Record<string, boolean>;
  hiddenSections: ToggleSection[];
  coverLetter?: CoverLetter | null;
  interview?: InterviewQuestion[] | null;
};

/** Tasks the AI endpoint accepts. Prompts live on the server only. */
export type AiTask =
  | "parseResume"
  | "parseCertificate"
  | "insights"
  | "analyzeJD"
  | "match"
  | "tailor"
  | "verify"
  | "learningPlan"
  | "coverLetter"
  | "interviewPrep"
  | "coachBullet";
