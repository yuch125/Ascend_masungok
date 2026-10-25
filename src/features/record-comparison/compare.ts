import type { Session } from '../../types';
export function comparable(a: Session, b: Session): boolean {
  return (
    a.exerciseId === b.exerciseId &&
    a.side === b.side &&
    a.version === b.version &&
    a.cameraDirection === b.cameraDirection
  );
}
export function previousSession(current: Session, sessions: Session[]): Session | undefined {
  return sessions
    .filter(
      (s) => s.id !== current.id && comparable(s, current) && s.recordedAt <= current.recordedAt,
    )
    .sort((a, b) => b.recordedAt.localeCompare(a.recordedAt))[0];
}
export function seriesFor(current: Session, sessions: Session[]) {
  return [...sessions.filter((s) => s.id !== current.id && comparable(s, current)), current]
    .sort((a, b) => a.recordedAt.localeCompare(b.recordedAt))
    .map((s) => ({
      date: new Date(s.recordedAt).toLocaleDateString('ko-KR', {
        month: 'numeric',
        day: 'numeric',
      }),
      range: +s.analysis.range.toFixed(1),
    }));
}
