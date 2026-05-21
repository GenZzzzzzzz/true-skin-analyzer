import { Link } from "@tanstack/react-router";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 glass">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link to="/" className="font-display text-lg font-semibold">
          SkinMatch
        </Link>
        <div className="text-xs text-muted-foreground hidden sm:block">
          Gemini 多模态 · 实时分析
        </div>
      </div>
    </header>
  );
}
