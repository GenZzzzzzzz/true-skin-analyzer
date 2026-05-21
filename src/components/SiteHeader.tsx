import { Link } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 glass">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link to="/" className="flex items-center gap-2.5 font-display text-lg font-semibold">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-accent-foreground"
            style={{ boxShadow: "0 6px 20px -6px var(--accent)" }}
          >
            <Sparkles className="h-4 w-4" strokeWidth={2.5} />
          </div>
          SkinMatch
          <span className="ml-1 hidden sm:inline text-xs font-normal text-muted-foreground tracking-wider uppercase">
            · AI 适配度
          </span>
        </Link>
        <div className="text-xs text-muted-foreground hidden sm:block">
          Gemini 多模态 · 实时分析
        </div>
      </div>
    </header>
  );
}
