import { createFileRoute, Link, ClientOnly } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer } from "recharts";
import { SiteHeader } from "@/components/SiteHeader";
import type { SkinReport } from "@/lib/skin-types";

export const Route = createFileRoute("/report")({
  head: () => ({
    meta: [
      { title: "报告 — SkinSense" },
      { name: "description", content: "AI 肤质分析报告。" },
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
        <div className="mx-auto max-w-2xl px-6 py-32 text-center">
          <p className="text-muted-foreground text-sm">暂无报告</p>
          <Link to="/analyze" className="mt-6 inline-block border-b border-foreground pb-1 text-sm">
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
      <main className="mx-auto max-w-3xl px-6 py-16">
        <section className="flex items-center gap-6">
          {photo && (
            <div className="h-20 w-20 overflow-hidden rounded-full border border-border shrink-0">
              <img src={photo} alt="" className="h-full w-full object-cover" />
            </div>
          )}
          <div>
            <div className="font-display text-6xl font-semibold tabular-nums tracking-tight">{report.overallScore}</div>
            <div className="mt-1 text-sm text-muted-foreground">{report.skinType}</div>
          </div>
        </section>

        <p className="mt-8 text-muted-foreground leading-relaxed text-sm max-w-xl">{report.summary}</p>

        <div className="mt-16 h-[320px]">
          <ClientOnly fallback={<div className="h-full w-full animate-pulse rounded-2xl bg-muted/30" />}>
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData}>
                <PolarGrid stroke="var(--border)" />
                <PolarAngleAxis dataKey="subject" tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} />
                <Radar dataKey="A" stroke="var(--foreground)" fill="var(--foreground)" fillOpacity={0.1} />
              </RadarChart>
            </ResponsiveContainer>
          </ClientOnly>
        </div>

        <div className="mt-16 divide-y divide-border border-t border-b border-border">
          {report.metrics.map((m) => (
            <div key={m.key} className="py-6">
              <div className="flex items-baseline justify-between">
                <div className="font-display text-base">{m.label}</div>
                <div className="font-display text-2xl font-semibold tabular-nums">{m.score}</div>
              </div>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{m.findings}</p>
              {m.recommendations.length > 0 && (
                <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
                  {m.recommendations.map((r, i) => (
                    <li key={i}>— {r}</li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>

        <div className="mt-12 flex justify-center gap-6 text-sm">
          <Link to="/" className="text-muted-foreground hover:text-foreground transition-colors">首页</Link>
          <Link to="/analyze" className="border-b border-foreground pb-1">重新分析</Link>
        </div>
      </main>
    </div>
  );
}
