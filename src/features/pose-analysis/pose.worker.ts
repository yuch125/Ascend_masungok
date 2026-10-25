/// <reference lib="webworker" />
import { FilesetResolver, HolisticLandmarker } from '@mediapipe/tasks-vision';
import { bodyOnlyLandmarks } from './bodyLandmarks';
let model: HolisticLandmarker | undefined;
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
      model = await HolisticLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: new URL('/models/holistic_landmarker.task', self.location.origin).href,
          delegate: 'CPU',
        },
        runningMode: 'VIDEO',
        minPoseDetectionConfidence: 0.5,
        minPosePresenceConfidence: 0.5,
        minHandLandmarksConfidence: 0.5,
        minFaceDetectionConfidence: 0.5,
        minFacePresenceConfidence: 0.5,
      });
      self.postMessage({ id: data.id, type: 'ready' });
    } else if (data.type === 'frame' && model) {
      try {
        const result = model.detectForVideo(data.bitmap, data.timestamp);
        self.postMessage({
          id: data.id,
          type: 'result',
          landmarks: bodyOnlyLandmarks(result.poseLandmarks[0] ?? []),
          worldLandmarks: bodyOnlyLandmarks(result.poseWorldLandmarks[0] ?? []),
          leftHandLandmarks: result.leftHandLandmarks[0] ?? [],
          leftHandWorldLandmarks: result.leftHandWorldLandmarks[0] ?? [],
          rightHandLandmarks: result.rightHandLandmarks[0] ?? [],
          rightHandWorldLandmarks: result.rightHandWorldLandmarks[0] ?? [],
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
