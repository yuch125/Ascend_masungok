import { describe, expect, it } from 'vitest';
import type { SymptomProfile } from '../../types';
import { inferAreas, matchedExercises } from './personalize';
const profile: SymptomProfile = {
  description: '계단을 걸을 때 무릎이 불편해요.',
  areas: ['knee'],
  side: 'right',
  professionalGuidance: false,
  updatedAt: '2026-10-24T00:00:00Z',
};
describe('explicit body-area course matching', () => {
  it('recognizes supported body areas without inventing diagnoses', () => {
    expect(inferAreas('계단에서 무릎이 불편하고 어깨로 팔을 들어 올리기 어려워요')).toEqual([
      'knee',
      'shoulder',
    ]);
    expect(inferAreas('팔꿈치를 굽히기 어려워요')).toEqual(['elbow']);
    expect(inferAreas('허리가 불편해요')).toEqual([]);
    expect(inferAreas('발목이 아파서 계단을 내려가기 어려워요')).toEqual([]);
  });
  it('uses the user-confirmed areas instead of silently overriding them with text', () => {
    expect(matchedExercises(profile).map((e) => e.id)).toEqual(['knee']);
    expect(matchedExercises({ ...profile, areas: ['shoulder'] }).map((e) => e.id)).toEqual([
      'shoulder',
    ]);
  });
  it('does not prescribe a fallback for unsupported symptoms', () => {
    expect(matchedExercises({ ...profile, areas: ['other'] })).toEqual([]);
    expect(matchedExercises({ ...profile, areas: [] })).toEqual([]);
  });
});
