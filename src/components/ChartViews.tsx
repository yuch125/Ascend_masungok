import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import EmptyChart from './EmptyChart';
import { exercises } from '../features/exercise-tracking/exercises';
import type { Session } from '../types';
import { seriesFor } from '../features/record-comparison/compare';
export function RangeChart({ current, sessions }: { current: Session; sessions: Session[] }) {
  const data = seriesFor(current, sessions);
  if (data.length < 2) return <EmptyChart text="다음 기록부터 변화를 비교할 수 있어요" />;
  return (
    <div className="chart">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ left: -25, right: 15, top: 15, bottom: 0 }}>
          <defs>
            <linearGradient id="rangeFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#39ac96" stopOpacity={0.22} />
              <stop offset="100%" stopColor="#39ac96" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#e7eeea" />
          <XAxis
            dataKey="date"
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11, fill: '#80928c' }}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            unit="°"
            tick={{ fontSize: 11, fill: '#80928c' }}
          />
          <Tooltip formatter={(value) => [`${value}°`, '관측 각도 범위']} />
          <Area
            type="linear"
            dataKey="range"
            stroke="#189d88"
            strokeWidth={2.5}
            fill="url(#rangeFill)"
            dot={{ r: 4, fill: 'white', strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
export function TimelineChart({ session }: { session: Session }) {
  const data = session.analysis.frames.map((f) => ({
    time: +f.time.toFixed(1),
    angle: f.angle === null ? null : +f.angle.toFixed(1),
  }));
  return (
    <div className="chart">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ left: -25, right: 15 }}>
          <CartesianGrid strokeDasharray="4 4" vertical={false} />
          <XAxis dataKey="time" unit="초" minTickGap={30} tick={{ fontSize: 11 }} />
          <YAxis domain={[0, 180]} unit="°" tick={{ fontSize: 11 }} />
          <Tooltip formatter={(v) => [`${v}°`, '각도']} />
          <Area
            dataKey="angle"
            stroke="#189d88"
            fill="#e2f3ed"
            connectNulls={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
export function WeeklyChart({ sessions }: { sessions: Session[] }) {
  const data = Array.from({ length: 7 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - 6 + i);
    return {
      day: date.toLocaleDateString('ko-KR', { weekday: 'short' }),
      count: sessions.filter((s) => new Date(s.recordedAt).toDateString() === date.toDateString())
        .length,
    };
  });
  return (
    <div className="chart small">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 11 }} />
          <YAxis allowDecimals={false} hide />
          <Tooltip formatter={(v) => [`${v}회`, '기록']} />
          <Bar dataKey="count" fill="#49b69d" radius={[5, 5, 0, 0]} maxBarSize={24} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ExerciseCountChart({ sessions }: { sessions: Session[] }) {
  const data = exercises.map((e) => ({
    name: e.bodyPart,
    count: sessions.filter((s) => s.exerciseId === e.id).length,
  }));
  return (
    <div className="chart small">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ left: 0, right: 20 }}>
          <XAxis type="number" allowDecimals={false} />
          <YAxis dataKey="name" type="category" width={60} tick={{ fontSize: 11 }} />
          <Tooltip formatter={(v) => [`${v}회`, '기록']} />
          <Bar dataKey="count" fill="#8cb7a2" radius={[0, 5, 5, 0]} maxBarSize={25} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
