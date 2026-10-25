import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import type { Session } from '../types';
export default function Calendar({ sessions }: { sessions: Session[] }) {
  const [month, setMonth] = useState(
    () => new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  );
  const dates = new Set(sessions.map((s) => new Date(s.recordedAt).toLocaleDateString('sv-SE')));
  const today = new Date().toLocaleDateString('sv-SE');
  return (
    <div className="calendar">
      <div className="calendar-title">
        <strong>
          {month.getFullYear()}년 {month.getMonth() + 1}월
        </strong>
        <div>
          <button
            className="icon-button"
            aria-label="이전 달"
            onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
          >
            <ChevronLeft size={16} />
          </button>
          <button
            className="icon-button"
            aria-label="다음 달"
            onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
      <div className="calendar-grid">
        {'일월화수목금토'.split('').map((d) => (
          <span className="weekday" key={d}>
            {d}
          </span>
        ))}
        {Array.from({ length: month.getDay() }, (_, i) => (
          <span key={`space${i}`} />
        ))}
        {Array.from(
          { length: new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate() },
          (_, i) => {
            const date = new Date(month.getFullYear(), month.getMonth(), i + 1).toLocaleDateString(
              'sv-SE',
            );
            return (
              <span
                key={i}
                className={`day ${dates.has(date) ? 'recorded' : ''} ${date === today ? 'today' : ''}`}
              >
                {i + 1}
                {dates.has(date) && <i />}
              </span>
            );
          },
        )}
      </div>
      <div className="calendar-key">
        <i /> 운동을 기록한 날 <span className="today-key" /> 오늘
      </div>
    </div>
  );
}
