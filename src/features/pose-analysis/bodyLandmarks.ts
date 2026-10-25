import type { AppData, Frame, PoseLandmarks } from '../../types';

export const FIRST_BODY_LANDMARK = 11;
export const POSE_LANDMARK_COUNT = 33;

/** Discard face coordinates immediately, without shifting shoulder/knee indices. */
export function bodyOnlyLandmarks(points: PoseLandmarks): PoseLandmarks {
  if (!points.slice(FIRST_BODY_LANDMARK, POSE_LANDMARK_COUNT).some(Boolean))
    return points.length ? [] : points;
  if (
    points.length === POSE_LANDMARK_COUNT &&
    points.slice(0, FIRST_BODY_LANDMARK).every((point) => point === null)
  )
    return points;
  return Array.from({ length: POSE_LANDMARK_COUNT }, (_, index) =>
    index < FIRST_BODY_LANDMARK ? null : (points[index] ?? null),
  );
}
export function bodyOnlyFrames(frames: Frame[]): Frame[] {
  let changed = false;
  const next = frames.map((frame) => {
    const landmarks = bodyOnlyLandmarks(frame.landmarks);
    const worldLandmarks = frame.worldLandmarks
      ? bodyOnlyLandmarks(frame.worldLandmarks)
      : undefined;
    if (landmarks === frame.landmarks && worldLandmarks === frame.worldLandmarks) return frame;
    changed = true;
    return { ...frame, landmarks, worldLandmarks };
  });
  return changed ? next : frames;
}
/** Also removes face coordinates from records created by earlier app versions. */
export function bodyOnlyData(data: AppData): AppData {
  let changed = false;
  const sessions = data.sessions.map((session) => {
    const frames = bodyOnlyFrames(session.analysis.frames);
    if (frames === session.analysis.frames) return session;
    changed = true;
    return { ...session, analysis: { ...session.analysis, frames } };
  });
  const captures = data.captures.map((capture) => {
    if (!capture.frames) return capture;
    const frames = bodyOnlyFrames(capture.frames);
    if (frames === capture.frames) return capture;
    changed = true;
    return { ...capture, frames };
  });
  return changed ? { ...data, sessions, captures } : data;
}
