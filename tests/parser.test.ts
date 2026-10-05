import { describe, expect, it } from "vitest";
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
