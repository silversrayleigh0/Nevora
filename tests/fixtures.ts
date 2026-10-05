// Sample student used by the unit tests. Placeholders in brackets are intentional.
import type { Account, Application, Gap, Insights, JDAnalysis, Match, Profile, TailoredResume, Verification } from "../shared/types";

export const SAMPLE_JD_TEXT = `Frontend Developer Intern — Acme Labs (Chennai)

About the role
We're looking for a frontend intern to help build and improve our customer dashboard.

Requirements
• Strong knowledge of JavaScript and React
• Experience integrating REST APIs
• Familiarity with Git and version control
• Good communication and teamwork

Nice to have
• TypeScript
• Unit testing with Jest
• Docker basics

What you'll do
• Build reusable UI components
• Connect screens to backend APIs
• Work with designers to polish the user experience`;

const account: Account = {
  name: "Priya Sharma",
  email: "priya.sharma@email.com",
  phone: "+91 [phone number]",
  city: "Chennai",
  status: "student",
  gradYear: "2027",
  interests: ["Frontend", "Full stack"],
};

const profile: Profile = {
  basics: {
    name: "Priya Sharma",
    email: "priya.sharma@email.com",
    phone: "+91 [phone number]",
    location: "Chennai",
    links: ["linkedin.com/in/[handle]", "github.com/[handle]"],
  },
  summary: "",
  education: [
    { id: "edu_1", institution: "[College name]", degree: "B.Tech", field: "Computer Science and Engineering", start: "2023", end: "2027", score: "CGPA 8.4" },
  ],
  experience: [
    {
      id: "exp_1",
      role: "Web Development Intern",
      org: "[Company name]",
      start: "Jun 2025",
      end: "Jul 2025",
      bullets: [
        { id: "exp_1_b1", text: "Built reusable React components for the company's internal dashboard." },
        { id: "exp_1_b2", text: "Fixed UI bugs and improved page layouts on mobile screens." },
      ],
    },
  ],
  projects: [
    {
      id: "proj_1",
      name: "CampusConnect — College fest web app",
      tech: ["React", "Node.js", "Express", "MongoDB"],
      link: "",
      bullets: [
        { id: "proj_1_b1", text: "Made a website for our college fest using React." },
        { id: "proj_1_b2", text: "Wrote backend APIs in Express for registrations." },
        { id: "proj_1_b3", text: "Led a team of 4 students and reviewed code on GitHub." },
      ],
    },
    {
      id: "proj_2",
      name: "Portfolio website",
      tech: ["React", "CSS"],
      link: "",
      bullets: [{ id: "proj_2_b1", text: "Designed and built a personal portfolio to show my projects." }],
    },
    {
      id: "proj_3",
      name: "Expense tracker",
      tech: ["Python", "Flask", "SQLite"],
      link: "",
      bullets: [
        { id: "proj_3_b1", text: "Built a web app to track daily expenses by category." },
        { id: "proj_3_b2", text: "Added monthly charts using Flask templates." },
      ],
    },
  ],
  skills: [
    { id: "skill_1", name: "JavaScript", category: "language" },
    { id: "skill_2", name: "TypeScript", category: "language" },
    { id: "skill_3", name: "Python", category: "language" },
    { id: "skill_4", name: "SQL", category: "language" },
    { id: "skill_5", name: "React", category: "framework" },
    { id: "skill_6", name: "Node.js", category: "framework" },
    { id: "skill_7", name: "Express", category: "framework" },
    { id: "skill_8", name: "Flask", category: "framework" },
    { id: "skill_9", name: "Git", category: "tool" },
    { id: "skill_10", name: "Figma", category: "tool" },
    { id: "skill_11", name: "VS Code", category: "tool" },
    { id: "skill_12", name: "MongoDB", category: "tool" },
  ],
  certifications: [{ id: "cert_1", name: "Responsive Web Design", issuer: "freeCodeCamp", date: "Mar 2025", credential: "" }],
  achievements: [
    { id: "ach_1", text: "Finalist, [Hackathon name] 2025" },
    { id: "ach_2", text: "Technical lead, Coding Club" },
  ],
};

