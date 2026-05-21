import { useEffect, useId, useRef, useState } from "react";
import { Camera, Upload, RotateCcw, X, Check } from "lucide-react";

interface Props {
  kind: "face" | "product";
  title: string;
  subtitle: string;
  previewUrl: string | null;
  onCapture: (blob: Blob) => void;
  onClear: () => void;
  accentLabel: string; // "你" / "产品"
}

export function CaptureCard({
  kind,
  title,
  subtitle,
  previewUrl,
  onCapture,
  onClear,
  accentLabel,
}: Props) {
  const [camOpen, setCamOpen] = useState(false);
  const [camError, setCamError] = useState<string | null>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraStarting, setCameraStarting] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const fileInputId = useId();

  useEffect(() => () => stopCamera(), []);

  useEffect(() => {
    const video = videoRef.current;
    if (!camOpen || !video || !cameraStream) return;

    video.srcObject = cameraStream;
    void video.play().catch(() => {
      setCamError("摄像头启动失败，请改用上传");
      setCameraStarting(false);
    });
  }, [camOpen, cameraStream]);

  function stopCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraStream(null);
    setCameraStarting(false);
    setCameraReady(false);
  }

  async function openCamera() {
    if (cameraStarting) return;
    setCamError(null);
    setCameraReady(false);
    setCameraStarting(true);
    setCamOpen(true);
    try {
      const facingMode = kind === "face" ? "user" : "environment";
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode, width: { ideal: 1280 }, height: { ideal: 1280 } },
        audio: false,
      });
      streamRef.current = stream;
      setCameraStream(stream);
    } catch {
      setCamError("无法访问摄像头，请改用上传");
      setCameraStarting(false);
    }
  }

  function closeCamera() {
    stopCamera();
    setCamOpen(false);
  }

  function snap() {
    const v = videoRef.current;
    if (!v || !cameraReady || !v.videoWidth || !v.videoHeight) return;
    const c = document.createElement("canvas");
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    c.getContext("2d")!.drawImage(v, 0, 0);
    c.toBlob(
      (blob) => {
        if (blob) {
          onCapture(blob);
          closeCamera();
        }
      },
      "image/jpeg",
      0.95,
    );
  }

  function onFile(file: File) {
    onCapture(file);
  }

  return (
    <>
      <div className="stereo-card no-lift group relative overflow-hidden rounded-[2rem] aspect-square">
        {/* Top accent label */}
        <div className="absolute top-4 left-4 z-10 flex items-center gap-1.5 rounded-full border border-white/15 bg-black/40 backdrop-blur px-3 py-1 text-[10px] uppercase tracking-widest text-white/80">
          <span
            className={
              "h-1.5 w-1.5 rounded-full " +
              (kind === "face" ? "bg-accent" : "bg-fuchsia-400")
            }
          />
          {accentLabel}
        </div>

        {previewUrl ? (
          <>
            <img
              src={previewUrl}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20" />
            <div className="absolute bottom-0 left-0 right-0 p-5 flex items-center justify-between">
              <div className="flex items-center gap-2 rounded-full bg-emerald-500/20 border border-emerald-400/40 px-3 py-1 text-xs text-emerald-200">
                <Check className="h-3.5 w-3.5" /> 已就绪
              </div>
              <button
                type="button"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  onClear();
                }}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-black/50 backdrop-blur px-3 py-1.5 text-xs text-white hover:bg-black/70 transition-colors cursor-pointer"
              >
                <RotateCcw className="h-3.5 w-3.5" /> 重选
              </button>
            </div>
          </>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
            <div className="mb-5 grid place-items-center">
              <div
                className={
                  "h-20 w-20 rounded-2xl grid place-items-center " +
                  (kind === "face"
                    ? "bg-accent/15 text-accent"
                    : "bg-fuchsia-400/15 text-fuchsia-300")
                }
                style={{
                  boxShadow:
                    "inset 0 1px 0 rgba(255,255,255,0.15), 0 8px 30px -10px rgba(0,0,0,0.5)",
                }}
              >
                <Camera className="h-9 w-9" strokeWidth={1.5} />
              </div>
            </div>
            <div className="font-display text-2xl font-semibold">{title}</div>
            <div className="mt-1.5 text-sm text-muted-foreground max-w-[14rem]">
              {subtitle}
            </div>
            <div className="mt-6 flex gap-2">
              <button
                type="button"
                disabled={cameraStarting}
                onClick={openCamera}
                className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-white/10 border border-white/15 px-4 py-2 text-sm hover:bg-white/15 transition-colors cursor-pointer active:scale-95 disabled:cursor-wait disabled:opacity-60"
              >
                <Camera className="h-4 w-4" /> {cameraStarting ? "启动中" : "拍摄"}
              </button>
              <label
                htmlFor={fileInputId}
                onClick={() => {
                  if (fileRef.current) fileRef.current.value = "";
                }}
                className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-white/5 border border-white/10 px-4 py-2 text-sm hover:bg-white/10 transition-colors cursor-pointer active:scale-95"
              >
                <Upload className="h-4 w-4" /> 上传
              </label>
            </div>
          </div>
        )}

        <input
          id={fileInputId}
          ref={fileRef}
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onFile(f);
            e.target.value = "";
          }}
        />
      </div>


      {/* Camera modal */}
      {camOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-xl p-4"
          onClick={closeCamera}
        >
          <div
            className="relative w-full max-w-xl rounded-3xl bg-surface border border-white/10 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
            style={{
              boxShadow:
                "0 40px 100px -20px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.1)",
            }}
          >
            <button
              onClick={closeCamera}
              className="absolute top-3 right-3 z-10 p-2 rounded-full bg-black/40 backdrop-blur hover:bg-black/60"
            >
              <X className="h-4 w-4" />
            </button>
            {camError ? (
              <div className="p-10 text-center">
                <div className="text-sm text-destructive">{camError}</div>
                <button
                  onClick={() => {
                    closeCamera();
                    fileRef.current?.click();
                  }}
                  className="mt-4 rounded-full bg-accent px-5 py-2 text-sm text-accent-foreground"
                >
                  改用上传
                </button>
              </div>
            ) : (
              <>
                <div className="relative aspect-square bg-black">
                  <video
                    ref={videoRef}
                    className="h-full w-full object-cover"
                    playsInline
                    muted
                    onLoadedMetadata={() => {
                      setCameraReady(true);
                      setCameraStarting(false);
                    }}
                  />
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                    {kind === "face" ? (
                      <div
                        className="h-3/4 w-3/5 rounded-[50%] border-2 border-accent/60"
                        style={{ boxShadow: "0 0 60px -10px var(--accent)" }}
                      />
                    ) : (
                      <div
                        className="h-3/4 w-3/4 rounded-2xl border-2 border-fuchsia-300/60"
                        style={{ boxShadow: "0 0 60px -10px #e879f9" }}
                      />
                    )}
                  </div>
                  <div className="absolute top-4 left-1/2 -translate-x-1/2 rounded-full bg-black/60 backdrop-blur px-3 py-1 text-xs">
                    {kind === "face"
                      ? "正面对准，把脸放入框内"
                      : "对准瓶身正面，让成分表清晰"}
                  </div>
                </div>
                <div className="flex justify-center gap-3 p-5">
                  <button
                    onClick={closeCamera}
                    className="rounded-full border border-border px-5 py-2.5 text-sm"
                  >
                    取消
                  </button>
                  <button
                    onClick={snap}
                    disabled={!cameraReady}
                    className="rounded-full bg-accent px-6 py-2.5 font-medium text-accent-foreground disabled:cursor-wait disabled:opacity-60"
                  >
                    {cameraReady ? "拍摄" : "准备中"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
