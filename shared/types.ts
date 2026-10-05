// Data model shared by the web app and the AI endpoint.

export type Bullet = { id: string; text: string };

export type SkillCategory = "language" | "framework" | "tool" | "concept" | "soft";

export type Profile = {
  /** photo: optional square JPEG data URL, used only by photo templates. */
  basics: { name: string; email: string; phone: string; location: string; links: string[]; photo?: string };
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
  experience: { id: string; role: string; org: string; start: string; end: string; bullets: Bullet[]; proof?: Proof }[];
  projects: { id: string; name: string; tech: string[]; link: string; bullets: Bullet[] }[];
  skills: { id: string; name: string; category: SkillCategory }[];
  certifications: { id: string; name: string; issuer: string; date: string; credential: string; proof?: Proof }[];
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
  linkedin?: LinkedInData;
  savedCourses?: Course[];
};

/** Identity shared by "Sign in with LinkedIn" (OpenID Connect). LinkedIn gives nothing more to standard apps. */
export type LinkedInIdentity = { sub: string; name: string; email: string; picture: string; connectedAt: number };

/** LinkedIn details kept on the account: who connected, and what their exported profile PDF contained. */
export type LinkedInData = {
  identity?: LinkedInIdentity;
  /** Parsed from the LinkedIn "Save to PDF" export. */
  imported?: Profile;
  importedAt?: number;
  fileName?: string;
  /** Suggestion keys the person chose not to add. */
  dismissed?: string[];
};

/** A course found by web search (source "web") or a search link built without AI (source "search"). */
export type Course = {
  id: string;
  skill: string;
  title: string;
  provider: string;
  url: string;
  free: boolean | null;
  level: string;
  duration: string;
  why: string;
  source: "web" | "search";
};

export type CourseSearch = { courses: Course[]; searchedAt: number; source: "web" | "search" };

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
  /** Name and contact line as edited on this resume; falls back to the profile when absent. */
  header?: { name: string; contact: string };
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

/** Result of checking an uploaded certificate or experience proof against the profile. */
export type ProofCheck = {
  verdict: "verified" | "mismatch" | "unreadable" | "not_a_document";
  documentType: string;
  holderName: string;
  issuer: string;
  title: string;
  role: string;
  date: string;
  startDate: string;
  endDate: string;
  nameMatches: boolean;
  detailsMatch: boolean;
  concerns: string[];
  reason: string;
};

/** What the profile keeps about a check (the image itself is never stored). */
export type Proof = { status: "verified" | "rejected"; reason: string; fileName: string; checkedAt: number; documentType: string };

export type ToggleSection = "summary" | "skills" | SectionKey;

/** A saved copy of a resume, kept when it's generated, regenerated or downloaded. */
export type ResumeVersion = {
  id: string;
  name: string;
  createdAt: number;
  kind: "generated" | "edited" | "downloaded";
  resume: TailoredResume;
  hiddenSections: ToggleSection[];
  template?: TemplateId;
};

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
  versions?: ResumeVersion[];
  template?: TemplateId;
  /** Course search results per gap skill (lowercase key). */
  courses?: Record<string, CourseSearch>;
};

export type TemplateId = "classic" | "modern" | "traditional" | "professional" | "corporate" | "centered";

/** Tasks the AI endpoint accepts. Prompts live on the server only. */
export type AiTask =
  | "parseResume"
  | "verifyDocument"
  | "insights"
  | "analyzeJD"
  | "match"
  | "tailor"
  | "verify"
  | "learningPlan"
  | "coverLetter"
  | "interviewPrep"
  | "coachBullet"
  | "findCourses";
