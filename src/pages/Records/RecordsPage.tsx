import { useState } from 'react';
import {
  Activity,
  ArrowDownToLine,
  ArrowRight,
  Camera,
  ChevronRight,
  ClipboardList,
} from 'lucide-react';
import type { CaptureRecord, Session } from '../../types';
import { exercises, getExercise } from '../../features/exercise-tracking/exercises';
import { EmptyChart, ExerciseCountPanel, RangeChart, WeeklyChart } from '../../components/Charts';
import SessionThumbnail from '../../components/SessionThumbnail';
import RecordComparison from '../../components/RecordComparison';
import { duration, formatDate } from '../../utils/date';

export default function RecordsPage({
  sessions,
  onDetail,
  onStart,
  onExport,
  userId,
  captures = [],
  onCapture,
}: {
  sessions: Session[];
  onDetail: (session: Session) => void;
  onStart: () => void;
  onExport: () => void;
  userId: string;
  captures?: CaptureRecord[];
  onCapture?: (capture: CaptureRecord) => void;
}) {
  const [filter, setFilter] = useState('all');
  const filtered = [...sessions]
    .filter((s) => filter === 'all' || s.exerciseId === filter)
    .sort((a, b) => b.recordedAt.localeCompare(a.recordedAt));
  const raw = captures.filter((capture) => !sessions.some((session) => session.id === capture.id));
  const pending = raw
    .filter((capture) => filter === 'all' || capture.exerciseId === filter)
    .sort((a, b) => b.recordedAt.localeCompare(a.recordedAt));
  const all = [...sessions, ...raw];
  const days = new Set(all.map((s) => new Date(s.recordedAt).toDateString())).size;
  return (
    <div className="records-page">
      <div className="tab-page-heading">
        <h1>
          내 기록<span>.</span>
        </h1>
      </div>
      <div className="record-summary">
        <section className="card">
          <span>운동 기록</span>
          <strong>
            {all.length}
            <small>개</small>
          </strong>
        </section>
        <section className="card">
          <span>움직인 날</span>
          <strong>
            {days}
            <small>일</small>
          </strong>
        </section>
        <section className="card">
          <span>기록 시간</span>
          <strong>
            {Math.round(all.reduce((sum, s) => sum + s.duration, 0) / 60)}
            <small>분</small>
          </strong>
        </section>
      </div>
      <div className="filter-tabs">
        {[{ id: 'all', name: '전체' }, ...exercises].map((ex) => (
          <button
            key={ex.id}
            className={filter === ex.id ? 'selected' : ''}
            onClick={() => setFilter(ex.id)}
          >
            {ex.name}
          </button>
        ))}
      </div>
      {filtered[0] && (
        <RecordComparison
          current={filtered[0]}
          sessions={sessions}
          userId={userId}
          onDetail={onDetail}
        />
      )}
      <section className="card">
        <div className="section-heading">
          <h2>움직임의 변화</h2>
          <Activity size={18} />
        </div>
        {filtered[0] ? (
          <>
            <p className="micro">
              {getExercise(filtered[0].exerciseId).name} ·{' '}
              {filtered[0].side === 'left' ? '왼쪽' : '오른쪽'} · {filtered[0].cameraDirection}
              <br />
              같은 분석 버전과 촬영 방향의 기록을 비교해요.
            </p>
            <RangeChart current={filtered[0]} sessions={sessions} />
          </>
        ) : (
          <EmptyChart />
        )}
      </section>
      <div className="section-heading section-spaced">
        <h2>영상 · 분석 기록</h2>
        <button className="text-button" onClick={onExport}>
          <ArrowDownToLine size={16} /> 내보내기
        </button>
      </div>
      {pending.map((capture) => (
        <button
          key={capture.id}
          className="card session-row raw-record-row"
          onClick={() => onCapture?.(capture)}
        >
          <SessionThumbnail session={capture} userId={userId} />
          <div>
            <span className="micro">{formatDate(capture.recordedAt)}</span>
            <h3>{getExercise(capture.exerciseId).name}</h3>
            <p>{capture.status === 'failed' ? '분석 다시 확인' : '분석 대기'} · 촬영 영상</p>
          </div>
          <ChevronRight size={18} />
        </button>
      ))}
      {filtered.length ? (
        <div className="session-list">
          {filtered.map((session) => (
            <button className="card session-row" key={session.id} onClick={() => onDetail(session)}>
              <SessionThumbnail session={session} userId={userId} />
              <div>
                <span className="micro">
                  {formatDate(session.recordedAt)} · {duration(session.duration)}
                </span>
                <h3>{getExercise(session.exerciseId).name}</h3>
                <p>
                  {session.side === 'left' ? '왼쪽' : '오른쪽'} ·{' '}
                  {session.mediaId ? (
                    <>
                      <Camera size={11} /> 영상 보관됨
                    </>
                  ) : (
                    '분석 기록'
                  )}
                </p>
              </div>
              <div className="session-range">
                <strong>{session.analysis.range.toFixed(1)}°</strong>
                <span>관측 각도 범위</span>
              </div>
              <ChevronRight size={18} />
            </button>
          ))}
        </div>
      ) : pending.length ? null : (
        <section className="card empty-state">
          <ClipboardList size={32} />
          <h3>첫 기록을 기다리고 있어요</h3>
          <p>
            운동을 촬영하고 분석을 저장하면
            <br />
            이곳에서 영상과 측정값을 다시 볼 수 있어요.
          </p>
          <button className="primary" onClick={onStart}>
            운동 고르러 가기 <ArrowRight size={16} />
          </button>
        </section>
      )}
      <section className="card weekly-card">
        <h2>최근 7일의 꾸준함</h2>
        {sessions.length ? (
          <WeeklyChart sessions={sessions} />
        ) : (
          <EmptyChart text="꾸준한 움직임을 쌓아가요" />
        )}
      </section>
      <ExerciseCountPanel sessions={sessions} />
    </div>
  );
}
