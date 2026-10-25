import { useEffect, useState } from 'react';
import { Activity, Heart, MessageCircle, MoreHorizontal, Share2 } from 'lucide-react';
import type { Post } from '../../types';
import { readMedia } from '../../services/local';
import { cloudMediaUrl } from '../../services/cloud';
import { formatDate } from '../../utils/date';
export default function PostCard({
  post,
  userId,
  busy,
  onLike,
  onComment,
  onDelete,
  onShare,
}: {
  post: Post;
  userId: string;
  busy: boolean;
  onLike: () => void;
  onComment: (s: string) => Promise<boolean>;
  onDelete: () => void;
  onShare: () => void;
}) {
  const [showComments, setShowComments] = useState(false),
    [comment, setComment] = useState(''),
    [confirm, setConfirm] = useState(false),
    [mediaUrl, setMediaUrl] = useState('');
  useEffect(() => {
    let active = true,
      localUrl = '';
    if (post.mediaId) {
      (userId === 'local-demo'
        ? readMedia(userId, post.mediaId).then((blob) =>
            blob ? (localUrl = URL.createObjectURL(blob)) : '',
          )
        : cloudMediaUrl(post.mediaId)
      )
        .then((url) => {
          if (active) setMediaUrl(url);
          else if (localUrl) URL.revokeObjectURL(localUrl);
        })
        .catch(() => {});
    }
    return () => {
      active = false;
      if (localUrl) URL.revokeObjectURL(localUrl);
    };
  }, [post.mediaId, userId]);
  return (
    <article className="card post-card">
      <div className="post-header">
        <div className="avatar">{post.nickname.slice(0, 1)}</div>
        <div>
          <h3>{post.nickname}</h3>
          <span>
            {formatDate(post.createdAt)} ·{' '}
            {new Date(post.createdAt).toLocaleTimeString('ko-KR', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
        </div>
        {post.userId === userId && (
          <button
            className="icon-button"
            aria-label="게시글 삭제"
            onClick={() => setConfirm(!confirm)}
          >
            <MoreHorizontal size={20} />
          </button>
        )}
      </div>
      {confirm && (
        <div className="delete-confirm">
          <span>이 게시글을 삭제할까요?</span>
          <button className="text-button danger-text" disabled={busy} onClick={onDelete}>
            삭제
          </button>
          <button className="text-button muted" onClick={() => setConfirm(false)}>
            취소
          </button>
        </div>
      )}
      <p className="post-content">{post.content}</p>
      {Object.keys(post.shared).length > 0 && (
        <div className="shared-record">
          <Activity size={21} />
          <div>
            {post.shared.exerciseName && <strong>{post.shared.exerciseName}</strong>}
            {post.shared.date && <span>{formatDate(post.shared.date)}</span>}
            {post.shared.range !== undefined && <span>관측 각도 범위 {post.shared.range}°</span>}
            {post.shared.difference !== undefined && (
              <span>
                이전 기록과 {post.shared.difference > 0 ? '+' : ''}
                {post.shared.difference}° 차이
              </span>
            )}
          </div>
          <span className="pill">직접 선택한 기록</span>
        </div>
      )}
      {mediaUrl &&
        (post.mediaType?.startsWith('video/') ? (
          <video className="post-media" src={mediaUrl} controls playsInline />
        ) : (
          <img className="post-media" src={mediaUrl} alt="게시자가 직접 공유한 이미지" />
        ))}
      <div className="post-actions">
        <button onClick={() => setShowComments(!showComments)}>
          <MessageCircle size={19} /> 댓글 {post.comments.length || ''}
        </button>
        <button
          className={post.likes.includes(userId) ? 'liked' : ''}
          disabled={busy}
          onClick={onLike}
        >
          <Heart size={19} fill={post.likes.includes(userId) ? 'currentColor' : 'none'} /> 좋아요{' '}
          {post.likes.length || ''}
        </button>
        <button onClick={onShare}>
          <Share2 size={19} /> 공유
        </button>
      </div>
      {showComments && (
        <div className="comments">
          {post.comments.map((c) => (
            <div className="comment" key={c.id}>
              <div className="avatar">{c.nickname.slice(0, 1)}</div>
              <p>
                <strong>{c.nickname}</strong>
                <span>{c.content}</span>
              </p>
            </div>
          ))}
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (comment.trim()) {
                if (await onComment(comment.trim())) setComment('');
              }
            }}
          >
            <input
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              maxLength={500}
              placeholder="따뜻한 응원을 남겨 주세요"
              required
              aria-label="댓글 내용"
            />
            <button className="primary" disabled={busy}>
              등록
            </button>
          </form>
        </div>
      )}
    </article>
  );
}
