import { createFileRoute, Link, ClientOnly } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  ResponsiveContainer,
} from "recharts";
import { ArrowLeft, RefreshCw, AlertTriangle, CheckCircle2, Lightbulb } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import {
  type CompatibilityReport,
  RISK_RADAR_LABELS,
  type Severity,
  type Verdict,
} from "@/lib/compatibility-types";

export const Route = createFileRoute("/report")({
  head: () => ({
    meta: [
      { title: "适配度报告 — SkinMatch" },
      { name: "description", content: "查看 AI 对这款产品与你皮肤的适配度评估。" },
    ],
  }),
  component: ReportPage,
});

const VERDICT_STYLE: Record<Verdict, { bg: string; text: string; ring: string }> = {
  推荐: { bg: "bg-emerald-500/15", text: "text-emerald-300", ring: "border-emerald-400/40" },
  谨慎: { bg: "bg-amber-500/15", text: "text-amber-300", ring: "border-amber-400/40" },
  不推荐: { bg: "bg-rose-500/15", text: "text-rose-300", ring: "border-rose-400/40" },
};

const SEV_STYLE: Record<Severity, string> = {
  低: "bg-emerald-500/15 text-emerald-300 border-emerald-400/30",
  中: "bg-amber-500/15 text-amber-300 border-amber-400/30",
  高: "bg-rose-500/15 text-rose-300 border-rose-400/30",
};

