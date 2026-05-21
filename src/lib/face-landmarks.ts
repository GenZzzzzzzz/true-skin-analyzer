// Lazy-loaded MediaPipe Face Landmarker (browser-only).
import type { FaceLandmarker as FL } from "@mediapipe/tasks-vision";

let landmarkerPromise: Promise<FL> | null = null;

export async function getFaceLandmarker(): Promise<FL> {
  if (landmarkerPromise) return landmarkerPromise;
  landmarkerPromise = (async () => {
    const { FilesetResolver, FaceLandmarker } = await import("@mediapipe/tasks-vision");
    const fileset = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm",
    );
    return FaceLandmarker.createFromOptions(fileset, {
      baseOptions: {
        modelAssetPath:
          "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
        delegate: "GPU",
      },
      runningMode: "IMAGE",
      numFaces: 1,
    });
  })();
  return landmarkerPromise;
}

export interface NormalizedPoint {
  x: number;
  y: number;
}

// Key MediaPipe FaceMesh landmark indices we use.
export const LMK = {
  leftEyeOuter: 33,
  rightEyeOuter: 263,
  noseTip: 1,
  chin: 152,
  forehead: 10,
  leftCheek: 234,
  rightCheek: 454,
  // cheek center approx
  leftCheekCenter: 50,
  rightCheekCenter: 280,
  noseBottom: 2,
  noseLeft: 64,
  noseRight: 294,
};
