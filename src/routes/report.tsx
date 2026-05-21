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
  type RiskRadar,
  type Severity,
  type Verdict,
} from "@/lib/compatibility-types";
import faceMeshImg from "@/assets/face-mesh.png";

// 面部分区 → 在 wireframe 图上的相对位置 (%)，以及该分区主要受哪些风险影响
type FaceZone = {
  id: string;
  label: string;
  x: number;
  y: number;
  size: number; // hotspot 基础半径 (px on 1x)
  drivers: Array<keyof RiskRadar>;
  hint: string;
};

const FACE_ZONES: FaceZone[] = [
  { id: "forehead", label: "额头 · T 区", x: 22, y: 17, size: 56, drivers: ["oiliness", "comedogenic"], hint: "出油 / 闭口高发区" },
  { id: "nose", label: "鼻翼 · 黑头区", x: 22, y: 47, size: 42, drivers: ["oiliness", "comedogenic", "irritation"], hint: "黑头、毛孔粗大" },
  { id: "eye", label: "眼周", x: 29, y: 31, size: 38, drivers: ["allergy", "irritation", "dryness"], hint: "皮肤最薄，易刺痛 / 过敏" },
  { id: "left-cheek", label: "左颊", x: 11, y: 52, size: 50, drivers: ["dryness", "irritation", "photo"], hint: "干燥 / 泛红 / 晒伤区" },
  { id: "right-cheek", label: "右颊", x: 33, y: 52, size: 50, drivers: ["dryness", "irritation", "photo"], hint: "干燥 / 泛红 / 晒伤区" },
  { id: "chin", label: "下巴", x: 22, y: 76, size: 46, drivers: ["comedogenic", "oiliness"], hint: "周期性闷痘高发区" },
  { id: "jaw-side", label: "下颌线", x: 72, y: 74, size: 48, drivers: ["comedogenic", "irritation"], hint: "闷痘 / 摩擦刺激" },
  { id: "temple", label: "太阳穴", x: 62, y: 28, size: 40, drivers: ["photo", "dryness"], hint: "易晒伤 / 干纹" },
];

function getZoneIntensity(zone: FaceZone, radar: RiskRadar): number {
  // 取该分区主要驱动维度的最大值作为强度
  let max = 0;
  for (const k of zone.drivers) {
    const v = radar[k] ?? 0;
    if (v > max) max = v;
  }
  return max; // 0-100
}

function intensityLabel(v: number): { text: string; color: string } {
  if (v >= 70) return { text: "重灾区", color: "text-rose-300" };
  if (v >= 45) return { text: "需留意", color: "text-amber-300" };
  if (v >= 25) return { text: "轻微", color: "text-emerald-300" };
  return { text: "安全", color: "text-muted-foreground" };
}

