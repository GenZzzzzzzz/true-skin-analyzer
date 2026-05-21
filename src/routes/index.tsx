import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader } from "@/components/SiteHeader";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SkinSense — AI 肤质分析" },
      { name: "description", content: "拍一张脸，AI 分析肤质。" },
    ],
  }),
  component: Home,
});

function Home() {
  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="flex-1 flex items-center justify-center px-6">
        <div className="text-center">
          <h1 className="font-display text-6xl md:text-8xl font-semibold tracking-tight leading-none">
            看见<br />你的肌肤
          </h1>
          <div className="mt-16">
            <Link
              to="/analyze"
              className="inline-block border-b border-foreground pb-1 text-sm tracking-widest uppercase hover:opacity-60 transition-opacity"
            >
              开始
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
