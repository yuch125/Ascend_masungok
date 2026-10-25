import { describe, expect, it } from 'vitest';
import { comparable, previousSession, seriesFor } from './compare';
import type { Session } from '../../types';
const session: Session = {
  id: 'a',
  exerciseId: 'knee',
  recordedAt: '2026-10-24T00:00:00Z',
  duration: 5,
  side: 'left',
  cameraDirection: '측면',
  version: 'v1',
  analysis: {
    min: 60,
    max: 120,
    range: 60,
    validRatio: 1,
    validFrames: 50,
    totalFrames: 50,
    repetitions: 2,
    frames: [],
  },
};
describe('comparison eligibility', () => {
  it('requires the same exercise, side, direction and algorithm', () => {
    expect(comparable(session, { ...session, id: 'b' })).toBe(true);
    for (const change of [
      { exerciseId: 'elbow' },
      { side: 'right' as const },
      { cameraDirection: '정면' },
      { version: 'v2' },
    ])
      expect(comparable(session, { ...session, ...change })).toBe(false);
  });
  it('uses the latest earlier compatible session and excludes itself', () => {
    const old = { ...session, id: 'old', recordedAt: '2026-10-22T00:00:00Z' };
    const future = { ...session, id: 'future', recordedAt: '2026-10-25T00:00:00Z' };
    expect(previousSession(session, [old, session, future])?.id).toBe('old');
    expect(previousSession(session, [session])).toBeUndefined();
  });
  it('does not duplicate the current session in charts', () => {
    expect(seriesFor(session, [session])).toHaveLength(1);
  });
});
