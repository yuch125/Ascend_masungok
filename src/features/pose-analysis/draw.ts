import type { Exercise, Frame, Landmark, Side } from '../../types';
import { FIRST_BODY_LANDMARK } from './bodyLandmarks';
export const POSE_CONNECTIONS = [
  [11, 12],
  [11, 13],
  [13, 15],
  [12, 14],
  [14, 16],
  [11, 23],
  [12, 24],
  [23, 24],
  [23, 25],
  [25, 27],
  [24, 26],
  [26, 28],
  [27, 29],
  [29, 31],
  [28, 30],
  [30, 32],
];
export function projectPoint(
  point: Pick<Landmark, 'x' | 'y'>,
  sourceWidth: number,
  sourceHeight: number,
  width: number,
  height: number,
  mirrored = false,
  fit: 'cover' | 'contain' = 'cover',
) {
  const scale =
    fit === 'cover'
      ? Math.max(width / sourceWidth, height / sourceHeight)
      : Math.min(width / sourceWidth, height / sourceHeight);
  const x = point.x * sourceWidth * scale + (width - sourceWidth * scale) / 2;
  return {
    x: mirrored ? width - x : x,
    y: point.y * sourceHeight * scale + (height - sourceHeight * scale) / 2,
  };
}
export function drawPose(
  ctx: CanvasRenderingContext2D,
  frame: Frame | undefined,
  exercise: Exercise,
  side: Side,
  geometry: {
    sourceWidth: number;
    sourceHeight: number;
    width: number;
    height: number;
    mirrored?: boolean;
    fit?: 'cover' | 'contain';
  },
) {
  const { width, height, sourceWidth, sourceHeight, mirrored = false, fit = 'cover' } = geometry;
  ctx.clearRect(0, 0, width, height);
  if (!frame || !sourceWidth || !sourceHeight) return;
  const visible = (p: Landmark | null | undefined): p is Landmark =>
    !!p &&
    Number.isFinite(p.x) &&
    Number.isFinite(p.y) &&
    p.visibility >= 0.65 &&
    (p.presence ?? 1) >= 0.65 &&
    p.x >= 0 &&
    p.x <= 1 &&
    p.y >= 0 &&
    p.y <= 1;
  const position = (p: Landmark) =>
    projectPoint(p, sourceWidth, sourceHeight, width, height, mirrored, fit);
  const targets = exercise.joints[side],
    lineWidth = Math.max(2, width / 240);
  ctx.lineWidth = lineWidth;
  for (const [a, b] of POSE_CONNECTIONS) {
    const first = frame.landmarks[a],
      second = frame.landmarks[b];
    if (!visible(first) || !visible(second)) continue;
    const p = position(first),
      q = position(second);
    ctx.strokeStyle =
      targets.includes(a) && targets.includes(b) && frame.angle !== null ? '#bdff80' : '#57e5cc';
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(q.x, q.y);
    ctx.stroke();
  }
  frame.landmarks.forEach((point, index) => {
    if (index < FIRST_BODY_LANDMARK || !visible(point)) return;
    const p = position(point);
    ctx.fillStyle = targets.includes(index) ? '#d3ff92' : '#fff';
    ctx.beginPath();
    ctx.arc(p.x, p.y, lineWidth * 1.4, 0, Math.PI * 2);
    ctx.fill();
  });
  const joint = frame.landmarks[targets[1]];
  if (frame.angle !== null && visible(joint)) {
    const p = position(joint);
    ctx.font = `bold ${Math.max(18, width / 27)}px sans-serif`;
    ctx.fillStyle = '#d3ff92';
    ctx.fillText(
      `${frame.angle.toFixed(1)}°`,
      Math.min(width - 82, Math.max(8, p.x + 13)),
      Math.max(24, p.y - 14),
    );
  }
}
