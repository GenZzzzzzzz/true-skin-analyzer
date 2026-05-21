import { type ReactNode } from "react";

/**
 * Static 3D stage for the report face block.
 * - Perspective container with fixed subtle 3D tilt
 * - Static lighting layers (no mouse tracking, no animation)
 * - Inner layers can use translateZ via inline style
 */
export function Stereo3DFace({ children }: { children: ReactNode }) {
  return (
    <div
      className="relative rounded-2xl overflow-hidden border border-white/10"
      style={{
        perspective: "1400px",
        background:
          "radial-gradient(120% 80% at 50% 30%, oklch(0.22 0.04 240 / 0.85), oklch(0.06 0.02 250 / 0.98))",
        boxShadow:
          "inset 0 1px 0 0 rgba(255,255,255,0.1), inset 0 -40px 80px -20px rgba(0,0,0,0.6), 0 40px 80px -20px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.05)",
      }}
    >
      <div
        className="relative"
        style={{
          transform: "rotateX(2deg) rotateY(-3deg)",
          transformStyle: "preserve-3d",
        }}
      >
        {children}
        {/* 1. Subsurface scatter — wide warm glow */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-5"
          style={{
            transform: "translateZ(55px)",
            background:
              "radial-gradient(circle at 45% 35%, oklch(0.78 0.1 30 / 0.14), transparent 55%)",
            mixBlendMode: "screen",
          }}
        />
        {/* 2. Specular highlight */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            transform: "translateZ(72px)",
            background:
              "radial-gradient(circle at 45% 35%, rgba(255,255,255,0.18), transparent 18%)",
            mixBlendMode: "screen",
          }}
        />
        {/* 3. Side-light gradient */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            transform: "translateZ(50px)",
            background:
              "linear-gradient(105deg, rgba(255,255,255,0.05) 0%, transparent 40%, transparent 60%, rgba(0,0,0,0.18) 100%)",
            mixBlendMode: "overlay",
            opacity: 0.7,
          }}
        />
        {/* 4. AO vignette */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            transform: "translateZ(65px)",
            background:
              "radial-gradient(130% 95% at 50% 50%, transparent 45%, rgba(0,0,0,0.55) 100%)",
          }}
        />
        {/* 5. Top-edge soft sheen */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-1/3"
          style={{
            transform: "translateZ(68px)",
            background:
              "linear-gradient(180deg, rgba(255,255,255,0.07), transparent)",
          }}
        />
      </div>
    </div>
  );
}