const VERDICT_MAP: Record<Verdict, { label: string; sub: string }> = {
  推荐: { label: "放心用", sub: "" },
  谨慎: { label: "最好别用", sub: "但也不是不行" },
  不推荐: { label: "千万别用", sub: "" },
};

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
              <div className="flex items-center gap-3">
                <div
                  className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm ${verdictStyle.bg} ${verdictStyle.text} ${verdictStyle.ring}`}
                >
                  {report.verdict === "推荐" && <CheckCircle2 className="h-4 w-4" />}
                  {report.verdict !== "推荐" && <AlertTriangle className="h-4 w-4" />}
                  {VERDICT_MAP[report.verdict]?.label ?? report.verdict}
                </div>
                {VERDICT_MAP[report.verdict]?.sub && (
                  <span className="text-xs text-muted-foreground">
                    {VERDICT_MAP[report.verdict].sub}
                  </span>
                )}
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

        {/* Face hotspot map */}
        <div className="mt-6 stereo-card rounded-3xl p-6 md:p-8 overflow-hidden">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h2 className="font-display text-xl font-semibold">面部风险分布</h2>
              <div className="text-xs text-muted-foreground mt-1">
                红色越深 = 该区域越可能出问题 · 基于成分 × 你皮肤的反应推断
              </div>
            </div>
            <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/70 shadow-[0_0_8px] shadow-emerald-400/60" />
                安全
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-amber-400/80 shadow-[0_0_8px] shadow-amber-400/70" />
                留意
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-rose-500 shadow-[0_0_12px] shadow-rose-500/80" />
                重灾区
              </span>
            </div>
          </div>

          <div className="mt-5 grid gap-6 md:grid-cols-[1.4fr,1fr] items-start">
            {/* Image + hotspots */}
            <div
              className="relative rounded-2xl overflow-hidden border border-white/10"
              style={{
                background:
                  "radial-gradient(120% 80% at 50% 30%, oklch(0.22 0.02 240 / 0.7), oklch(0.08 0.01 240 / 0.95))",
              }}
            >
              <img
                src={faceMeshImg}
                alt="面部分区示意"
                className="w-full h-auto block opacity-90 mix-blend-luminosity"
                draggable={false}
              />
              {/* Hotspot overlay */}
              <div className="absolute inset-0">
                {FACE_ZONES.map((z) => {
                  const v = getZoneIntensity(z, report.riskRadar);
                  if (v < 15) return null; // 太低就不画
                  const isHot = v >= 70;
                  const isMid = v >= 45 && v < 70;
                  const color = isHot
                    ? "239,68,68" // rose-500
                    : isMid
                      ? "251,191,36" // amber-400
                      : "52,211,153"; // emerald-400
                  const alpha = 0.18 + (v / 100) * 0.55;
                  const sizePx = z.size + (v / 100) * 28;
                  return (
                    <div
                      key={z.id}
                      className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                      style={{ left: `${z.x}%`, top: `${z.y}%` }}
                    >
                      <div
                        className={isHot ? "animate-pulse" : ""}
                        style={{
                          width: `${sizePx}px`,
                          height: `${sizePx}px`,
                          borderRadius: "9999px",
                          background: `radial-gradient(circle, rgba(${color},${alpha}) 0%, rgba(${color},${alpha * 0.5}) 35%, transparent 70%)`,
                          filter: "blur(2px)",
                        }}
                      />
                    </div>
                  );
                })}
                {/* Labels */}
                {FACE_ZONES.map((z) => {
                  const v = getZoneIntensity(z, report.riskRadar);
                  if (v < 45) return null;
                  const isHot = v >= 70;
                  return (
                    <div
                      key={`${z.id}-label`}
                      className="absolute -translate-x-1/2 pointer-events-none"
                      style={{ left: `${z.x}%`, top: `calc(${z.y}% - 4px)` }}
                    >
                      <div
                        className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-medium backdrop-blur-md border ${
                          isHot
                            ? "bg-rose-500/25 border-rose-300/40 text-rose-100"
                            : "bg-amber-400/20 border-amber-300/40 text-amber-100"
                        }`}
                      >
                        {z.label}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Zone breakdown list */}
            <div className="space-y-2">
              {[...FACE_ZONES]
                .map((z) => ({ z, v: getZoneIntensity(z, report.riskRadar) }))
                .sort((a, b) => b.v - a.v)
                .map(({ z, v }) => {
                  const meta = intensityLabel(v);
                  return (
                    <div
                      key={z.id}
                      className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2.5"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{z.label}</div>
                        <div className="text-[11px] text-muted-foreground truncate">
                          {z.hint}
                        </div>
                      </div>
                      <div className="w-20 h-1.5 rounded-full bg-white/5 overflow-hidden shrink-0">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${Math.max(4, v)}%`,
                            background:
                              v >= 70
                                ? "linear-gradient(90deg, oklch(0.7 0.22 25), oklch(0.6 0.25 15))"
                                : v >= 45
                                  ? "linear-gradient(90deg, oklch(0.8 0.18 75), oklch(0.7 0.2 55))"
                                  : "linear-gradient(90deg, oklch(0.78 0.15 165), oklch(0.7 0.16 195))",
                          }}
                        />
                      </div>
                      <span className={`text-[11px] w-12 text-right ${meta.color}`}>
                        {meta.text}
                      </span>
                    </div>
                  );
                })}
            </div>
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
