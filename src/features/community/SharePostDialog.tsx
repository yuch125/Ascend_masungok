import { useState } from 'react';
import { Check, Copy, Share2 } from 'lucide-react';
import type { Post } from '../../types';
import Modal from '../../components/Modal';

export function sharedPostText(post: Post): string {
  const details = [
    post.shared.exerciseName,
    post.shared.date ? new Date(post.shared.date).toLocaleDateString('ko-KR') : undefined,
    post.shared.range === undefined ? undefined : `관측 각도 범위 ${post.shared.range}°`,
    post.shared.difference === undefined
      ? undefined
      : `이전 기록과 ${post.shared.difference}° 차이`,
  ].filter(Boolean);
  return [post.content, details.join(' · ')].filter(Boolean).join('\n\n');
}
export default function SharePostDialog({
  post,
  local,
  onClose,
}: {
  post: Post;
  local: boolean;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false),
    [message, setMessage] = useState('');
  const url = `${window.location.origin}${window.location.pathname}${window.location.search}#/community/post/${encodeURIComponent(post.id)}`;
  const text = sharedPostText(post),
    copyText = local ? text : url;
  return (
    <Modal title="이 이야기를 함께 나눠요" onClose={onClose}>
      <div className="share-post-preview">
        <strong>{post.nickname}님의 이야기</strong>
        <p>{text}</p>
      </div>
      <p className="micro">
        {local
          ? '로컬 데모 글에는 다른 기기에서 열 수 있는 공개 주소가 없어요. 글 내용을 복사할 수 있어요.'
          : '받는 사람도 로그인해야 게시글을 볼 수 있어요. 게시된 정보만 공유하며 개인 원본 영상·증상은 포함하지 않습니다.'}
      </p>
      <label className="field-label">
        {local ? '공유할 글 내용' : '게시글 주소'}
        <textarea
          readOnly
          value={copyText}
          onFocus={(e) => e.target.select()}
          rows={local ? 4 : 2}
        />
      </label>
      <div className="button-row">
        {typeof navigator.share === 'function' && (
          <button
            className="primary"
            onClick={async () => {
              try {
                await navigator.share({
                  title: 'Re:Move · 함께하는 움직임',
                  text,
                  ...(local ? {} : { url }),
                });
              } catch (error) {
                if ((error as { name?: string }).name !== 'AbortError')
                  setMessage('기기 공유를 열지 못했어요. 아래 내용을 복사해 주세요.');
              }
            }}
          >
            <Share2 size={16} /> 공유하기
          </button>
        )}
        <button
          className="secondary"
          onClick={async () => {
            try {
              if (!navigator.clipboard?.writeText) throw new Error();
              await navigator.clipboard.writeText(copyText);
              setCopied(true);
              setMessage('복사했어요. 원하는 곳에 붙여넣어 주세요.');
            } catch {
              setMessage('위 내용을 길게 누르거나 선택해서 복사해 주세요.');
            }
          }}
        >
          {copied ? <Check size={16} /> : <Copy size={16} />}{' '}
          {copied ? '복사 완료' : local ? '글 내용 복사' : '주소 복사'}
        </button>
      </div>
      {message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}
    </Modal>
  );
}
