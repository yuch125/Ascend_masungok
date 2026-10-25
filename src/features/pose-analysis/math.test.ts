import { describe, expect, it } from 'vitest';
import { countRepetitions, jointAngle, measureFrame, summarize } from './math';
import { exercises } from '../exercise-tracking/exercises';
import type { Frame, Landmark } from '../../types';
describe('joint angle and input quality', () => {
  it('calculates right, straight and acute angles using the dot product', () => {
    expect(jointAngle({ x: 1, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 1 })).toBeCloseTo(90);
    expect(jointAngle({ x: -1, y: 0 }, { x: 0, y: 0 }, { x: 1, y: 0 })).toBeCloseTo(180);
    expect(jointAngle({ x: 1, y: 0 }, { x: 0, y: 0 }, { x: 1, y: 1 })).toBeCloseTo(45);
  });
  it('rejects degenerate and non-finite vectors', () => {
    expect(jointAngle({ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 1, y: 1 })).toBeNull();
    expect(jointAngle({ x: NaN, y: 0 }, { x: 0, y: 0 }, { x: 1, y: 1 })).toBeNull();
  });
  it('respects aspect ratio, side, visibility, presence and image bounds', () => {
    const points: Landmark[] = Array.from({ length: 33 }, () => ({
      x: 0.5,
      y: 0.5,
      z: 0,
      visibility: 1,
      presence: 1,
    }));
    points[23] = { ...points[23], x: 0.75 };
    points[27] = { ...points[27], x: 0.75, y: 0.75 };
    expect(measureFrame(points, exercises[0], 'left', 200, 100)).toBeCloseTo(26.565);
    expect(measureFrame(points, exercises[0], 'right', 200, 100)).toBeNull();
    points[25].visibility = 0.1;
    expect(measureFrame(points, exercises[0], 'left', 200, 100)).toBeNull();
    points[25].visibility = 1;
    points[25].presence = 0.1;
    expect(measureFrame(points, exercises[0], 'left', 200, 100)).toBeNull();
    points[25].presence = 1;
    points[25].x = 2;
    expect(measureFrame(points, exercises[0], 'left', 200, 100)).toBeNull();
  });
});
const frames = (angles: (number | null)[]): Frame[] =>
  angles.map((angle, i) => ({ time: i * 0.1, angle, landmarks: [] }));
describe('real measurements and repetition state', () => {
  it('counts a complete extended-flexed-extended cycle once', () => {
    expect(countRepetitions(frames([170, 160, 130, 100, 110, 130, 165, 170]), [110, 155])).toBe(1);
    expect(countRepetitions(frames([100, 105, 165]), [110, 155])).toBe(0);
    expect(countRepetitions(frames([170, 100, 170]), undefined)).toBeNull();
  });
  it('does not connect cycles across a tracking outage', () => {
    expect(
      countRepetitions(frames([170, 100, null, null, null, null, null, null, 170]), [110, 155]),
    ).toBe(0);
  });
  it('summarizes only valid frames without filling missing data', () => {
    const result = summarize(frames([80, 90, null, 100, 110, 120]), exercises[0]);
    expect(result.min).toBe(80);
    expect(result.max).toBe(120);
    expect(result.range).toBe(40);
    expect(result.validRatio).toBeCloseTo(5 / 6);
    expect(result.frames[2].angle).toBeNull();
  });
  it('fails on no human or insufficient reliable measurements', () => {
    expect(() => summarize(frames([null, null, null]), exercises[0])).toThrow();
    expect(() => summarize(frames([90, 100]), exercises[0])).toThrow();
  });
});
