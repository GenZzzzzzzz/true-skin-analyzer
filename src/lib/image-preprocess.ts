// Advanced client-side image pipeline:
//   load → face landmarks (MediaPipe) → alignment (rotate by eye line) →
//   Single-Scale Retinex illumination correction → high-res JPEG q=0.95 →
//   generate zone crops (full / T-zone / cheeks / nose / red-enhanced).
// Graceful fallback when no face is detected: center crop + retinex only.

import { getFaceLandmarker, LMK, type NormalizedPoint } from "./face-landmarks";

export interface ZoneImage {
  zone: "full" | "tzone" | "cheeks" | "nose" | "redness" | "eyes";
  label: string;
  base64: string; // raw base64, no data: prefix
}

export interface PreprocessResult {
  zones: ZoneImage[];
  faceDetected: boolean;
  previewDataUrl: string; // aligned full-face preview for UI
}

const FULL_MAX = 1280; // 足够保留毛孔/细纹，传输和模型解码都更快
const ZONE_MAX = 768;
const JPEG_Q = 0.9;

export async function preprocessImage(
  source: Blob | HTMLVideoElement,
): Promise<PreprocessResult> {
  const sourceCanvas = await sourceToCanvas(source);

  // 1. Face landmarks
  let landmarks: NormalizedPoint[] | null = null;
  try {
    const landmarker = await getFaceLandmarker();
    const res = landmarker.detect(sourceCanvas);
    landmarks = res.faceLandmarks?.[0] ?? null;
  } catch (e) {
    console.warn("face landmarker failed, falling back", e);
  }

  // 2. Aligned full-face canvas (+ transform so we can map landmarks without re-detect)
  let aligned: HTMLCanvasElement;
  let alignT: AlignTransform | null = null;
  if (landmarks) {
    const r = alignFace(sourceCanvas, landmarks, FULL_MAX);
    aligned = r.canvas;
    alignT = r.t;
  } else {
    aligned = centerSquare(sourceCanvas, FULL_MAX);
  }

  // 3. Illumination correction (single-scale retinex)
  retinexInPlace(aligned);

  const fullBase64 = canvasToJpegBase64(aligned, FULL_MAX, JPEG_Q);
  const previewDataUrl = `data:image/jpeg;base64,${fullBase64}`;

  const zones: ZoneImage[] = [
    { zone: "full", label: "对齐+光照矫正后的全脸", base64: fullBase64 },
  ];

  if (landmarks && alignT) {
    const W = aligned.width;
    const H = aligned.height;
    // Map source landmarks → aligned-canvas pixels (avoids a 2nd MediaPipe pass).
    const px = (i: number) => mapLandmark(landmarks![i], alignT!);
    void W; void H;

    // T-zone: forehead top → nose bottom, width ~ nose width * 3
    const fh = px(LMK.forehead);
    const nb = px(LMK.noseBottom);
    const nL = px(LMK.noseLeft);
    const nR = px(LMK.noseRight);
    const tWidth = (nR.x - nL.x) * 3.2;
    zones.push({
      zone: "tzone",
      label: "T 区 (额头 + 鼻梁)",
      base64: cropToBase64(aligned, fh.x - tWidth / 2, fh.y - 20, tWidth, nb.y - fh.y + 40),
    });

    // Nose close-up (blackheads, pore detail)
    const noseW = (nR.x - nL.x) * 1.8;
    const noseH = (nb.y - px(LMK.noseTip).y) * 3.2 + 40;
    zones.push({
      zone: "nose",
      label: "鼻部特写 (毛孔/黑头)",
      base64: cropToBase64(aligned, nL.x - noseW * 0.2, px(LMK.noseTip).y - noseH * 0.3, noseW, noseH),
    });

    // Cheeks combined side-by-side
    const lc = px(LMK.leftCheekCenter);
    const rc = px(LMK.rightCheekCenter);
    const cheekSize = Math.min(W, H) * 0.28;
    const cheeksCanvas = document.createElement("canvas");
    cheeksCanvas.width = Math.round(cheekSize * 2 + 16);
    cheeksCanvas.height = Math.round(cheekSize);
    const cctx = cheeksCanvas.getContext("2d")!;
    cctx.fillStyle = "#000";
    cctx.fillRect(0, 0, cheeksCanvas.width, cheeksCanvas.height);
    cctx.drawImage(
      aligned,
      lc.x - cheekSize / 2, lc.y - cheekSize / 2, cheekSize, cheekSize,
      0, 0, cheekSize, cheekSize,
    );
    cctx.drawImage(
      aligned,
      rc.x - cheekSize / 2, rc.y - cheekSize / 2, cheekSize, cheekSize,
      cheekSize + 16, 0, cheekSize, cheekSize,
    );
    zones.push({
      zone: "cheeks",
      label: "双颊 (左 | 右)",
      base64: canvasToJpegBase64(cheeksCanvas, ZONE_MAX, JPEG_Q),
    });

    // Eye area (wrinkles, dark circles, sensitivity)
    const le = px(LMK.leftEyeOuter);
    const re = px(LMK.rightEyeOuter);
    const eyeY = (le.y + re.y) / 2;
    const eyeW = (re.x - le.x) * 1.4;
    const eyeH = eyeW * 0.45;
    zones.push({
      zone: "eyes",
      label: "眼周",
      base64: cropToBase64(aligned, (le.x + re.x) / 2 - eyeW / 2, eyeY - eyeH / 2, eyeW, eyeH),
    });
  }

  // Red-channel enhanced (highlight redness / capillaries)
  zones.push({
    zone: "redness",
    label: "红色通道增强 (红血丝/炎症)",
    base64: redChannelEnhanced(aligned, FULL_MAX),
  });

  return { zones, faceDetected: !!landmarks, previewDataUrl };
}

