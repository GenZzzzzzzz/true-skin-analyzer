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
      <main className="mx-auto max-w-2xl px-6 py-16">
        {error && (
          <div className="mb-6 text-center text-sm text-destructive">{error}</div>
        )}

        {mode === "choose" && (
          <div className="grid gap-3 sm:grid-cols-2">
            <button
              onClick={startCamera}
              className="border border-border rounded-2xl py-16 text-center hover:border-foreground transition-colors"
            >
              <Camera className="mx-auto h-6 w-6" strokeWidth={1.5} />
              <div className="mt-4 text-sm">拍摄</div>
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="border border-border rounded-2xl py-16 text-center hover:border-foreground transition-colors"
            >
              <Upload className="mx-auto h-6 w-6" strokeWidth={1.5} />
              <div className="mt-4 text-sm">上传</div>
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
          <div>
            <div className="relative overflow-hidden rounded-2xl bg-black aspect-square">
              <video ref={videoRef} className="h-full w-full object-cover" playsInline muted />
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="h-3/4 w-3/5 rounded-[50%] border border-white/40" />
              </div>
            </div>
            <div className="mt-6 flex justify-center gap-6 text-sm">
              <button
                onClick={() => {
                  stopCamera();
                  setMode("choose");
                }}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                取消
              </button>
              <button onClick={capture} className="border-b border-foreground pb-1">
                拍摄
              </button>
            </div>
          </div>
        )}

        {mode === "preview" && previewUrl && prepared && (
          <div>
            <div className="overflow-hidden rounded-2xl">
              <img src={previewUrl} alt="" className="w-full" />
            </div>
            <div className="mt-6 flex justify-center gap-6 text-sm">
              <button
                onClick={() => {
                  setPrepared(null);
                  setPreviewUrl(null);
                  setMode("choose");
                }}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                重选
              </button>
              <button onClick={submit} className="border-b border-foreground pb-1">
                分析
              </button>
            </div>
          </div>
        )}

        {mode === "loading" && (
          <div className="py-24 text-center">
            <Loader2 className="mx-auto h-6 w-6 animate-spin" />
          </div>
        )}
      </main>
    </div>
  );
}
