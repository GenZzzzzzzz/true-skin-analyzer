import { useEffect, useState } from "react";
import faceMeshImg from "@/assets/face-mesh-left.png";
import c1 from "@/assets/cosmetic-1.png";
import c2 from "@/assets/cosmetic-2.png";
import c3 from "@/assets/cosmetic-3.png";
import c4 from "@/assets/cosmetic-4.png";
import c5 from "@/assets/cosmetic-5.png";

type Zone = {
  // percent coordinates on the face image box
  top: string;
  left: string;
  width: string;
  height: string;
  tone: "red" | "yellow";
};

type Product = {
  src: string;
  name: string;
  zones: Zone[];
};

const PRODUCTS: Product[] = [
  {
    src: c1,
    name: "Hyaluronic Serum",
    // Forehead T-zone (yellow) + nose bridge (red)
    zones: [
      { top: "12%", left: "22%", width: "55%", height: "16%", tone: "yellow" },
      { top: "52%", left: "42%", width: "16%", height: "12%", tone: "red" },
    ],
  },
  {
    src: c2,
    name: "Protective Day Cream",
    // Upper forehead (yellow) + left cheek (yellow)
    zones: [
      { top: "10%", left: "24%", width: "52%", height: "14%", tone: "yellow" },
      { top: "54%", left: "12%", width: "20%", height: "14%", tone: "yellow" },
    ],
  },
  {
    src: c3,
    name: "Radiant Fluid Foundation",
    // Both cheeks (red) + chin (yellow)
    zones: [
      { top: "52%", left: "10%", width: "22%", height: "16%", tone: "red" },
      { top: "52%", left: "62%", width: "24%", height: "16%", tone: "red" },
      { top: "80%", left: "32%", width: "32%", height: "10%", tone: "yellow" },
    ],
  },
  {
    src: c4,
    name: "Couture Lipstick",
    // Lips only (red)
    zones: [
      { top: "72%", left: "32%", width: "32%", height: "10%", tone: "red" },
    ],
  },
  {
    src: c5,
    name: "Face Cream",
    // Forehead (yellow) + jawline (yellow)
    zones: [
      { top: "12%", left: "22%", width: "55%", height: "14%", tone: "yellow" },
      { top: "80%", left: "28%", width: "40%", height: "10%", tone: "yellow" },
    ],
  },
];

/**
 * High-end hero:
 *  - 3D face (background-less, larger, no rotation) on the left
 *  - Vertical film strip on the right that slides cosmetic photos one-by-one
 *  - Selected cosmetic illuminates corresponding red/yellow risk zones on the face
 */
export function RotatingFaceHero() {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const t = setInterval(() => {
      setActive((i) => (i + 1) % PRODUCTS.length);
    }, 2600);
    return () => clearInterval(t);
  }, []);

  const product = PRODUCTS[active];

  return (
    <div className="relative mx-auto flex items-center justify-center gap-6 sm:gap-10">
      {/* Face stage — larger, no background, blends into page */}
      <div
        className="relative"
        style={{
          width: "min(320px, 60vw)",
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

        {/* Risk zones overlay — fades when product changes */}
        <div key={active} className="absolute inset-0 zone-fade-in">
          {product.zones.map((z, i) => (
            <div
              key={i}
              className="absolute rounded-full"
              style={{
                top: z.top,
                left: z.left,
                width: z.width,
                height: z.height,
                background:
                  z.tone === "red"
                    ? "radial-gradient(ellipse, oklch(0.7 0.25 25 / 0.78), oklch(0.7 0.25 25 / 0) 70%)"
                    : "radial-gradient(ellipse, oklch(0.85 0.18 85 / 0.78), oklch(0.85 0.18 85 / 0) 70%)",
                filter: "blur(6px)",
                mixBlendMode: "screen",
              }}
            />
          ))}
        </div>
      </div>

      {/* Vertical film strip */}
      <FilmStrip products={PRODUCTS} active={active} onSelect={setActive} />
    </div>
  );
}

function FilmStrip({
  products,
  active,
  onSelect,
}: {
  products: Product[];
  active: number;
  onSelect: (i: number) => void;
}) {
  // Frame height + gap (matches CSS below)
  const FRAME_H = 90;
  const GAP = 8;
  const STEP = FRAME_H + GAP;
  const VISIBLE = 3;
  // Center the active frame
  const offset = -(active * STEP) + ((VISIBLE - 1) / 2) * STEP;

  return (
    <div
      className="relative hidden sm:block"
      style={{
        width: 110,
        height: VISIBLE * FRAME_H + (VISIBLE - 1) * GAP,
      }}
    >
      {/* Film body — black strip with perforations on both sides */}
      <div
        aria-hidden
        className="absolute inset-0 rounded-[6px]"
        style={{
          background: "#0a0a0a",
          boxShadow:
            "0 30px 60px rgba(0,0,0,0.55), inset 0 0 0 1px rgba(255,255,255,0.04)",
        }}
      />
      {/* Perforations */}
      <Perforations side="left" />
      <Perforations side="right" />

      {/* Top & bottom fade for cinematic feel */}
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

      {/* Frames track */}
      <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 overflow-hidden" style={{ width: 80 }}>
        <div
          className="absolute left-0 right-0 transition-transform duration-700"
          style={{
            transform: `translateY(${offset}px)`,
            top: 0,
          }}
        >
          {products.map((p, i) => (
            <button
              key={i}
              onClick={() => onSelect(i)}
              className="block w-full"
              style={{
                height: FRAME_H,
                marginBottom: GAP,
              }}
            >
              <div
                className="relative h-full w-full overflow-hidden rounded-[2px] transition-all duration-500"
                style={{
                  background: "#f6f4ef",
                  outline:
                    i === active
                      ? "1px solid oklch(0.85 0.05 220 / 0.6)"
                      : "1px solid rgba(255,255,255,0.04)",
                  opacity: i === active ? 1 : 0.38,
                  filter: i === active ? "none" : "grayscale(0.4)",
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
          ))}
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
