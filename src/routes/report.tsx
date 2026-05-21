import { createFileRoute, Link, ClientOnly } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer } from "recharts";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import type { SkinReport } from "@/lib/skin-types";

export const Route = createFileRoute("/report")({
  head: () => ({
    meta: [
      { title: "肤质报告 — SkinSense" },
      { name: "description", content: "查看你的 AI 肤质分析报告与护理建议。" },
    ],
  }),
  component: ReportPage,
});

function ReportPage() {
  const [report, setReport] = useState<SkinReport | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("skin-report");
      const ph = sessionStorage.getItem("skin-photo");
      if (raw) setReport(JSON.parse(raw));
      if (ph) setPhoto(ph);
    } catch {}
  }, []);

  if (!report) {
    return (
      <div className="min-h-screen">
        <SiteHeader />
        <div className="mx-auto max-w-2xl px-6 py-24 text-center">
          <h1 className="font-display text-2xl font-semibold">暂无报告</h1>
          <p className="mt-2 text-muted-foreground">请先完成一次肤质分析</p>
          <Link to="/analyze" className="mt-6 inline-block rounded-full bg-accent px-6 py-2.5 text-accent-foreground font-medium">
            去分析
          </Link>
        </div>
      </div>
    );
  }

  const radarData = report.metrics.map((m) => ({ subject: m.label, A: m.score, fullMark: 100 }));

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-6 py-12">
        <div className="mb-8 flex items-center justify-between">
          <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" /> 返回首页
          </Link>
          <Link to="/analyze" className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm hover:bg-surface transition-colors">
            <RefreshCw className="h-3.5 w-3.5" /> 重新分析
          </Link>
        </div>

        <div className="glass rounded-3xl p-8 md:p-10">
          <div className="grid gap-8 md:grid-cols-[auto,1fr] items-center">
            {photo && (
              <div className="h-32 w-32 overflow-hidden rounded-2xl border border-border md:h-40 md:w-40">
                <img src={photo} alt="" className="h-full w-full object-cover" />
              </div>
            )}
            <div>
              <div className="text-xs uppercase tracking-widest text-muted-foreground">综合健康分</div>
              <div className="mt-1 flex items-baseline gap-3">
                <div className="font-display text-7xl font-bold text-gradient">{report.overallScore}</div>
                <div className="text-muted-foreground">/ 100</div>
              </div>
              <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-accent/10 px-3 py-1 text-sm text-accent">
                肤质类型：{report.skinType}
              </div>
              <p className="mt-4 text-muted-foreground leading-relaxed">{report.summary}</p>
            </div>
          </div>
        </div>

        <div className="mt-6 glass rounded-3xl p-6 md:p-8">
          <h2 className="font-display text-xl font-semibold">肤质雷达</h2>
          <div className="h-[360px] mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData}>
                <PolarGrid stroke="var(--border)" />
                <PolarAngleAxis dataKey="subject" tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} />
                <Radar name="健康度" dataKey="A" stroke="var(--accent)" fill="var(--accent)" fillOpacity={0.25} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {report.metrics.map((m) => (
            <div key={m.key} className="rounded-2xl border border-border bg-surface/40 p-6">
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-display text-lg font-semibold">{m.label}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">等级 {m.level}</div>
                </div>
                <div className="font-display text-3xl font-bold tabular-nums">{m.score}</div>
              </div>
              <div className="mt-3 h-1.5 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${m.score}%`,
                    background: "linear-gradient(90deg, oklch(0.78 0.15 195), oklch(0.85 0.12 165))",
                  }}
                />
              </div>
              <p className="mt-4 text-sm text-muted-foreground leading-relaxed">{m.findings}</p>
              <div className="mt-4 space-y-1.5">
                {m.recommendations.map((r, i) => (
                  <div key={i} className="flex gap-2 text-sm">
                    <span className="text-accent">·</span>
                    <span>{r}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-10 rounded-2xl border border-border bg-surface/30 p-5 text-xs text-muted-foreground text-center">
          本报告基于 AI 视觉分析，仅供日常护肤参考，不构成医学诊断。如有皮肤问题请咨询专业皮肤科医生。
        </div>
      </main>
    </div>
  );
}
