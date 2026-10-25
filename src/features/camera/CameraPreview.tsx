import { useEffect, useRef, useState } from 'react';
import { Play } from 'lucide-react';

export default function CameraPreview({
  stream,
  mirrored,
  recording,
}: {
  stream: MediaStream;
  mirrored: boolean;
  recording: boolean;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const [needsTap, setNeedsTap] = useState(false);
  useEffect(() => {
    const video = ref.current!;
    let active = true;
    video.muted = true;
    video.srcObject = stream;
    video
      .play()
      .then(() => {
        if (active) setNeedsTap(false);
      })
      .catch(() => {
        if (active) setNeedsTap(true);
      });
    return () => {
      active = false;
      video.pause();
      video.srcObject = null;
    };
  }, [stream]);
  return (
    <div className="video-stage live-preview">
      <video
        ref={ref}
        className={mirrored ? 'mirrored' : ''}
        autoPlay
        muted
        playsInline
        aria-label="실시간 카메라 미리보기"
      />
      {needsTap && (
        <button
          className="preview-play primary"
          onClick={() => {
            ref.current
              ?.play()
              .then(() => setNeedsTap(false))
              .catch(() => setNeedsTap(true));
          }}
        >
          <Play size={18} /> 카메라 화면 시작
        </button>
      )}
      <span className={`video-label ${recording ? 'recording' : ''}`}>
        {recording ? '● 촬영 중 · 최대 3분' : '카메라 연결됨 · 대상 관절이 보이는지 확인해 주세요'}
      </span>
    </div>
  );
}
