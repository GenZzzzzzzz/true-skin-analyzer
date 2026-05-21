// Lightweight product image preprocessing: load → resize → JPEG.
// We do NOT apply retinex/alignment to product photos.

const MAX = 1280;
const Q = 0.9;

export async function preprocessProduct(blob: Blob): Promise<{
  base64: string;
  previewDataUrl: string;
}> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const im = new Image();
    im.onload = () => resolve(im);
    im.onerror = reject;
    im.src = URL.createObjectURL(blob);
  });
  const w0 = img.naturalWidth;
  const h0 = img.naturalHeight;
  const s = Math.min(1, MAX / Math.max(w0, h0));
  const w = Math.round(w0 * s);
  const h = Math.round(h0 * s);
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, w, h);
  const dataUrl = c.toDataURL("image/jpeg", Q);
  return { base64: dataUrl.split(",")[1], previewDataUrl: dataUrl };
}
