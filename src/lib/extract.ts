// Reads text from uploaded files entirely in the browser.

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

const PDF = "application/pdf";
const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export const isPdf = (f: File) => f.type === PDF || /\.pdf$/i.test(f.name);
export const isDocx = (f: File) => f.type === DOCX || /\.docx$/i.test(f.name);

export async function pdfText(file: File, maxPages = 8): Promise<string> {
  const [pdfjs, worker] = await Promise.all([import("pdfjs-dist"), import("pdfjs-dist/build/pdf.worker.min.mjs?url")]);
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
  const doc = await task.promise;
  const pages: string[] = [];
  for (let i = 1; i <= Math.min(doc.numPages, maxPages); i++) {
    const content = await (await doc.getPage(i)).getTextContent();
    const lines: string[] = [];
    let line = "";
    for (const item of content.items) {
      if (!("str" in item)) continue;
      line += item.str;
      if (item.hasEOL) {
        lines.push(line);
        line = "";
      } else line += " ";
    }
    if (line.trim()) lines.push(line);
    pages.push(lines.join("\n"));
  }
  await task.destroy();
  return pages.join("\n\n").replace(/[ \t]+/g, " ").trim();
}

type Mammoth = { extractRawText(input: { arrayBuffer: ArrayBuffer }): Promise<{ value: string }> };

export async function docxText(file: File): Promise<string> {
  const mod = (await import("mammoth/mammoth.browser.min.js")) as { default?: Mammoth } & Mammoth;
  const mammoth = mod.default ?? mod;
  const { value } = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
  return value.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

export async function resumeText(file: File): Promise<string> {
  if (isPdf(file)) return pdfText(file);
  if (isDocx(file)) return docxText(file);
  throw new Error("Choose a PDF or Word (.docx) file, or paste your resume text instead.");
}

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("That file couldn't be read."));
    reader.readAsDataURL(file);
  });
}

const MAX_SIDE = 1800;

function canvasToJpeg(canvas: HTMLCanvasElement): string {
  return canvas.toDataURL("image/jpeg", 0.88);
}

/** Loads an image file and scales it down so uploads stay small and fast. */
async function imageToDataUrl(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("That image couldn't be opened. Try a PNG or JPG."));
      el.src = url;
    });
    const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvasToJpeg(canvas);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Renders the first page of a PDF to an image. */
async function pdfToDataUrl(file: File): Promise<string> {
  const [pdfjs, worker] = await Promise.all([import("pdfjs-dist"), import("pdfjs-dist/build/pdf.worker.min.mjs?url")]);
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
  try {
    const page = await (await task.promise).getPage(1);
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: Math.min(2.5, MAX_SIDE / Math.max(base.width, base.height)) });
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    await page.render({ canvas, canvasContext: canvas.getContext("2d")!, viewport }).promise;
    return canvasToJpeg(canvas);
  } finally {
    await task.destroy();
  }
}

export const PROOF_ACCEPT = "image/png,image/jpeg,image/webp,application/pdf,.pdf";
export const MAX_PROOF_BYTES = 10 * 1024 * 1024;

/** Turns an uploaded proof (photo, scan or PDF) into one JPEG image for checking. */
export async function proofImage(file: File): Promise<string> {
  if (file.size > MAX_PROOF_BYTES) throw new Error("That file is over 10 MB. Try a smaller one.");
  if (isPdf(file)) return pdfToDataUrl(file);
  if (/^image\/(png|jpe?g|webp|gif)$/.test(file.type)) return imageToDataUrl(file);
  throw new Error("Upload a photo, scan or PDF of the document.");
}