const insights: Insights = {
  strengths: [
    { area: "Frontend", level: "Strong", score: 85 },
    { area: "Backend", level: "Growing", score: 55 },
    { area: "Design", level: "Growing", score: 45 },
    { area: "Data", level: "Beginner", score: 25 },
  ],
  roles: [
    { title: "Frontend Developer Intern", fit: 84 },
    { title: "Full-stack Intern", fit: 71 },
    { title: "UI Engineer Intern", fit: 66 },
  ],
};

const acmeJD: JDAnalysis = {
  title: "Frontend Developer Intern",
  company: "Acme Labs",
  location: "Chennai",
  seniority: "intern",
  mustHave: [
    { skill: "JavaScript", normalized: "javascript" },
    { skill: "React", normalized: "react" },
    { skill: "REST APIs", normalized: "rest apis" },
    { skill: "Git", normalized: "git" },
  ],
  niceToHave: [
    { skill: "TypeScript", normalized: "typescript" },
    { skill: "Jest", normalized: "jest" },
    { skill: "Docker", normalized: "docker" },
  ],
  responsibilities: ["Build reusable UI components", "Connect screens to backend APIs", "Polish the user experience with designers"],
  softSkills: ["Communication", "Teamwork"],
  keywords: ["frontend", "dashboard", "React", "REST APIs", "UI components", "Git"],
  education: "Pursuing a degree in computer science or a related field",
};

const acmeMatch: Match = {
  score: 76,
  breakdown: { must: 88, nice: 17, soft: 100, education: 100 },
  requirements: [
    { requirement: "JavaScript", type: "must", status: "strong", evidenceIds: ["proj_1", "proj_2", "exp_1"], note: "Used across your projects and internship" },
    { requirement: "React", type: "must", status: "strong", evidenceIds: ["proj_1_b1", "exp_1_b1"], note: "Built the CampusConnect frontend" },
    { requirement: "REST APIs", type: "must", status: "strong", evidenceIds: ["proj_1_b2"], note: "Wrote Express APIs for registrations" },
    { requirement: "Git", type: "must", status: "partial", evidenceIds: ["skill_9", "proj_1_b3"], note: "Listed as a skill, mentioned once" },
    { requirement: "TypeScript", type: "nice", status: "partial", evidenceIds: ["skill_2"], note: "Listed, but not used in a project yet" },
    { requirement: "Jest", type: "nice", status: "missing", evidenceIds: [], note: "Not found in your profile" },
    { requirement: "Docker", type: "nice", status: "missing", evidenceIds: [], note: "Not found in your profile" },
    { requirement: "Communication", type: "soft", status: "strong", evidenceIds: ["proj_1_b3"], note: "Led a team of 4 and reviewed code" },
    { requirement: "Teamwork", type: "soft", status: "strong", evidenceIds: ["ach_2"], note: "Technical lead, Coding Club" },
    { requirement: "Degree in computer science", type: "education", status: "strong", evidenceIds: ["edu_1"], note: "B.Tech CSE, graduating 2027" },
  ],
};

