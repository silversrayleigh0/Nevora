import { describe, expect, it } from "vitest";
import { parseLinkedInText } from "../src/lib/linkedinPdf";

// Text as pdf.js reads a LinkedIn "Save to PDF" export (sidebar first, then main column).
const SAMPLE = `Contact
arun.kumar@example.com
www.linkedin.com/in/arunk (LinkedIn)
Top Skills
Docker
React.js
Node.js
Languages
English (Full Professional)
Tamil (Native or Bilingual)
Certifications
AWS Certified Cloud Practitioner
Responsive Web Design
Arun Kumar
Frontend Developer | React
Chennai, Tamil Nadu, India
Summary
I build tools for students.
Experience
Acme Labs
1 year 4 months
Frontend Intern
June 2025 - Present (5 months)
Chennai, Tamil Nadu, India
Built the dashboard used by 40 staff.
Teaching Assistant
January 2024 - May 2024 (5 months)
Ran weekly programming labs.
Sample Tech
Web Development Intern
Jun 2023 - Jul 2023 (2 months)
Remote
• Built React pages for the admin panel.
Page 1 of 2
Education
Sample Institute of Technology
Bachelor of Technology - BTech, Computer Science · (2022 - 2026)`;

describe("LinkedIn PDF reader", () => {
  const out = parseLinkedInText(SAMPLE, "Arun Kumar");
  it("reads top skills and certifications, not languages", () => {
    expect(out.skills.map((s) => s.name)).toEqual(["Docker", "React.js", "Node.js"]);
    expect(out.certifications.map((c) => c.name)).toEqual(["AWS Certified Cloud Practitioner", "Responsive Web Design"]);
  });
  it("still stops at the main column without a name", () => {
    expect(parseLinkedInText(SAMPLE).certifications).toHaveLength(2);
  });
  it("reads each role with its company, dates and description", () => {
    expect(out.experience.map((e) => [e.role, e.org, e.start, e.end])).toEqual([
      ["Frontend Intern", "Acme Labs", "Jun 2025", "Present"],
      ["Teaching Assistant", "Acme Labs", "Jan 2024", "May 2024"],
      ["Web Development Intern", "Sample Tech", "Jun 2023", "Jul 2023"],
    ]);
    expect(out.experience.map((e) => e.bullets.map((b) => b.text))).toEqual([
      ["Built the dashboard used by 40 staff."],
      ["Ran weekly programming labs."],
      ["Built React pages for the admin panel."],
    ]);
  });
});
