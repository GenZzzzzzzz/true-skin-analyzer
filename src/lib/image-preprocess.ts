// Client-side image preprocessing: resize, white-balance, brightness normalize.
// Returns a base64 JPEG (without data: prefix).

export async function preprocessImage(source: Blob | HTMLVideoElement, maxSize = 1024): Promise<string> {
  const img = await loadImage(source);
  const { width: sw, height: sh } = getDims(img);
  const scale = Math.min(1, maxSize / Math.max(sw, sh));
  const w = Math.round(sw * scale);
  const h = Math.round(sh * scale);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img as CanvasImageSource, 0, 0, w, h);

  const imageData = ctx.getImageData(0, 0, w, h);
  const data = imageData.data;
  let rSum = 0, gSum = 0, bSum = 0, count = 0;
  for (let i = 0; i < data.length; i += 4) {
    rSum += data[i]; gSum += data[i + 1]; bSum += data[i + 2]; count++;
  }
  const rAvg = rSum / count, gAvg = gSum / count, bAvg = bSum / count;
  const gray = (rAvg + gAvg + bAvg) / 3;
  const rK = gray / (rAvg || 1), gK = gray / (gAvg || 1), bK = gray / (bAvg || 1);
  const brightnessK = Math.min(1.25, Math.max(0.85, 128 / (gray || 1)));
  for (let i = 0; i < data.length; i += 4) {
    data[i]     = clamp(data[i]     * rK * brightnessK);
    data[i + 1] = clamp(data[i + 1] * gK * brightnessK);
    data[i + 2] = clamp(data[i + 2] * bK * brightnessK);
  }
  ctx.putImageData(imageData, 0, 0);

  const dataUrl = canvas.toDataURL("image/jpeg", 0.88);
  return dataUrl.split(",")[1];
}

function clamp(v: number) { return v < 0 ? 0 : v > 255 ? 255 : v; }

function getDims(img: HTMLImageElement | HTMLVideoElement) {
  if (img instanceof HTMLVideoElement) return { width: img.videoWidth, height: img.videoHeight };
  return { width: img.naturalWidth, height: img.naturalHeight };
}

async function loadImage(source: Blob | HTMLVideoElement): Promise<HTMLImageElement | HTMLVideoElement> {
  if (source instanceof HTMLVideoElement) return source;
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = URL.createObjectURL(source);
  });
}
