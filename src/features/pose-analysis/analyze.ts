import type { Exercise, Frame, Side } from '../../types';
import { measureFrame, summarize } from './math';
import { PoseClient, snapshotVideo } from './PoseClient';
import { seekVideo, videoDuration, waitForVideo } from './media';

export async function analyzeVideo(
  video: HTMLVideoElement,
  exercise: Exercise,
  side: Side,
  onProgress: (value: number) => void,
  signal: AbortSignal,
  knownDuration?: number,
) {
  await waitForVideo(video, signal);
  const duration = await videoDuration(video, signal, knownDuration),
    client = new PoseClient();
  const abort = () => client.close();
  signal.addEventListener('abort', abort, { once: true });
  try {
    if (signal.aborted) throw new DOMException('취소됨', 'AbortError');
    video.pause();
    await client.init();
    const frames: Frame[] = [],
      total = Math.ceil(duration * 10);
    for (let i = 0; i < total; i++) {
      if (signal.aborted) throw new DOMException('취소됨', 'AbortError');
      const time = Math.min(i / 10, duration - 0.02);
      await seekVideo(video, time, signal);
      const bitmap = await snapshotVideo(video);
      if (signal.aborted) {
        bitmap.close();
        throw new DOMException('취소됨', 'AbortError');
      }
      const { landmarks, worldLandmarks } = await client.detectWithWorld(bitmap, i * 100 + 1);
      frames.push({
        time,
        angle: measureFrame(landmarks, exercise, side, video.videoWidth, video.videoHeight),
        landmarks,
        worldLandmarks,
      });
      onProgress(Math.round(((i + 1) / total) * 100));
    }
    await seekVideo(video, 0, signal);
    return { analysis: summarize(frames, exercise), duration };
  } finally {
    signal.removeEventListener('abort', abort);
    client.close();
  }
}
export async function analyzeBlob(
  blob: Blob,
  exercise: Exercise,
  side: Side,
  onProgress: (value: number) => void,
  signal: AbortSignal,
  knownDuration?: number,
) {
  const video = document.createElement('video'),
    url = URL.createObjectURL(blob);
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';
  video.src = url;
  video.load();
  try {
    return await analyzeVideo(video, exercise, side, onProgress, signal, knownDuration);
  } finally {
    video.pause();
    video.removeAttribute('src');
    video.load();
    URL.revokeObjectURL(url);
  }
}
