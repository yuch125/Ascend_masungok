export function waitForVideo(video: HTMLVideoElement, signal: AbortSignal): Promise<void> {
  if (signal.aborted) return Promise.reject(new DOMException('취소됨', 'AbortError'));
  if (video.readyState >= 2 && video.videoWidth > 0) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(timer);
      video.removeEventListener('loadeddata', ready);
      video.removeEventListener('canplay', ready);
      video.removeEventListener('error', failed);
      signal.removeEventListener('abort', aborted);
    };
    const ready = () => {
      if (video.readyState >= 2 && video.videoWidth > 0) {
        cleanup();
        resolve();
      }
    };
    const failed = () => {
      cleanup();
      reject(new Error('이 영상을 재생할 수 없어요. MP4 또는 WebM 파일로 다시 선택해 주세요.'));
    };
    const aborted = () => {
      cleanup();
      reject(new DOMException('취소됨', 'AbortError'));
    };
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error('영상 프레임을 읽지 못했어요. 다른 영상으로 다시 시도해 주세요.'));
    }, 12000);
    video.addEventListener('loadeddata', ready);
    video.addEventListener('canplay', ready);
    video.addEventListener('error', failed, { once: true });
    signal.addEventListener('abort', aborted, { once: true });
    ready();
  });
}
export function validateDuration(value: number): number {
  if (!Number.isFinite(value) || value < 0.5 || value > 180.5)
    throw new Error('0.5초 이상 3분 이하의 영상을 선택해 주세요.');
  return Math.min(180, value);
}
export function seekVideo(
  video: HTMLVideoElement,
  time: number,
  signal: AbortSignal,
): Promise<void> {
  if (signal.aborted) return Promise.reject(new DOMException('취소됨', 'AbortError'));
  if (Math.abs(video.currentTime - time) < 0.001 && !video.seeking)
    return waitForVideo(video, signal);
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(timer);
      video.removeEventListener('seeked', done);
      video.removeEventListener('error', failed);
      signal.removeEventListener('abort', aborted);
    };
    const done = () => {
      cleanup();
      waitForVideo(video, signal).then(resolve, reject);
    };
    const failed = () => {
      cleanup();
      reject(new Error('영상 탐색에 실패했어요. 다른 파일로 다시 시도해 주세요.'));
    };
    const aborted = () => {
      cleanup();
      reject(new DOMException('취소됨', 'AbortError'));
    };
    const timer = setTimeout(failed, 10000);
    video.addEventListener('seeked', done, { once: true });
    video.addEventListener('error', failed, { once: true });
    signal.addEventListener('abort', aborted, { once: true });
    try {
      video.currentTime = time;
    } catch (error) {
      cleanup();
      reject(error);
    }
  });
}
export async function videoDuration(
  video: HTMLVideoElement,
  signal: AbortSignal,
  known?: number,
): Promise<number> {
  if (known !== undefined)
    return validateDuration(
      Number.isFinite(video.duration) && video.duration > 0
        ? Math.min(known, video.duration)
        : known,
    );
  if (Number.isFinite(video.duration)) return validateDuration(video.duration);
  if (video.seekable.length) {
    const end = video.seekable.end(video.seekable.length - 1);
    if (Number.isFinite(end)) return validateDuration(end);
  }
  // Only imported WebM files without a duration header need an end probe.
  await seekVideo(video, 1e8, signal);
  const duration = Number.isFinite(video.duration) ? video.duration : video.currentTime;
  await seekVideo(video, 0, signal);
  return validateDuration(duration);
}
