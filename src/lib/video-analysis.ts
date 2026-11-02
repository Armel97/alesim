// Client-only helper that loads MediaPipe Tasks Vision (Pose + Face)
// and processes webcam frames locally. No video ever leaves the device
// from this module — only aggregated numeric metrics are exposed.

import {
  FilesetResolver,
  PoseLandmarker,
  FaceLandmarker,
  type NormalizedLandmark,
} from "@mediapipe/tasks-vision";

const WASM_BASE = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.0/wasm";
const POSE_MODEL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task";
const FACE_MODEL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task";

export type VideoSample = {
  t: number; // seconds from start
  gazeCentered: boolean;
  headTiltDeg: number;
  shoulderTiltDeg: number;
  posturePosScore: number; // 0-1, 1 = shoulders back & level
  handsVisible: boolean;
  smile: number; // 0-1
  faceCenterX: number; // 0-1 (normalized in frame)
  faceCenterY: number;
};

export type VideoMarker = {
  t: number;
  kind: "gaze_away" | "slouch" | "steady" | "filler" | "pause" | "repetition";
  note?: string;
};

export type VideoAnalysisSummary = {
  gazeCameraPct: number; // 0-100
  postureScore: number; // 0-100
  stabilityScore: number; // 0-100 (higher = calmer)
  expressivity: number; // 0-100 (smile + head movement variance)
  handsUsagePct: number; // 0-100
  headTiltAvgDeg: number;
  shoulderTiltAvgDeg: number;
  samples: number;
  markers: VideoMarker[];
};

let poseLm: PoseLandmarker | null = null;
let faceLm: FaceLandmarker | null = null;
let loading: Promise<void> | null = null;

export async function loadVideoModels(): Promise<void> {
  if (poseLm && faceLm) return;
  if (loading) return loading;
  loading = (async () => {
    const filesets = await FilesetResolver.forVisionTasks(WASM_BASE);
    poseLm = await PoseLandmarker.createFromOptions(filesets, {
      baseOptions: { modelAssetPath: POSE_MODEL, delegate: "GPU" },
      runningMode: "VIDEO",
      numPoses: 1,
    });
    faceLm = await FaceLandmarker.createFromOptions(filesets, {
      baseOptions: { modelAssetPath: FACE_MODEL, delegate: "GPU" },
      runningMode: "VIDEO",
      numFaces: 1,
      outputFaceBlendshapes: true,
    });
  })();
  return loading;
}

export function disposeVideoModels() {
  try {
    poseLm?.close();
    faceLm?.close();
  } catch {
    /* noop */
  }
  poseLm = null;
  faceLm = null;
  loading = null;
}

function angleBetween(a: NormalizedLandmark, b: NormalizedLandmark): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return (Math.atan2(dy, dx) * 180) / Math.PI;
}

export function analyzeFrame(
  video: HTMLVideoElement,
  tSec: number,
  timestampMs: number,
): VideoSample | null {
  if (!poseLm || !faceLm) return null;
  const face = faceLm.detectForVideo(video, timestampMs);
  const pose = poseLm.detectForVideo(video, timestampMs);

  let gazeCentered = false;
  let headTiltDeg = 0;
  let smile = 0;
  let faceCenterX = 0.5;
  let faceCenterY = 0.5;
  const faceLm0 = face.faceLandmarks?.[0];
  if (faceLm0 && faceLm0.length > 300) {
    // Left/right eye outer corners
    const leftEye = faceLm0[33];
    const rightEye = faceLm0[263];
    if (leftEye && rightEye) {
      headTiltDeg = angleBetween(leftEye, rightEye);
      faceCenterX = (leftEye.x + rightEye.x) / 2;
      faceCenterY = (leftEye.y + rightEye.y) / 2;
      // "Looks at camera" ≈ face centered horizontally in the frame.
      gazeCentered = Math.abs(faceCenterX - 0.5) < 0.14;
    }
    // Basic smile proxy: mouth corners distance vs vertical opening
    const mouthL = faceLm0[61];
    const mouthR = faceLm0[291];
    const lipTop = faceLm0[13];
    const lipBot = faceLm0[14];
    if (mouthL && mouthR && lipTop && lipBot) {
      const width = Math.hypot(mouthR.x - mouthL.x, mouthR.y - mouthL.y);
      const opening = Math.hypot(lipTop.x - lipBot.x, lipTop.y - lipBot.y);
      // Smiles: wide + slightly open lips
      smile = Math.max(0, Math.min(1, (width - 0.08) * 6 + opening * 4));
    }
    // Use blendshapes if available for better smile
    const bs = face.faceBlendshapes?.[0]?.categories ?? [];
    const smileL = bs.find((c) => c.categoryName === "mouthSmileLeft")?.score ?? 0;
    const smileR = bs.find((c) => c.categoryName === "mouthSmileRight")?.score ?? 0;
    if (smileL || smileR) smile = Math.min(1, (smileL + smileR) / 2 + 0.1);
  }

  let shoulderTiltDeg = 0;
  let posturePosScore = 0.5;
  let handsVisible = false;
  const poseLmk = pose.landmarks?.[0];
  if (poseLmk && poseLmk.length > 20) {
    const lSh = poseLmk[11];
    const rSh = poseLmk[12];
    const lHip = poseLmk[23];
    const rHip = poseLmk[24];
    const lWri = poseLmk[15];
    const rWri = poseLmk[16];
    const nose = poseLmk[0];
    if (lSh && rSh) shoulderTiltDeg = angleBetween(lSh, rSh);
    if (lSh && rSh && nose) {
      const shoulderCenterY = (lSh.y + rSh.y) / 2;
      const shoulderWidth = Math.hypot(rSh.x - lSh.x, rSh.y - lSh.y);
      // Slouching → head sinks toward shoulders (small vertical gap).
      const neckGap = shoulderCenterY - nose.y;
      const openness = Math.max(0, Math.min(1, neckGap / (shoulderWidth * 0.9)));
      const level = 1 - Math.min(1, Math.abs(shoulderTiltDeg) / 15);
      posturePosScore = openness * 0.7 + level * 0.3;
      // Torso alignment bonus: hips below shoulders in frame
      if (lHip && rHip) {
        const hipY = (lHip.y + rHip.y) / 2;
        if (hipY > shoulderCenterY + 0.05) posturePosScore = Math.min(1, posturePosScore + 0.05);
      }
    }
    const wristVisible = (w?: NormalizedLandmark) =>
      !!w && w.x > 0 && w.x < 1 && w.y > 0 && w.y < 1 && (w.visibility ?? 1) > 0.4;
    handsVisible = wristVisible(lWri) || wristVisible(rWri);
  }

  return {
    t: tSec,
    gazeCentered,
    headTiltDeg,
    shoulderTiltDeg,
    posturePosScore,
    handsVisible,
    smile,
    faceCenterX,
    faceCenterY,
  };
}

