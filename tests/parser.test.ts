import { describe, expect, it } from "vitest";
import { normalizeProfile } from "../src/lib/normalize";
import { parseResumeText } from "../src/lib/resumeParser";

const MARKDOWN = `# Arun Kumar
Chennai | arun.kumar@example.com | +91 98765 43210 | github.com/arunk | linkedin.com/in/arunk

## SUMMARY
Final-year computer science student who enjoys building web apps.

## EDUCATION
**B.Tech in Computer Science and Engineering — Sample Institute of Technology**
2022 – 2026 · CGPA 8.2

## SKILLS
Languages: Python, JavaScript, SQL
Frameworks: React, Flask
Tools: Git, VS Code

## PROJECTS
**Campus Events Portal — React, Flask, SQLite**
- Built a portal for students to register for college events.
- Added an admin page to manage event listings.

**Weather Dashboard**
Tech: JavaScript, HTML, CSS
- Showed live weather for any city using a public API.

## EXPERIENCE
**Web Development Intern — Sample Tech Solutions**
June–July 2025
- Created responsive pages from design references.
- Fixed layout issues across mobile and desktop screens.
- Used Git to track changes and collaborate with the team.

## CERTIFICATIONS
- Python for Everybody — Coursera (2024)

## ACTIVITIES
- Participated in a college hackathon as part of a four-member team.
- Presented a working prototype and explained its key features.

## LANGUAGES
Tamil · English`;

describe("parseResumeText", () => {
  const p = parseResumeText(MARKDOWN);
  it("reads the header", () => {
    expect(p.basics.name).toBe("Arun Kumar");
    expect(p.basics.email).toBe("arun.kumar@example.com");
    expect(p.basics.phone).toBe("+91 98765 43210");
    expect(p.basics.location).toBe("Chennai");
    expect(p.basics.links).toEqual(expect.arrayContaining(["github.com/arunk", "linkedin.com/in/arunk"]));
  });
  it("reads education", () => {
    expect(p.education[0]).toMatchObject({ degree: "B.Tech", field: "Computer Science and Engineering", institution: "Sample Institute of Technology", start: "2022", end: "2026" });
    expect(p.education[0].score).toMatch(/CGPA 8.2/);
  });
  it("reads skills with categories", () => {
    const by = Object.fromEntries(p.skills.map((s) => [s.name, s.category]));
    expect(by).toMatchObject({ Python: "language", React: "framework", Git: "tool" });
  });
  it("reads projects with tech and bullets", () => {
    expect(p.projects.map((x) => x.name)).toEqual(["Campus Events Portal", "Weather Dashboard"]);
    expect(p.projects[0].tech).toEqual(["React", "Flask", "SQLite"]);
    expect(p.projects[1].tech).toEqual(["JavaScript", "HTML", "CSS"]);
    expect(p.projects[0].bullets).toHaveLength(2);
  });
  it("reads experience with dates", () => {
    expect(p.experience[0]).toMatchObject({ role: "Web Development Intern", org: "Sample Tech Solutions", start: "June 2025", end: "July 2025" });
    expect(p.experience[0].bullets).toHaveLength(3);
  });
  it("reads certifications and activities, and skips languages", () => {
    expect(p.certifications[0]).toMatchObject({ name: "Python for Everybody", issuer: "Coursera", date: "2024" });
    expect(p.achievements).toHaveLength(2);
    expect(JSON.stringify(p)).not.toMatch(/Tamil/);
  });
  it("handles plain-text resumes with caps headings", () => {
    const q = parseResumeText("Priya S\npriya@x.com\n\nPROJECTS\nTodo App - React\n• Built a todo app\n\nSKILLS\nJava, C++");
    expect(q.basics.name).toBe("Priya S");
    expect(q.projects[0]).toMatchObject({ name: "Todo App", tech: ["React"] });
    expect(q.skills.map((s) => s.name)).toEqual(["Java", "C++"]);
  });
});

