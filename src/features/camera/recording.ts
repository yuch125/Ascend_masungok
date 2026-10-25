import type { CaptureRecord, Exercise, Frame, Session, Side } from '../../types';
import { ANALYSIS_VERSION, summarize } from '../pose-analysis/math';
import { bodyOnlyLandmarks } from '../pose-analysis/bodyLandmarks';

export function resampleCaptureFrames(samples: Frame[], duration: number): Frame[] {
  const frames: Frame[] = [],
    sorted = [...samples].sort((a, b) => a.time - b.time);
  let cursor = 0;
  for (let index = 0; index < Math.ceil(duration * 10); index++) {
    const time = index / 10;
    while (
      cursor + 1 < sorted.length &&
      Math.abs(sorted[cursor + 1].time - time) <= Math.abs(sorted[cursor].time - time)
    )
      cursor++;
    const sample = sorted[cursor];
    frames.push(
      sample && Math.abs(sample.time - time) <= 0.12
        ? {
            ...sample,
            time,
            landmarks: bodyOnlyLandmarks(sample.landmarks),
            worldLandmarks: sample.worldLandmarks
              ? bodyOnlyLandmarks(sample.worldLandmarks)
              : undefined,
          }
        : { time, angle: null, landmarks: [] },
    );
  }
  return frames;
}
export function sessionFromCapture(
  capture: CaptureRecord,
  exercise: Exercise,
  frames: Frame[],
): Session {
  return {
    id: capture.id,
    exerciseId: exercise.id,
    recordedAt: capture.recordedAt,
    duration: capture.duration,
    side: capture.side,
    cameraDirection: capture.cameraDirection,
    mirrored: capture.mirrored,
    version: ANALYSIS_VERSION,
    analysis: summarize(frames, exercise),
    mediaId: capture.mediaId,
  };
}
export function recordingMime(): string | undefined {
  if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function')
    return undefined;
  return recordingTypes.find((type) => MediaRecorder.isTypeSupported(type));
}
const recordingTypes = ['video/mp4', 'video/webm;codecs=vp8', 'video/webm;codecs=vp9'];
export function createVideoRecorder(stream: MediaStream): MediaRecorder {
  if (typeof MediaRecorder === 'undefined')
    throw new Error('이 브라우저에서는 영상 불러오기를 이용해 주세요.');
  // Prefer MP4 where supported so iPad recordings can also be played and shared
  // in Photos. Capability detection also handles iPad Safari's desktop user agent.
  for (const mimeType of recordingTypes) {
    if (!MediaRecorder.isTypeSupported?.(mimeType)) continue;
    try {
      return new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 800_000 });
    } catch {
      /* Try the next supported container. */
    }
  }
  // Safari versions can advertise a codec but reject explicit recorder options.
  return new MediaRecorder(stream);
}
export function videoFile(blob: Blob): File {
  const type = blob.type.split(';')[0] || 'video/webm',
    extension = type === 'video/mp4' ? 'mp4' : type === 'video/quicktime' ? 'mov' : 'webm';
  return new File([blob], `re-move-${Date.now()}.${extension}`, { type });
}
export type CaptureShare = { capture: CaptureRecord; blob: Blob; session?: Session };
export type CaptureSide = Side;
