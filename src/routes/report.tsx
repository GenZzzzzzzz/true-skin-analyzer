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
import faceMeshImg from "@/assets/face-mesh-v2.png";
import { Stereo3DFace } from "@/components/Stereo3DFace";

// 面部分区 → 在 wireframe 图上的精细轮廓 (SVG path d, viewBox 100x100)
// path: 基于面部分割描出的不规则形状，贴合每一块皮肤亚区（额头/鼻/眼眶/颊/下巴/下颌/太阳穴）
type FaceZone = {
  id: string;
  label: string;
  labelX: number;
  labelY: number;
  path: string;
  drivers: Array<keyof RiskRadar>;
  hint: string;
};

const FACE_ZONES: FaceZone[] = [
  {
    id: "forehead",
    label: "额头 · T 区",
    labelX: 26, labelY: 18,
    // 额头：发际线 y≈22 到眉骨 y≈38，宽度 x16-37
    path: "M16,28 C18,23 22,21 26,21 C30,21 34,23 37,28 C38,33 37,36 34,37 C30,38 22,38 18,37 C16,36 15,33 16,28 Z",
    drivers: ["oiliness", "comedogenic"],
    hint: "出油 / 闭口高发区",
  },
  {
    id: "nose",
    label: "鼻翼 · 黑头区",
    labelX: 26, labelY: 53,
    // 鼻：从眉间 y47 到鼻尖 y65，鼻翼在 y60-66 张开到 x22-30
    path: "M25,47 C24,52 23,57 23,61 C22,64 22,66 25,67 C26,67 27,67 28,67 C30,67 31,66 30,63 C30,58 29,52 28,47 C27,46 26,46 25,47 Z",
    drivers: ["oiliness", "comedogenic", "irritation"],
    hint: "黑头、毛孔粗大",
  },
  {
    id: "eye",
    label: "眼周",
    labelX: 37, labelY: 41,
    // 双眼眶：左眼 x13-22 / 右眼 x29-38，y43-48
    path: "M14,46 C16,43 19,42 22,43 C23,44 23,46 22,47 C19,49 16,49 14,48 C13,47 13,47 14,46 Z M30,46 C32,43 35,42 38,43 C39,44 39,46 38,47 C35,49 32,49 30,48 C29,47 29,47 30,46 Z",
    drivers: ["allergy", "irritation", "dryness"],
    hint: "皮肤最薄，易刺痛 / 过敏",
  },
  {
    id: "left-cheek",
    label: "左颊",
    labelX: 13, labelY: 56,
    // 左颊：颧骨下 x12-21, y52-73
    path: "M13,54 C15,52 18,52 20,55 C21,59 22,64 21,69 C19,73 16,75 13,74 C11,72 11,67 11,62 C11,58 12,55 13,54 Z",
    drivers: ["dryness", "irritation", "photo"],
    hint: "干燥 / 泛红 / 晒伤区",
  },
  {
    id: "right-cheek",
    label: "右颊",
    labelX: 39, labelY: 56,
    path: "M39,54 C37,52 34,52 32,55 C31,59 30,64 31,69 C33,73 36,75 39,74 C41,72 41,67 41,62 C41,58 40,55 39,54 Z",
    drivers: ["dryness", "irritation", "photo"],
    hint: "干燥 / 泛红 / 晒伤区",
  },
  {
    id: "chin",
    label: "下巴",
    labelX: 26, labelY: 93,
    // 下巴：x20-32, y79-89 (嘴下到下巴底)
    path: "M20,81 C22,79 30,79 32,81 C33,84 32,87 30,89 C28,90 24,90 22,89 C20,87 19,84 20,81 Z",
    drivers: ["comedogenic", "oiliness"],
    hint: "周期性闷痘高发区",
  },
  {
    id: "jaw-side",
    label: "下颌线",
    labelX: 78, labelY: 64,
    // 侧脸下颌：x64-85, y65-84
    path: "M64,68 C70,66 78,66 84,69 C86,73 86,78 83,82 C77,86 70,87 66,85 C63,82 62,76 63,71 C63,69 63,68 64,68 Z",
    drivers: ["comedogenic", "irritation"],
    hint: "闷痘 / 摩擦刺激",
  },
  {
    id: "temple",
    label: "太阳穴",
    labelX: 66, labelY: 28,
    // 侧脸太阳穴：x62-72, y32-44
    path: "M62,34 C64,31 68,30 72,32 C73,36 72,40 70,43 C67,44 64,43 62,41 C61,38 61,36 62,34 Z",
    drivers: ["photo", "dryness"],
    hint: "易晒伤 / 干纹",
  },
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
            <Stereo3DFace>
              <img
                src={faceMeshImg}
                alt="面部分区示意"
                className="w-full h-auto block opacity-95 grayscale relative"
                draggable={false}
                style={{ transform: "translateZ(20px)" }}
              />
              {/* Hotspot overlay — 基于面部分割的精细轮廓 */}
              <svg
                className="absolute inset-0 w-full h-full pointer-events-none mix-blend-multiply"
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                style={{
                  transform: "translateZ(35px)",
                  filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.45))",
                }}
              >
                <defs>
                  <filter id="blob-blur" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="0.35" />
                  </filter>
                  <clipPath id="face-skin" clipPathUnits="userSpaceOnUse">
                    <polygon points="
                      27,14 33,15 38,18 41,24 42,32 43,42 42,52
                      40,62 37,72 33,82 29,90 25,92 21,90 17,82
                      14,72 12,62 11,52 11,42 12,32 14,24 18,18 22,15
                    " />
                    <polygon points="
                      72,14 78,15 83,19 86,26 88,35 89,46 88,56
                      86,66 83,75 79,84 74,90 68,90 64,86 62,78
                      60,68 59,58 59,48 60,38 62,28 65,20
                    " />
                  </clipPath>
                </defs>
                <g clipPath="url(#face-skin)">
                  {FACE_ZONES.map((z) => {
                    const v = getZoneIntensity(z, report.riskRadar);
                    if (v < 45) return null;
                    const isHot = v >= 70;
                    const rgb = isHot ? "239,68,68" : "251,191,36";
                    const fillAlpha = 0.38 + (v / 100) * 0.22;
                    const strokeAlpha = isHot ? 0.75 : 0.6;
                    return (
                      <g key={z.id} className={isHot ? "animate-pulse" : ""}>
                        {/* 填充层 —— 轻微模糊使边缘更自然 */}
                        <path
                          d={z.path}
                          fill={`rgba(${rgb},${fillAlpha})`}
                          filter="url(#blob-blur)"
                        />
                        {/* 描边层 —— 勾勒分割轮廓 */}
                        <path
                          d={z.path}
                          fill="none"
                          stroke={`rgba(${rgb},${strokeAlpha})`}
                          strokeWidth={0.4}
                          strokeLinejoin="round"
                          vectorEffect="non-scaling-stroke"
                        />
                      </g>
                    );
                  })}
                </g>
              </svg>
              {/* Labels */}
              <div className="absolute inset-0" style={{ transform: "translateZ(60px)" }}>
                {FACE_ZONES.map((z) => {
                  const v = getZoneIntensity(z, report.riskRadar);
                  if (v < 45) return null;
                  const isHot = v >= 70;
                  return (
                    <div
                      key={`${z.id}-label`}
                      className="absolute -translate-x-1/2 pointer-events-none"
                      style={{ left: `${z.labelX}%`, top: `${z.labelY}%` }}
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
            </Stereo3DFace>


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
