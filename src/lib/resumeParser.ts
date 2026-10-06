// Reads a resume's plain text into a profile without AI. It copies text as
// written and never infers anything; Live AI gives better structure when available.
import type { Profile } from "../../shared/types";
import { categorize, DEGREES } from "./options";
import { BULLET_GLYPHS, DOT_LEADER, meaningful, normalizeProfile } from "./normalize";

type Section = "header" | "summary" | "education" | "skills" | "projects" | "experience" | "certifications" | "achievements" | "ignore";

const HEADINGS: [RegExp, Section][] = [
  [/^(summary|professional summary|objective|career objective|profile|about( me)?)$/i, "summary"],
  [/^(education|academics?|academic (background|details|qualifications?)|qualifications?)$/i, "education"],
  [/^((technical |key |core )?skills|skill set|technologies|tech stack|tools( and technologies)?)$/i, "skills"],
  [/^((academic |personal |key )?projects?)$/i, "projects"],
  [/^((work |professional |relevant )?experience|internships?|employment( history)?|work history)$/i, "experience"],
  [/^(certifications?|certificates?|courses?|licen[cs]es( and certifications)?|courses and certifications)$/i, "certifications"],
  [/^(achievements?|awards?( and achievements)?|honou?rs|activities|extra[- ]?curricular( activities)?|leadership|positions of responsibility|volunteering)$/i, "achievements"],
  [/^(languages( known)?|hobbies|interests|references|declaration|personal details)$/i, "ignore"],
];

