import { lazy, Suspense, useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, LockKeyhole, Trash2 } from 'lucide-react';
import AscendBottomNav from '../../components/AscendBottomNav';
import type { Plan, Session } from '../../types';
import { readMedia } from '../../services/local';
import { getExercise } from '../../features/exercise-tracking/exercises';
import { RangeChart, TimelineChart } from '../../components/Charts';
import { VideoOverlay } from '../../components/VideoOverlay';
import Modal from '../../components/Modal';
import { formatDate } from '../../utils/date';
import { previousSession } from '../../features/record-comparison/compare';

const PoseKeyframeReview = lazy(() => import('../../components/PoseKeyframeReview'));

function Difference({ value, unit = '°' }: { value: number; unit?: string }) {
  const rounded = Math.round(value * 10) / 10;
  return (
    <span className={`feedback-change ${rounded > 0 ? 'positive' : rounded < 0 ? 'negative' : ''}`}>
      {rounded > 0 ? '+' : ''}
      {rounded}
      {unit}
    </span>
  );
}

export default function SessionDetail({
  session,
  sessions,
  plan,
  userId,
  busy,
  onClose,
  onDelete,
  onShare,
  onRemoveVideo,
}: {
  session: Session;
  sessions: Session[];
  plan?: Plan;
  userId: string;
  busy: boolean;
  onClose: () => void;
  onDelete: () => void;
  onShare: () => void;
  onRemoveVideo: () => void;
}) {
  const [url, setUrl] = useState('');
  const [confirm, setConfirm] = useState(false);
  const [view, setView] = useState<'video' | '3d'>('video');
  const previous = previousSession(session, sessions);
  const exercise = getExercise(session.exerciseId);
  const target = plan?.targetAngle ?? (exercise.id === 'knee' ? 175 : undefined);
  const targetProgress = target ? Math.min(100, (session.analysis.max / target) * 100) : 0;
  const improvement = previous ? session.analysis.range - previous.analysis.range : 0;
  const recentDays = new Set(
    sessions
      .filter((item) => Date.now() - new Date(item.recordedAt).getTime() < 7 * 86400000)
      .map((item) => new Date(item.recordedAt).toDateString()),
  ).size;
  const weeklyTarget = plan?.days?.length ?? 5;

  useEffect(() => {
    let active = true;
    let objectUrl = '';
    setUrl('');
    if (session.mediaId)
      readMedia(userId, session.mediaId).then((blob) => {
        if (blob && active) {
          objectUrl = URL.createObjectURL(blob);
          setUrl(objectUrl);
        }
      });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [session.mediaId, userId]);

  return (
    <Modal title="피드백" wide onClose={onClose}>
      <div className="feedback-page">
        <header className="feedback-page-header">
          <button type="button" aria-label="피드백 닫기" onClick={onClose}>
            <ArrowLeft />
          </button>
          <div>
            <h1>피드백</h1>
            <p>
              {exercise.name} · {exercise.cameraDirection} ·{' '}
              {session.side === 'left' ? '왼쪽' : '오른쪽'} · {formatDate(session.recordedAt)}
            </p>
          </div>
        </header>

        <section className="ascend-card feedback-compare-card">
          <h3>이전 기록과 비교</h3>
          <div className="feedback-table feedback-table-head">
            <span>지표</span>
            <span>오늘</span>
            <span>{previous ? formatDate(previous.recordedAt) : '이전'}</span>
            <span>변화</span>
          </div>
          {(
            [
              ['굴곡 각도', session.analysis.min, previous?.analysis.min],
              ['신전 각도', session.analysis.max, previous?.analysis.max],
              ['움직임 범위', session.analysis.range, previous?.analysis.range],
            ] as const
          ).map(([label, current, before]) => (
            <div className="feedback-table" key={label}>
              <strong>{label}</strong>
              <b>{current.toFixed(0)}°</b>
              <span>{before === undefined ? '—' : `${before.toFixed(0)}°`}</span>
              {before === undefined ? (
                <span className="feedback-change">—</span>
              ) : (
                <Difference value={current - before} />
              )}
            </div>
          ))}
          <div className="feedback-table">
            <strong>반복 횟수</strong>
            <b>{session.analysis.repetitions ?? '—'}회</b>
            <span>{previous?.analysis.repetitions ?? '—'}회</span>
            {previous?.analysis.repetitions == null || session.analysis.repetitions == null ? (
              <span className="feedback-change">—</span>
            ) : (
              <Difference
                value={session.analysis.repetitions - previous.analysis.repetitions}
                unit="회"
              />
            )}
          </div>
        </section>

        <section className="ascend-card feedback-progress-card">
          <h3>목표 대비</h3>
          {target && (
            <div className="feedback-progress-row">
              <div>
                <span>신전 각도</span>
                <strong>
                  {session.analysis.max.toFixed(0)}° <small>/ {target}°</small>
                </strong>
              </div>
              <div className="goal-progress">
                <i style={{ width: `${targetProgress}%` }} />
              </div>
            </div>
          )}
          <div className="feedback-progress-row">
            <div>
              <span>이번 주 재활 활동</span>
              <strong>
                {recentDays}일 <small>/ {weeklyTarget}일</small>
              </strong>
            </div>
            <div className="goal-progress">
              <i style={{ width: `${Math.min(100, (recentDays / weeklyTarget) * 100)}%` }} />
            </div>
          </div>
        </section>

        <section className="ascend-card feedback-trend-card">
          <div>
            <span>신전 각도 추이(최근 5회)</span>
            <strong>
              {previous
                ? `움직임 범위가 이전보다 ${Math.abs(improvement).toFixed(0)}° ${improvement >= 0 ? '넓어졌어요.' : '줄었어요.'}`
                : '첫 기록이 저장되었어요.'}
            </strong>
          </div>
          <RangeChart current={session} sessions={sessions} />
        </section>

        <section className="feedback-media-card">
          <div className="feedback-tabs" role="tablist" aria-label="피드백 보기 방식">
            <button
              type="button"
              className={view === 'video' ? 'selected' : ''}
              onClick={() => setView('video')}
            >
              내 영상
            </button>
            <button
              type="button"
              className={view === '3d' ? 'selected' : ''}
              onClick={() => setView('3d')}
            >
              3D 자세 비교
            </button>
          </div>
          {view === 'video' ? (
            url ? (
              <VideoOverlay
                url={url}
                exercise={exercise}
                side={session.side}
                mirrored={session.mirrored ?? false}
                frames={session.analysis.frames}
              />
            ) : (
              <div className="feedback-video-empty">
                <LockKeyhole /> 원본 영상은 이 기기에 저장되어 있지 않습니다. 3D 자세 비교는 사용할
                수 있습니다.
              </div>
            )
          ) : (
            <Suspense
              fallback={<div className="feedback-video-empty">3D 키프레임을 준비하고 있어요…</div>}
            >
              <PoseKeyframeReview session={session} exercise={exercise} targetAngle={target} />
            </Suspense>
          )}
        </section>

        <details className="feedback-timeline">
          <summary>프레임별 각도 자세히 보기</summary>
          <TimelineChart session={session} />
        </details>
        <p className="ascend-disclaimer">측정값은 2D 영상 기준 참고용이며 진단이 아니에요.</p>
        <button type="button" className="ascend-primary feedback-record-button" onClick={onClose}>
          기록에서 자세히 보기
        </button>
        <div className="button-row feedback-actions">
          <button className="primary" onClick={onShare}>
            선택 공유 <ArrowRight size={16} />
          </button>
          {url && (
            <button className="secondary" onClick={onRemoveVideo} disabled={busy}>
              원본 영상만 삭제
            </button>
          )}
          <button className="text-button danger-text" onClick={() => setConfirm(true)}>
            <Trash2 size={16} /> 기록 삭제
          </button>
        </div>
        {confirm && (
          <div className="delete-confirm">
            <span>기록과 이 기기에 보관된 영상을 삭제할까요?</span>
            <button className="danger-text text-button" disabled={busy} onClick={onDelete}>
              삭제
            </button>
            <button className="text-button" onClick={() => setConfirm(false)}>
              취소
            </button>
          </div>
        )}
        <AscendBottomNav active="records" />
      </div>
    </Modal>
  );
}
