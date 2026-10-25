import { expect, it } from 'vitest';
import { sharedPostText } from './SharePostDialog';
import type { Post } from '../../types';
it('shares posted content and selected metrics without original media paths or profile information', () => {
  const post: Post = {
    id: 'post-test',
    userId: 'owner-test',
    nickname: '테스트',
    content: '오늘의 작은 한 걸음',
    createdAt: '2026-10-24T00:00:00Z',
    shared: { exerciseName: '무릎 굽혔다 펴기', range: 60 },
    mediaId: 'private-original-path',
    likes: [],
    comments: [],
  };
  const text = sharedPostText(post);
  expect(text).toContain('오늘의 작은 한 걸음');
  expect(text).toContain('60°');
  expect(text).not.toContain('private-original-path');
  expect(text).not.toContain('owner-test');
});
