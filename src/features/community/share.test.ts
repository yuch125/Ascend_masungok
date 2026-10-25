import { describe, expect, it } from 'vitest';
import { buildSharedRecord } from './share';
import type { Session } from '../../types';
const fixture: Session = {
  id: 'test-only',
  exerciseId: 'knee',
  recordedAt: '2026-10-24T00:00:00Z',
  duration: 5,
  side: 'left',
  cameraDirection: '측면',
  version: 'v1',
  mediaId: 'never-share-this',
  analysis: {
    min: 60,
    max: 120,
    range: 60,
    validFrames: 50,
    totalFrames: 50,
    validRatio: 1,
    repetitions: 2,
    frames: [],
  },
};
describe('explicit share projection', () => {
  it('shares nothing by default and never leaks private session fields', () => {
    expect(buildSharedRecord(fixture, [], [])).toEqual({});
    expect(buildSharedRecord(undefined, [], ['name', 'range'])).toEqual({});
    const shared = buildSharedRecord(fixture, [], ['name', 'range']);
    expect(shared).toEqual({ exerciseName: '무릎 굽혔다 펴기', range: 60 });
    expect(shared).not.toHaveProperty('mediaId');
    expect(shared).not.toHaveProperty('side');
    expect(shared).not.toHaveProperty('frames');
  });
  it('does not invent a comparison when a compatible previous record is missing', () => {
    expect(
      buildSharedRecord(
        fixture,
        [{ ...fixture, id: 'older', side: 'right', recordedAt: '2026-10-22T00:00:00Z' }],
        ['difference'],
      ),
    ).toEqual({});
    expect(
      buildSharedRecord(
        fixture,
        [
          {
            ...fixture,
            id: 'older',
            recordedAt: '2026-10-22T00:00:00Z',
            analysis: { ...fixture.analysis, range: 55 },
          },
        ],
        ['difference'],
      ),
    ).toEqual({ difference: 5 });
  });
});
