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
