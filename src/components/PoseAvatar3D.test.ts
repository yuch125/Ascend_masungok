import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import type { Frame, HandLandmarks, Landmark } from '../types';
import {
  estimateBodyYaw,
  getHandOrientation,
  HUMAN_HAND_PALM_NORMAL_AXIS,
  HUMAN_HAND_THUMB_AXIS,
  isBilateralSquatBend,
  landmarkAngle3D,
  modelSideForDisplay,
  resolveHandLandmarks,
  stabilizeLegFromImage,
} from './PoseAvatar3D';

const posePoint = (x: number, y: number, z: number) => ({
  position: new THREE.Vector3(x, y, z),
  confidence: 1,
});

const landmark = (x: number, y: number, z = 0): Landmark => ({
  x,
  y,
  z,
  visibility: 1,
  presence: 1,
});

function openPalm(side: 'left' | 'right'): HandLandmarks {
  const mirror = side === 'left' ? 1 : -1;
  const hand: HandLandmarks = Array(21).fill(null);
  hand[0] = landmark(0, 0);
  hand[1] = landmark(-0.45 * mirror, 0.42);
  hand[2] = landmark(-0.62 * mirror, 0.6);
  hand[3] = landmark(-0.76 * mirror, 0.73);
  hand[4] = landmark(-0.88 * mirror, 0.82);
  hand[5] = landmark(-0.35 * mirror, 0.9);
  hand[6] = landmark(-0.38 * mirror, 1.25);
  hand[9] = landmark(-0.04 * mirror, 1.08);
  hand[10] = landmark(-0.04 * mirror, 1.45);
  hand[13] = landmark(0.2 * mirror, 1.02);
  hand[14] = landmark(0.23 * mirror, 1.35);
  hand[17] = landmark(0.38 * mirror, 0.84);
  hand[18] = landmark(0.44 * mirror, 1.12);
  return hand;
}

