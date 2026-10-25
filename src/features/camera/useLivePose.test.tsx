// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useLivePose } from './useLivePose';
import { exercises } from '../exercise-tracking/exercises';
import type { Landmark } from '../../types';

const mocks = vi.hoisted(() => ({
  init: vi.fn(),
  detect: vi.fn(),
  detectWithWorld: vi.fn(),
  close: vi.fn(),
  snapshot: vi.fn(),
  draw: vi.fn(),
}));
vi.mock('../pose-analysis/PoseClient', () => ({
  PoseClient: class {
    init = mocks.init;
    detect = mocks.detect;
    detectWithWorld = mocks.detectWithWorld;
    close = mocks.close;
  },
  snapshotVideo: mocks.snapshot,
}));
vi.mock('../pose-analysis/draw', () => ({ drawPose: mocks.draw }));
let now: number, nextFrame: FrameRequestCallback;
beforeEach(() => {
  now = 100;
  Object.values(mocks).forEach((mock) => mock.mockReset());
  mocks.init.mockResolvedValue(undefined);
  mocks.snapshot.mockResolvedValue({ close: vi.fn() });
  vi.spyOn(performance, 'now').mockImplementation(() => now);
  vi.stubGlobal(
    'requestAnimationFrame',
    vi.fn((callback: FrameRequestCallback) => {
      nextFrame = callback;
      return 1;
    }),
  );
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it('tracks automatically on an open preview, timestamps capture before inference, and clears stale angles', async () => {
  const points: Landmark[] = Array.from({ length: 33 }, () => ({
    x: 0.5,
    y: 0.5,
    z: 0,
    visibility: 1,
  }));
  points[23].y = 0.2;
  points[27].x = 0.8;
  let respond!: (points: Landmark[]) => void;
  mocks.detectWithWorld.mockReturnValue(
    new Promise<{ landmarks: Landmark[]; worldLandmarks: Landmark[] }>((resolve) => {
      respond = (landmarks) => resolve({ landmarks, worldLandmarks: landmarks });
    }),
  );
  const video = {
    videoWidth: 640,
    videoHeight: 480,
    readyState: 2,
    paused: false,
  } as HTMLVideoElement;
  const context = { clearRect: vi.fn() };
  const canvas = {
    width: 0,
    height: 0,
    getContext: () => context,
    getBoundingClientRect: () => ({ width: 360, height: 720 }),
  } as unknown as HTMLCanvasElement;
  const videoRef = { current: video },
    canvasRef = { current: canvas },
    stream = {} as MediaStream,
    onFrame = vi.fn();
  const hook = renderHook(() =>
    useLivePose(videoRef, canvasRef, stream, exercises[0], 'left', true, onFrame),
  );
  await act(async () => {});
  expect(hook.result.current.state).toBe('searching');
  await act(async () => nextFrame(now));
  expect(mocks.detectWithWorld).toHaveBeenCalledWith(expect.anything(), 100);
  now = 400;
  await act(async () => respond(points));
  expect(onFrame).toHaveBeenCalledWith(
    expect.objectContaining({ time: 0.1, angle: 90, landmarks: points }),
    100,
  );
  expect(hook.result.current.angle).toBe(90);
  Object.defineProperty(video, 'paused', { value: true });
  act(() => nextFrame(now));
  expect(mocks.draw).toHaveBeenLastCalledWith(
    context,
    expect.objectContaining({ angle: 90 }),
    exercises[0],
    'left',
    expect.objectContaining({ width: 360, height: 720, mirrored: true }),
  );
  now = 800;
  act(() => nextFrame(now));
  expect(mocks.draw).toHaveBeenLastCalledWith(
    context,
    undefined,
    exercises[0],
    'left',
    expect.anything(),
  );
  expect(hook.result.current.angle).toBeNull();
  expect(hook.result.current.state).toBe('searching');
  hook.unmount();
  expect(mocks.close).toHaveBeenCalledOnce();
});
