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
    labelX: 26, labelY: 14,
    // 正脸额头：发际线 y≈11 → 眉骨 y≈39，横跨 x10–38；顶部贴合发际弧线
    path: "M11,16 C14,12 19,10 24,10 C30,10 35,11 38,15 C40,21 40,29 39,35 C38,38 36,40 33,40 C28,41 21,41 16,40 C13,40 11,38 10,34 C9,28 9,21 11,16 Z",
    drivers: ["oiliness", "comedogenic"],
    hint: "出油 / 闭口高发区",
  },
  {
    id: "nose",
    label: "鼻翼 · 黑头区",
    labelX: 26, labelY: 52,
    // 鼻梁→鼻尖→鼻翼：y42 起到 y67，鼻翼 x21–30；避开眼睛
    path: "M24,42 C23,47 22,53 22,58 C21,62 21,65 23,67 C25,68 27,68 29,67 C31,65 31,62 30,58 C30,53 29,47 28,42 C27,41 25,41 24,42 Z",
    drivers: ["oiliness", "comedogenic", "irritation"],
    hint: "黑头、毛孔粗大",
  },
  {
    id: "eye",
    label: "眼周",
    labelX: 37, labelY: 39,
    // 眼周为下眼睑/外眼角的弯月环，避开眼球 (y43–47 中心)
    path: "M12,47 C16,46 21,46 23,47 C22,50 19,51 16,51 C13,51 12,49 12,47 Z M29,47 C31,46 36,46 40,47 C40,49 39,51 36,51 C33,51 30,50 29,47 Z",
    drivers: ["allergy", "irritation", "dryness"],
    hint: "皮肤最薄，易刺痛 / 过敏",
  },
  {
    id: "left-cheek",
    label: "左颊",
    labelX: 13, labelY: 58,
    // 左颊：颧骨下 x9–21, y49–70；上不触眼睑、下不触唇 (y>71)
    path: "M11,50 C14,49 18,49 20,52 C21,57 22,63 20,68 C17,71 13,71 11,69 C9,65 8,58 9,53 C9,51 10,50 11,50 Z",
    drivers: ["dryness", "irritation", "photo"],
    hint: "干燥 / 泛红 / 晒伤区",
  },
  {
    id: "right-cheek",
    label: "右颊",
    labelX: 39, labelY: 58,
    path: "M39,50 C36,49 32,49 30,52 C29,57 28,63 30,68 C33,71 37,71 39,69 C41,65 42,58 41,53 C41,51 40,50 39,50 Z",
    drivers: ["dryness", "irritation", "photo"],
    hint: "干燥 / 泛红 / 晒伤区",
  },
  {
    id: "chin",
    label: "下巴",
    labelX: 26, labelY: 94,
    // 下巴：嘴下 y78 → 下巴底 y91，x19–32；避开下唇 (y<78)
    path: "M19,79 C22,77 28,77 31,79 C33,82 33,87 31,90 C28,92 22,92 19,90 C17,87 17,82 19,79 Z",
    drivers: ["comedogenic", "oiliness"],
    hint: "周期性闷痘高发区",
  },
  {
    id: "jaw-side",
    label: "下颌线",
    labelX: 79, labelY: 66,
    // 侧脸下颌线：贴合颌骨弧线 x61–84, y65–86；避开嘴唇 (x71–83/y70–77)
    path: "M62,66 C68,65 76,66 82,69 C85,73 85,79 82,84 C76,87 68,87 64,84 C61,80 60,74 61,69 C61,67 61,66 62,66 Z",
    drivers: ["comedogenic", "irritation"],
    hint: "闷痘 / 摩擦刺激",
  },
  {
    id: "temple",
    label: "太阳穴",
    labelX: 66, labelY: 26,
    // 侧脸太阳穴：x60–74, y26–42，绕过眉骨与眼眶
    path: "M61,28 C64,25 70,25 73,28 C74,32 73,37 71,40 C68,42 64,41 62,38 C60,34 60,30 61,28 Z",
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
                  {report.verdict === "谨慎"
                    ? (() => {
                        const sevOrder: Record<Severity, number> = { 高: 3, 中: 2, 低: 1 };
                        const probMap: Record<Severity, number> = { 高: 80, 中: 55, 低: 30 };
                        const topRisks = [...report.risks]
                          .sort((a, b) => sevOrder[b.severity] - sevOrder[a.severity])
                          .slice(0, 2);
                        if (topRisks.length === 1) {
                          return `可能有${topRisks[0].type}的风险`;
                        }
                        return `可能有${topRisks.map((r) => `${r.type}（${probMap[r.severity]}%）`).join("、")}的风险`;
                      })()
                    : (VERDICT_MAP[report.verdict]?.label ?? report.verdict)}
                </div>
                {report.verdict === "谨慎" ? (
                  <span className="text-xs text-muted-foreground">
                    （{Math.round(100 - report.compatibilityScore)}% 综合风险概率）
                  </span>
                ) : VERDICT_MAP[report.verdict]?.sub && (
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
                className="w-full h-auto block relative"
                draggable={false}
                style={{ transform: "translateZ(20px)" }}
              />
              {/* Hotspot overlay — 基于面部分割的精细轮廓 */}
              {/* 皮下泛色层 —— 用 multiply 让红/黄"渗进"肤色,而不是浮在表面 */}
              <svg
                className="absolute inset-0 w-full h-full pointer-events-none"
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                style={{
                  transform: "translateZ(28px)",
                  mixBlendMode: "multiply",
                  opacity: 0.98,
                }}
              >
                <defs>
                  {/* 大幅羽化:让色块边缘自然消散在皮肤里,完全无硬边 */}
                  <filter id="skin-bleed" x="-40%" y="-40%" width="180%" height="180%">
                    <feGaussianBlur stdDeviation="2.2" />
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
                <g clipPath="url(#face-skin)" filter="url(#skin-bleed)">
                  {FACE_ZONES.map((z) => {
                    const v = getZoneIntensity(z, report.riskRadar);
                    if (v < 45) return null;
                    const isHot = v >= 70;
                    // 更饱和的红/黄,让颜色在 multiply 后依然明显可见
                    const rgb = isHot ? "240,40,40" : "250,165,30";
                    const alpha = 0.55 + (v / 100) * 0.30;
                    return (
                      <path
                        key={z.id}
                        d={z.path}
                        fill={`rgba(${rgb},${alpha})`}
                        className={isHot ? "animate-pulse" : ""}
                      />
                    );
                  })}
                </g>
              </svg>
              {/* 高光提示层 —— 极淡的暖光,只在重灾区呼吸,增加"皮下炎症发热"的感觉 */}
              <svg
                className="absolute inset-0 w-full h-full pointer-events-none"
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                style={{
                  transform: "translateZ(32px)",
                  mixBlendMode: "soft-light",
                  opacity: 0.92,
                }}
              >
                <defs>
                  <filter id="skin-glow" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur stdDeviation="3" />
                  </filter>
                </defs>
                <g clipPath="url(#face-skin)" filter="url(#skin-glow)">
                  {FACE_ZONES.map((z) => {
                    const v = getZoneIntensity(z, report.riskRadar);
                    if (v < 60) return null;
                    const isHot = v >= 70;
                    const rgb = isHot ? "255,90,70" : "255,180,60";
                    return (
                      <path
                        key={`${z.id}-glow`}
                        d={z.path}
                        fill={`rgba(${rgb},0.72)`}
                        className={isHot ? "animate-pulse" : ""}
                      />
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
