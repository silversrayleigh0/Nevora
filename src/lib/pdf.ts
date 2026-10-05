// Text-based PDFs, so applicant tracking systems can read every word.
import type { Profile, TailoredResume, ToggleSection } from "../../shared/types";

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

export async function resumePdf(resume: TailoredResume, profile: Profile, hidden: ToggleSection[], filename: string) {
  const pdf = await newDoc();
  const margin = 18;
  const width = 210 - margin * 2;
  const bottom = 281;
  let y = margin;
  const room = (h: number) => {
    if (y + h > bottom) {
      pdf.addPage();
      y = margin;
    }
  };
  const text = (value: string, size: number, opts: { bold?: boolean; color?: number; indent?: number; gap?: number } = {}) => {
    pdf.setFont("helvetica", opts.bold ? "bold" : "normal");
    pdf.setFontSize(size);
    pdf.setTextColor(opts.color ?? 29);
    const lines: string[] = pdf.splitTextToSize(value, width - (opts.indent ?? 0));
    const lh = size * 0.42;
    for (const line of lines) {
      room(lh);
      pdf.text(line, margin + (opts.indent ?? 0), y + lh * 0.8);
      y += lh;
    }
    y += opts.gap ?? 0;
  };
  const heading = (title: string) => {
    y += 3;
    room(9);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9);
    pdf.setTextColor(29);
    pdf.text(title, margin, y + 3.5, { charSpace: 0.6 });
    y += 5;
    pdf.setDrawColor(210);
    pdf.setLineWidth(0.25);
    pdf.line(margin, y, margin + width, y);
    y += 2;
  };
  const itemTitle = (title: string, meta?: string) => {
    room(5);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);
    const metaWidth = meta ? pdf.getTextWidth(meta) + 4 : 0;
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(29);
    const lines: string[] = pdf.splitTextToSize(title, width - metaWidth);
    pdf.text(lines[0], margin, y + 3.4);
    if (meta) {
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(81);
      pdf.text(meta, margin + width, y + 3.4, { align: "right" });
    }
    y += 4.4;
    for (const line of lines.slice(1)) {
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(29);
      room(4.4);
      pdf.text(line, margin, y + 3.4);
      y += 4.4;
    }
  };

  const b = profile.basics;
  text(b.name || "Your name", 20, { bold: true, gap: 1 });
  text(contactLine(profile, "  ·  "), 9, { color: 81, gap: 1 });
  if (!hidden.includes("summary") && resume.summary) {
    heading("SUMMARY");
    text(stripPlaceholders(resume.summary), 10);
  }
  const skills = resume.skills.filter((g) => g.items.length);
  if (!hidden.includes("skills") && skills.length) {
    heading("SKILLS");
    skills.forEach((g) => text(`${g.category}: ${g.items.join(", ")}`, 10));
  }
  for (const section of resume.sections) {
    if (hidden.includes(section.key) || !section.items.length) continue;
    heading(SECTION_TITLES[section.key] ?? section.key.toUpperCase());
    section.items.forEach((item, i) => {
      if (i) y += 1.5;
      itemTitle(stripPlaceholders(item.heading) || item.heading, item.meta);
      if (item.subheading) text(item.subheading, 10);
      for (const bullet of item.bullets) {
        const line = stripPlaceholders(bullet.text);
        if (!line) continue;
        room(4.3);
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(10);
        pdf.setTextColor(29);
        pdf.text("•", margin + 1, y + 3.4);
        text(line, 10, { indent: 4.5 });
      }
    });
  }
  pdf.setProperties({ title: `${b.name} — Resume`, author: b.name, creator: "Nevora" });
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
  const out = [profile.basics.name, contactLine(profile, " | "), ""];
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
