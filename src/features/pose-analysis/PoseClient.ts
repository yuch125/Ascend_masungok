import type { HandLandmarks, PoseLandmarks } from '../../types';
import { bodyOnlyLandmarks } from './bodyLandmarks';

type Reply =
  | { id: number; type: 'ready' }
  | {
      id: number;
      type: 'result';
      landmarks: PoseLandmarks;
      worldLandmarks?: PoseLandmarks;
      leftHandLandmarks?: HandLandmarks;
      leftHandWorldLandmarks?: HandLandmarks;
      rightHandLandmarks?: HandLandmarks;
      rightHandWorldLandmarks?: HandLandmarks;
    }
  | { id: number; type: 'error'; message: string };
export type PoseDetection = {
  landmarks: PoseLandmarks;
  worldLandmarks: PoseLandmarks;
  leftHandLandmarks: HandLandmarks;
  leftHandWorldLandmarks: HandLandmarks;
  rightHandLandmarks: HandLandmarks;
  rightHandWorldLandmarks: HandLandmarks;
};
export class PoseClient {
  private worker: Worker;
  private nextId = 0;
  private closed = false;
  private pending = new Map<
    number,
    {
      resolve: (reply: Reply) => void;
      reject: (error: Error) => void;
      timer: ReturnType<typeof setTimeout>;
    }
  >();
  private initialized?: Promise<void>;
  constructor(worker?: Worker) {
    this.worker =
      worker ?? new Worker(new URL('./pose.worker.ts', import.meta.url), { type: 'module' });
    this.worker.onmessage = ({ data }: MessageEvent<Reply>) => {
      const request = this.pending.get(data.id);
      if (!request) return;
      this.pending.delete(data.id);
      clearTimeout(request.timer);
      if (data.type === 'error') request.reject(new Error(data.message));
      else request.resolve(data);
    };
    this.worker.onerror = () =>
      this.fail(
        new Error('관절 분석을 시작하지 못했어요. 브라우저를 새로고침하고 다시 시도해 주세요.'),
      );
  }
  private fail(error: Error) {
    for (const request of this.pending.values()) {
      clearTimeout(request.timer);
      request.reject(error);
    }
    this.pending.clear();
  }
  private request(payload: object, transfer: Transferable[] = []): Promise<Reply> {
    if (this.closed) return Promise.reject(new DOMException('분석이 종료되었어요.', 'AbortError'));
    const id = ++this.nextId;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error('분석 모델 응답이 늦어요. 다시 시도해 주세요.'));
      }, 60000);
      this.pending.set(id, { resolve, reject, timer });
      try {
        this.worker.postMessage({ ...payload, id }, transfer);
      } catch (error) {
        clearTimeout(timer);
        this.pending.delete(id);
        reject(error);
      }
    });
  }
  init(): Promise<void> {
    return (this.initialized ??= this.request({ type: 'init' }).then(() => {}));
  }
  async detect(bitmap: ImageBitmap, timestamp: number): Promise<PoseLandmarks> {
    return (await this.detectWithWorld(bitmap, timestamp)).landmarks;
  }
  async detectWithWorld(bitmap: ImageBitmap, timestamp: number): Promise<PoseDetection> {
    if (this.closed) {
      bitmap.close();
      throw new DOMException('분석이 종료되었어요.', 'AbortError');
    }
    try {
      const response = await this.request({ type: 'frame', bitmap, timestamp }, [bitmap]);
      if (response.type !== 'result') throw new Error('관절 분석 응답을 읽지 못했어요.');
      return {
        landmarks: bodyOnlyLandmarks(response.landmarks),
        worldLandmarks: bodyOnlyLandmarks(response.worldLandmarks ?? []),
        leftHandLandmarks: response.leftHandLandmarks ?? [],
        leftHandWorldLandmarks: response.leftHandWorldLandmarks ?? [],
        rightHandLandmarks: response.rightHandLandmarks ?? [],
        rightHandWorldLandmarks: response.rightHandWorldLandmarks ?? [],
      };
    } catch (error) {
      try {
        bitmap.close();
      } catch {}
      throw error;
    }
  }
  close() {
    if (this.closed) return;
    this.closed = true;
    this.fail(new DOMException('분석이 취소되었어요.', 'AbortError'));
    this.worker.terminate();
  }
}

export async function snapshotVideo(video: HTMLVideoElement): Promise<ImageBitmap> {
  if (video.readyState < 2 || video.videoWidth === 0 || video.videoHeight === 0)
    throw new Error('영상 프레임을 아직 읽지 못했어요.');
  const ratio = Math.min(1, 960 / Math.max(video.videoWidth, video.videoHeight));
  if (typeof createImageBitmap !== 'function')
    throw new Error(
      '이 브라우저는 영상 분석을 지원하지 않아요. 최신 Chrome 또는 Safari에서 열어 주세요.',
    );
  const width = Math.max(1, Math.round(video.videoWidth * ratio)),
    height = Math.max(1, Math.round(video.videoHeight * ratio));
  try {
    return await createImageBitmap(video, {
      resizeWidth: width,
      resizeHeight: height,
      resizeQuality: 'low',
    });
  } catch {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('영상 프레임을 읽지 못했어요.');
    context.drawImage(video, 0, 0, width, height);
    return createImageBitmap(canvas);
  }
}
