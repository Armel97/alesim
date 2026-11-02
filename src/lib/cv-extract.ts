// Client-only text extraction for CV files. Never import from a loader or SSR module.

export type ExtractKind = "pdf" | "docx" | "image";

export function detectKind(file: File): ExtractKind | null {
  const name = file.name.toLowerCase();
  const type = (file.type || "").toLowerCase();
  if (type === "application/pdf" || name.endsWith(".pdf")) return "pdf";
  if (
    type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    name.endsWith(".docx")
  )
    return "docx";
  if (type.startsWith("image/") || /\.(png|jpe?g|webp|bmp)$/i.test(name)) return "image";
  return null;
}

type PdfTextItem = { str?: string };
type PdfJsModule = {
  GlobalWorkerOptions: { workerSrc: string };
  getDocument: (opts: { data: Uint8Array }) => {
    promise: Promise<{
      numPages: number;
      getPage: (i: number) => Promise<{ getTextContent: () => Promise<{ items: PdfTextItem[] }> }>;
    }>;
  };
};

async function extractPdf(file: File): Promise<string> {
  const pdfjs = (await import("pdfjs-dist/build/pdf.mjs")) as unknown as PdfJsModule;
  const worker = await import("pdfjs-dist/build/pdf.worker.mjs?url");
  pdfjs.GlobalWorkerOptions.workerSrc = (worker as { default: string }).default;
  const buf = new Uint8Array(await file.arrayBuffer());
  const doc = await pdfjs.getDocument({ data: buf }).promise;
  const parts: string[] = [];
  for (let i = 1; i <= Math.min(doc.numPages, 20); i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const line = content.items.map((it) => it.str ?? "").join(" ");
    parts.push(line);
  }
  return parts.join("\n\n");
}

async function extractDocx(file: File): Promise<string> {
  const mammoth = (await import("mammoth/mammoth.browser")) as unknown as {
    extractRawText: (opts: { arrayBuffer: ArrayBuffer }) => Promise<{ value?: string }>;
  };
  const arrayBuffer = await file.arrayBuffer();
  const { value } = await mammoth.extractRawText({ arrayBuffer });
  return String(value ?? "");
}

async function extractImage(
  file: File,
  lang: "fr" | "en",
  onProgress?: (p: number) => void,
): Promise<string> {
  const Tesseract = (await import("tesseract.js")) as unknown as {
    recognize: (
      f: File,
      lang: string,
      opts: { logger: (m: { status: string; progress: number }) => void },
    ) => Promise<{ data?: { text?: string } }>;
  };
  const result = await Tesseract.recognize(file, lang === "fr" ? "fra" : "eng", {
    logger: (m: { status: string; progress: number }) => {
      if (m.status === "recognizing text" && onProgress) onProgress(m.progress);
    },
  });
  return String(result?.data?.text ?? "");
}

export async function extractCvText(
  file: File,
  lang: "fr" | "en",
  onProgress?: (p: number) => void,
): Promise<{ kind: ExtractKind; text: string }> {
  const kind = detectKind(file);
  if (!kind) throw new Error("Unsupported file type");
  let text = "";
  if (kind === "pdf") text = await extractPdf(file);
  else if (kind === "docx") text = await extractDocx(file);
  else text = await extractImage(file, lang, onProgress);
  return {
    kind,
    text: text
      .replace(/\s+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim(),
  };
}
