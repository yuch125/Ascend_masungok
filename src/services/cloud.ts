import { createClient } from '@supabase/supabase-js';
import type { AppData, Post } from '../types';
import { emptyData } from './local';
import { bodyOnlyData } from '../features/pose-analysis/bodyLandmarks';
const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
export const supabase = url && key ? createClient(url, key) : null;
function check(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}
export async function loadCloud(): Promise<AppData> {
  if (!supabase) return emptyData();
  const result = await supabase.rpc('load_private_data_v2');
  check(result.error);
  const initial = emptyData();
  return bodyOnlyData({
    ...initial,
    ...result.data,
    symptoms: result.data?.symptoms ?? null,
    preferences: { ...initial.preferences, ...result.data?.preferences },
    plans: result.data?.plans?.length ? result.data.plans : initial.plans,
    posts: await loadPosts(),
  });
}
export async function saveCloud(data: AppData) {
  if (!supabase) return;
  data = bodyOnlyData(data);
  const result = await supabase.rpc('sync_private_data_v2', {
    goals_data: data.goals,
    plans_data: data.plans,
    sessions_data: data.sessions.map((s) => ({ ...s, mediaId: undefined })),
    display_name: data.nickname,
    settings_data: { symptoms: data.symptoms, preferences: data.preferences },
  });
  check(result.error);
}
export async function loadPosts(): Promise<Post[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('community_posts')
    .select('*, comments(*), likes(user_id)')
    .order('created_at', { ascending: false });
  check(error);
  return (data ?? []).map((row) => ({
    id: row.id,
    userId: row.user_id,
    nickname: row.nickname,
    content: row.content,
    createdAt: row.created_at,
    shared: row.shared_data,
    mediaId: row.media_url ?? undefined,
    mediaType: row.media_type ?? undefined,
    likes: row.likes.map((l: { user_id: string }) => l.user_id),
    comments: row.comments.map((c: Record<string, string>) => ({
      id: c.id,
      userId: c.user_id,
      nickname: c.nickname,
      content: c.content,
      createdAt: c.created_at,
    })),
  }));
}
export async function createCloudPost(post: Post, media?: Blob) {
  if (!supabase) return;
  let path: string | undefined;
  try {
    if (media) {
      path = `${post.userId}/${post.id}`;
      const result = await supabase.storage
        .from('community-media')
        .upload(path, media, { contentType: media.type });
      check(result.error);
    }
    const result = await supabase.from('community_posts').insert({
      id: post.id,
      user_id: post.userId,
      nickname: post.nickname,
      content: post.content,
      shared_data: post.shared,
      media_url: path,
      media_type: media?.type,
    });
    check(result.error);
  } catch (error) {
    if (path) await supabase.storage.from('community-media').remove([path]);
    throw error;
  }
}
export async function deleteCloudPost(post: Post) {
  if (!supabase) return;
  if (post.mediaId) {
    const removed = await supabase.storage.from('community-media').remove([post.mediaId]);
    check(removed.error);
  }
  const result = await supabase.from('community_posts').delete().eq('id', post.id);
  check(result.error);
}
export async function toggleCloudLike(post: Post, userId: string) {
  if (!supabase) return;
  const result = post.likes.includes(userId)
    ? await supabase.from('likes').delete().eq('post_id', post.id).eq('user_id', userId)
    : await supabase.from('likes').insert({ post_id: post.id, user_id: userId });
  check(result.error);
}
export async function addCloudComment(postId: string, comment: Post['comments'][number]) {
  if (!supabase) return;
  const result = await supabase.from('comments').insert({
    id: comment.id,
    post_id: postId,
    user_id: comment.userId,
    nickname: comment.nickname,
    content: comment.content,
  });
  check(result.error);
}
export async function cloudMediaUrl(path: string) {
  if (!supabase) return '';
  const { data, error } = await supabase.storage.from('community-media').createSignedUrl(path, 600);
  check(error);
  return data?.signedUrl ?? '';
}
