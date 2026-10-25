import type { Session, SharedRecord } from '../../types';
import { getExercise } from '../exercise-tracking/exercises';
import { previousSession } from '../record-comparison/compare';
export function buildSharedRecord(
  session: Session | undefined,
  sessions: Session[],
  choices: string[],
): SharedRecord {
  if (!session) return {};
  const shared: SharedRecord = {},
    previous = previousSession(session, sessions);
  if (choices.includes('name')) shared.exerciseName = getExercise(session.exerciseId).name;
  if (choices.includes('date')) shared.date = session.recordedAt;
  if (choices.includes('range')) shared.range = +session.analysis.range.toFixed(1);
  if (choices.includes('difference') && previous)
    shared.difference = +(session.analysis.range - previous.analysis.range).toFixed(1);
  return shared;
}