/** A bullet glyph (space optional: PDFs often drop it), a dash or star with a space, or "1." / "1)". */
const BULLET = new RegExp(`^\\s*(?:[${BULLET_GLYPHS}]\\s*|[-*–]\\s+|\\d+[.)]\\s+)`, "u");
/** A line that is nothing but bullet glyphs or dashes: pdf.js often puts the bullet on its own line. */
const LONE_BULLET = new RegExp(`^\\s*(?:[${BULLET_GLYPHS}]+|[-*–])\\s*$`, "u");
/** Several bullets that landed on one line ("• Built X • Added Y"). Not "·" or "-", which also separate words. */
const INLINE_BULLET = /\s+[•●▪◦‣∙○■►▶➢➤✓✔❖\uF0A7\uF0B7\uF076\uF0D8\uF0FC]\s+/u;
const EMAIL = /[\w.+-]+@[\w-]+\.[\w.]+/;
const PHONE = /\+?\d[\d\s().-]{7,}\d/;
const LINK = /(?:https?:\/\/)?(?:www\.)?(?:linkedin\.com|github\.com|gitlab\.com|behance\.net|dribbble\.com|[\w-]+\.(?:dev|io|me|app|vercel\.app|netlify\.app))\/?[\w\-./?=#%]*/i;
const DATE_WORD = /\b(19|20)\d{2}\b|\b(present|current|ongoing|now)\b|\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\b/i;
const SEPARATOR = /\s+[—–|]\s+|\s+-\s+|\s+@\s+|\s+at\s+/i;

const clean = (s: string) =>
  s
    .replace(DOT_LEADER, " ")
    .replace(/\*\*|__|`/g, "")
    .replace(/^#+\s*/, "")
    .replace(/\s+/g, " ")
    .trim();

function headingOf(line: string): Section | null {
  const raw = line.trim();
  const text = clean(raw).replace(/[:\-–—]+$/, "").trim();
  if (!text || text.length > 45) return null;
  for (const [re, section] of HEADINGS) if (re.test(text)) return section;
  // A markdown heading or an ALL-CAPS line we don't recognise is still a section break.
  if (/^#{2,}\s/.test(raw) || (/^[A-Z][A-Z &/]{3,}$/.test(text) && !/\d/.test(text))) return "ignore";
  return null;
}

const isDateLine = (s: string) => DATE_WORD.test(s) && s.replace(DATE_WORD, "").replace(/[\s,–—\-/.·|to()]+/gi, "").length < 12;

function splitDates(s: string): { start: string; end: string } {
  const range = s.replace(/[()]/g, "").split(/\s*(?:–|—|-|to)\s*/i).map((x) => x.trim()).filter(Boolean);
  if (range.length >= 2) {
    const [start, end] = range;
    // "June–July 2025": carry the year onto the start.
    const year = end.match(/(19|20)\d{2}/)?.[0];
    return { start: /(19|20)\d{2}/.test(start) || !year ? start : `${start} ${year}`, end };
  }
  return { start: range[0] ?? "", end: "" };
}

/** Pulls a trailing or embedded date range out of a title line. */
function takeDates(line: string): { text: string; start: string; end: string } {
  const m = line.match(/[(|·,–—-]?\s*((?:(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s*)?(?:19|20)\d{2}\s*(?:–|—|-|to)\s*(?:(?:(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s*)?(?:19|20)\d{2}|present|current|ongoing)|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\s*(?:–|—|-|to)\s*(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s*(?:19|20)\d{2})\)?\s*$/i);
  if (!m || m.index === undefined) return { text: line, start: "", end: "" };
  return { text: line.slice(0, m.index).replace(/[\s,|·(–—-]+$/, "").trim(), ...splitDates(m[1]) };
}

type Entry = { title: string; lines: string[]; bullets: string[] };

/** One bullet per line: inline bullets split apart. */
const splitBullets = (lines: string[]) => lines.flatMap((l) => (BULLET.test(l) ? l.split(INLINE_BULLET).map((part, i) => (i ? `• ${part}` : part)) : [l]));

function entries(lines: string[]): Entry[] {
  const out: Entry[] = [];
  for (const line of splitBullets(lines)) {
    if (BULLET.test(line)) {
      const text = clean(line.replace(BULLET, ""));
      if (!text) continue;
      if (!out.length) out.push({ title: "", lines: [], bullets: [] });
      out[out.length - 1].bullets.push(text);
    } else {
      const text = clean(line);
      if (!text) continue;
      const last = out[out.length - 1];
      // Date or detail lines directly under a title belong to it.
      if (last && !last.bullets.length && (isDateLine(text) || /^(tech|technologies|tools|stack|built with|cgpa|gpa|percentage|score)\b/i.test(text))) last.lines.push(text);
      else out.push({ title: text, lines: [], bullets: [] });
    }
  }
  return out;
}

const splitList = (s: string) =>
  s
    .split(new RegExp(`\\s*[,;|/${BULLET_GLYPHS}]\\s*|\\s+and\\s+`, "u"))
    .map((x) => x.replace(BULLET, "").replace(/^[-*]\s*/, "").replace(/\.$/, "").trim())
    .filter((x) => meaningful(x) && x.length <= 40);

export function parseResumeText(raw: string): Profile {
  // A bullet glyph alone on its line belongs to the next line.
  const lines: string[] = [];
  let pendingBullet = false;
  for (const line of raw.replace(/\r/g, "").split("\n")) {
    if (LONE_BULLET.test(line)) {
      pendingBullet = true;
      continue;
    }
    if (pendingBullet && line.trim()) {
      lines.push(headingOf(line) ? line : `• ${line.trim()}`);
      pendingBullet = false;
    } else lines.push(line);
  }
  const buckets: Record<Section, string[]> = { header: [], summary: [], education: [], skills: [], projects: [], experience: [], certifications: [], achievements: [], ignore: [] };
  let current: Section = "header";
  for (const line of lines) {
    const h = headingOf(line);
    if (h) {
      current = h;
      continue;
    }
    if (line.trim()) buckets[current].push(line);
  }

  // Header: name, contact details, links.
  const headerText = buckets.header.map(clean).join(" | ");
  const email = headerText.match(EMAIL)?.[0] ?? raw.match(EMAIL)?.[0] ?? "";
  const phone = (headerText.match(PHONE)?.[0] ?? "").trim();
  const links = [...new Set((headerText.match(new RegExp(LINK, "gi")) ?? []).map((l) => l.replace(/^https?:\/\/(www\.)?/i, "").replace(/\/$/, "")))].filter((l) => !l.includes("@"));
  const nameLine = buckets.header.map(clean).find((l) => l && !EMAIL.test(l) && !PHONE.test(l) && !LINK.test(l) && /^[\p{L} .'-]{2,60}$/u.test(l));
  const location =
    headerText
      .split(new RegExp(`\\s*[|${BULLET_GLYPHS}]\\s*`, "u"))
      .map((p) => p.trim())
      .find((p) => p && p !== nameLine && !EMAIL.test(p) && !PHONE.test(p) && !LINK.test(p) && /^[\p{L} ,.-]{2,40}$/u.test(p) && p.split(" ").length <= 4) ?? "";

  const education = entries(buckets.education).map((e, i) => {
    const all = [e.title, ...e.lines, ...e.bullets].join(" · ");
    const { text: title, start: s1, end: e1 } = takeDates(e.title);
    const years = all.match(/(19|20)\d{2}/g) ?? [];
    const [left, right] = title.split(SEPARATOR);
    const degree = DEGREES.find((d) => new RegExp(`(^|\\W)${d.replace(/[.()]/g, "\\$&").replace(/\\\./g, "\\.?")}(\\W|$)`, "i").test(left)) ?? "";
    const field = (left.match(/\b(?:in|of)\s+(.+)$/i)?.[1] ?? (degree ? left.replace(degree, "").replace(/^[\s,.-]+/, "") : "")).trim();
    return {
      id: `edu_${i + 1}`,
      institution: (right ?? (degree ? "" : left)).trim(),
      degree: degree || (right ? left.trim() : ""),
      field,
      start: s1 || years[0] || "",
      end: e1 || years[1] || "",
      score: all.match(/\b(?:cgpa|gpa|cpi|sgpa)\b[:\s]*[\d.]+(?:\s*\/\s*10)?|[\d.]{2,5}\s*%/i)?.[0] ?? "",
    };
  });

  const skills: { id: string; name: string; category: string }[] = [];
  for (const line of buckets.skills) {
    const text = clean(line.replace(BULLET, ""));
    if (!meaningful(text)) continue;
    const [label, rest] = text.includes(":") ? [text.slice(0, text.indexOf(":")), text.slice(text.indexOf(":") + 1)] : ["", text];
    const hint = /language/i.test(label) ? "language" : /framework|librar/i.test(label) ? "framework" : /tool|platform|database|cloud/i.test(label) ? "tool" : /soft/i.test(label) ? "soft" : /concept|core|area/i.test(label) ? "concept" : "";
    for (const name of splitList(rest)) {
      if (skills.some((s) => s.name.toLowerCase() === name.toLowerCase())) continue;
      const known = categorize(name);
      skills.push({ id: `skill_${skills.length + 1}`, name, category: hint && known === "tool" ? hint : known });
    }
  }

  const projects = entries(buckets.projects).map((e, i) => {
    const { text: title } = takeDates(e.title);
    const techLine = e.lines.find((l) => /^(tech|technologies|tools|stack|built with)/i.test(l));
    const [name, after] = title.split(SEPARATOR);
    const tech = techLine ? splitList(techLine.replace(/^[^:]*:/, "")) : after && splitList(after).every((t) => t.split(" ").length <= 3) ? splitList(after) : [];
    return {
      id: `proj_${i + 1}`,
      name: (tech.length || !after ? name : title).trim(),
      tech,
      link: (title.match(LINK)?.[0] ?? "").trim(),
      bullets: e.bullets.map((text, j) => ({ id: `proj_${i + 1}_b${j + 1}`, text })),
    };
  });

  const experience = entries(buckets.experience).map((e, i) => {
    const fromTitle = takeDates(e.title);
    const dateLine = e.lines.find(isDateLine);
    const dates = fromTitle.start ? fromTitle : dateLine ? splitDates(dateLine) : { start: "", end: "" };
    const [role, org] = fromTitle.text.split(SEPARATOR);
    return {
      id: `exp_${i + 1}`,
      role: (role ?? "").trim(),
      org: (org ?? "").trim(),
      start: dates.start,
      end: dates.end,
      bullets: e.bullets.map((text, j) => ({ id: `exp_${i + 1}_b${j + 1}`, text })),
    };
  });

  const certifications = splitBullets(buckets.certifications)
    .map((l) => clean(l.replace(BULLET, "")))
    .filter(meaningful)
    .map((l, i) => {
      const ranged = takeDates(l);
      // A single trailing date: "(2024)", ", Mar 2024", "– 2024".
      const single = ranged.start ? null : ranged.text.match(/[\s,(–—-]*\(?((?:(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s*)?(?:19|20)\d{2})\)?\s*$/i);
      const text = single?.index !== undefined ? ranged.text.slice(0, single.index) : ranged.text;
      const [name, issuer] = text.split(SEPARATOR);
      return { id: `cert_${i + 1}`, name: name.trim(), issuer: (issuer ?? "").trim(), date: ranged.start || single?.[1] || "", credential: "" };
    });

  const achievements = splitBullets(buckets.achievements)
    .map((l) => clean(l.replace(BULLET, "")))
    .filter(meaningful)
    .map((text, i) => ({ id: `ach_${i + 1}`, text }));

  return normalizeProfile({
    basics: { name: nameLine ?? "", email, phone, location, links },
    summary: buckets.summary.map(clean).join(" "),
    education,
    experience,
    projects,
    skills,
    certifications,
    achievements,
  });
}

/** True when the text produced enough structure to be worth showing. */
export const parsedEnough = (p: Profile) => p.projects.length + p.experience.length + p.education.length + p.skills.length > 0;