describe('3D avatar retargeting constraints', () => {
  it('treats a missing image-space bend as a fully extended leg', () => {
    const leg = [
      posePoint(0, 1, 0),
      posePoint(0.24, 0, 0.28),
      posePoint(0, -1, 0),
      posePoint(0, -1.1, 0.25),
    ];
    const corrected = stabilizeLegFromImage(leg, null);
    expect(corrected[1]?.position.x).toBeCloseTo(0, 5);
    expect(corrected[1]?.position.z).toBeCloseTo(0, 5);
    expect(corrected[1]?.position.y).toBeCloseTo(0, 5);
    expect(corrected[2]?.position).toEqual(leg[2].position);
  });

  it('preserves shallow knee flexion instead of pinning the leg straight', () => {
    const leg = [
      posePoint(0, 1, 0),
      posePoint(0.18, 0, 0.22),
      posePoint(0, -1, 0),
      posePoint(0, -1.1, 0.25),
    ];
    const corrected = stabilizeLegFromImage(leg, 160);
    expect(corrected[1]?.position.x).toBeCloseTo(leg[1].position.x, 5);
    expect(corrected[1]?.position.z).toBeCloseTo(leg[1].position.z, 5);
    expect(corrected[2]?.position.x).not.toBeCloseTo(leg[2].position.x, 3);
  });

  it('recognizes synchronized shallow flexion as a bilateral squat', () => {
    expect(isBilateralSquatBend(164, 166)).toBe(true);
    expect(isBilateralSquatBend(160, 176)).toBe(false);
    expect(isBilateralSquatBend(null, 160)).toBe(false);
  });

  it('normalizes the measured diagonal body axis instead of assuming a fixed camera angle', () => {
    const world: (Landmark | null)[] = Array(33).fill(null);
    world[23] = landmark(0.35, 0, -0.35);
    world[24] = landmark(-0.35, 0, 0.35);
    world[11] = landmark(0.4, -0.8, -0.4);
    world[12] = landmark(-0.4, -0.8, 0.4);
    const yaw = estimateBodyYaw(
      { time: 0, angle: null, landmarks: [], worldLandmarks: world },
      false,
    );
    expect(yaw).toBeCloseTo(Math.PI / 4, 5);
  });

  it('uses world depth when measuring a knee in a diagonal capture', () => {
    const world: (Landmark | null)[] = Array(33).fill(null);
    world[23] = landmark(0, 1, 0);
    world[25] = landmark(0, 0, 0);
    world[27] = landmark(0, 0, 1);
    expect(landmarkAngle3D(world, [23, 25, 27])).toBeCloseTo(90, 5);
  });

  it('maps MediaPipe thumb sides to the verified left and right model-hand structure', () => {
    const leftHand = openPalm('left');
    const rightHand = openPalm('right');
    const frame = {
      time: 0,
      angle: null,
      landmarks: [],
      leftHandWorldLandmarks: leftHand,
      rightHandWorldLandmarks: rightHand,
    } satisfies Frame;
    const left = getHandOrientation(frame, 'left', false);
    const right = getHandOrientation(frame, 'right', false);
    expect(left).not.toBeNull();
    expect(right).not.toBeNull();
    expect(left?.forward.y).toBeLessThan(-0.95);
    expect(right?.forward.y).toBeLessThan(-0.95);
    expect(left?.thumb.x).toBeLessThan(-0.95);
    expect(right?.thumb.x).toBeGreaterThan(0.95);
    expect(left!.normal.dot(left!.forward)).toBeCloseTo(0, 5);
    expect(left!.normal.dot(left!.thumb)).toBeCloseTo(0, 5);
    expect(right!.normal.dot(right!.forward)).toBeCloseTo(0, 5);
    expect(right!.normal.dot(right!.thumb)).toBeCloseTo(0, 5);
    expect(HUMAN_HAND_THUMB_AXIS.left).toEqual([1, 0, 0]);
    expect(HUMAN_HAND_THUMB_AXIS.right).toEqual([-1, 0, 0]);
    expect(HUMAN_HAND_PALM_NORMAL_AXIS.left).toEqual([0, 0, -1]);
    expect(HUMAN_HAND_PALM_NORMAL_AXIS.right).toEqual([0, 0, 1]);
  });

  it('uses landmark depth to recover a tilted palm plane', () => {
    const hand = openPalm('left');
    hand.forEach((point) => {
      if (point) point.z = point.x * 0.6;
    });
    const orientation = getHandOrientation(
      {
        time: 0,
        angle: null,
        landmarks: [],
        leftHandWorldLandmarks: hand,
      },
      'left',
      false,
    );
    expect(orientation).not.toBeNull();
    expect(Math.abs(orientation!.normal.x)).toBeGreaterThan(0.25);
    expect(orientation!.normal.dot(orientation!.forward)).toBeCloseTo(0, 5);
  });

  it('distinguishes the palm and back of the same hand as opposite hand frames', () => {
    const palm = openPalm('left');
    const back = palm.map((point) => (point ? { ...point, x: -point.x, z: -point.z } : null));
    const palmOrientation = getHandOrientation(
      { time: 0, angle: null, landmarks: [], leftHandWorldLandmarks: palm },
      'left',
      false,
    );
    const backOrientation = getHandOrientation(
      { time: 0, angle: null, landmarks: [], leftHandWorldLandmarks: back },
      'left',
      false,
    );
    expect(palmOrientation).not.toBeNull();
    expect(backOrientation).not.toBeNull();
    expect(palmOrientation!.forward.dot(backOrientation!.forward)).toBeGreaterThan(0.98);
    expect(palmOrientation!.thumb.dot(backOrientation!.thumb)).toBeLessThan(-0.98);
    expect(palmOrientation!.normal.dot(backOrientation!.normal)).toBeLessThan(-0.98);
  });

  it('repairs a swapped Holistic left/right result using pose wrist landmarks', () => {
    const pose: (Landmark | null)[] = Array(33).fill(null);
    pose[15] = landmark(0.2, 0.5);
    pose[16] = landmark(0.8, 0.5);
    const declaredLeft: HandLandmarks = Array(21).fill(null);
    const declaredRight: HandLandmarks = Array(21).fill(null);
    declaredLeft[0] = landmark(0.79, 0.5);
    declaredRight[0] = landmark(0.21, 0.5);
    const frame = {
      time: 0,
      angle: null,
      landmarks: pose,
      leftHandLandmarks: declaredLeft,
      rightHandLandmarks: declaredRight,
    } satisfies Frame;
    expect(resolveHandLandmarks(frame, 'left')?.declaredSide).toBe('right');
    expect(resolveHandLandmarks(frame, 'right')?.declaredSide).toBe('left');
  });

  it('keeps anatomical sides for normal video and swaps model sides only for selfie display', () => {
    expect(modelSideForDisplay('left', false)).toBe('left');
    expect(modelSideForDisplay('right', false)).toBe('right');
    expect(modelSideForDisplay('left', true)).toBe('right');
    expect(modelSideForDisplay('right', true)).toBe('left');
  });
});
