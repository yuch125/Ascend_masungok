import { ArrowUpRight, History } from 'lucide-react';
import type { Session } from '../types';
import { previousSession } from '../features/record-comparison/compare';
import SessionThumbnail from './SessionThumbnail';
import { formatDate } from '../utils/date';

export default function RecordComparison({
  current,
  sessions,
  userId,
  onDetail,
}: {
  current: Session;
  sessions: Session[];
  userId: string;
  onDetail: (session: Session) => void;
}) {
  const previous = previousSession(current, sessions);
  if (!previous)
    return (
      <div className="comparison-first-record">
        <History size={22} />
        <div>
          <strong>나의 첫 번째 움직임이에요</strong>
          <p>같은 운동을 한 번 더 기록하면 영상과 측정값을 나란히 볼 수 있어요.</p>
        </div>
      </div>
    );
  const delta = current.analysis.range - previous.analysis.range;
  return (
    <section className="record-comparison">
      <div className="section-heading">
        <h2>지난 기록과 비교해요</h2>
        <span className="comparison-change">
          {delta > 0 ? '+' : ''}
          {delta.toFixed(1)}°
        </span>
      </div>
      <div className="comparison-videos">
        {[
          { session: previous, label: '이전 기록' },
          { session: current, label: '최근 기록' },
        ].map(({ session, label }) => (
          <button key={session.id} onClick={() => onDetail(session)}>
            <SessionThumbnail session={session} userId={userId} />
            <div>
              <span>{label}</span>
              <small>{formatDate(session.recordedAt)}</small>
            </div>
            <strong>{session.analysis.range.toFixed(1)}°</strong>
            <p>
              관측 각도 범위 <ArrowUpRight size={12} />
            </p>
          </button>
        ))}
      </div>
      <p className="comparison-note">
        같은 운동·측정 관절·촬영 방향의 기록이에요. 각도 변화가 의학적 회복을 뜻하지는 않습니다.
      </p>
    </section>
  );
}
