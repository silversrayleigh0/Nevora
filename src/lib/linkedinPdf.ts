// Reads a LinkedIn "Save to PDF" export without AI. The export has a fixed layout:
// a sidebar (Contact, Top Skills, Languages, Certifications, Honors-Awards) and a main
// column (name, headline, Summary, Experience, Education). We keep only skills,
// experience and certifications — the three things the resume might be missing.
import type { LinkedInExtract, Profile } from "../../shared/types";
import { categorize } from "./options";


const HEADINGS: Record<string, string> = {
  contact: "contact",
  "top skills": "skills",
  skills: "skills",
  languages: "other",
  certifications: "certifications",
  "licenses & certifications": "certifications",
  "licenses and certifications": "certifications",
  "honors-awards": "other",
  "honors & awards": "other",
  publications: "other",
  patents: "other",
  projects: "other",
  "volunteer experience": "other",
  summary: "other",
  about: "other",
  experience: "experience",
  education: "other",
};

const MONTHS: Record<string, string> = {
  january: "Jan", february: "Feb", march: "Mar", april: "Apr", may: "May", june: "Jun",
  july: "Jul", august: "Aug", september: "Sep", october: "Oct", november: "Nov", december: "Dec",
};
const MONTH = "(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)";
const WHEN = `(?:${MONTH}\\s+\\d{4}|\\d{4}|present)`;
const DATE_LINE = new RegExp(`^(${WHEN})\\s*[-–—]\\s*(${WHEN})(?:\\s*\\(.*\\))?$`, "i");
const DURATION = /^(\d+\s+years?)?\s*(\d+\s+months?)?$/i;
const PAGE = /^page \d+ of \d+$/i;

const tidyDate = (d: string) => {
  const t = d.trim();
  if (/^present$/i.test(t)) return "Present";
  const [m, y] = t.split(/\s+/);
  if (!y) return t;
  const key = Object.keys(MONTHS).find((k) => k.startsWith(m.toLowerCase().slice(0, 3)));
  return `${key ? MONTHS[key] : m} ${y}`;
};

const isDuration = (l: string) => DURATION.test(l) && /\d/.test(l);
/** A city line under a role: short, no full stop, usually "City, Region" or "Remote". */
const isLocation = (l: string) => l.length < 60 && !/[.:;]$/.test(l) && (/,/.test(l) || /\b(remote|india|united|area|on-site|hybrid)\b/i.test(l));
const bulletText = (l: string) => l.replace(/^[•●▪◦\-–*]\s*/, "").trim();

const MAIN = new Set(["summary", "about", "experience", "education"]);

/** `name` is the person's name; it marks where LinkedIn's main column starts. */
export function parseLinkedInText(raw: string, name = ""): LinkedInExtract {
  const lines = raw
    .split(/\n/)
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter((l) => l && !PAGE.test(l));

  const sections: Record<string, string[]> = { skills: [], certifications: [], experience: [] };
  let current = "";
  let sidebar = true;
  const wanted = name.trim().toLowerCase();
  for (const line of lines) {
    const key = line.toLowerCase();
    const heading = HEADINGS[key];
    if (heading) {
      // The name, headline and city sit between the sidebar and the first main heading.
      if (sidebar && MAIN.has(key)) {
        sidebar = false;
        const list = sections[current];
        if (list) {
          const at = wanted ? list.findIndex((l) => l.toLowerCase() === wanted) : -1;
          if (at >= 0) list.splice(at);
          else if (list.length && isLocation(list[list.length - 1])) list.splice(Math.max(0, list.length - 3));
        }
      }
      current = heading;
      continue;
    }
    if (current in sections) sections[current].push(line);
  }

  const seen = new Set<string>();
  const skills = sections.skills
    .flatMap((l) => l.split(/\s*[,•·|]\s*/))
    .map((s) => s.trim())
    .filter((s) => s && s.length <= 40 && !/\(.*(proficiency|native)/i.test(s) && !seen.has(s.toLowerCase()) && seen.add(s.toLowerCase()))
    .map((name, i) => ({ id: `li_skill_${i + 1}`, name, category: categorize(name) }));

  const certifications = sections.certifications
    .filter((l) => l.length <= 120)
    .map((name, i) => ({ id: `li_cert_${i + 1}`, name, issuer: "", date: "", credential: "" }));

  // Experience: each role is "[Company] [total duration] Role / Dates / Location / description".
  const ex = sections.experience;
  const dateRows = ex.map((l, i) => (DATE_LINE.test(l) ? i : -1)).filter((i) => i > 0);
  const experience: Profile["experience"] = [];
  let org = "";
  dateRows.forEach((d, n) => {
    const role = ex[d - 1];
    const before = ex[d - 2];
    const prevEnd = n ? dateRows[n - 1] : -1;
    if (before !== undefined && d - 2 > prevEnd) {
      if (isDuration(before) && ex[d - 3] !== undefined && d - 3 > prevEnd) org = ex[d - 3];
      else if (!isDuration(before) && (n === 0 || (before.length < 60 && !/[.]$/.test(before) && d - 2 > prevEnd + 1))) org = before;
    }
    const [, start, end] = DATE_LINE.exec(ex[d])!;
    // Description runs until the next role's heading lines.
    const next = dateRows[n + 1];
    let stop = next === undefined ? ex.length : next - 1;
    if (next !== undefined) {
      const head = ex[next - 2];
      if (head !== undefined && next - 2 > d && (isDuration(head) || (head.length < 60 && !/[.]$/.test(head)))) stop = isDuration(head) ? next - 3 : next - 2;
    }
    let from = d + 1;
    if (ex[from] && isLocation(ex[from])) from++;
    const bullets = ex
      .slice(from, Math.max(from, stop))
      .map(bulletText)
      .filter((t) => t.length > 3)
      .map((text, b) => ({ id: `li_exp_${n + 1}_b${b + 1}`, text }));
    experience.push({ id: `li_exp_${n + 1}`, role, org, start: tidyDate(start), end: tidyDate(end), bullets });
  });

  return { skills, experience, certifications };
}

export const extractedAnything = (x: LinkedInExtract) => x.skills.length + x.experience.length + x.certifications.length > 0;
