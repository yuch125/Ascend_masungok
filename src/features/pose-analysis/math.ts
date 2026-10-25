import type { Analysis, Exercise, Frame, PoseLandmarks, Side } from '../../types';
import { bodyOnlyFrames } from './bodyLandmarks';
export const ANALYSIS_VERSION = '2d-projected-v1';
export function jointAngle(
  a: { x: number; y: number },
  b: { x: number; y: number },
  c: { x: number; y: number },
): number | null {
  const u = [a.x - b.x, a.y - b.y],
    v = [c.x - b.x, c.y - b.y];
  const denominator = Math.hypot(...u) * Math.hypot(...v);
  if (!Number.isFinite(denominator) || denominator < 1e-8) return null;
  const cosine = (u[0] * v[0] + u[1] * v[1]) / denominator;
  return (Math.acos(Math.min(1, Math.max(-1, cosine))) * 180) / Math.PI;
}
export function measureFrame(
  points: PoseLandmarks,
  exercise: Exercise,
  side: Side,
  width: number,
  height: number,
): number | null {
  const targets = exercise.joints[side].map((i) => points[i]);
  if (
    targets.some(
      (p) =>
        !p ||
        !Number.isFinite(p.x) ||
        !Number.isFinite(p.y) ||
        !Number.isFinite(p.visibility) ||
        p.visibility < 0.65 ||
        !Number.isFinite(p.presence ?? 1) ||
        (p.presence ?? 1) < 0.65 ||
        p.x < 0 ||
        p.x > 1 ||
        p.y < 0 ||
        p.y > 1,
    )
  )
    return null;
  const [a, b, c] = targets.map((p) => ({ x: p!.x * width, y: p!.y * height }));
  return jointAngle(a, b, c);
}
export function countRepetitions(frames: Frame[], thresholds?: [number, number]): number | null {
  if (!thresholds) return null;
  let phase: 'unknown' | 'extended' | 'flexed' = 'unknown',
    count = 0,
    previousTime = -1;
  for (const frame of frames) {
    if (previousTime >= 0 && frame.time - previousTime > 0.5) phase = 'unknown';
    if (frame.angle === null) continue;
    if (frame.angle >= thresholds[1]) {
      if (phase === 'flexed') count++;
      phase = 'extended';
    } else if (frame.angle <= thresholds[0] && phase === 'extended') phase = 'flexed';
    previousTime = frame.time;
  }
  return count;
}
export function summarize(frames: Frame[], exercise: Exercise): Analysis {
  const angles = frames.flatMap((f) => (f.angle === null ? [] : [f.angle]));
  if (angles.length < 5 || angles.length / frames.length < 0.25)
    throw new Error(
      '관절을 충분히 측정하지 못했어요. 대상 관절이 보이는 밝은 장소에서 다시 촬영해 주세요.',
    );
  const min = Math.min(...angles),
    max = Math.max(...angles);
  return {
    min,
    max,
    range: max - min,
    validRatio: angles.length / frames.length,
    validFrames: angles.length,
    totalFrames: frames.length,
    repetitions: countRepetitions(frames, exercise.repThresholds),
    frames: bodyOnlyFrames(frames),
  };
}
