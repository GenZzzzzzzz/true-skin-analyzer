import { useEffect, useRef, type ReactNode } from "react";

/**
 * Pseudo-3D stage for the report face block.
 * - Perspective container with mouse-driven rotateX/rotateY parallax
 * - Light highlight tracking the cursor via CSS vars (--mx / --my)
 * - Inner layers can use translateZ via `data-depth` style (set by parent inline)
 * - Respects prefers-reduced-motion
 * - On touch/no-hover: gentle auto breathing tilt
 */
export function Stereo3DFace({ children }: { children: ReactNode }) {
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const canHover = window.matchMedia("(hover: hover)").matches;

    if (reduce) return;

    if (!canHover) {
      // breathing auto tilt on touch devices
      let start = performance.now();
      const tick = (t: number) => {
        const dt = (t - start) / 1000;
        const rx = Math.sin(dt * 0.6) * 3;
        const ry = Math.cos(dt * 0.5) * 4;
        inner.style.setProperty("--rx", `${rx}deg`);
        inner.style.setProperty("--ry", `${ry}deg`);
        inner.style.setProperty("--mx", `${50 + ry * 4}%`);
        inner.style.setProperty("--my", `${30 + rx * 4}%`);
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
      return () => {
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
      };
    }

    let pendingX = 0;
    let pendingY = 0;
    let scheduled = false;

    const apply = () => {
      scheduled = false;
      const rx = -pendingY * 6;
      const ry = pendingX * 6;
      inner.style.setProperty("--rx", `${rx}deg`);
      inner.style.setProperty("--ry", `${ry}deg`);
      inner.style.setProperty("--mx", `${(pendingX + 0.5) * 100}%`);
      inner.style.setProperty("--my", `${(pendingY + 0.5) * 100}%`);
    };

    const onMove = (e: MouseEvent) => {
      const r = outer.getBoundingClientRect();
      pendingX = (e.clientX - r.left) / r.width - 0.5;
      pendingY = (e.clientY - r.top) / r.height - 0.5;
      if (!scheduled) {
        scheduled = true;
        rafRef.current = requestAnimationFrame(apply);
      }
    };

    const onLeave = () => {
      pendingX = 0;
      pendingY = 0;
      if (!scheduled) {
        scheduled = true;
        rafRef.current = requestAnimationFrame(apply);
      }
    };

    outer.addEventListener("mousemove", onMove);
    outer.addEventListener("mouseleave", onLeave);
    return () => {
      outer.removeEventListener("mousemove", onMove);
      outer.removeEventListener("mouseleave", onLeave);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <div
      ref={outerRef}
      className="relative rounded-2xl overflow-hidden border border-white/10"
      style={{
        perspective: "1200px",
        background:
          "radial-gradient(120% 80% at 50% 30%, oklch(0.22 0.02 240 / 0.7), oklch(0.08 0.01 240 / 0.95))",
        boxShadow:
          "inset 0 1px 0 0 rgba(255,255,255,0.08), 0 30px 60px -20px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04)",
      }}
    >
      <div
        ref={innerRef}
        className="relative will-change-transform"
        style={{
          transform:
            "rotateX(var(--rx,0deg)) rotateY(var(--ry,0deg))",
          transformStyle: "preserve-3d",
          transition: "transform 0.25s cubic-bezier(0.2,0.8,0.2,1)",
        }}
      >
        {children}
        {/* Cursor-tracking highlight (top layer, non-interactive) */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            transform: "translateZ(70px)",
            background:
              "radial-gradient(circle at var(--mx,50%) var(--my,30%), rgba(255,255,255,0.14), transparent 45%)",
            mixBlendMode: "screen",
          }}
        />
        {/* Vignette */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            transform: "translateZ(65px)",
            background:
              "radial-gradient(120% 90% at 50% 50%, transparent 55%, rgba(0,0,0,0.45) 100%)",
          }}
        />
      </div>
    </div>
  );
}
