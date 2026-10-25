import { useEffect, useRef, useState } from 'react';
import { ChevronRight, Film } from 'lucide-react';
import type { CaptureRecord, Session } from '../types';
import { getExercise } from '../features/exercise-tracking/exercises';
import { readMedia } from '../services/local';
import { VideoOverlay } from './VideoOverlay';
import LatestAnalysisCard from './LatestAnalysisCard';

export default function LatestCaptureCard({
  sessions,
  captures,
  userId,
  onDetail,
  onCapture,
  onRecords,
  onStart,
}: {
  sessions: Session[];
  captures: CaptureRecord[];
  userId: string;
  onDetail: (session: Session) => void;
  onCapture: (capture: CaptureRecord) => void;
  onRecords: () => void;
  onStart: () => void;
}) {
  const latestSession = [...sessions].sort((a, b) => b.recordedAt.localeCompare(a.recordedAt))[0],
    latestCapture = [...captures].sort((a, b) => b.recordedAt.localeCompare(a.recordedAt))[0];
  const capture =
    latestCapture && (!latestSession || latestCapture.recordedAt >= latestSession.recordedAt)
      ? latestCapture
      : undefined;
  const session = capture ? sessions.find((session) => session.id === capture.id) : latestSession;
  if (session || !capture)
    return (
      <LatestAnalysisCard
        session={session}
        userId={userId}
        onDetail={onDetail}
        onRecords={onRecords}
        onStart={onStart}
      />
    );
  return <RawCapture capture={capture} userId={userId} onCapture={onCapture} />;
}
function RawCapture({
  capture,
  userId,
  onCapture,
}: {
  capture: CaptureRecord;
  userId: string;
  onCapture: (capture: CaptureRecord) => void;
}) {
  const [url, setUrl] = useState(''),
    [overlay, setOverlay] = useState(true);
  const video = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    let active = true,
      objectUrl = '';
    setUrl('');
    if (capture.mediaId)
      readMedia(userId, capture.mediaId)
        .then((blob) => {
          if (blob && active) {
            objectUrl = URL.createObjectURL(blob);
            setUrl(objectUrl);
          }
        })
        .catch(() => {});
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [capture.id, capture.mediaId, userId]);
  return (
    <section className="latest-analysis latest-raw-capture" aria-label="가장 최근 촬영 영상">
      <div className="section-heading">
        <div>
          <h2>최근 촬영</h2>
          <p>{getExercise(capture.exerciseId).name}</p>
        </div>
        <span className="raw-analysis-status">
          {capture.status === 'failed' ? '분석 다시 확인' : '분석 대기'}
        </span>
      </div>
      {url ? (
        <VideoOverlay
          url={url}
          exercise={getExercise(capture.exerciseId)}
          side={capture.side}
          mirrored={capture.mirrored ?? false}
          frames={overlay ? (capture.frames ?? []) : []}
          videoRef={video}
        />
      ) : (
        <div className="latest-video-missing">
          <Film size={24} />
          <p>이 기기에 원본 영상이 없어요.</p>
        </div>
      )}
      <div className="latest-overlay-toolbar">
        <button
          role="switch"
          aria-checked={overlay}
          aria-label="분석 표시"
          onClick={() => setOverlay((value) => !value)}
        >
          관절 표시 {overlay ? 'ON' : 'OFF'}
        </button>
        <button
          className="text-button"
          onClick={() => {
            video.current?.pause();
            onCapture(capture);
          }}
        >
          분석·공유 <ChevronRight size={15} />
        </button>
      </div>
    </section>
  );
}
