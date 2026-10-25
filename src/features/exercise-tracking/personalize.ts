import type { BodyArea, Exercise, SymptomProfile } from '../../types';
import { exercises } from './exercises';

export const bodyAreas: { id: BodyArea; name: string; hint: string }[] = [
  { id: 'knee', name: '무릎', hint: '걷기, 계단, 무릎 움직임' },
  { id: 'shoulder', name: '어깨', hint: '팔 들어 올리기, 어깨 움직임' },
  { id: 'elbow', name: '팔꿈치', hint: '팔 굽히기, 팔꿈치 움직임' },
  { id: 'other', name: '다른 부위', hint: '목, 허리, 손목 등' },
];

// Explicit keyword matching, not diagnosis, clinical suitability assessment or
// a generated prescription. Unsupported areas never receive a guessed program.
export function inferAreas(description: string): BodyArea[] {
  const areas: BodyArea[] = [];
  if (/무릎|knee/i.test(description)) areas.push('knee');
  if (/어깨|팔.{0,15}(들|올)|shoulder/i.test(description)) areas.push('shoulder');
  if (/팔꿈치|팔.{0,5}(굽|펴)|elbow/i.test(description)) areas.push('elbow');
  return areas;
}

export function matchedExercises(profile: SymptomProfile): Exercise[] {
  const supported = profile.areas.filter((area) => area !== 'other');
  return exercises.filter((exercise) => supported.some((area) => area === exercise.id));
}
