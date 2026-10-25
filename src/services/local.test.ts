import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { emptyData, readData, writeData, saveMedia, readMedia, deleteMedia } from './local';
import { openDB } from 'idb';
describe('browser account separation and original video retention', () => {
  it('removes face coordinates from saved and legacy records while preserving measurements and videos', async () => {
    const database = await openDB('remove-private-v1', 1),
      data = emptyData();
    const points = Array.from({ length: 33 }, (_, index) => ({
      x: 0.5,
      y: 0.5,
      z: index,
      visibility: 1,
    }));
    const frames = [{ time: 0, angle: 90, landmarks: points }];
    data.sessions = [
      {
        id: 'body-only-record',
        exerciseId: 'knee',
        recordedAt: '2026-10-24',
        duration: 1,
        side: 'left',
        cameraDirection: '측면',
        version: '2d-projected-v1',
        mediaId: 'original',
        analysis: {
          min: 90,
          max: 90,
          range: 0,
          validRatio: 1,
          validFrames: 1,
          totalFrames: 1,
          repetitions: 0,
          frames,
        },
      },
    ];
    data.captures = [
      {
        id: 'body-only-record',
        exerciseId: 'knee',
        recordedAt: '2026-10-24',
        duration: 1,
        side: 'left',
        cameraDirection: '측면',
        status: 'ready',
        mediaId: 'original',
        frames,
      },
    ];
    await database.put('data', data, 'legacy-face-records');
    const restored = await readData('legacy-face-records');
    for (const recordFrames of [
      restored.sessions[0].analysis.frames,
      restored.captures[0].frames!,
    ]) {
      expect(recordFrames[0].landmarks.slice(0, 11)).toEqual(Array(11).fill(null));
      expect(recordFrames[0].landmarks[25]).toEqual(points[25]);
    }
    expect(restored.sessions[0].mediaId).toBe('original');
    expect(restored.sessions[0].analysis.min).toBe(90);
    const migrated = await database.get('data', 'legacy-face-records');
    expect(migrated.sessions[0].analysis.frames[0].landmarks[0]).toBeNull();
    await writeData('new-face-records', data);
    const written = await database.get('data', 'new-face-records');
    expect(written.captures[0].frames[0].landmarks[10]).toBeNull();
    expect(data.sessions[0].analysis.frames[0].landmarks[0]).toEqual(points[0]);
  });
  it('preserves existing records while adding symptom and preference defaults', async () => {
    const database = await openDB('remove-private-v1', 1);
    const legacy = JSON.parse(JSON.stringify(emptyData()));
    delete legacy.symptoms;
    delete legacy.preferences;
    legacy.sessions = [
      {
        id: 'legacy-test-session',
        exerciseId: 'knee',
        recordedAt: '2026-10-24T00:00:00Z',
        duration: 1,
        side: 'left',
        cameraDirection: '측면',
        version: 'test-v1',
        mediaId: 'legacy-test-video',
        analysis: {
          min: 60,
          max: 120,
          range: 60,
          validRatio: 1,
          validFrames: 10,
          totalFrames: 10,
          repetitions: 1,
          frames: [],
        },
      },
    ];
    await database.put('data', legacy, 'legacy-account');
    await saveMedia(
      'legacy-account',
      'legacy-test-video',
      new Blob(['test-only'], { type: 'video/webm' }),
    );
    const restored = await readData('legacy-account');
    expect(restored.symptoms).toBeNull();
    expect(restored.preferences).toEqual({ saveOriginal: true });
    expect(restored.sessions[0].id).toBe('legacy-test-session');
    expect(await readMedia('legacy-account', 'legacy-test-video')).toBeDefined();
  });
  it('isolates account snapshots and originals and supports original deletion', async () => {
    const a = { ...emptyData(), nickname: 'Account A' },
      b = { ...emptyData(), nickname: 'Account B' };
    await writeData('account-a', a);
    await writeData('account-b', b);
    expect((await readData('account-a')).nickname).toBe('Account A');
    expect((await readData('account-b')).nickname).toBe('Account B');
    expect((await readData('local-demo')).nickname).toBe('무브');
    await saveMedia('account-a', 'private-video', new Blob(['test-only'], { type: 'video/webm' }));
    expect(await readMedia('account-a', 'private-video')).toBeDefined();
    expect(await readMedia('account-b', 'private-video')).toBeUndefined();
    await deleteMedia('account-a', 'private-video');
    expect(await readMedia('account-a', 'private-video')).toBeUndefined();
  });
});