describe("bullet glyphs never become entries", () => {
  // Text as pdf.js reads real resumes: bullets on their own line, glued to the text,
  // Word's private-use bullet, several bullets on one line, and dot leaders.
  const PDF_TEXT = `Arun Kumar
Chennai ● arun@example.com ● +91 98765 43210
Skills
Languages: JavaScript ● Python ● SQL
•
Frameworks: React, Flask
Projects
Campus Events Portal | React, Flask
•
Built a portal for students to register for college events
•Added an admin page to manage events
Experience
Web Development Intern — Sample Tech ........ Jun 2025 – Jul 2025
 Built React pages for the dashboard
• Fixed layout bugs • Wrote unit tests for forms
·
Certifications
●
AWS Cloud Practitioner (2024)
Achievements
▪ Won the college hackathon`;

  const p = parseResumeText(PDF_TEXT);
  const everything = JSON.stringify(p);

  it("keeps no item that is only a bullet or dots", () => {
    for (const glyph of ['"•"', '"●"', '"·"', '"▪"', '"\uF0B7"', "...."]) expect(everything).not.toContain(glyph);
    expect(p.projects.map((x) => x.name)).toEqual(["Campus Events Portal"]);
    expect(p.experience).toHaveLength(1);
  });

  it("attaches a bullet on its own line to the next line", () => {
    expect(p.projects[0].bullets.map((b) => b.text)).toEqual(["Built a portal for students to register for college events", "Added an admin page to manage events"]);
  });

  it("reads Word bullets, inline bullets and dot leaders", () => {
    const e = p.experience[0];
    expect([e.role, e.org, e.start, e.end]).toEqual(["Web Development Intern", "Sample Tech", "Jun 2025", "Jul 2025"]);
    expect(e.bullets.map((b) => b.text)).toEqual(["Built React pages for the dashboard", "Fixed layout bugs", "Wrote unit tests for forms"]);
  });

  it("splits skills on bullet separators", () => {
    expect(p.skills.map((s) => s.name)).toEqual(["JavaScript", "Python", "SQL", "React", "Flask"]);
  });

  it("keeps certifications and achievements without their bullets", () => {
    expect(p.certifications.map((c) => [c.name, c.date])).toEqual([["AWS Cloud Practitioner", "2024"]]);
    expect(p.achievements.map((a) => a.text)).toEqual(["Won the college hackathon"]);
  });

  it("doesn't treat a markdown rule as a bullet", () => {
    const md = parseResumeText("Arun Kumar\n---\nSkills\nReact, SQL\n---\nProjects\nPortal\n- Built it");
    expect(md.skills.map((s) => s.name)).toEqual(["React", "SQL"]);
    expect(md.projects.map((x) => x.name)).toEqual(["Portal"]);
  });
});

describe("normalizeProfile drops punctuation-only items (AI output and stored data)", () => {
  const p = normalizeProfile({
    basics: { name: "Arun" },
    skills: ["•", "React", { name: "● Docker" }, "...", ".NET", "C#"],
    projects: [{ name: "•", bullets: ["•"] }, { name: "Portal", bullets: ["• Built it", "·", "Added X........"] }, { name: "", bullets: [] }],
    experience: [{ role: "●", org: "", bullets: [] }, { role: "Intern", org: "Acme", bullets: [{ text: " Did a thing" }] }],
    certifications: [{ name: "▪" }, { name: "AWS" }],
    achievements: ["•", "Won"],
  });
  it("removes bullets and dot leaders but keeps real text", () => {
    expect(p.skills.map((s) => s.name)).toEqual(["React", "Docker", ".NET", "C#"]);
    expect(p.projects.map((x) => [x.name, x.bullets.map((b) => b.text)])).toEqual([
      ["Portal", ["Built it", "Added X"]],
      ["", []],
    ]);
    expect(p.experience.map((e) => [e.role, e.bullets.map((b) => b.text)])).toEqual([["Intern", ["Did a thing"]]]);
    expect(p.certifications.map((c) => c.name)).toEqual(["AWS"]);
    expect(p.achievements.map((a) => a.text)).toEqual(["Won"]);
  });
});
