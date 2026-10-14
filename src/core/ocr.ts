// Reading a photo of a nutrition label on the phone. Tesseract (WASM) and its English model
// are shipped in /ocr and loaded only when a label is scanned, then kept by the service worker
// so it works offline afterwards.

/** Shrink and sharpen a phone photo: OCR is slow and no more accurate on 12-megapixel images. */
async function prepare(file: Blob): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 1800 / Math.max(bmp.width, bmp.height));
  const w = Math.max(1, Math.round(bmp.width * scale));
  const h = Math.max(1, Math.round(bmp.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.filter = "grayscale(1) contrast(1.35)";
  ctx.drawImage(bmp, 0, 0, w, h);
  bmp.close?.();
  return await new Promise((res) => canvas.toBlob((b) => res(b ?? file), "image/png"));
}

export async function readLabelImage(file: Blob, onProgress?: (p: number) => void): Promise<string> {
  const { createWorker } = await import("tesseract.js");
  const dir = new URL(`${import.meta.env.BASE_URL}ocr`, location.href).href;
  const worker = await createWorker("eng", 1, {
    workerPath: `${dir}/worker.min.js`,
    corePath: dir,
    langPath: dir,
    gzip: false,
    workerBlobURL: false,
    logger: (m: { status: string; progress: number }) => { if (m.status === "recognizing text") onProgress?.(m.progress); },
  });
  try {
    const { data } = await worker.recognize(await prepare(file));
    return data.text;
  } finally {
    await worker.terminate();
  }
}
