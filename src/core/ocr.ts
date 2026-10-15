// Reading a photo of a nutrition label on the phone. Tesseract (WASM) and its English model
// are shipped in /ocr and loaded only when a label is scanned, then kept by the service worker
// so it works offline afterwards.
//
// One look isn't always enough (glare, a curved tin, small print), so if the first pass doesn't
// find energy, saturated fat and sodium it tries the photo again a different way: another size
// and contrast, a layout mode for tables, then a hard black-and-white version.
import { readUntilComplete } from "./ocrpasses";

interface Look { max: number; contrast: number; threshold: boolean; mode: "auto" | "block" | "sparse" }
const LOOKS: Look[] = [
  { max: 1800, contrast: 1.35, threshold: false, mode: "auto" },
  { max: 2600, contrast: 1, threshold: false, mode: "block" },
  { max: 2200, contrast: 1.2, threshold: true, mode: "sparse" },
];

/** Shrink (or lift) a phone photo to a size OCR copes with, sharpen it, and optionally make it black and white. */
async function render(bmp: ImageBitmap, look: Look): Promise<Blob | null> {
  const scale = Math.min(2, look.max / Math.max(bmp.width, bmp.height));
  const w = Math.max(1, Math.round(bmp.width * scale));
  const h = Math.max(1, Math.round(bmp.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: look.threshold });
  if (!ctx) return null;
  ctx.filter = `grayscale(1) contrast(${look.contrast})`;
  ctx.drawImage(bmp, 0, 0, w, h);
  if (look.threshold) {
    const img = ctx.getImageData(0, 0, w, h);
    const d = img.data;
    const hist = new Array<number>(256).fill(0);
    for (let i = 0; i < d.length; i += 4) hist[d[i]]++;
    // Otsu: the cut that best separates dark print from light background.
    const total = w * h;
    let sum = 0;
    for (let t = 0; t < 256; t++) sum += t * hist[t];
    let sumB = 0, wB = 0, best = 0, cut = 127;
    for (let t = 0; t < 256; t++) {
      wB += hist[t];
      if (!wB) continue;
      const wF = total - wB;
      if (!wF) break;
      sumB += t * hist[t];
      const mB = sumB / wB, mF = (sum - sumB) / wF;
      const between = wB * wF * (mB - mF) ** 2;
      if (between > best) { best = between; cut = t; }
    }
    for (let i = 0; i < d.length; i += 4) { const v = d[i] > cut ? 255 : 0; d[i] = d[i + 1] = d[i + 2] = v; }
    ctx.putImageData(img, 0, 0);
  }
  return await new Promise((res) => canvas.toBlob((b) => res(b), "image/png"));
}

export interface ReadProgress {
  /** 0..1 within the current attempt. */
  progress?: number;
  /** Set when a new attempt starts: 1 for the first. */
  attempt?: number;
  of?: number;
}

/** One text per pass that was run; merge them with `mergeReads`. */
export async function readLabelImage(file: Blob, onProgress?: (p: ReadProgress) => void): Promise<string[]> {
  const { createWorker, PSM } = await import("tesseract.js");
  const dir = new URL(`${import.meta.env.BASE_URL}ocr`, location.href).href;
  const worker = await createWorker("eng", 1, {
    workerPath: `${dir}/worker.min.js`,
    corePath: dir,
    langPath: dir,
    gzip: false,
    workerBlobURL: false,
    logger: (m: { status: string; progress: number }) => { if (m.status === "recognizing text") onProgress?.({ progress: m.progress }); },
  });
  const bmp = await createImageBitmap(file);
  const modes = { auto: PSM.AUTO, block: PSM.SINGLE_BLOCK, sparse: PSM.SPARSE_TEXT };
  try {
    const passes = LOOKS.map((look) => async () => {
      await worker.setParameters({ tessedit_pageseg_mode: modes[look.mode] });
      const img = await render(bmp, look);
      const { data } = await worker.recognize(img ?? file);
      return data.text;
    });
    const r = await readUntilComplete(passes, (attempt, of) => onProgress?.({ attempt, of }));
    console.info(`[ocr] ${r.complete ? "complete" : "incomplete"} after ${r.attempts} of ${LOOKS.length} passes`);
    return r.texts;
  } finally {
    bmp.close?.();
    await worker.terminate();
  }
}

/** Plain text from a screenshot or photo (an order screen, not a nutrition table): one pass, no checks. */
export async function readPlainImage(file: Blob, onProgress?: (p: number) => void): Promise<string> {
  const { createWorker, PSM } = await import("tesseract.js");
  const dir = new URL(`${import.meta.env.BASE_URL}ocr`, location.href).href;
  const worker = await createWorker("eng", 1, {
    workerPath: `${dir}/worker.min.js`,
    corePath: dir,
    langPath: dir,
    gzip: false,
    workerBlobURL: false,
    logger: (m: { status: string; progress: number }) => { if (m.status === "recognizing text") onProgress?.(m.progress); },
  });
  const bmp = await createImageBitmap(file);
  try {
    await worker.setParameters({ tessedit_pageseg_mode: PSM.AUTO });
    const img = await render(bmp, { max: 2000, contrast: 1, threshold: false, mode: "auto" });
    const { data } = await worker.recognize(img ?? file);
    return data.text;
  } finally {
    bmp.close?.();
    await worker.terminate();
  }
}
