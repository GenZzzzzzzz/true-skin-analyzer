import { Link } from "@tanstack/react-router";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 backdrop-blur-sm">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <Link to="/" className="font-display text-base tracking-tight">
          SkinSense
        </Link>
        <Link
          to="/analyze"
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          分析
        </Link>
      </div>
    </header>
  );
}
