import { Link } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 glass">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link to="/" className="flex items-center gap-2 font-display text-lg font-semibold">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-accent text-accent-foreground">
            <Sparkles className="h-4 w-4" strokeWidth={2.5} />
          </div>
          SkinSense
        </Link>
        <nav className="flex items-center gap-6 text-sm text-muted-foreground">
          <Link to="/" activeOptions={{ exact: true }} activeProps={{ className: "text-foreground" }} className="hover:text-foreground transition-colors">首页</Link>
          <Link to="/analyze" activeProps={{ className: "text-foreground" }} className="hover:text-foreground transition-colors">开始分析</Link>
          <Link to="/analyze" className="rounded-full bg-accent px-4 py-1.5 text-accent-foreground font-medium hover:opacity-90 transition-opacity">
            立即体验
          </Link>
        </nav>
      </div>
    </header>
  );
}
