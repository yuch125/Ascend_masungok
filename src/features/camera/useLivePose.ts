import { useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import type { Exercise, Frame, Side } from '../../types';
import { PoseClient, snapshotVideo } from '../pose-analysis/PoseClient';
import { measureFrame } from '../pose-analysis/math';
import { drawPose } from '../pose-analysis/draw';

export function useLivePose(
  videoRef: RefObject<HTMLVideoElement | null>,
  canvasRef: RefObject<HTMLCanvasElement | null>,
  stream: MediaStream | undefined,
  exercise: Exercise,
  side: Side,
  mirrored: boolean,
  onFrame: (frame: Frame, clock: number) => void,
) {
  const [state, setState] = useState<'loading' | 'tracking' | 'searching' | 'error'>('loading'),
    [angle, setAngle] = useState<number | null>(null),
    [error, setError] = useState(''),
    [revision, setRevision] = useState(0);
  const callback = useRef(onFrame);
  callback.current = onFrame;
  const job = useRef<Promise<void> | null>(null),
    lastFrame = useRef<Frame | undefined>(undefined);
  useEffect(() => {
    if (!stream) return;
    let active = true,
      raf = 0,
      lastTime = -Infinity,
      ready = false;
    let client: PoseClient;
    setState('loading');
    setError('');
    setAngle(null);
    lastFrame.current = undefined;
    try {
      client = new PoseClient();
    } catch {
      setState('error');
      setError('실시간 분석을 지원하지 않는 브라우저예요.');
      return;
    }
    client
      .init()
      .then(() => {
        if (active) {
          ready = true;
          setState('searching');
        }
      })
      .catch((cause) => {
        if (active) {
          setError(cause instanceof Error ? cause.message : '분석 모델을 열지 못했어요.');
          setState('error');
        }
      });
    const draw = () => {
      const video = videoRef.current,
        canvas = canvasRef.current;
      if (video && canvas) {
        const rect = canvas.getBoundingClientRect(),
          dpr = Math.min(window.devicePixelRatio || 1, 2),
          width = Math.round((rect.width || video.videoWidth || 640) * dpr),
          height = Math.round((rect.height || video.videoHeight || 480) * dpr);
        if (canvas.width !== width) canvas.width = width;
        if (canvas.height !== height) canvas.height = height;
        const ctx = canvas.getContext('2d');
        const frame =
          lastFrame.current && performance.now() / 1000 - lastFrame.current.time < 0.5
            ? lastFrame.current
            : undefined;
        if (ctx)
          drawPose(ctx, frame, exercise, side, {
            sourceWidth: video.videoWidth || 640,
            sourceHeight: video.videoHeight || 480,
            width,
            height,
            mirrored,
          });
        if (!frame && ready) {
          setAngle(null);
          setState('searching');
        }
      }
    };
    const tick = () => {
      if (!active) return;
      raf = requestAnimationFrame(tick);
      draw();
      const video = videoRef.current,
        now = performance.now();
      if (
        !ready ||
        job.current ||
        !video ||
        video.paused ||
        video.readyState < 2 ||
        !video.videoWidth ||
        now - lastTime < 80
      )
        return;
      lastTime = now;
      const work = (async () => {
        try {
          const bitmap = await snapshotVideo(video);
          if (!active) {
            bitmap.close();
            return;
          }
          const detection = await client.detectWithWorld(bitmap, now);
          if (!active) return;
          const frame: Frame = {
            time: now / 1000,
            ...detection,
            angle: measureFrame(
              detection.landmarks,
              exercise,
              side,
              video.videoWidth,
              video.videoHeight,
            ),
          };
          lastFrame.current = frame;
          callback.current(frame, now);
          setAngle(frame.angle);
          setState(detection.landmarks.length ? 'tracking' : 'searching');
        } catch (cause) {
          if (active) {
            ready = false;
            setAngle(null);
            setError(cause instanceof Error ? cause.message : '관절 분석이 중단됐어요.');
            setState('error');
          }
        }
      })();
      job.current = work;
      work.finally(() => {
        if (job.current === work) job.current = null;
      });
    };
    raf = requestAnimationFrame(tick);
    return () => {
      active = false;
      cancelAnimationFrame(raf);
      client.close();
      lastFrame.current = undefined;
      job.current = null;
      const canvas = canvasRef.current;
      canvas?.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
    };
  }, [stream, exercise, side, mirrored, revision, videoRef, canvasRef]);
  return {
    state,
    angle,
    error,
    retry: () => setRevision((value) => value + 1),
    flush: async () => {
      await job.current;
    },
  };
}
