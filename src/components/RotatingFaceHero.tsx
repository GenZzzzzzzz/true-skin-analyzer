import faceMeshImg from "@/assets/face-mesh-v2.png";

/**
 * Premium rotating 3D face hero.
 * - Continuous Y-axis rotation conveys "scanning / analyzing"
 * - Layered glow rings, orbital ticks, and ambient lighting for high-end feel
 * - Pure CSS animation, GPU-accelerated, respects prefers-reduced-motion
 */
export function RotatingFaceHero() {
  return (
    <div
      className="relative mx-auto"
      style={{
        width: "min(420px, 80vw)",
        aspectRatio: "1 / 1",
        perspective: "1600px",
      }}
    >
      {/* Ambient backdrop glow */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10 rounded-full blur-3xl opacity-70"
        style={{
          background:
            "radial-gradient(circle at 50% 45%, oklch(0.78 0.15 195 / 0.45), oklch(0.7 0.22 320 / 0.25) 45%, transparent 70%)",
        }}
      />

      {/* Outer orbital ring — counter-rotates */}
      <div
        aria-hidden
        className="absolute inset-0 rounded-full border border-white/10 face-orbit-rev"
        style={{
          background:
            "conic-gradient(from 0deg, transparent 0deg, oklch(0.78 0.15 195 / 0.35) 30deg, transparent 60deg, transparent 180deg, oklch(0.7 0.22 320 / 0.3) 210deg, transparent 240deg)",
          mask: "radial-gradient(circle, transparent 47%, black 48%, black 50%, transparent 51%)",
          WebkitMask:
            "radial-gradient(circle, transparent 47%, black 48%, black 50%, transparent 51%)",
        }}
      />

      {/* Inner tick ring */}
      <div
        aria-hidden
        className="absolute inset-[6%] rounded-full border border-white/5 face-orbit"
        style={{
          background:
            "repeating-conic-gradient(from 0deg, oklch(0.85 0.05 220 / 0.25) 0deg 0.6deg, transparent 0.6deg 6deg)",
          mask: "radial-gradient(circle, transparent 46%, black 47%, black 49%, transparent 50%)",
          WebkitMask:
            "radial-gradient(circle, transparent 46%, black 47%, black 49%, transparent 50%)",
        }}
      />

      {/* Rotating 3D face stage */}
      <div className="absolute inset-[10%] face-spin-stage">
        {/* Bottom shadow disc — sits on the "floor" */}
        <div
          aria-hidden
          className="absolute left-1/2 bottom-[-6%] -translate-x-1/2 rounded-[50%] blur-2xl opacity-60"
          style={{
            width: "80%",
            height: "14%",
            background: "radial-gradient(ellipse, rgba(0,0,0,0.6), transparent 70%)",
          }}
        />

        {/* Left-half face with overlays */}
        <div className="absolute inset-0" style={{ clipPath: "inset(0 50% 0 0)" }}>
          <img
            src={faceMeshImg}
            alt=""
            draggable={false}
            className="absolute inset-0 m-auto h-full w-full object-contain select-none"
            style={{
              filter:
                "drop-shadow(0 20px 40px rgba(0,0,0,0.55)) drop-shadow(0 0 30px oklch(0.78 0.15 195 / 0.35))",
            }}
          />

          {/* Front rim light */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(60% 80% at 30% 30%, rgba(255,255,255,0.18), transparent 55%)",
              mixBlendMode: "screen",
            }}
          />

          {/* Scan line sweep */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 overflow-hidden rounded-full"
          >
            <div
              className="absolute inset-x-0 h-[14%] face-scan"
              style={{
                background:
                  "linear-gradient(180deg, transparent, oklch(0.85 0.18 195 / 0.45), transparent)",
                filter: "blur(2px)",
              }}
            />
          </div>
        </div>
      </div>

      {/* Floating data chips */}
      <FloatChip className="left-[-2%] top-[18%]" label="刺激" value="低" tone="ok" delay="0s" />
      <FloatChip className="right-[-4%] top-[34%]" label="闷痘" value="留意" tone="warn" delay="1.2s" />
      <FloatChip className="left-[2%] bottom-[18%]" label="过敏" value="低" tone="ok" delay="2.1s" />
      <FloatChip className="right-[-2%] bottom-[8%]" label="光敏" value="中" tone="warn" delay="0.6s" />
    </div>
  );
}

function FloatChip({
  className,
  label,
  value,
  tone,
  delay,
}: {
  className?: string;
  label: string;
  value: string;
  tone: "ok" | "warn";
  delay: string;
}) {
  const color =
    tone === "ok"
      ? "border-emerald-300/30 bg-emerald-400/10 text-emerald-200"
      : "border-amber-300/30 bg-amber-400/10 text-amber-200";
  return (
    <div
      className={`absolute hidden sm:flex items-center gap-2 rounded-full border ${color} backdrop-blur-md px-3 py-1.5 text-[11px] font-medium shadow-lg face-float ${className ?? ""}`}
      style={{ animationDelay: delay }}
    >
      <span className="opacity-70">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}
