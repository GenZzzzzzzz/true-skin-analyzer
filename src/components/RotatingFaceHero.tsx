import { useEffect, useState } from "react";
import faceMeshImg from "@/assets/face-mesh-left.png";
import c1 from "@/assets/cosmetic-1.png";
import c2 from "@/assets/cosmetic-2.png";
import c3 from "@/assets/cosmetic-3.png";
import c4 from "@/assets/cosmetic-4.png";
import c5 from "@/assets/cosmetic-5.png";

// Anatomical zone paths in a 0–100 viewBox matching face-mesh-left.png (632×848).
// Derived from the report's FACE_ZONES with x scaled ×2 (left half → full width)
// so the curves hug the same anatomical landmarks (forehead T-zone, nose,
// cheeks, chin, perioral). Avoids lips and eyes.
const Z = {
  forehead:
    "M22,16 C28,12 38,10 48,10 C60,10 70,11 76,15 C80,21 80,29 78,35 C76,38 72,40 66,40 C56,41 42,41 32,40 C26,40 22,38 20,34 C18,28 18,21 22,16 Z",
  nose:
    "M48,42 C46,47 44,53 44,58 C42,62 42,65 46,67 C50,68 54,68 58,67 C62,65 62,62 60,58 C60,53 58,47 56,42 C54,41 50,41 48,42 Z",
  leftCheek:
    "M22,50 C28,49 36,49 40,52 C42,57 44,63 40,68 C34,71 26,71 22,69 C18,65 16,58 18,53 C18,51 20,50 22,50 Z",
  rightCheek:
    "M78,50 C72,49 64,49 60,52 C58,57 56,63 60,68 C66,71 74,71 78,69 C82,65 84,58 82,53 C82,51 80,50 78,50 Z",
  chin:
    "M38,79 C44,77 56,77 62,79 C66,82 66,87 62,90 C56,92 44,92 38,90 C34,87 34,82 38,79 Z",
  perioralLeft:
    "M28,68 C32,66 38,66 41,69 C41,73 37,75 33,74 C28,73 26,71 28,68 Z",
  perioralRight:
    "M59,69 C62,66 68,66 72,68 C74,71 72,73 67,74 C63,75 59,73 59,69 Z",
  jaw:
    "M22,72 C28,70 36,71 40,74 C42,79 40,84 36,86 C30,87 24,84 21,80 C19,77 20,73 22,72 Z",
};

type Tone = "red" | "yellow";
type ZonePath = { d: string; tone: Tone };

type Product = {
  src: string;
  name: string;
  zones: ZonePath[];
};

const PRODUCTS: Product[] = [
  {
    src: c1,
    name: "Hyaluronic Serum",
    zones: [
      { d: Z.forehead, tone: "yellow" },
      { d: Z.nose, tone: "red" },
    ],
  },
  {
    src: c2,
    name: "Protective Day Cream",
    zones: [
      { d: Z.forehead, tone: "yellow" },
      { d: Z.leftCheek, tone: "yellow" },
    ],
  },
  {
    src: c3,
    name: "Radiant Fluid Foundation",
    zones: [
      { d: Z.leftCheek, tone: "red" },
      { d: Z.rightCheek, tone: "red" },
      { d: Z.chin, tone: "yellow" },
    ],
  },
  {
    src: c4,
    name: "Couture Lipstick",
    zones: [
      { d: Z.perioralLeft, tone: "red" },
      { d: Z.perioralRight, tone: "red" },
    ],
  },
  {
    src: c5,
    name: "Face Cream",
    zones: [
      { d: Z.forehead, tone: "yellow" },
      { d: Z.jaw, tone: "yellow" },
    ],
  },
];

/**
 * Hero: 3D face on the left, vertical film strip on the right.
 * Risk zones use the same SVG / multiply + soft-light layering as the
 * /report page so the homepage matches our reporting visual language.
 */
export function RotatingFaceHero() {
  // `tick` is a monotonically increasing counter so the film strip keeps
  // sliding downward continuously instead of snapping back to the top.
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const t = setInterval(() => {
      setTick((i) => i + 1);
    }, 3500);
    return () => clearInterval(t);
  }, []);


  const active = ((tick % PRODUCTS.length) + PRODUCTS.length) % PRODUCTS.length;
  const product = PRODUCTS[active];

  return (
    <div className="relative mx-auto flex items-center justify-center gap-6 sm:gap-10">
      <div
        className="relative"
        style={{
          width: "min(300px, 52vw)",
          aspectRatio: "632 / 848",
        }}
      >
        <img
          src={faceMeshImg}
          alt="3D face analysis"
          draggable={false}
          className="absolute inset-0 h-full w-full select-none"
          style={{
            filter:
              "drop-shadow(0 30px 60px rgba(0,0,0,0.55)) drop-shadow(0 0 40px oklch(0.78 0.15 195 / 0.25))",
          }}
        />

        {/* Subsurface bleed — multiply layer so color settles into skin */}
        <svg
          key={`bleed-${active}`}
          className="absolute inset-0 h-full w-full pointer-events-none zone-fade-in"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          style={{ mixBlendMode: "multiply", opacity: 0.95 }}
        >
          <defs>
            <filter id="hero-bleed" x="-40%" y="-40%" width="180%" height="180%">
              <feGaussianBlur stdDeviation="2.2" />
            </filter>
          </defs>
          <g filter="url(#hero-bleed)">
            {product.zones.map((z, i) => {
              const rgb = z.tone === "red" ? "240,40,40" : "250,165,30";
              return <path key={i} d={z.d} fill={`rgba(${rgb},0.7)`} />;
            })}
          </g>
        </svg>

        {/* Inflammation glow — soft-light layer for subdermal warmth */}
        <svg
          key={`glow-${active}`}
          className="absolute inset-0 h-full w-full pointer-events-none zone-fade-in"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          style={{ mixBlendMode: "soft-light", opacity: 0.9 }}
        >
          <defs>
            <filter id="hero-glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="3" />
            </filter>
          </defs>
          <g filter="url(#hero-glow)">
            {product.zones.map((z, i) => {
              const rgb = z.tone === "red" ? "255,90,70" : "255,180,60";
              return (
                <path
                  key={i}
                  d={z.d}
                  fill={`rgba(${rgb},0.7)`}
                  className={z.tone === "red" ? "animate-pulse" : ""}
                />
              );
            })}
          </g>
        </svg>
      </div>

      <FilmStrip products={PRODUCTS} tick={tick} onSelect={(i) => setTick(i)} />
    </div>
  );
}