function ReportPage() {
  const [report, setReport] = useState<CompatibilityReport | null>(null);
  const [facePhoto, setFacePhoto] = useState<string | null>(null);
  const [productPhoto, setProductPhoto] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("compat-report");
      if (raw) setReport(JSON.parse(raw));
      setFacePhoto(sessionStorage.getItem("face-photo"));
      setProductPhoto(sessionStorage.getItem("product-photo"));
    } catch {}
  }, []);

  if (!report) {
    return (
      <div className="min-h-screen">
        <SiteHeader />
        <div className="mx-auto max-w-2xl px-6 py-24 text-center">
          <h1 className="font-display text-2xl font-semibold">暂无报告</h1>
          <p className="mt-2 text-muted-foreground">请先完成一次适配度分析</p>
          <Link
            to="/"
            className="mt-6 inline-block rounded-full bg-accent px-6 py-2.5 text-accent-foreground font-medium"
          >
            去分析
          </Link>
        </div>
      </div>
    );
  }

  const verdictStyle = VERDICT_STYLE[report.verdict] ?? VERDICT_STYLE["谨慎"];
  const radarData = (Object.keys(RISK_RADAR_LABELS) as Array<keyof typeof RISK_RADAR_LABELS>).map(
    (k) => ({
      subject: RISK_RADAR_LABELS[k],
      A: report.riskRadar[k] ?? 0,
      fullMark: 100,
    }),
  );

  // Circular score ring math
  const R = 56;
  const C = 2 * Math.PI * R;
  const dash = (report.compatibilityScore / 100) * C;

  return (
    <div className="min-h-screen relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div
          className="absolute left-1/2 top-0 h-[500px] w-[800px] -translate-x-1/2 rounded-full blur-3xl opacity-50"
          style={{
            background:
              "radial-gradient(circle, oklch(0.78 0.15 195 / 0.25), transparent 65%)",
          }}
        />
      </div>
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-6 py-12">
        <div className="mb-8 flex items-center justify-between">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" /> 返回首页
          </Link>
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm hover:bg-surface transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" /> 换一款再测
          </Link>
        </div>

        {/* Hero: score ring + verdict */}
        <div className="stereo-card rounded-[2rem] p-8 md:p-10">
          <div className="grid gap-8 md:grid-cols-[auto,1fr] items-center">
            <div className="relative h-44 w-44 mx-auto md:mx-0">
              <svg viewBox="0 0 140 140" className="h-full w-full -rotate-90">
                <circle
                  cx="70"
                  cy="70"
                  r={R}
                  fill="none"
                  stroke="var(--border)"
                  strokeWidth="10"
                />
                <circle
                  cx="70"
                  cy="70"
                  r={R}
                  fill="none"
                  stroke="url(#scoreGrad)"
                  strokeWidth="10"
                  strokeLinecap="round"
                  strokeDasharray={`${dash} ${C}`}
                  style={{ filter: "drop-shadow(0 0 8px var(--accent))" }}
                />
                <defs>
                  <linearGradient id="scoreGrad" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="oklch(0.85 0.16 195)" />
                    <stop offset="100%" stopColor="oklch(0.75 0.18 165)" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="absolute inset-0 grid place-items-center">
                <div className="text-center">
                  <div className="font-display text-5xl font-bold text-gradient tabular-nums">
                    {report.compatibilityScore}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">适配度 / 100</div>
                </div>
              </div>
            </div>
            <div>
              <div
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm ${verdictStyle.bg} ${verdictStyle.text} ${verdictStyle.ring}`}
              >
                {report.verdict === "推荐" && <CheckCircle2 className="h-4 w-4" />}
                {report.verdict !== "推荐" && <AlertTriangle className="h-4 w-4" />}
                AI 判断：{report.verdict}
              </div>
              <h1 className="mt-4 font-display text-2xl md:text-3xl font-semibold">
                {report.product.recognized
                  ? report.product.name || "已识别产品"
                  : "产品识别信息不足"}
              </h1>
              <div className="mt-1 text-sm text-muted-foreground">
                {report.product.category}
              </div>
              <p className="mt-4 text-muted-foreground leading-relaxed">
                {report.summary}
              </p>
            </div>
          </div>
        </div>

        {/* Two cards: skin + product */}
        <div className="mt-6 grid gap-5 md:grid-cols-2">
          <div className="stereo-card rounded-2xl p-6">
            <div className="flex items-center gap-3">
              {facePhoto && (
                <img
                  src={facePhoto}
                  alt=""
                  className="h-14 w-14 rounded-xl object-cover border border-white/10"
                />
              )}
              <div>
                <div className="text-xs uppercase tracking-widest text-muted-foreground">
                  你的皮肤
                </div>
                <div className="font-display text-lg font-semibold">
                  {report.skinSnapshot.type}
                </div>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-1.5">
              {report.skinSnapshot.topConcerns.map((c) => (
                <span
                  key={c}
                  className="rounded-full bg-accent/10 border border-accent/20 text-accent px-2.5 py-1 text-xs"
                >
                  {c}
                </span>
              ))}
            </div>
          </div>

          <div className="stereo-card rounded-2xl p-6">
            <div className="flex items-center gap-3">
              {productPhoto && (
                <img
                  src={productPhoto}
                  alt=""
                  className="h-14 w-14 rounded-xl object-cover border border-white/10"
                />
              )}
              <div>
                <div className="text-xs uppercase tracking-widest text-muted-foreground">
                  识别到的产品
                </div>
                <div className="font-display text-lg font-semibold">
                  {report.product.category}
                </div>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-1.5">
              {report.product.keyIngredients.length === 0 && (
                <span className="text-xs text-muted-foreground">未识别到关键成分</span>
              )}
              {report.product.keyIngredients.map((c) => (
                <span
                  key={c}
                  className="rounded-full bg-fuchsia-400/10 border border-fuchsia-300/20 text-fuchsia-200 px-2.5 py-1 text-xs"
                >
                  {c}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Risk radar */}
        <div className="mt-6 stereo-card rounded-3xl p-6 md:p-8">
          <h2 className="font-display text-xl font-semibold">风险维度雷达</h2>
          <div className="text-xs text-muted-foreground mt-1">数值越高 = 风险越大</div>
          <div className="h-[320px] mt-4">
            <ClientOnly fallback={<div className="h-full w-full animate-pulse rounded-2xl bg-muted/30" />}>
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData}>
                  <PolarGrid stroke="var(--border)" />
                  <PolarAngleAxis
                    dataKey="subject"
                    tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                  />
                  <Radar
                    name="风险"
                    dataKey="A"
                    stroke="oklch(0.7 0.22 25)"
                    fill="oklch(0.7 0.22 25)"
                    fillOpacity={0.25}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </ClientOnly>
          </div>
        </div>

        {/* Risks list */}
        {report.risks.length > 0 && (
          <div className="mt-6">
            <h2 className="font-display text-xl font-semibold mb-3 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-400" />
              潜在风险
            </h2>
            <div className="grid gap-3">
              {report.risks.map((r, i) => (
                <div
                  key={i}
                  className="stereo-card rounded-2xl p-5 flex items-start gap-4"
                >
                  <span
                    className={`shrink-0 rounded-full border px-2.5 py-1 text-xs ${SEV_STYLE[r.severity]}`}
                  >
                    {r.severity}
                  </span>
                  <div className="flex-1">
                    <div className="font-display font-semibold">{r.type}</div>
                    <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
                      {r.reason}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Benefits + Tips + Alternatives */}
        <div className="mt-6 grid gap-5 md:grid-cols-2">
          {report.benefits.length > 0 && (
            <div className="stereo-card rounded-2xl p-6">
              <h3 className="font-display text-lg font-semibold flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-400" /> 潜在好处
              </h3>
              <ul className="mt-3 space-y-2">
                {report.benefits.map((b, i) => (
                  <li key={i} className="flex gap-2 text-sm">
                    <span className="text-emerald-400">·</span>
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="stereo-card rounded-2xl p-6">
            <h3 className="font-display text-lg font-semibold flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-accent" /> 使用建议
            </h3>
            <ul className="mt-3 space-y-2">
              {report.usageTips.map((t, i) => (
                <li key={i} className="flex gap-2 text-sm">
                  <span className="text-accent">·</span>
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {report.alternatives && report.alternatives.length > 0 && (
          <div className="mt-6 stereo-card rounded-2xl p-6">
            <h3 className="font-display text-lg font-semibold">替代成分方向</h3>
            <div className="mt-3 flex flex-wrap gap-2">
              {report.alternatives.map((a, i) => (
                <span
                  key={i}
                  className="rounded-full bg-white/5 border border-white/10 px-3 py-1.5 text-sm"
                >
                  {a}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="mt-10 rounded-2xl border border-border bg-surface/30 p-5 text-xs text-muted-foreground text-center">
          本报告基于 AI 视觉与成分分析，仅供日常护肤参考，不构成医学诊断。
          如有皮肤问题或既往过敏史，请咨询专业皮肤科医生。
        </div>
      </main>
    </div>
  );
}
