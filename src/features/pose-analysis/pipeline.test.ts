// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PoseClient } from './PoseClient';
import { projectPoint } from './draw';
import { seekVideo, videoDuration, waitForVideo } from './media';
import { resampleCaptureFrames, sessionFromCapture, videoFile } from '../camera/recording';
import { exercises } from '../exercise-tracking/exercises';
import type { CaptureRecord, Frame } from '../../types';
import { bodyOnlyLandmarks } from './bodyLandmarks';

afterEach(() => vi.useRealTimers());

describe('worker responses and cancellation', () => {
  function worker() {
    return {
      postMessage: vi.fn(),
      terminate: vi.fn(),
      onmessage: null,
      onerror: null,
    } as unknown as Worker;
  }
  it('waits for model readiness once and matches returned landmarks to their request', async () => {
    const engine = worker(),
      client = new PoseClient(engine);
    const ready = client.init();
    expect(client.init()).toBe(ready);
    expect(engine.postMessage).toHaveBeenCalledTimes(1);
    engine.onmessage!({ data: { id: 1, type: 'ready' } } as MessageEvent);
    await ready;
    const bitmap = { close: vi.fn() } as unknown as ImageBitmap;
    const first = client.detect(bitmap, 100),
      second = client.detect(bitmap, 200);
    const points = Array.from({ length: 33 }, () => ({ x: 0.4, y: 0.6, z: 0, visibility: 0.9 }));
    engine.onmessage!({ data: { id: 3, type: 'result', landmarks: points } } as MessageEvent);
    engine.onmessage!({ data: { id: 2, type: 'result', landmarks: [] } } as MessageEvent);
    expect(await first).toEqual([]);
    expect(await second).toEqual(bodyOnlyLandmarks(points));
    expect(engine.postMessage).toHaveBeenLastCalledWith(
      { id: 3, type: 'frame', bitmap, timestamp: 200 },
      [bitmap],
    );
    client.close();
    expect(engine.terminate).toHaveBeenCalledOnce();
  });
  it('rejects in-flight work immediately on cancel and disposes a later bitmap', async () => {
    const engine = worker(),
      client = new PoseClient(engine);
    const pending = client.init();
    const rejected = expect(pending).rejects.toHaveProperty('name', 'AbortError');
    client.close();
    await rejected;
    const bitmap = { close: vi.fn() } as unknown as ImageBitmap;
    await expect(client.detect(bitmap, 1)).rejects.toHaveProperty('name', 'AbortError');
    expect(bitmap.close).toHaveBeenCalledOnce();
  });
  it('surfaces model failures and times out missing replies', async () => {
    vi.useFakeTimers();
    const engine = worker(),
      client = new PoseClient(engine);
    const pending = client.init();
    const rejected = expect(pending).rejects.toThrow('model unavailable');
    engine.onmessage!({
      data: { id: 1, type: 'error', message: 'model unavailable' },
    } as MessageEvent);
    await rejected;
    const bitmap = { close: vi.fn() } as unknown as ImageBitmap;
    const detection = client.detect(bitmap, 1);
    const timedOut = expect(detection).rejects.toThrow('응답이 늦어요');
    await vi.advanceTimersByTimeAsync(60000);
    await timedOut;
    client.close();
  });
});

describe('recorded WebM decoding', () => {
  function video(duration = Infinity) {
    const video = document.createElement('video');
    Object.defineProperties(video, {
      duration: { configurable: true, value: duration },
      readyState: { configurable: true, value: 2 },
      videoWidth: { value: 1280 },
      videoHeight: { value: 720 },
    });
    return video;
  }
  it('uses measured recording duration without seeking to an arbitrary end for infinite WebM metadata', async () => {
    const clip = video();
    const seek = vi.spyOn(clip, 'currentTime', 'set');
    expect(await videoDuration(clip, new AbortController().signal, 12.3)).toBe(12.3);
    expect(seek).not.toHaveBeenCalled();
    Object.defineProperty(clip, 'duration', { value: 12 });
    expect(await videoDuration(clip, new AbortController().signal, 12.3)).toBe(12);
  });
  it('does not seek an already decoded frame, and aborts a stalled seek', async () => {
    const clip = video(5),
      abort = new AbortController();
    const seek = vi.spyOn(clip, 'currentTime', 'set');
    await seekVideo(clip, 0, abort.signal);
    expect(seek).not.toHaveBeenCalled();
    const pending = seekVideo(clip, 1, abort.signal);
    const rejected = expect(pending).rejects.toHaveProperty('name', 'AbortError');
    abort.abort();
    await rejected;
  });
  it('waits for actual decoded frames and surfaces corrupt files', async () => {
    const clip = video();
    Object.defineProperty(clip, 'readyState', { value: 1 });
    const pending = waitForVideo(clip, new AbortController().signal);
    const rejected = expect(pending).rejects.toThrow('재생할 수 없어요');
    clip.dispatchEvent(new Event('error'));
    await rejected;
  });
});

describe('full-screen camera geometry and recording samples', () => {
  it('applies the same centered cover crop as the preview and mirrors front camera points', () => {
    const source = { x: 0.6, y: 0.25 };
    const rear = projectPoint(source, 1280, 720, 360, 720);
    expect(rear).toEqual({ x: 308, y: 180 });
    expect(projectPoint(source, 1280, 720, 360, 720, true)).toEqual({ x: 52, y: 180 });
    expect(projectPoint({ x: 0.5, y: 0.5 }, 1280, 720, 360, 720)).toEqual({ x: 180, y: 360 });
  });
  it('keeps unobserved time as missing measurements rather than interpolating angles', () => {
    const sample: Frame = { time: 0, angle: 90, landmarks: [] };
    const frames = resampleCaptureFrames([sample], 1);
    expect(frames).toHaveLength(10);
    expect(frames[0].angle).toBe(90);
    expect(frames[5]).toEqual({ time: 0.5, angle: null, landmarks: [] });
    const capture: CaptureRecord = {
      id: 'capture',
      exerciseId: 'knee',
      recordedAt: '2026-10-24',
      duration: 1,
      side: 'left',
      cameraDirection: '측면',
      status: 'pending',
    };
    expect(() => sessionFromCapture(capture, exercises[0], frames)).toThrow(
      '충분히 측정하지 못했어요',
    );
  });
  it('normalizes recorded codec MIME so the clip is accepted by the post composer', () => {
    const file = videoFile(new Blob(['clip'], { type: 'video/webm;codecs=vp8' }));
    expect(file.type).toBe('video/webm');
    expect(file.name).toMatch(/\.webm$/);
    expect(file.size).toBe(4);
  });
});
