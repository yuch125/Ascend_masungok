import { describe, expect, it, vi } from 'vitest';
import { bodyOnlyLandmarks } from './bodyLandmarks';
import { drawPose, HAND_CONNECTIONS, POSE_CONNECTIONS } from './draw';
import { measureFrame, summarize } from './math';
import { exercises } from '../exercise-tracking/exercises';
import { resampleCaptureFrames } from '../camera/recording';
import type { Landmark } from '../../types';

const pose = (): Landmark[] =>
  Array.from({ length: 33 }, (_, index) => ({
    x: 0.1 + (index % 5) * 0.15,
    y: 0.1 + Math.floor(index / 5) * 0.1,
    z: index * 0.01,
    visibility: 1,
    presence: 1,
  }));

describe('body landmarks with a nose-only head target', () => {
  it('keeps the nose but discards eyes, ears and mouth without renumbering body joints', () => {
    const original = pose(),
      points = bodyOnlyLandmarks(original);
    expect(points).toHaveLength(33);
    expect(points[0]).toBe(original[0]);
    expect(points.slice(1, 11)).toEqual(Array(10).fill(null));
    expect(points.slice(11)).toEqual(original.slice(11));
    expect(points[25]).toBe(original[25]);
    expect(bodyOnlyLandmarks(points)).toBe(points);
  });
  it('does not fabricate a person when no body points were detected', () => {
    expect(bodyOnlyLandmarks([])).toEqual([]);
    expect(bodyOnlyLandmarks(pose().slice(0, 11))).toEqual([]);
  });
  it('preserves left and right angles for every supported exercise', () => {
    const original = pose(),
      body = bodyOnlyLandmarks(original);
    for (const exercise of exercises)
      for (const side of ['left', 'right'] as const) {
        const angle = measureFrame(original, exercise, side, 1280, 720);
        expect(angle).not.toBeNull();
        expect(measureFrame(body, exercise, side, 1280, 720)).toBe(angle);
      }
  });
  it('excludes face coordinates from summaries and captured frame samples', () => {
    const frames = Array.from({ length: 10 }, (_, index) => ({
      time: index / 10,
      angle: 90,
      landmarks: pose(),
    }));
    const summary = summarize(frames, exercises[0]);
    const capture = resampleCaptureFrames(frames, 1);
    for (const frame of [...summary.frames, ...capture]) {
      expect(frame.landmarks[0]).toEqual(frames[0].landmarks[0]);
      expect(frame.landmarks.slice(1, 11)).toEqual(Array(10).fill(null));
      expect(frame.landmarks[25]).toEqual(frames[0].landmarks[25]);
    }
    expect(summary.min).toBe(90);
  });
  it('draws only the nose from the face when replaying an unsanitized legacy frame', () => {
    const ctx = {
      clearRect: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      arc: vi.fn(),
      fill: vi.fn(),
      fillText: vi.fn(),
    };
    drawPose(
      ctx as unknown as CanvasRenderingContext2D,
      { time: 0, angle: 90, landmarks: pose() },
      exercises[0],
      'left',
      { sourceWidth: 640, sourceHeight: 480, width: 640, height: 480 },
    );
    expect(ctx.arc).toHaveBeenCalledTimes(23);
    expect(ctx.fillText).toHaveBeenCalledWith('90.0°', expect.any(Number), expect.any(Number));
    expect(POSE_CONNECTIONS.every((pair) => pair.every((index) => index >= 11))).toBe(true);
  });
  it('draws all detected finger joints and hand connections', () => {
    const ctx = {
      clearRect: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      arc: vi.fn(),
      fill: vi.fn(),
      fillText: vi.fn(),
    };
    const hands = pose().slice(0, 21);
    drawPose(
      ctx as unknown as CanvasRenderingContext2D,
      {
        time: 0,
        angle: 90,
        landmarks: bodyOnlyLandmarks(pose()),
        leftHandLandmarks: hands,
        rightHandLandmarks: hands,
      },
      exercises[0],
      'left',
      { sourceWidth: 640, sourceHeight: 480, width: 640, height: 480 },
    );
    expect(ctx.arc).toHaveBeenCalledTimes(65);
    expect(HAND_CONNECTIONS).toHaveLength(21);
    expect(HAND_CONNECTIONS.flat().every((index) => index >= 0 && index <= 20)).toBe(true);
  });
});
