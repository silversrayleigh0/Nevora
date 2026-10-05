// Choices for the profile dropdowns. "Other" lets people type anything not listed.
import type { SkillCategory } from "../../shared/types";

export const OTHER = "__other__";

export const DEGREES = [
  "B.Tech", "B.E.", "B.Sc", "BCA", "B.Com", "BBA", "B.A.", "B.Arch", "B.Des",
  "M.Tech", "M.E.", "M.Sc", "MCA", "MBA", "M.Com", "M.A.", "Ph.D.",
  "Integrated M.Tech", "Diploma", "Higher Secondary (12th)", "Secondary (10th)",
];

export const BRANCHES = [
  "Computer Science and Engineering",
  "Information Technology",
  "Artificial Intelligence and Data Science",
  "Artificial Intelligence and Machine Learning",
  "Computer Science and Business Systems",
  "Cyber Security",
  "Data Science",
  "Electronics and Communication Engineering",
  "Electrical and Electronics Engineering",
  "Electronics and Instrumentation Engineering",
  "Mechanical Engineering",
  "Mechatronics",
  "Civil Engineering",
  "Chemical Engineering",
  "Biotechnology",
  "Biomedical Engineering",
  "Aeronautical Engineering",
  "Automobile Engineering",
  "Computer Applications",
  "Computer Science",
  "Mathematics",
  "Physics",
  "Statistics",
  "Commerce",
  "Business Administration",
  "Economics",
  "Design",
];

const THIS_YEAR = new Date().getFullYear();
/** Years from oldest to six years ahead (expected graduation). */
export const YEARS = Array.from({ length: 36 }, (_, i) => String(THIS_YEAR + 6 - i));

export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export const SKILL_CATALOG: { name: string; category: SkillCategory }[] = [
  ...["JavaScript", "TypeScript", "Python", "Java", "C", "C++", "C#", "Go", "Rust", "Kotlin", "Swift", "Dart", "PHP", "Ruby", "R", "SQL", "HTML", "CSS", "Bash", "MATLAB", "Scala"].map(
    (name) => ({ name, category: "language" as const }),
  ),
  ...[
    "React", "Next.js", "Angular", "Vue", "Svelte", "Node.js", "Express", "NestJS", "Django", "Flask", "FastAPI", "Spring Boot", "Laravel",
    "Ruby on Rails", ".NET", "Flutter", "React Native", "Tailwind CSS", "Bootstrap", "Redux", "jQuery", "TensorFlow", "PyTorch",
    "scikit-learn", "pandas", "NumPy", "Keras", "OpenCV", "Hugging Face Transformers", "LangChain", "Jest", "JUnit", "Selenium", "Cypress",
  ].map((name) => ({ name, category: "framework" as const })),
  ...[
    "Git", "GitHub", "GitLab", "Docker", "Kubernetes", "AWS", "Azure", "Google Cloud", "Firebase", "Vercel", "Linux", "VS Code", "Postman",
    "Figma", "Jira", "MongoDB", "PostgreSQL", "MySQL", "SQLite", "Redis", "Supabase", "Excel", "Power BI", "Tableau", "Jupyter",
    "Android Studio", "Jenkins", "GitHub Actions", "Terraform", "Nginx",
  ].map((name) => ({ name, category: "tool" as const })),
  ...[
    "Data structures", "Algorithms", "Object-oriented programming", "REST APIs", "GraphQL", "Machine learning", "Deep learning",
    "Natural language processing", "Computer vision", "Data analysis", "Data visualization", "DBMS", "Operating systems",
    "Computer networks", "System design", "Microservices", "Unit testing", "CI/CD", "Agile", "UI/UX design", "Responsive design",
    "Cloud computing", "Cybersecurity", "Statistics",
  ].map((name) => ({ name, category: "concept" as const })),
  ...["Communication", "Teamwork", "Leadership", "Problem solving", "Time management", "Critical thinking", "Adaptability", "Public speaking"].map(
    (name) => ({ name, category: "soft" as const }),
  ),
];

/** Best guess at a skill's category, for skills typed freely or read from a resume. */
export function categorize(name: string): SkillCategory {
  const known = SKILL_CATALOG.find((s) => s.name.toLowerCase() === name.trim().toLowerCase());
  return known?.category ?? "tool";
}

/** Splits "Jun 2025" / "June 2025" / "2025" / "Present" into picker parts. */
export function parseMonthYear(value: string): { month: string; year: string; present: boolean } {
  const v = value.trim();
  if (/^(present|current|now|ongoing)$/i.test(v)) return { month: "", year: "", present: true };
  const year = v.match(/(19|20)\d{2}/)?.[0] ?? "";
  const month = MONTHS.find((m) => new RegExp(`\\b${m}`, "i").test(v)) ?? "";
  return { month, year, present: false };
}

export const formatMonthYear = (month: string, year: string) => [month, year].filter(Boolean).join(" ");
