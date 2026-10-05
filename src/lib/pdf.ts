// Text-based PDFs, so applicant tracking systems can read every word.
import type { Profile, TailoredResume, ToggleSection } from "../../shared/types";
import { shapePhoto, templateFor, type TemplateSpec } from "./templates";

export const SECTION_TITLES: Record<string, string> = {
  projects: "PROJECTS",
  experience: "EXPERIENCE",
  education: "EDUCATION",
  certifications: "CERTIFICATIONS",
  achievements: "ACHIEVEMENTS",
};

/** Placeholders like [add metric] are coaching notes, not resume content. */
export const stripPlaceholders = (s: string) =>
  s
    .replace(/\s*\[[^\]]*\]/g, "")
    .replace(/\s+/g, " ")
    .replace(/^[\s—–,·|-]+|[\s—–,·|-]+$/g, "")
    .trim();

export const contactLine = (p: Profile, sep: string) =>
  [p.basics.location, p.basics.email, p.basics.phone, ...p.basics.links].filter(Boolean).join(sep);

async function newDoc() {
  const { jsPDF } = await import("jspdf");
  return new jsPDF({ unit: "mm", format: "a4" });
}

const rgb = (hex: string): [number, number, number] => {
  const n = parseInt(hex.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const INK: [number, number, number] = [29, 29, 31];
const GREY: [number, number, number] = [81, 81, 84];

export async function resumePdf(resume: TailoredResume, profile: Profile, hidden: ToggleSection[], filename: string, spec: TemplateSpec = templateFor()) {
  const pdf = await newDoc();
  const compact = spec.density === "compact";
  const font = spec.font === "serif" ? "times" : "helvetica";
  const body = compact ? 9.5 : 10;
  const accent = rgb(spec.accent);
  const margin = compact ? 15 : 18;
  const width = 210 - margin * 2;
  const bottom = 297 - margin;
  let y = margin;
  const room = (h: number) => {
    if (y + h > bottom) {
      pdf.addPage();
      y = margin;
    }
  };
  type TextOpts = { bold?: boolean; color?: [number, number, number]; indent?: number; gap?: number; x?: number; w?: number; align?: "left" | "center" };
  const text = (value: string, size: number, opts: TextOpts = {}) => {
    pdf.setFont(font, opts.bold ? "bold" : "normal");
    pdf.setFontSize(size);
    pdf.setTextColor(...(opts.color ?? INK));
    const x = opts.x ?? margin;
    const w = opts.w ?? width;
    const lines: string[] = pdf.splitTextToSize(value, w - (opts.indent ?? 0));
    const lh = size * (compact ? 0.4 : 0.42);
    for (const line of lines) {
      room(lh);
      if (opts.align === "center") pdf.text(line, x + w / 2, y + lh * 0.8, { align: "center" });
      else pdf.text(line, x + (opts.indent ?? 0), y + lh * 0.8);
      y += lh;
    }
    y += opts.gap ?? 0;
  };
  const heading = (title: string) => {
    y += compact ? 2.2 : 3;
    room(9);
    pdf.setFont(font, "bold");
    pdf.setFontSize(compact ? 8.5 : 9);
    pdf.setTextColor(...(spec.accent === "#1d1d1f" ? INK : accent));
    pdf.text(title, margin, y + 3.5, { charSpace: 0.6 });
    y += 5;
    if (spec.heading !== "plain") {
      if (spec.heading === "accent") {
        pdf.setDrawColor(...accent);
        pdf.setLineWidth(0.45);
      } else {
        pdf.setDrawColor(210);
        pdf.setLineWidth(0.25);
      }
      pdf.line(margin, y, margin + width, y);
    }
    y += 2;
  };
  const itemTitle = (title: string, meta?: string) => {
    room(5);
    pdf.setFont(font, "normal");
    pdf.setFontSize(body);
    const metaWidth = meta ? pdf.getTextWidth(meta) + 4 : 0;
    pdf.setFont(font, "bold");
    pdf.setTextColor(...INK);
    const lines: string[] = pdf.splitTextToSize(title, width - metaWidth);
    const lh = body * 0.44;
    pdf.text(lines[0], margin, y + lh * 0.78);
    if (meta) {
      pdf.setFont(font, "normal");
      pdf.setTextColor(...GREY);
      pdf.text(meta, margin + width, y + lh * 0.78, { align: "right" });
    }
    y += lh;
    for (const line of lines.slice(1)) {
      pdf.setFont(font, "bold");
      pdf.setTextColor(...INK);
      room(lh);
      pdf.text(line, margin, y + lh * 0.78);
      y += lh;
    }
  };

  // ---- Header
  const name = resume.header?.name ?? profile.basics.name;
  const contact = resume.header?.contact ?? contactLine(profile, "  ·  ");
  const photoSrc = spec.photo && profile.basics.photo ? await shapePhoto(profile.basics.photo, spec.photoShape).catch(() => null) : null;
  const photo = photoSrc ? spec.photo : false;
  const P = 25; // photo size in mm
  const nameSize = compact ? 18 : 20;
  const headerTop = y;
  if (spec.band) {
    pdf.setFillColor(...rgb(spec.band));
    pdf.rect(0, 0, 210, margin + (photo ? P : 16) + 6, "F");
  }
  const nameColor = spec.accent === "#1d1d1f" ? INK : accent;
  if (photo === "center" && photoSrc) {
    pdf.addImage(photoSrc, "JPEG", 105 - P / 2, y, P, P);
    y += P + 3;
    text(name || "Your name", nameSize, { bold: true, color: nameColor, align: "center", gap: 1 });
    if (contact) text(contact, 9, { color: GREY, align: "center", gap: 1 });
  } else if ((photo === "left" || photo === "right") && photoSrc) {
    const textX = photo === "left" ? margin + P + 6 : margin;
    const textW = width - P - 6;
    pdf.addImage(photoSrc, "JPEG", photo === "left" ? margin : margin + width - P, y, P, P);
    y += 4;
    text(name || "Your name", nameSize, { bold: true, color: nameColor, x: textX, w: textW, gap: 1.5 });
    if (contact) text(contact, 9, { color: GREY, x: textX, w: textW });
    y = Math.max(y, headerTop + P) + 1;
  } else {
    const align = spec.align === "center" ? "center" : "left";
    text(name || "Your name", nameSize, { bold: true, color: nameColor, align, gap: 1 });
    if (contact) text(contact, 9, { color: GREY, align, gap: 1 });
  }
  if (spec.band) y += 3;

  // ---- Body
  if (!hidden.includes("summary") && resume.summary) {
    heading("SUMMARY");
    text(stripPlaceholders(resume.summary), body);
  }
  const skills = resume.skills.filter((g) => g.items.filter(Boolean).length);
  if (!hidden.includes("skills") && skills.length) {
    heading("SKILLS");
    skills.forEach((g) => text(`${g.category}: ${g.items.filter(Boolean).join(", ")}`, body));
  }
  for (const section of resume.sections) {
    if (hidden.includes(section.key) || !section.items.length) continue;
    heading(SECTION_TITLES[section.key] ?? section.key.toUpperCase());
    section.items.forEach((item, i) => {
      if (i) y += compact ? 1 : 1.5;
      itemTitle(stripPlaceholders(item.heading) || item.heading, item.meta);
      if (item.subheading) text(item.subheading, body);
      for (const bullet of item.bullets) {
        const line = stripPlaceholders(bullet.text);
        if (!line) continue;
        room(4.3);
        pdf.setFont(font, "normal");
        pdf.setFontSize(body);
        pdf.setTextColor(...INK);
        pdf.text("•", margin + 1, y + body * 0.34);
        text(line, body, { indent: 4.5 });
      }
    });
  }
  pdf.setProperties({ title: `${name} — Resume`, author: name, creator: "Nevora" });
  pdf.save(`${filename}.pdf`);
}

export async function letterPdf(body: string, filename: string) {
  const pdf = await newDoc();
  const margin = 22;
  const width = 210 - margin * 2;
  let y = margin;
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(11);
  pdf.setTextColor(29);
  for (const para of body.split(/\n/)) {
    const lines: string[] = para.trim() ? pdf.splitTextToSize(para, width) : [""];
    for (const line of lines) {
      if (y > 277) {
        pdf.addPage();
        y = margin;
      }
      pdf.text(line, margin, y);
      y += 5.6;
    }
  }
  pdf.save(`${filename}.pdf`);
}

/** Plain text for pasting into application forms. */
export function resumeText(resume: TailoredResume, profile: Profile, hidden: ToggleSection[]): string {
  const out = [resume.header?.name ?? profile.basics.name, resume.header?.contact ?? contactLine(profile, " | "), ""];
  if (!hidden.includes("summary") && resume.summary) out.push("SUMMARY", stripPlaceholders(resume.summary), "");
  if (!hidden.includes("skills")) {
    out.push("SKILLS");
    resume.skills.forEach((g) => g.items.length && out.push(`${g.category}: ${g.items.join(", ")}`));
    out.push("");
  }
  resume.sections
    .filter((s) => !hidden.includes(s.key))
    .forEach((s) => {
      out.push(SECTION_TITLES[s.key]);
      s.items.forEach((item) => {
        out.push([item.heading, item.meta].filter(Boolean).join(" — "));
        if (item.subheading) out.push(item.subheading);
        item.bullets.forEach((b) => out.push(`• ${stripPlaceholders(b.text)}`));
      });
      out.push("");
    });
  return out.join("\n").trim();
}

export const fileSafe = (s: string) => s.replace(/[^\w]+/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "");
