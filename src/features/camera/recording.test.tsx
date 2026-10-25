// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import FullscreenCapture from '../../pages/Exercise/FullscreenCapture';
import { exercises } from '../exercise-tracking/exercises';
import type { Frame, Landmark } from '../../types';
import { measureFrame } from '../pose-analysis/math';

const mocks = vi.hoisted(() => ({
  analyzeBlob: vi.fn(),
  onFrame: undefined as undefined | ((frame: Frame, clock: number) => void),
}));
vi.mock('../pose-analysis/analyze', () => ({ analyzeBlob: mocks.analyzeBlob }));
vi.mock('../../services/local', () => ({ readMedia: vi.fn() }));
vi.mock('./useLivePose', () => ({
  useLivePose: (...args: unknown[]) => {
    mocks.onFrame = args[6] as typeof mocks.onFrame;
    return { state: 'tracking', angle: 90, error: '', retry: vi.fn() };
  },
}));

class Recorder {
  static isTypeSupported = () => true;
  mimeType = 'video/webm;codecs=vp8';
  state = 'inactive';
  ondataavailable?: (event: { data: Blob }) => void;
  onstop?: () => void;
  onerror?: () => void;
  start() {
    this.state = 'recording';
  }
  stop() {
    this.state = 'inactive';
    this.ondataavailable?.({
      data: new Blob(['actual-recorder-output-fixture'], { type: this.mimeType }),
    });
    this.onstop?.();
  }
}
let now: number;
const track = { stop: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn() };
beforeEach(() => {
  now = 100;
  mocks.analyzeBlob.mockReset();
  track.stop.mockClear();
  vi.spyOn(performance, 'now').mockImplementation(() => now);
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  vi.stubGlobal('MediaRecorder', Recorder);
  vi.stubGlobal(
    'requestAnimationFrame',
    vi.fn(() => 1),
  );
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
  vi.stubGlobal(
    'URL',
    Object.assign(class extends URL {}, {
      createObjectURL: vi.fn(() => 'blob:recorded'),
      revokeObjectURL: vi.fn(),
    }),
  );
  Object.defineProperty(window, 'isSecureContext', { configurable: true, value: true });
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: {
      getUserMedia: vi
        .fn()
        .mockResolvedValue({ getTracks: () => [track], getVideoTracks: () => [track] }),
    },
  });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

async function setup() {
  const onSave = vi.fn().mockResolvedValue(undefined),
    onCaptureSaved = vi.fn().mockResolvedValue(undefined),
    onShare = vi.fn();
  render(
    <FullscreenCapture
      exercise={exercises[0]}
      onBack={vi.fn()}
      onSave={onSave}
      onShare={onShare}
      onCaptureSaved={onCaptureSaved}
      autoConnect
      consentGranted
    />,
  );
  await waitFor(() =>
    expect(
      (screen.getByLabelText('실시간 카메라 미리보기') as HTMLVideoElement).srcObject,
    ).toBeDefined(),
  );
  return { user: userEvent.setup(), onSave, onCaptureSaved, onShare };
}

it('retains the recorded clip, saves live joint measurements, and passes the same clip to SNS composition', async () => {
  const { user, onSave, onCaptureSaved, onShare } = await setup();
  await user.click(screen.getByRole('button', { name: '촬영 시작' }));
  const points: Landmark[] = Array.from({ length: 33 }, () => ({
    x: 0.5,
    y: 0.5,
    z: 0,
    visibility: 1,
  }));
  points[23].y = 0.2;
  points[27].x = 0.8;
  const angle = measureFrame(points, exercises[0], 'left', 1280, 720);
  act(() => {
    for (let index = 0; index < 10; index++) {
      const clock = 100 + index * 100;
      mocks.onFrame?.({ time: clock / 1000, angle, landmarks: points }, clock);
    }
  });
  now = 1100;
  await user.click(screen.getByRole('button', { name: '촬영 종료' }));
  await waitFor(() => expect(onSave).toHaveBeenCalledOnce());
  await waitFor(() => expect(onCaptureSaved).toHaveBeenCalledTimes(2));
  const [pending, original] = onCaptureSaved.mock.calls[0];
  expect(original.size).toBeGreaterThan(0);
  expect(pending.duration).toBe(1);
  expect(pending.status).toBe('pending');
  expect(pending.mirrored).toBe(true);
  const session = onSave.mock.calls[0][0];
  expect(session.analysis.min).toBeCloseTo(90);
  expect(session.analysis.validRatio).toBe(1);
  expect(session.mediaId).toBe(pending.mediaId);
  expect(session.mirrored).toBe(true);
  expect(mocks.analyzeBlob).not.toHaveBeenCalled();
  expect(track.stop).toHaveBeenCalled();
  await user.click(screen.getByRole('button', { name: '게시물 만들기' }));
  expect(onShare).toHaveBeenCalledWith({
    blob: original,
    capture: expect.objectContaining({ id: pending.id, status: 'ready' }),
    session,
  });
});

it('retries offline analysis with a known duration and keeps the video shareable after detection failure', async () => {
  mocks.analyzeBlob.mockRejectedValue(new Error('관절을 충분히 측정하지 못했어요.'));
  const { user, onSave, onCaptureSaved, onShare } = await setup();
  await user.click(screen.getByRole('button', { name: '촬영 시작' }));
  now = 2100;
  await user.click(screen.getByRole('button', { name: '촬영 종료' }));
  await screen.findByText('관절을 충분히 측정하지 못했어요.');
  expect(onSave).not.toHaveBeenCalled();
  expect(mocks.analyzeBlob).toHaveBeenCalledWith(
    expect.any(Blob),
    exercises[0],
    'left',
    expect.any(Function),
    expect.any(AbortSignal),
    2,
  );
  expect(onCaptureSaved.mock.calls[0][1]).toBeInstanceOf(Blob);
  expect(onCaptureSaved.mock.calls[1][0].status).toBe('failed');
  await user.click(screen.getByRole('button', { name: '게시물 만들기' }));
  expect(onShare.mock.calls[0][0].blob).toBe(onCaptureSaved.mock.calls[0][1]);
  await user.click(screen.getByRole('button', { name: '다시 시도' }));
  await waitFor(() => expect(mocks.analyzeBlob).toHaveBeenCalledTimes(2));
});

it('finishes and retains the clip when iPad Safari moves into the background', async () => {
  mocks.analyzeBlob.mockRejectedValue(new Error('no person'));
  const { user, onCaptureSaved } = await setup();
  await user.click(screen.getByRole('button', { name: '촬영 시작' }));
  now = 1800;
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
  act(() => document.dispatchEvent(new Event('visibilitychange')));
  await waitFor(() => expect(onCaptureSaved).toHaveBeenCalled());
  expect(onCaptureSaved.mock.calls[0][0].duration).toBeCloseTo(1.7);
  expect(onCaptureSaved.mock.calls[0][1].size).toBeGreaterThan(0);
  expect(screen.getByRole('button', { name: '게시물 만들기' })).toBeDefined();
});
