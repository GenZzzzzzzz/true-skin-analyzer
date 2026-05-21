import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { Loader2, Sparkles, ShieldCheck } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { CaptureCard } from "@/components/CaptureCard";
import { RotatingFaceHero } from "@/components/RotatingFaceHero";
import { preprocessImage } from "@/lib/image-preprocess";
import { preprocessProduct } from "@/lib/product-preprocess";
import { analyzeCompatibility } from "@/lib/compatibility.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SkinMatch — AI 化妆品 × 肤质适配度" },
      {
        name: "description",
        content: "拍一张脸 + 一张化妆品，AI 即时分析这款产品对你皮肤的适配度与潜在风险。",
      },
      { property: "og:title", content: "SkinMatch — AI 适配度分析" },
      {
        property: "og:description",
        content: "拍一张脸 + 一张化妆品，AI 即时分析适配度。",
      },
    ],
  }),
  component: Home,
});

type Stage = "idle" | "preprocessing" | "analyzing";

function Home() {
  const navigate = useNavigate();
  const analyze = useServerFn(analyzeCompatibility);

  const [faceBlob, setFaceBlob] = useState<Blob | null>(null);
  const [facePreview, setFacePreview] = useState<string | null>(null);
  const [productBlob, setProductBlob] = useState<Blob | null>(null);
  const [productPreview, setProductPreview] = useState<string | null>(null);

  const [stage, setStage] = useState<Stage>("idle");
  const [error, setError] = useState<string | null>(null);
  const objectUrls = useRef<string[]>([]);

  useEffect(
    () => () => {
      objectUrls.current.forEach((u) => URL.revokeObjectURL(u));
    },
    [],
  );

  function setFace(b: Blob) {
    setFaceBlob(b);
    const u = URL.createObjectURL(b);
    objectUrls.current.push(u);
    setFacePreview(u);
    setError(null);
  }
  function setProduct(b: Blob) {
    setProductBlob(b);
    const u = URL.createObjectURL(b);
    objectUrls.current.push(u);
    setProductPreview(u);
    setError(null);
  }

  const ready = !!faceBlob && !!productBlob && stage === "idle";

  async function submit() {
    if (!faceBlob || !productBlob) return;
    setError(null);
    setStage("preprocessing");
    try {
      const [faceResult, productResult] = await Promise.all([
        preprocessImage(faceBlob),
        preprocessProduct(productBlob),
      ]);
      setStage("analyzing");
      const res = await analyze({
        data: {
          zones: faceResult.zones,
          productBase64: productResult.base64,
          faceDetected: faceResult.faceDetected,
        },
      });
      if (!res.report) {
        setError(res.error || "分析失败");
        setStage("idle");
        return;
      }
      try {
        sessionStorage.setItem("compat-report", JSON.stringify(res.report));
        sessionStorage.setItem("face-photo", faceResult.previewDataUrl);
        sessionStorage.setItem("product-photo", productResult.previewDataUrl);
      } catch {}
      navigate({ to: "/report" });
    } catch (e) {
      console.error(e);
      setError("处理失败，请换一张照片重试");
      setStage("idle");
    }
  }

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Ambient lighting */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div
          className="absolute left-[-10%] top-[-10%] h-[600px] w-[600px] rounded-full blur-3xl opacity-60"
          style={{
            background:
              "radial-gradient(circle, oklch(0.78 0.15 195 / 0.35), transparent 65%)",
          }}
        />
        <div
          className="absolute right-[-10%] top-[10%] h-[500px] w-[500px] rounded-full blur-3xl opacity-50"
          style={{
            background:
              "radial-gradient(circle, oklch(0.7 0.22 320 / 0.3), transparent 65%)",
          }}
        />
      </div>

      <SiteHeader />

      <main className="mx-auto max-w-6xl px-6 pt-12 pb-20">
        <div className="text-center mb-10">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-border bg-surface/60 backdrop-blur px-4 py-1.5 text-xs text-muted-foreground">
            <Sparkles className="h-3 w-3 text-accent" />
            上传你的脸 + 一款产品，AI 分析是否适合
          </div>
          <h1 className="text-4xl md:text-6xl font-bold leading-[1.05] tracking-tight">
            这款<span className="text-gradient">真的适合</span>你的皮肤吗？
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-base md:text-lg text-muted-foreground">
            两张照片，10 秒判断刺激、过敏、闷痘、光敏等 6 项风险。
          </p>
        </div>

        {/* Rotating 3D face hero */}
        <div className="mb-12 flex justify-center">
          <RotatingFaceHero />
        </div>

        {/* The two capture cards */}
        <div className="grid gap-5 sm:gap-8 md:grid-cols-2 max-w-4xl mx-auto">
          <CaptureCard
            kind="face"
            title="你的脸"
            subtitle="正面 · 自然光 · 素颜效果最佳"
            previewUrl={facePreview}
            accentLabel="你"
            onCapture={setFace}
            onClear={() => {
              setFaceBlob(null);
              setFacePreview(null);
            }}
          />
          <CaptureCard
            kind="product"
            title="产品"
            subtitle="化妆品 / 防晒 / 护肤品瓶身"
            previewUrl={productPreview}
            accentLabel="产品"
            onCapture={setProduct}
            onClear={() => {
              setProductBlob(null);
              setProductPreview(null);
            }}
          />
        </div>

        {/* CTA */}
        <div className="mt-10 flex flex-col items-center gap-4">
          {error && (
            <div className="rounded-full border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive">
              {error}
            </div>
          )}
          <button
            onClick={submit}
            disabled={!ready}
            className="cta-glow inline-flex items-center gap-2.5 rounded-full px-9 py-4 text-base font-semibold text-accent-foreground disabled:cursor-not-allowed transition-transform hover:scale-[1.02] active:scale-[0.98]"
          >
            {stage === "idle" && <>分析适配度</>}
            {stage !== "idle" && (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {stage === "preprocessing" ? "图像对齐与光照矫正中…" : "AI 分析中…"}
              </>
            )}
          </button>
          <div className="text-xs text-muted-foreground flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5" />
            照片仅用于本次分析，不会上传保存
          </div>
        </div>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto max-w-6xl px-6 py-6 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} SkinMatch · 仅供日常护肤参考，不构成医学诊断
        </div>
      </footer>

      {/* Fullscreen analyzing overlay */}
      {stage !== "idle" && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 backdrop-blur-xl">
          <div
            className="stereo-card rounded-3xl px-10 py-12 text-center max-w-sm mx-4"
            style={{ background: "var(--surface)" }}
          >
            <div className="relative mx-auto h-16 w-16">
              <div className="absolute inset-0 rounded-full bg-accent/20 animate-ping" />
              <div className="relative h-16 w-16 grid place-items-center rounded-full bg-accent/15 border border-accent/30">
                <Loader2 className="h-7 w-7 text-accent animate-spin" />
              </div>
            </div>
            <div className="mt-6 font-display text-xl font-semibold">
              {stage === "preprocessing"
                ? "正在对齐人脸 · 光照矫正"
                : "Gemini 正在判断适配度"}
            </div>
            <div className="mt-2 text-sm text-muted-foreground">
              {stage === "preprocessing"
                ? "首次会加载关键点模型，约 3-6 秒"
                : "综合多分区肤质 × 产品成分，约 6-12 秒"}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
