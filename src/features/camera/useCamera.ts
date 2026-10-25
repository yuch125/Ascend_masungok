import { useCallback, useEffect, useRef, useState } from 'react';
import { cameraErrorMessage, releaseCamera, requestCamera } from './camera';
import type { CameraFacing } from './camera';

export function useCamera() {
  const [stream, setStream] = useState<MediaStream>();
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState('');
  const [facing, setFacing] = useState<CameraFacing>('user');
  const streamRef = useRef<MediaStream | undefined>(undefined);
  const attempt = useRef(0);
  const pending = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const mounted = useRef(true);

  const stop = useCallback(() => {
    attempt.current++;
    pending.current = false;
    clearTimeout(timer.current);
    releaseCamera(streamRef.current);
    streamRef.current = undefined;
    setStream(undefined);
    setConnecting(false);
  }, []);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      attempt.current++;
      clearTimeout(timer.current);
      releaseCamera(streamRef.current);
    };
  }, []);

  async function connect(requestedFacing: CameraFacing = facing) {
    if (pending.current) return;
    setFacing(requestedFacing);
    const id = ++attempt.current;
    pending.current = true;
    setConnecting(true);
    setError('');
    releaseCamera(streamRef.current);
    streamRef.current = undefined;
    setStream(undefined);
    timer.current = setTimeout(() => {
      if (!mounted.current || id !== attempt.current) return;
      stop();
      setError(
        '카메라 허용 창을 확인해 주세요. 응답이 없어 연결을 멈췄어요. 권한을 확인한 뒤 다시 연결하거나 영상을 불러와 주세요.',
      );
    }, 30000);
    try {
      const next = await requestCamera(requestedFacing);
      if (!mounted.current || id !== attempt.current) {
        releaseCamera(next);
        return;
      }
      streamRef.current = next;
      setStream(next);
    } catch (cause) {
      if (mounted.current && id === attempt.current) setError(cameraErrorMessage(cause));
    } finally {
      if (mounted.current && id === attempt.current) {
        clearTimeout(timer.current);
        pending.current = false;
        setConnecting(false);
      }
    }
  }

  useEffect(() => {
    if (!stream) return;
    const ended = () => {
      stop();
      setError('카메라 연결이 끊어졌어요. 다시 연결해 주세요.');
    };
    const tracks = stream.getVideoTracks();
    tracks.forEach((track) => track.addEventListener('ended', ended));
    return () => tracks.forEach((track) => track.removeEventListener('ended', ended));
  }, [stream, stop]);

  return { stream, connecting, error, facing, setFacing, connect, stop };
}
