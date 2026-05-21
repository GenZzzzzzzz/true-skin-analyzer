import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { Camera, Upload, AlertTriangle, Loader2, RotateCcw } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { preprocessImage, type PreprocessResult } from "@/lib/image-preprocess";
import { analyzeSkin } from "@/lib/skin.functions";

export const Route = createFileRoute("/analyze")({
  head: () => ({
    meta: [
      { title: "拍摄分析 — SkinSense" },
      { name: "description", content: "拍摄或上传一张正面照片，开始 AI 肤质分析。" },
    ],
  }),
  component: AnalyzePage,
});

type Mode = "choose" | "camera" | "preview" | "loading";

function AnalyzePage() {
  const navigate = useNavigate();
  const analyze = useServerFn(analyzeSkin);
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<Mode>("choose");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [prepared, setPrepared] = useState<PreprocessResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => () => stopCamera(), []);

  function stopCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  async function startCamera() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 1280 } },
        audio: false,
      });
      streamRef.current = stream;
      setMode("camera");
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      }, 50);
    } catch {
      setError("无法访问摄像头，请改用上传照片");
    }
  }

  async function runPreprocess(src: Blob | HTMLVideoElement) {
    setMode("loading");
    setError(null);
    try {
      const result = await preprocessImage(src);
      setPrepared(result);
      setPreviewUrl(result.previewDataUrl);
      if (!result.faceDetected) {
        setError("未检测到清晰人脸，建议重新拍摄以提升精度");
      }
      setMode("preview");
    } catch (e) {
      console.error(e);
      setError("图片处理失败，请换一张");
      setMode("choose");
    }
  }

  async function capture() {
    if (!videoRef.current) return;
    const video = videoRef.current;
    await runPreprocess(video);
    stopCamera();
  }

  async function onFile(file: File) {
    await runPreprocess(file);
  }

  async function submit() {
    if (!prepared) return;
    setMode("loading");
    setError(null);
    const result = await analyze({
      data: { zones: prepared.zones, faceDetected: prepared.faceDetected },
    });
    if (!result.report) {
      setError(result.error || "分析失败");
      setMode("preview");
      return;
    }
    try {
      sessionStorage.setItem("skin-report", JSON.stringify(result.report));
      sessionStorage.setItem("skin-photo", previewUrl || "");
    } catch {}
    navigate({ to: "/report" });
  }

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-4xl px-6 py-12">
        <div className="mb-10 text-center">
          <h1 className="text-3xl md:text-4xl font-bold">开始肤质分析</h1>
          <p className="mt-2 text-muted-foreground">在自然光下正面拍摄，效果最佳</p>
        </div>

        {error && (
          <div className="mb-6 flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            <span>{error}</span>
          </div>
        )}

        {mode === "choose" && (
          <div className="grid gap-4 md:grid-cols-2">
            <button
              onClick={startCamera}
              className="group glass rounded-3xl p-10 text-center transition-all hover:border-accent/40 hover:glow-accent"
            >
              <Camera className="mx-auto h-12 w-12 text-accent" strokeWidth={1.5} />
              <div className="mt-4 font-display text-xl font-semibold">使用摄像头</div>
              <div className="mt-1 text-sm text-muted-foreground">实时拍摄一张正面照</div>
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="group glass rounded-3xl p-10 text-center transition-all hover:border-accent/40"
            >
              <Upload className="mx-auto h-12 w-12 text-foreground" strokeWidth={1.5} />
              <div className="mt-4 font-display text-xl font-semibold">上传照片</div>
              <div className="mt-1 text-sm text-muted-foreground">JPG / PNG · 无滤镜效果最佳</div>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
            />
          </div>
        )}

        {mode === "camera" && (
          <div className="glass rounded-3xl p-4">
            <div className="relative overflow-hidden rounded-2xl bg-black aspect-square">
              <video ref={videoRef} className="h-full w-full object-cover" playsInline muted />
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div
                  className="h-3/4 w-3/5 rounded-[50%] border-2 border-accent/60"
                  style={{ boxShadow: "0 0 60px -10px var(--accent)" }}
                />
              </div>
              <div className="absolute top-4 left-1/2 -translate-x-1/2 rounded-full bg-black/60 backdrop-blur px-3 py-1 text-xs">
                把脸放入框内，正面对准镜头
              </div>
            </div>
            <div className="mt-4 flex justify-center gap-3">
              <button
                onClick={() => {
                  stopCamera();
                  setMode("choose");
                }}
                className="rounded-full border border-border px-5 py-2.5 text-sm"
              >
                取消
              </button>
              <button onClick={capture} className="rounded-full bg-accent px-6 py-2.5 font-medium text-accent-foreground">
                拍摄
              </button>
            </div>
          </div>
        )}

        {mode === "preview" && previewUrl && prepared && (
          <div className="glass rounded-3xl p-6">
            <div className="overflow-hidden rounded-2xl">
              <img src={previewUrl} alt="待分析照片" className="w-full" />
            </div>
            <div className="mt-4 flex flex-wrap gap-2 justify-center text-xs text-muted-foreground">
              {prepared.zones.map((z) => (
                <span key={z.zone} className="rounded-full border border-border px-2.5 py-1">
                  {z.label}
                </span>
              ))}
            </div>
            <div className="mt-5 flex justify-center gap-3">
              <button
                onClick={() => {
                  setPrepared(null);
                  setPreviewUrl(null);
                  setMode("choose");
                }}
                className="inline-flex items-center gap-2 rounded-full border border-border px-5 py-2.5 text-sm"
              >
                <RotateCcw className="h-4 w-4" /> 重新选择
              </button>
              <button onClick={submit} className="rounded-full bg-accent px-6 py-2.5 font-medium text-accent-foreground glow-accent">
                开始 AI 分析
              </button>
            </div>
          </div>
        )}

        {mode === "loading" && (
          <div className="glass rounded-3xl p-16 text-center">
            <Loader2 className="mx-auto h-10 w-10 animate-spin text-accent" />
            <div className="mt-6 font-display text-xl">AI 正在分析肤质…</div>
            <div className="mt-2 text-sm text-muted-foreground">通常需要 5-15 秒</div>
          </div>
        )}

        <div className="mt-10 rounded-2xl border border-border bg-surface/40 p-6 text-sm text-muted-foreground">
          <div className="font-semibold text-foreground mb-2">拍摄小贴士</div>
          <ul className="space-y-1.5 list-disc pl-5">
            <li>使用自然光（如靠窗），避免阴影与逆光</li>
            <li>素颜、无滤镜、不戴眼镜与口罩</li>
            <li>脸部填满画面 70% 左右，正面对镜</li>
            <li>所有照片仅用于本次分析，不会被上传保存</li>
          </ul>
        </div>
      </main>
    </div>
  );
}
