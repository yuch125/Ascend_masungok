import { openDB } from 'idb';
import { defaultPlans } from '../features/exercise-tracking/exercises';
import type { AppData } from '../types';
import { bodyOnlyData } from '../features/pose-analysis/bodyLandmarks';
const db = openDB('remove-private-v1', 1, {
  upgrade(database) {
    database.createObjectStore('data');
    database.createObjectStore('media');
  },
});
export const emptyData = (): AppData => ({
  captures: [],
  symptoms: null,
  preferences: { saveOriginal: true },
  goals: [],
  plans: structuredClone(defaultPlans),
  sessions: [],
  posts: [],
  nickname: '무브',
});
export async function readData(user: string): Promise<AppData> {
  const stored = await (await db).get('data', user);
  const initial = emptyData();
  const restored = {
    ...initial,
    ...stored,
    preferences: { ...initial.preferences, ...stored?.preferences },
  };
  const cleaned = bodyOnlyData(restored);
  if (stored && cleaned !== restored) await (await db).put('data', cleaned, user);
  return cleaned;
}
export async function writeData(user: string, data: AppData) {
  await (await db).put('data', bodyOnlyData(data), user);
}
export async function saveMedia(user: string, id: string, blob: Blob) {
  await (await db).put('media', blob, `${user}/${id}`);
}
export async function readMedia(user: string, id: string): Promise<Blob | undefined> {
  return (await db).get('media', `${user}/${id}`);
}
export async function deleteMedia(user: string, id: string) {
  await (await db).delete('media', `${user}/${id}`);
}
