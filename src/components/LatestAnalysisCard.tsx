import { useEffect, useRef, useState } from 'react';
import { Activity, ArrowRight, ChevronRight, Film, ScanLine } from 'lucide-react';
import type { Session } from '../types';
import { getExercise } from '../features/exercise-tracking/exercises';
import { readMedia } from '../services/local';
import { duration, formatDate } from '../utils/date';
import { VideoOverlay } from './VideoOverlay';

export default function LatestAnalysisCard({
  session,
  userId,
  onDetail,
  onRecords,
  onStart,
}: {
  session?: Session;
  userId: string;
  onDetail: (session: Session) => void;
  onRecords: () => void;
  onStart: () => void;
}) {
  const [url, setUrl] = useState(''),
    [loading, setLoading] = useState(false),
    [overlay, setOverlay] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    let active = true,
      objectUrl = '';
    setUrl('');
    setOverlay(true);
    if (!session?.mediaId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    readMedia(userId, session.mediaId)
      .then((blob) => {
        if (blob && active) {
          objectUrl = URL.createObjectURL(blob);
          setUrl(objectUrl);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [session?.id, session?.mediaId, userId]);
  if (!session)
    return (
      <section className="latest-analysis latest-analysis-empty">
        <div className="section-heading">
          <h2>최근 영상 분석</h2>
          <ScanLine size={18} />
        </div>
        <div>
          <span>
            <Film size={25} />
          </span>
          <h3>나의 움직임을 영상으로 남겨요</h3>
          <p>
            운동을 촬영하고 분석을 저장하면
            <br />
            관절과 각도를 표시한 최신 영상을 홈에서 볼 수 있어요.
          </p>
          <button className="secondary" onClick={onStart}>
            첫 영상 분석하기 <ArrowRight size={15} />
          </button>
        </div>
      </section>
    );
  const exercise = getExercise(session.exerciseId);
  return (
    <section className="latest-analysis" aria-label="가장 최근 운동 영상 분석">
      <div className="section-heading">
        <div>
          <h2>최근 촬영</h2>
          <p>
            {exercise.name} · {formatDate(session.recordedAt)} · {duration(session.duration)}
          </p>
        </div>
        <button className="text-button" onClick={onRecords}>
          전체 보기 <ChevronRight size={14} />
        </button>
      </div>
      {loading ? (
        <div className="latest-video-missing" role="status">
          <ScanLine size={25} />
          <p>저장한 영상을 불러오고 있어요.</p>
        </div>
      ) : url ? (
        <>
          <VideoOverlay
            key={session.id}
            url={url}
            exercise={exercise}
            side={session.side}
            mirrored={session.mirrored ?? false}
            frames={overlay ? session.analysis.frames : []}
            videoRef={videoRef}
          />
          <div className="latest-overlay-toolbar">
            <span>
              <i /> 관절 위치 · 연결선 · 각도
            </span>
            <button
              role="switch"
              aria-checked={overlay}
              aria-label="분석 표시"
              onClick={() => setOverlay((value) => !value)}
            >
              관절 표시 {overlay ? 'ON' : 'OFF'}
            </button>
          </div>
        </>
      ) : (
        <div className="latest-video-missing">
          <Film size={25} />
          <strong>이 기기에 원본 영상이 없어요</strong>
          <p>
            분석 결과는 아래에서 확인할 수 있어요.
            <br />
            다음 기록에서 원본 영상 보관을 선택하면 홈에서 재생할 수 있어요.
          </p>
        </div>
      )}
      <div className="latest-measurements">
        <div>
          <span>최소 각도</span>
          <strong>
            {session.analysis.min.toFixed(1)}
            <small>°</small>
          </strong>
        </div>
        <div>
          <span>최대 각도</span>
          <strong>
            {session.analysis.max.toFixed(1)}
            <small>°</small>
          </strong>
        </div>
        <div>
          <span>관측 각도 범위</span>
          <strong>
            {session.analysis.range.toFixed(1)}
            <small>°</small>
          </strong>
        </div>
      </div>
      <div className="latest-analysis-footer">
        <span>
          <Activity size={13} />
          {session.side === 'left' ? '왼쪽' : '오른쪽'} {exercise.jointName} ·{' '}
          {session.cameraDirection} · 유효 프레임 {Math.round(session.analysis.validRatio * 100)}%
        </span>
        <button
          onClick={() => {
            videoRef.current?.pause();
            onDetail(session);
          }}
        >
          분석 자세히 <ChevronRight size={14} />
        </button>
      </div>
    </section>
  );
}