function FilmStrip({
  products,
  tick,
  onSelect,
}: {
  products: Product[];
  tick: number;
  onSelect: (i: number) => void;
}) {
  const FRAME_H = 90;
  const GAP = 8;
  const STEP = FRAME_H + GAP;
  const VISIBLE = 3;
  const N = products.length;
  // Per-frame duration must match the parent tick interval so the highlighted
  // product visually aligns with the centered frame during the hold phase.
  const PER_FRAME_MS = 3500;
  const totalMs = N * PER_FRAME_MS;

  const active = ((tick % N) + N) % N;
  // Triple the strip so the CSS loop never reveals a gap.
  const rendered = [...products, ...products, ...products];

  // Build "hold then slide" keyframes: each frame holds for HOLD_RATIO of
  // its cell, then slides one STEP to the next over the remaining time.
  const HOLD_RATIO = 0.78;
  const keyframes = (() => {
    const stops: string[] = [];
    for (let k = 0; k <= N; k++) {
      const cellStartPct = (k * 100) / N;
      stops.push(`${cellStartPct.toFixed(4)}% { transform: translateY(${-k * STEP}px); }`);
      if (k < N) {
        const holdEndPct = cellStartPct + (HOLD_RATIO * 100) / N;
        stops.push(`${holdEndPct.toFixed(4)}% { transform: translateY(${-k * STEP}px); }`);
      }
    }
    return stops.join("\n");
  })();

  return (
    <div
      className="relative hidden sm:block"
      style={{
        width: 110,
        height: VISIBLE * FRAME_H + (VISIBLE - 1) * GAP,
      }}
    >
      <style>{`
        @keyframes filmstrip-scroll {
          ${keyframes}
        }
      `}</style>


      <div
        aria-hidden
        className="absolute inset-0 rounded-[6px]"
        style={{
          background: "#0a0a0a",
          boxShadow:
            "0 30px 60px rgba(0,0,0,0.55), inset 0 0 0 1px rgba(255,255,255,0.04)",
        }}
      />
      <Perforations side="left" />
      <Perforations side="right" />

      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-10 z-20"
        style={{
          background:
            "linear-gradient(to bottom, var(--background), transparent)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-10 z-20"
        style={{
          background:
            "linear-gradient(to top, var(--background), transparent)",
        }}
      />

      <div
        className="absolute inset-y-0 left-1/2 -translate-x-1/2 overflow-hidden"
        style={{ width: 80 }}
      >
        <div
          className="absolute left-0 right-0"
          style={{
            top: ((VISIBLE - 1) / 2) * STEP - STEP * N,
            animation: `filmstrip-scroll ${totalMs}ms linear infinite`,
            willChange: "transform",
          }}
        >
          {rendered.map((p, i) => {
            const productIndex = i % N;
            const isActive = productIndex === active;
            return (
              <button
                key={i}
                onClick={() => onSelect(productIndex)}
                className="block w-full"
                style={{
                  height: FRAME_H,
                  marginBottom: GAP,
                }}
              >
                <div
                  className="relative h-full w-full overflow-hidden rounded-[2px] transition-opacity duration-500"
                  style={{
                    background: "#f6f4ef",
                    outline: isActive
                      ? "1px solid oklch(0.85 0.05 220 / 0.6)"
                      : "1px solid rgba(255,255,255,0.04)",
                    opacity: isActive ? 1 : 0.38,
                    filter: isActive ? "none" : "grayscale(0.4)",
                  }}
                >
                  <img
                    src={p.src}
                    alt={p.name}
                    draggable={false}
                    className="absolute inset-0 m-auto h-full w-full object-contain p-2 select-none"
                  />
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Perforations({ side }: { side: "left" | "right" }) {
  return (
    <div
      aria-hidden
      className="absolute top-0 bottom-0 z-10"
      style={{
        [side]: 0,
        width: 14,
        background:
          "repeating-linear-gradient(to bottom, transparent 0 6px, #f6f4ef 6px 16px, transparent 16px 22px)",
        WebkitMaskImage:
          "linear-gradient(to right, black, black)",
      }}
    />
  );
}
