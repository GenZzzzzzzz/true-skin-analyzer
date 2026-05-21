import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, RefreshCw, AlertTriangle, CheckCircle2 } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import {
  type CompatibilityReport,
  type RiskRadar,
  type Severity,
  type Verdict,
  type SkinAgeImpact,
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
    labelX: 81, labelY: 68,
    // 侧脸下颌线：内边推到 x66 之外避免触碰嘴唇 (嘴唇约 x42–58/y70–77)
    path: "M66,68 C72,67 78,68 83,71 C86,75 86,81 83,86 C77,89 70,89 66,86 C64,82 63,76 64,71 C64,69 65,68 66,68 Z",
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

function SkinAgeImpactCard({ impact }: { impact: SkinAgeImpact }) {
  const years = impact.years;
  const signed = `${years > 0 ? "+" : ""}${years.toFixed(1)}`;
  const isAging = impact.direction === "aging";
  const isRejuv = impact.direction === "rejuvenating";
  const tone = isAging
    ? { text: "text-rose-300", chip: "bg-rose-500/15 border-rose-400/40 text-rose-200", glow: "oklch(0.65 0.2 25)" }
    : isRejuv
      ? { text: "text-emerald-300", chip: "bg-emerald-500/15 border-emerald-400/40 text-emerald-200", glow: "oklch(0.75 0.18 165)" }
      : { text: "text-muted-foreground", chip: "bg-white/5 border-white/15 text-muted-foreground", glow: "oklch(0.7 0.05 220)" };
  const label = isAging ? "▲ 老化轨迹加速" : isRejuv ? "▼ 老化轨迹减缓" : "● 基本中性";

  // pointer on -0.6 .. +0.8 scale (tightened to match clamped model output)
  const min = -0.6, max = 0.8;
  const pct = Math.max(0, Math.min(1, (years - min) / (max - min))) * 100;

  return (
    <div className="mt-6 stereo-card rounded-3xl p-8 md:p-10 relative overflow-hidden">
      <div
        className="pointer-events-none absolute -top-24 right-0 h-64 w-64 rounded-full blur-3xl opacity-40"
        style={{ background: `radial-gradient(circle, ${tone.glow}, transparent 70%)` }}
      />
      <div className="text-xs uppercase tracking-widest text-muted-foreground">
        皮肤老化轨迹影响 · 持续使用 12 个月
      </div>
      <div className="mt-2 grid gap-8 md:grid-cols-[auto,1fr] items-center">
        <div className="text-center md:text-left">
          <div className={`font-display text-6xl md:text-7xl font-bold tabular-nums ${tone.text}`}>
            {signed} <span className="text-2xl md:text-3xl font-medium opacity-80">岁</span>
          </div>
          <div className={`mt-2 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs ${tone.chip}`}>
            {label}
            <span className="opacity-60">· 置信度 {impact.confidence}</span>
          </div>
        </div>
        <div>
          <div className="text-sm text-foreground/80 leading-relaxed">
            预计每日规律使用一年后，相对自然基线，你的<strong className={tone.text}>光老化外观轨迹</strong>
            {isAging ? "将加速约" : isRejuv ? "将减缓约" : "几乎不偏移，约"}
            <span className={`mx-1 font-semibold ${tone.text}`}>{Math.abs(years).toFixed(1)} 岁</span>
            <span className="text-muted-foreground">（非分子层面生物学年龄）</span>。
          </div>
          {/* scale bar */}
          <div className="mt-4">
            <div className="relative h-1.5 rounded-full bg-white/10">
              <div
                className="absolute top-1/2 -translate-y-1/2 h-3 w-3 rounded-full border-2 border-white shadow"
                style={{ left: `calc(${pct}% - 6px)`, background: tone.glow }}
              />
            </div>
            <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
              <span>-0.6 岁 (减缓)</span>
              <span>0</span>
              <span>+0.8 岁 (加速)</span>
            </div>
          </div>
        </div>
      </div>


      {/* Drivers */}
      <div className="mt-6 grid gap-2">
        <div className="text-xs uppercase tracking-widest text-muted-foreground">主要驱动因素</div>
        <ul className="grid gap-2">
          {impact.drivers.map((d, i) => {
            const positive = d.contributionYears > 0;
            return (
              <li
                key={i}
                className="flex items-start justify-between gap-4 rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3"
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium">{d.factor}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{d.mechanism}</div>
                  {d.citation && (
                    <div className="text-[11px] text-accent/80 mt-1 flex items-center gap-1">
                      <span className="opacity-70">🔬</span>
                      <span className="italic">{d.citation}</span>
                    </div>
                  )}
                </div>
                <div
                  className={`shrink-0 tabular-nums text-sm font-semibold ${positive ? "text-rose-300" : "text-emerald-300"}`}
                >
                  {positive ? "+" : ""}
                  {d.contributionYears.toFixed(1)} 岁
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="mt-4 text-[11px] text-muted-foreground">
        * {impact.caveat}
      </div>
    </div>
  );
}

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
              <div className="flex items-center gap-3 flex-wrap">
                {report.verdict === "谨慎" && (
                  <div
                    className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm ${verdictStyle.bg} ${verdictStyle.text} ${verdictStyle.ring}`}
                  >
                    <AlertTriangle className="h-4 w-4" />
                    一般，有更好的选择
                  </div>
                )}
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

        {/* Face hotspot map — minimal, no side breakdown */}

        <div className="mt-6 stereo-card rounded-3xl p-6 md:p-8 overflow-hidden">

          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="text-xs uppercase tracking-widest text-muted-foreground">
                Facial Risk Map
              </div>
              <h2 className="font-display text-xl font-semibold mt-1">面部风险分布</h2>
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

          <div className="mt-6 mx-auto max-w-xl">
            <Stereo3DFace>
              <img
                src={faceMeshImg}
                alt="面部分区示意"
                className="w-full h-auto block relative"
                draggable={false}
                style={{ transform: "translateZ(20px)" }}
              />
              <svg
                className="absolute inset-0 w-full h-full pointer-events-none"
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                style={{ transform: "translateZ(28px)", mixBlendMode: "multiply", opacity: 0.98 }}
              >
                <defs>
                  <filter id="skin-bleed" x="-40%" y="-40%" width="180%" height="180%">
                    <feGaussianBlur stdDeviation="2.2" />
                  </filter>
                  <clipPath id="face-skin" clipPathUnits="userSpaceOnUse">
                    <polygon points="8,10 16,6 26,5 36,7 42,12 44,20 45,32 44,44 43,54 41,64 38,74 34,84 30,92 25,94 20,92 16,84 13,74 11,64 9,54 8,44 7,34 7,22" />
                    <polygon points="58,10 64,7 74,5 84,7 91,12 93,22 94,34 93,46 92,58 90,68 87,77 83,86 77,92 70,92 65,88 62,80 60,70 58,60 57,50 56,40 57,28 58,18" />
                  </clipPath>
                </defs>
                <g clipPath="url(#face-skin)" filter="url(#skin-bleed)">
                  {FACE_ZONES.map((z) => {
                    const v = getZoneIntensity(z, report.riskRadar);
                    if (v < 45) return null;
                    const isHot = v >= 70;
                    const rgb = isHot ? "240,40,40" : "250,165,30";
                    const alpha = 0.55 + (v / 100) * 0.30;
                    return (
                      <path key={z.id} d={z.path} fill={`rgba(${rgb},${alpha})`} className={isHot ? "animate-pulse" : ""} />
                    );
                  })}
                </g>
              </svg>
              <svg
                className="absolute inset-0 w-full h-full pointer-events-none"
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                style={{ transform: "translateZ(32px)", mixBlendMode: "soft-light", opacity: 0.92 }}
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
                      <path key={`${z.id}-glow`} d={z.path} fill={`rgba(${rgb},0.72)`} className={isHot ? "animate-pulse" : ""} />
                    );
                  })}
                </g>
              </svg>
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
          </div>
        </div>


        {/* Skin Age Impact — Regenerative Bio hero number */}
        {report.skinAgeImpact && <SkinAgeImpactCard impact={report.skinAgeImpact} />}



        {/* Benefits only */}
        {report.benefits.length > 0 && (
          <div className="mt-6 stereo-card rounded-3xl p-6 md:p-8">
            <div className="text-xs uppercase tracking-widest text-muted-foreground">
              Potential Benefits
            </div>
            <h3 className="font-display text-xl font-semibold mt-1 flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-400" /> 潜在好处
            </h3>
            <ul className="mt-4 space-y-2">
              {report.benefits.map((b, i) => (
                <li key={i} className="flex gap-2 text-sm">
                  <span className="text-emerald-400">·</span>
                  <span>{b}</span>
                </li>
              ))}
            </ul>
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