const acmeResume: TailoredResume = {
  summary:
    "Computer Science undergraduate (2027) focused on frontend development, with hands-on experience building React applications and integrating REST APIs.",
  skills: [
    { category: "Languages", items: ["JavaScript", "TypeScript", "Python", "SQL"] },
    { category: "Frameworks", items: ["React", "Node.js", "Express"] },
    { category: "Tools", items: ["Git", "Figma", "VS Code", "MongoDB"] },
  ],
  sections: [
    {
      key: "projects",
      items: [
        {
          refId: "proj_1",
          heading: "CampusConnect — College fest web app",
          meta: "React, Node.js, Express, MongoDB",
          bullets: [
            {
              id: "t1",
              text: "Built a responsive React web app that lets students register for college fest events [add metric]",
              sourceIds: ["proj_1_b1"],
              originalText: "Made a website for our college fest using React.",
              changeReason: "Starts with a strong verb and leads with React, a required skill. Add a number to show impact.",
              needsMetric: true,
            },
            {
              id: "t2",
              text: "Developed REST APIs with Node.js and Express for event registration",
              sourceIds: ["proj_1_b2"],
              originalText: "Wrote backend APIs in Express for registrations.",
              changeReason: "Uses the job's exact term, REST APIs. Your project already shows this skill.",
              needsMetric: false,
            },
            {
              id: "t3",
              text: "Led a team of 4 students, coordinating tasks and code reviews on GitHub",
              sourceIds: ["proj_1_b3"],
              originalText: "Led a team of 4 students and reviewed code on GitHub.",
              changeReason: "Shows teamwork and Git together — both appear in the job description.",
              needsMetric: false,
            },
          ],
        },
        {
          refId: "proj_2",
          heading: "Portfolio website",
          meta: "React, CSS",
          bullets: [
            {
              id: "t4",
              text: "Designed and built a personal portfolio in React to showcase projects",
              sourceIds: ["proj_2_b1"],
              originalText: "Designed and built a personal portfolio to show my projects.",
              changeReason: "Names the framework so recruiters see React again.",
              needsMetric: false,
            },
          ],
        },
      ],
    },
    {
      key: "experience",
      items: [
        {
          refId: "exp_1",
          heading: "Web Development Intern — [Company name]",
          meta: "Jun 2025 – Jul 2025",
          bullets: [
            {
              id: "t5",
              text: "Built reusable React components for an internal dashboard",
              sourceIds: ["exp_1_b1"],
              originalText: "Built reusable React components for the company's internal dashboard.",
              changeReason: "Matches 'build reusable UI components' from the role.",
              needsMetric: false,
            },
            {
              id: "t6",
              text: "Fixed UI bugs and improved page layouts on mobile screens",
              sourceIds: ["exp_1_b2"],
              originalText: "Fixed UI bugs and improved page layouts on mobile screens.",
              changeReason: "Kept as is — it already reads clearly.",
              needsMetric: false,
            },
            {
              id: "t7",
              text: "Experienced with Docker deployments and containerization",
              sourceIds: [],
              originalText: "",
              changeReason: "Added manually.",
              needsMetric: false,
            },
          ],
        },
      ],
    },
    {
      key: "education",
      items: [
        {
          refId: "edu_1",
          heading: "B.Tech, Computer Science and Engineering — [College name]",
          meta: "2023 – 2027",
          subheading: "CGPA 8.4",
          bullets: [],
        },
      ],
    },
    { key: "certifications", items: [{ refId: "cert_1", heading: "Responsive Web Design — freeCodeCamp", meta: "2025", bullets: [] }] },
  ],
  omittedIds: ["proj_3"],
  orderNotes: [
    { change: "Projects moved above Experience", reason: "Your projects match this role more closely than your internship." },
    { change: "React and JavaScript listed first", reason: "Recruiters scan the first skills. These are required for this job." },
  ],
};

const acmeVerifications: Verification[] = [
  { bulletId: "t1", supported: true },
  { bulletId: "t2", supported: true },
  { bulletId: "t3", supported: true },
  { bulletId: "t4", supported: true },
  { bulletId: "t5", supported: true },
  { bulletId: "t6", supported: true },
  { bulletId: "t7", supported: false, issue: "Docker isn't in any of your projects or experience. Remove it, or add a project that shows it." },
];