// ---------- helpers ----------

async function sourceToCanvas(source: Blob | HTMLVideoElement): Promise<HTMLCanvasElement> {
  const c = document.createElement("canvas");
  if (source instanceof HTMLVideoElement) {
    c.width = source.videoWidth;
    c.height = source.videoHeight;
    c.getContext("2d")!.drawImage(source, 0, 0);
    return c;
  }
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const im = new Image();
    im.onload = () => resolve(im);
    im.onerror = reject;
    im.src = URL.createObjectURL(source);
  });
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  c.getContext("2d")!.drawImage(img, 0, 0);
  return c;
}

interface AlignTransform {
  angle: number; cx: number; cy: number; scale: number; dim: number;
  srcW: number; srcH: number;
}

function alignFace(
  source: HTMLCanvasElement,
  lmks: NormalizedPoint[],
  maxSize: number,
): { canvas: HTMLCanvasElement; t: AlignTransform } {
  const W = source.width, H = source.height;
  const le = { x: lmks[LMK.leftEyeOuter].x * W, y: lmks[LMK.leftEyeOuter].y * H };
  const re = { x: lmks[LMK.rightEyeOuter].x * W, y: lmks[LMK.rightEyeOuter].y * H };
  const angle = Math.atan2(re.y - le.y, re.x - le.x);

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of lmks) {
    const x = p.x * W, y = p.y * H;
    if (x < minX) minX = x; if (y < minY) minY = y;
    if (x > maxX) maxX = x; if (y > maxY) maxY = y;
  }
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const faceSize = Math.max(maxX - minX, maxY - minY) * 1.45;

  const out = document.createElement("canvas");
  const scale = Math.min(1, maxSize / faceSize);
  const dim = Math.round(faceSize * scale);
  out.width = dim;
  out.height = dim;
  const ctx = out.getContext("2d")!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  ctx.translate(dim / 2, dim / 2);
  ctx.rotate(-angle);
  ctx.scale(scale, scale);
  ctx.translate(-cx, -cy);
  ctx.drawImage(source, 0, 0);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  return { canvas: out, t: { angle, cx, cy, scale, dim, srcW: W, srcH: H } };
}

// Map a normalized source landmark into aligned-canvas pixel coords using the
// same affine as alignFace: (sx-cx,sy-cy) → rotate(-angle) → scale → +dim/2.
function mapLandmark(p: NormalizedPoint, t: AlignTransform) {
  const sx = p.x * t.srcW - t.cx;
  const sy = p.y * t.srcH - t.cy;
  const cos = Math.cos(-t.angle), sin = Math.sin(-t.angle);
  return {
    x: (sx * cos - sy * sin) * t.scale + t.dim / 2,
    y: (sx * sin + sy * cos) * t.scale + t.dim / 2,
  };
}

