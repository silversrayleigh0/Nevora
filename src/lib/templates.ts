// Resume templates. All are single-column with real text and standard section
// names, so applicant tracking systems read them in order. Photo templates suit
// regions where a photo is expected (e.g. India, Europe, Middle East).
import type { TemplateId } from "../../shared/types";

export type TemplateSpec = {
  id: TemplateId;
  name: string;
  description: string;
  photo: false | "left" | "right" | "center";
  font: "sans" | "serif";
  align: "left" | "center";
  /** Name and section heading colour. */
  accent: string;
  /** Light band behind the header, or none. */
  band?: string;
  /** "rule": grey line under headings; "accent": coloured line; "plain": no line. */
  heading: "rule" | "accent" | "plain";
  photoShape: "circle" | "rounded";
  density: "regular" | "compact";
};

export const TEMPLATES: TemplateSpec[] = [
  {
    id: "classic",
    name: "Classic",
    description: "Harvard-style black and white. Safest for every applicant tracking system.",
    photo: false,
    font: "sans",
    align: "left",
    accent: "#1d1d1f",
    heading: "rule",
    photoShape: "circle",
    density: "regular",
  },
  {
    id: "modern",
    name: "Modern",
    description: "Navy name and headings with a clean accent line. Popular for tech roles.",
    photo: false,
    font: "sans",
    align: "left",
    accent: "#1f3a5f",
    heading: "accent",
    photoShape: "circle",
    density: "regular",
  },
  {
    id: "traditional",
    name: "Traditional",
    description: "Centered serif layout, tight one-page fit. Favoured in finance and consulting.",
    photo: false,
    font: "serif",
    align: "center",
    accent: "#1d1d1f",
    heading: "rule",
    photoShape: "circle",
    density: "compact",
  },
  {
    id: "professional",
    name: "Professional",
    description: "Photo beside your name, navy accents. Common for campus placements.",
    photo: "left",
    font: "sans",
    align: "left",
    accent: "#1f3a5f",
    heading: "accent",
    photoShape: "rounded",
    density: "regular",
  },
  {
    id: "corporate",
    name: "Corporate",
    description: "Soft-tinted header with your photo on the right. Polished for business roles.",
    photo: "right",
    font: "sans",
    align: "left",
    accent: "#0a5e6b",
    band: "#eef4f5",
    heading: "accent",
    photoShape: "circle",
    density: "regular",
  },
  {
    id: "centered",
    name: "Centered",
    description: "Round photo above a centered name. Balanced and easy to scan.",
    photo: "center",
    font: "sans",
    align: "center",
    accent: "#1d1d1f",
    heading: "rule",
    photoShape: "circle",
    density: "regular",
  },
];

export const templateFor = (id?: TemplateId) => TEMPLATES.find((t) => t.id === id) ?? TEMPLATES[0];

/** Crops a photo to a square (or circle) on white, ready for the page and the PDF. */
export async function shapePhoto(dataUrl: string, shape: "circle" | "rounded", size = 360): Promise<string> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error("photo"));
    el.src = dataUrl;
  });
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, size, size);
  ctx.save();
  ctx.beginPath();
  if (shape === "circle") ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
  else ctx.roundRect(0, 0, size, size, size * 0.12);
  ctx.clip();
  const side = Math.min(img.naturalWidth, img.naturalHeight);
  ctx.drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, size, size);
  ctx.restore();
  return canvas.toDataURL("image/jpeg", 0.9);
}

/** Prepares an uploaded photo for the profile: square, 400px, compressed. */
export async function profilePhoto(file: File): Promise<string> {
  if (!/^image\/(png|jpe?g|webp)$/.test(file.type)) throw new Error("Choose a JPG, PNG or WebP photo.");
  if (file.size > 8 * 1024 * 1024) throw new Error("That photo is over 8 MB. Try a smaller one.");
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("That photo couldn't be opened."));
      el.src = url;
    });
    const size = 400;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext("2d")!;
    const side = Math.min(img.naturalWidth, img.naturalHeight);
    // Faces usually sit in the upper part of a portrait, so crop a little above center.
    const top = img.naturalHeight > img.naturalWidth ? (img.naturalHeight - side) * 0.3 : (img.naturalHeight - side) / 2;
    ctx.drawImage(img, (img.naturalWidth - side) / 2, top, side, side, 0, 0, size, size);
    return canvas.toDataURL("image/jpeg", 0.85);
  } finally {
    URL.revokeObjectURL(url);
  }
}