const acmePlan: Gap[] = [
  {
    skill: "TypeScript",
    priority: "high",
    timeEstimate: "About 1 week",
    why: "Acme Labs lists TypeScript as a plus. You've listed it as a skill, but no project shows it yet.",
    steps: [
      "Learn types, interfaces and generics",
      "Type the props of your React components",
      "Convert one CampusConnect screen to TypeScript",
      "Add the update to your Nevora profile",
    ],
    resources: [
      { title: "TypeScript Handbook (official docs)", type: "docs" },
      { title: "React TypeScript Cheatsheet", type: "docs" },
    ],
    miniProject: "Migrate the CampusConnect registration form to TypeScript.",
  },
  {
    skill: "Jest",
    priority: "medium",
    timeEstimate: "About 4 days",
    why: "Testing is a good-to-have for this role and shows you care about code quality.",
    steps: ["Learn the basics of unit tests", "Test one React component with React Testing Library", "Add tests to your portfolio project"],
    resources: [
      { title: "Jest docs: Getting started", type: "docs" },
      { title: "React Testing Library docs", type: "docs" },
    ],
    miniProject: "Write tests for your portfolio's contact form.",
  },
  {
    skill: "Docker",
    priority: "medium",
    timeEstimate: "About 1 week",
    why: "Docker basics help you ship projects the way teams do. It's listed as a nice-to-have.",
    steps: [
      "Understand images and containers",
      "Write a Dockerfile for a Node.js API",
      "Run CampusConnect's API in a container",
      "Add Docker to the project in your profile",
    ],
    resources: [
      { title: "Docker docs: Get started", type: "docs" },
      { title: "Docker's Node.js language guide", type: "docs" },
    ],
    miniProject: "Containerize the CampusConnect API.",
  },
];

const DAY = 864e5;

function applications(now: number): Application[] {
  const base = { verifications: null, plan: null, planDone: {}, hiddenSections: [], coverLetter: null, interview: null, resume: null };
  return [
    {
      ...base,
      id: "app_acme",
      name: "Frontend Intern – Acme Labs",
      createdAt: now,
      updatedAt: now,
      jdText: SAMPLE_JD_TEXT,
      jd: acmeJD,
      match: acmeMatch,
      resume: acmeResume,
      verifications: acmeVerifications,
      plan: acmePlan,
      planDone: { "0-0": true, "0-1": true },
    },
    {
      ...base,
      id: "app_northwind",
      name: "Data Analyst – Northwind",
      createdAt: now - 3 * DAY,
      updatedAt: now - 3 * DAY,
      jdText: "Data Analyst Intern — Northwind\n\nRequirements\n• SQL\n• Excel\n• Python (pandas)\n• Communication",
      jd: {
        title: "Data Analyst Intern",
        company: "Northwind",
        seniority: "intern",
        mustHave: [
          { skill: "SQL", normalized: "sql" },
          { skill: "Excel", normalized: "excel" },
          { skill: "Python", normalized: "python" },
        ],
        niceToHave: [{ skill: "Power BI", normalized: "power bi" }],
        responsibilities: ["Build weekly reports"],
        softSkills: ["Communication"],
        keywords: ["SQL", "reports"],
      },
      match: { score: 64, breakdown: { must: 73, nice: 0, soft: 100, education: 100 }, requirements: [] },
    },
    {
      ...base,
      id: "app_globex",
      name: "SDE Intern – Globex",
      createdAt: now - 8 * DAY,
      updatedAt: now - 8 * DAY,
      jdText: "Software Engineer Intern — Globex\n\nRequirements\n• Data structures and algorithms\n• Java or Python\n• Git",
      jd: {
        title: "Software Engineer Intern",
        company: "Globex",
        seniority: "intern",
        mustHave: [
          { skill: "Data structures", normalized: "data structures" },
          { skill: "Python", normalized: "python" },
          { skill: "Git", normalized: "git" },
        ],
        niceToHave: [],
        responsibilities: ["Write and test backend features"],
        softSkills: ["Teamwork"],
        keywords: ["DSA", "Python"],
      },
      match: { score: 71, breakdown: { must: 85, nice: 0, soft: 100, education: 100 }, requirements: [] },
    },
  ];
}

export function demoState() {
  const apps = applications(Date.now());
  return {
    account: structuredClone(account),
    profile: structuredClone(profile),
    insights: structuredClone(insights),
    applications: apps,
    activeId: apps[0].id,
  };
}