function centerSquare(source: HTMLCanvasElement, maxSize: number): HTMLCanvasElement {
  const s = Math.min(source.width, source.height);
  const out = document.createElement("canvas");
  const dim = Math.min(s, maxSize);
  out.width = dim; out.height = dim;
  out.getContext("2d")!.drawImage(
    source,
    (source.width - s) / 2, (source.height - s) / 2, s, s,
    0, 0, dim, dim,
  );
  return out;
}

// Single-Scale Retinex (per-channel): divide each pixel by a blurred copy
// to remove global illumination gradients, then renormalize. Boosts local contrast.
function retinexInPlace(canvas: HTMLCanvasElement) {
  const w = canvas.width, h = canvas.height;
  const ctx = canvas.getContext("2d")!;
  const original = ctx.getImageData(0, 0, w, h);

  // Blurred copy via canvas filter
  const blurC = document.createElement("canvas");
  blurC.width = w; blurC.height = h;
  const bctx = blurC.getContext("2d")!;
  bctx.filter = `blur(${Math.max(8, Math.round(Math.min(w, h) * 0.04))}px)`;
  bctx.drawImage(canvas, 0, 0);
  const blurred = bctx.getImageData(0, 0, w, h);

  const od = original.data, bd = blurred.data;
  // global means for renormalization
  let mr = 0, mg = 0, mb = 0, n = 0;
  for (let i = 0; i < od.length; i += 4) {
    mr += od[i]; mg += od[i+1]; mb += od[i+2]; n++;
  }
  mr /= n; mg /= n; mb /= n;

  for (let i = 0; i < od.length; i += 4) {
    // local-illumination removed value, then scaled back to mean
    const rr = (od[i]     * mr) / (bd[i]     + 1);
    const gg = (od[i + 1] * mg) / (bd[i + 1] + 1);
    const bb = (od[i + 2] * mb) / (bd[i + 2] + 1);
    // blend 60% retinex + 40% original to keep skin tone natural
    od[i]     = clamp(rr * 0.6 + od[i]     * 0.4);
    od[i + 1] = clamp(gg * 0.6 + od[i + 1] * 0.4);
    od[i + 2] = clamp(bb * 0.6 + od[i + 2] * 0.4);
  }
  ctx.putImageData(original, 0, 0);
}

function redChannelEnhanced(source: HTMLCanvasElement, maxSize: number): string {
  const scale = Math.min(1, maxSize / Math.max(source.width, source.height));
  const w = Math.round(source.width * scale);
  const h = Math.round(source.height * scale);
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const ctx = c.getContext("2d")!;
  ctx.drawImage(source, 0, 0, w, h);
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], g = d[i + 1], b = d[i + 2];
    // a/b channel-like redness: r - (g+b)/2, amplified
    const redness = clamp((r - (g + b) / 2) * 2.5 + 60);
    // render redness as heat overlay on grayscale base
    const gray = 0.3 * r + 0.59 * g + 0.11 * b;
    d[i]     = clamp(gray * 0.4 + redness);       // R
    d[i + 1] = clamp(gray * 0.6);                  // G
    d[i + 2] = clamp(gray * 0.6);                  // B
  }
  ctx.putImageData(img, 0, 0);
  return canvasToJpegBase64(c, maxSize, JPEG_Q);
}

function cropToBase64(
  source: HTMLCanvasElement,
  x: number, y: number, w: number, h: number,
): string {
  const sx = Math.max(0, Math.floor(x));
  const sy = Math.max(0, Math.floor(y));
  const sw = Math.min(source.width - sx, Math.max(1, Math.floor(w)));
  const sh = Math.min(source.height - sy, Math.max(1, Math.floor(h)));
  const c = document.createElement("canvas");
  c.width = sw; c.height = sh;
  c.getContext("2d")!.drawImage(source, sx, sy, sw, sh, 0, 0, sw, sh);
  return canvasToJpegBase64(c, ZONE_MAX, JPEG_Q);
}

function canvasToJpegBase64(c: HTMLCanvasElement, maxSize: number, q: number): string {
  let out = c;
  const m = Math.max(c.width, c.height);
  if (m > maxSize) {
    const s = maxSize / m;
    out = document.createElement("canvas");
    out.width = Math.round(c.width * s);
    out.height = Math.round(c.height * s);
    const ctx = out.getContext("2d")!;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(c, 0, 0, out.width, out.height);
  }
  return out.toDataURL("image/jpeg", q).split(",")[1];
}

function clamp(v: number) { return v < 0 ? 0 : v > 255 ? 255 : v; }
