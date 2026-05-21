import { createFileRoute, Link } from "@tanstack/react-router";
import { Droplet, AlertCircle, Sparkles, Scan, Activity, Sun, Layers } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SkinSense — AI 肤质精准分析" },
      { name: "description", content: "拍一张脸，AI 即时分析 7 项肤质指标，给你专属护肤建议。" },
      { property: "og:title", content: "SkinSense — AI 肤质精准分析" },
      { property: "og:description", content: "拍一张脸，AI 即时分析 7 项肤质指标。" },
    ],
  }),
  component: Home,
});

const features = [
  { icon: Droplet, title: "油脂分布", desc: "T 区、额头、鼻、下巴油光检测" },
  { icon: Sun, title: "干燥/缺水", desc: "面颊、眼周干纹、紧绷度评估" },
  { icon: AlertCircle, title: "敏感/红血丝", desc: "局部红斑与血丝识别" },
  { icon: Scan, title: "毛孔状态", desc: "粗大、堵塞情况" },
  { icon: Activity, title: "痘痘/粉刺", desc: "黑头、白头、炎症痘检测" },
  { icon: Layers, title: "肤色均匀度", desc: "暗沉、色斑、雀斑分布" },
  { icon: Sparkles, title: "皱纹/细纹", desc: "年龄相关纹理分析" },
];

function Home() {
  return (
    <div className="min-h-screen">
      <SiteHeader />

      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div
            className="absolute left-1/2 top-0 h-[600px] w-[900px] -translate-x-1/2 rounded-full blur-3xl"
            style={{ background: "radial-gradient(circle, oklch(0.78 0.15 195 / 0.25), transparent 60%)" }}
          />
        </div>
        <div className="mx-auto max-w-6xl px-6 pt-24 pb-20 text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-surface/60 px-4 py-1.5 text-xs text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
            由 Gemini 多模态视觉模型驱动
          </div>
          <h1 className="text-5xl md:text-7xl font-bold leading-[1.05] tracking-tight">
            <span className="text-gradient">看见</span>你的肌肤
            <br />
            像专家一样
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-lg text-muted-foreground">
            上传一张正面照片，AI 在 10 秒内完成 7 项肤质评估，生成可执行的护理建议报告。
          </p>
          <div className="mt-10 flex justify-center gap-3">
            <Link
              to="/analyze"
              className="group inline-flex items-center gap-2 rounded-full bg-accent px-6 py-3 font-medium text-accent-foreground glow-accent hover:opacity-90 transition-opacity"
            >
              开始免费分析
              <span className="transition-transform group-hover:translate-x-0.5">→</span>
            </Link>
            <a
              href="#features"
              className="inline-flex items-center rounded-full border border-border bg-surface/40 px-6 py-3 font-medium hover:bg-surface transition-colors"
            >
              查看指标
            </a>
          </div>

          <div className="mx-auto mt-20 max-w-4xl">
            <div className="glass rounded-3xl p-8 text-left">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                {[
                  { label: "综合健康", value: "86", unit: "分" },
                  { label: "肤质类型", value: "混合", unit: "偏油" },
                  { label: "评估维度", value: "7", unit: "项" },
                  { label: "用时", value: "<10", unit: "秒" },
                ].map((s) => (
                  <div key={s.label}>
                    <div className="text-xs uppercase tracking-widest text-muted-foreground">{s.label}</div>
                    <div className="mt-2 font-display text-4xl font-semibold">
                      {s.value}
                      <span className="ml-1 text-base font-normal text-muted-foreground">{s.unit}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="mx-auto max-w-6xl px-6 py-24">
        <div className="mb-12 text-center">
          <h2 className="text-3xl md:text-4xl font-bold">7 项核心肤质指标</h2>
          <p className="mt-3 text-muted-foreground">视觉 AI + 皮肤专家知识库联合评估</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div
              key={f.title}
              className="group rounded-2xl border border-border bg-surface/40 p-6 transition-all hover:bg-surface hover:border-accent/30"
            >
              <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10 text-accent">
                <f.icon className="h-5 w-5" strokeWidth={1.8} />
              </div>
              <h3 className="font-display text-lg font-semibold">{f.title}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-24">
        <div className="glass rounded-3xl p-10 md:p-14">
          <div className="mb-10 text-center">
            <h2 className="text-3xl md:text-4xl font-bold">三步获得专属报告</h2>
          </div>
          <div className="grid gap-8 md:grid-cols-3">
            {[
              { n: "01", t: "拍摄或上传", d: "在自然光下正面拍摄，或上传清晰照片" },
              { n: "02", t: "AI 视觉分析", d: "图像增强 + 多模态模型评估 7 项指标" },
              { n: "03", t: "查看护理建议", d: "可视化报告与可执行的护肤建议" },
            ].map((s) => (
              <div key={s.n}>
                <div className="font-mono text-xs text-accent">{s.n}</div>
                <div className="mt-3 font-display text-xl font-semibold">{s.t}</div>
                <div className="mt-1.5 text-sm text-muted-foreground">{s.d}</div>
              </div>
            ))}
          </div>
          <div className="mt-10 text-center">
            <Link to="/analyze" className="inline-flex items-center gap-2 rounded-full bg-accent px-6 py-3 font-medium text-accent-foreground glow-accent">
              立即开始 <Sparkles className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-border">
        <div className="mx-auto max-w-6xl px-6 py-8 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} SkinSense · 分析结果仅供日常护肤参考，不构成医学诊断
        </div>
      </footer>
    </div>
  );
}