export function summarizeSamples(samples: VideoSample[]): VideoAnalysisSummary {
  if (samples.length === 0) {
    return {
      gazeCameraPct: 0,
      postureScore: 0,
      stabilityScore: 0,
      expressivity: 0,
      handsUsagePct: 0,
      headTiltAvgDeg: 0,
      shoulderTiltAvgDeg: 0,
      samples: 0,
      markers: [],
    };
  }
  const n = samples.length;
  const gazePct = Math.round((samples.filter((s) => s.gazeCentered).length / n) * 100);
  const handsPct = Math.round((samples.filter((s) => s.handsVisible).length / n) * 100);
  const avgPosture = samples.reduce((a, s) => a + s.posturePosScore, 0) / n;
  const avgSmile = samples.reduce((a, s) => a + s.smile, 0) / n;

  // Stability: inverse of face center variance
  const meanX = samples.reduce((a, s) => a + s.faceCenterX, 0) / n;
  const meanY = samples.reduce((a, s) => a + s.faceCenterY, 0) / n;
  const varSum =
    samples.reduce((a, s) => a + (s.faceCenterX - meanX) ** 2 + (s.faceCenterY - meanY) ** 2, 0) /
    n;
  const stability = Math.round(Math.max(0, Math.min(100, 100 - Math.sqrt(varSum) * 900)));

  const headTiltAvg = samples.reduce((a, s) => a + Math.abs(s.headTiltDeg), 0) / n;
  const shoulderTiltAvg = samples.reduce((a, s) => a + Math.abs(s.shoulderTiltDeg), 0) / n;

  // Expressivity: mix of smile presence + moderate head motion variance
  const movement = Math.min(100, Math.sqrt(varSum) * 600);
  const expressivity = Math.round(Math.min(100, avgSmile * 60 + Math.min(50, movement * 0.7)));

  // Markers: contiguous segments of gaze-away or slouch (limit ~8)
  const markers: VideoMarker[] = [];
  let awayStart: number | null = null;
  let slouchStart: number | null = null;
  for (const s of samples) {
    if (!s.gazeCentered && awayStart === null) awayStart = s.t;
    if (s.gazeCentered && awayStart !== null) {
      if (s.t - awayStart > 1.2) markers.push({ t: awayStart, kind: "gaze_away" });
      awayStart = null;
    }
    if (s.posturePosScore < 0.45 && slouchStart === null) slouchStart = s.t;
    if (s.posturePosScore >= 0.45 && slouchStart !== null) {
      if (s.t - slouchStart > 1.5) markers.push({ t: slouchStart, kind: "slouch" });
      slouchStart = null;
    }
  }
  if (awayStart !== null && samples[n - 1].t - awayStart > 1.2)
    markers.push({ t: awayStart, kind: "gaze_away" });
  if (slouchStart !== null && samples[n - 1].t - slouchStart > 1.5)
    markers.push({ t: slouchStart, kind: "slouch" });

  return {
    gazeCameraPct: gazePct,
    postureScore: Math.round(avgPosture * 100),
    stabilityScore: stability,
    expressivity,
    handsUsagePct: handsPct,
    headTiltAvgDeg: Math.round(headTiltAvg * 10) / 10,
    shoulderTiltAvgDeg: Math.round(shoulderTiltAvg * 10) / 10,
    samples: n,
    markers: markers.slice(0, 12),
  };
}
