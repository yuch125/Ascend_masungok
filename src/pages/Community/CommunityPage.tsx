import { Heart, Plus, RefreshCw, Users } from 'lucide-react';
import type { Post } from '../../types';
import PostCard from '../../features/community/PostCard';

export type FeedFilter = 'all' | 'video' | 'mine';
export default function CommunityPage({
  posts,
  userId,
  busy,
  filter,
  onFilter,
  onCompose,
  onRefresh,
  onLike,
  onComment,
  onDelete,
  onShare,
  focusedId,
}: {
  posts: Post[];
  userId: string;
  busy: boolean;
  filter: FeedFilter;
  onFilter: (filter: FeedFilter) => void;
  onCompose: () => void;
  onRefresh: () => void;
  onLike: (post: Post) => void;
  onComment: (post: Post, content: string) => Promise<boolean>;
  onDelete: (post: Post) => void;
  onShare: (post: Post) => void;
  focusedId?: string;
}) {
  const visible = posts
    .filter(
      (post) =>
        (!focusedId || post.id === focusedId) &&
        (filter !== 'mine' || post.userId === userId) &&
        (filter !== 'video' || post.mediaType?.startsWith('video/')),
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return (
    <div className="social-page">
      <div className="social-heading">
        <div>
          <h1>
            커뮤니티<span>✦</span>
          </h1>
        </div>
        <button
          className="icon-button"
          aria-label="피드 새로고침"
          onClick={onRefresh}
          disabled={busy}
        >
          <RefreshCw size={19} />
        </button>
      </div>
      <button className="social-compose" onClick={onCompose}>
        <span className="avatar">
          <Users size={19} />
        </span>
        <span>오늘의 운동, 어땠나요?</span>
        <Plus size={20} />
      </button>
      <div className="social-tabs">
        {[
          { id: 'all', name: '최신' },
          { id: 'video', name: '영상' },
          { id: 'mine', name: '내 글' },
        ].map((item) => (
          <button
            key={item.id}
            className={filter === item.id ? 'active' : ''}
            onClick={() => onFilter(item.id as FeedFilter)}
          >
            {item.name}
          </button>
        ))}
      </div>
      {userId === 'local-demo' && <p className="demo-notice">로컬 데모 · 이 기기에만 저장돼요.</p>}
      {focusedId && (
        <button className="text-button" onClick={() => onFilter('all')}>
          전체 피드로 돌아가기
        </button>
      )}
      {visible.length ? (
        visible.map((post) => (
          <PostCard
            key={post.id}
            post={post}
            userId={userId}
            busy={busy}
            onLike={() => onLike(post)}
            onComment={(text) => onComment(post, text)}
            onDelete={() => onDelete(post)}
            onShare={() => onShare(post)}
          />
        ))
      ) : (
        <section className="card empty-state">
          <div className="empty-heart">
            <Heart size={32} />
          </div>
          <h3>{focusedId ? '이 게시글을 볼 수 없어요' : '첫 번째 이야기를 기다려요'}</h3>
          <p>
            {focusedId
              ? '삭제되었거나 이 계정에서 접근할 수 없는 게시글이에요.'
              : '운동 영상, 작은 성취, 오늘의 마음을 나눠보세요.'}
          </p>
          <button className="primary" onClick={onCompose}>
            <Plus size={17} /> 이야기 나누기
          </button>
        </section>
      )}
      <button className="community-compose-fab" aria-label="게시글 작성" onClick={onCompose}>
        <Plus size={25} />
      </button>
    </div>
  );
}
