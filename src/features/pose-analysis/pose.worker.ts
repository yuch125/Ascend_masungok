/// <reference lib="webworker" />
import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision';
import { bodyOnlyLandmarks } from './bodyLandmarks';
let model: PoseLandmarker | undefined;
self.onmessage = async ({
  data,
}: MessageEvent<
  | { id: number; type: 'init' }
  | { id: number; type: 'frame'; bitmap: ImageBitmap; timestamp: number }
>) => {
  try {
    if (data.type === 'init') {
      const vision = await FilesetResolver.forVisionTasks(
        new URL('/mediapipe', self.location.origin).href,
        true,
      );
      model = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: new URL('/models/pose_landmarker_lite.task', self.location.origin).href,
          delegate: 'CPU',
        },
        runningMode: 'VIDEO',
        numPoses: 1,
        minPoseDetectionConfidence: 0.5,
        minPosePresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });
      self.postMessage({ id: data.id, type: 'ready' });
    } else if (data.type === 'frame' && model) {
      try {
        const result = model.detectForVideo(data.bitmap, data.timestamp);
        self.postMessage({
          id: data.id,
          type: 'result',
          landmarks: bodyOnlyLandmarks(result.landmarks[0] ?? []),
          worldLandmarks: bodyOnlyLandmarks(result.worldLandmarks[0] ?? []),
        });
      } finally {
        data.bitmap.close();
      }
    }
  } catch (error) {
    self.postMessage({
      type: 'error',
      id: data.id,
      message: error instanceof Error ? error.message : String(error),
    });
  }
};
