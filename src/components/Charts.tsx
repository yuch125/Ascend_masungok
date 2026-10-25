import { lazy, Suspense } from 'react';
import type { Session } from '../types';
import EmptyChart from './EmptyChart';
export { default as EmptyChart } from './EmptyChart';
const RangeView = lazy(() => import('./ChartViews').then((m) => ({ default: m.RangeChart })));
const TimelineView = lazy(() => import('./ChartViews').then((m) => ({ default: m.TimelineChart })));
const WeeklyView = lazy(() => import('./ChartViews').then((m) => ({ default: m.WeeklyChart })));
const ExerciseView = lazy(() =>
  import('./ChartViews').then((m) => ({ default: m.ExerciseCountChart })),
);
const fallback = (
  <div className="chart chart-loading" role="status">
    그래프를 준비하고 있어요…
  </div>
);
export function RangeChart(props: { current: Session; sessions: Session[] }) {
  return (
    <Suspense fallback={fallback}>
      <RangeView {...props} />
    </Suspense>
  );
}
export function TimelineChart(props: { session: Session }) {
  return (
    <Suspense fallback={fallback}>
      <TimelineView {...props} />
    </Suspense>
  );
}
export function WeeklyChart(props: { sessions: Session[] }) {
  return (
    <Suspense fallback={fallback}>
      <WeeklyView {...props} />
    </Suspense>
  );
}
export function ExerciseCountChart(props: { sessions: Session[] }) {
  return (
    <Suspense fallback={fallback}>
      <ExerciseView {...props} />
    </Suspense>
  );
}
export function ExerciseCountPanel({ sessions }: { sessions: Session[] }) {
  return (
    <section className="card exercise-count-chart">
      <div className="section-heading">
        <h2>운동별 수행 기록</h2>
      </div>
      {sessions.length ? (
        <ExerciseCountChart sessions={sessions} />
      ) : (
        <EmptyChart text="운동별 기록을 모아 볼 수 있어요" />
      )}
    </section>
  );
}
