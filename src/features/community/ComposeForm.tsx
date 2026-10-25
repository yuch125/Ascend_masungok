import { createId } from '../../utils/id';
import { useEffect, useState } from 'react';
import { Heart } from 'lucide-react';
import type { Session, Post } from '../../types';
import Modal from '../../components/Modal';
import { previousSession } from '../record-comparison/compare';
import { buildSharedRecord } from './share';
import { videoFile } from '../camera/recording';
export default function ComposeForm({
  session,
  sessions,
  nickname,
  userId,
  busy,
  onClose,
  onSubmit,
  initialMedia,
  initialCaption = '',
}: {
  session?: Session;
  sessions: Session[];
  nickname: string;
  userId: string;
  busy: boolean;
  onClose: () => void;
  onSubmit: (p: Post, media?: Blob) => void;
  initialMedia?: Blob;
  initialCaption?: string;
}) {
  const [content, setContent] = useState(initialCaption),
    [choices, setChoices] = useState<string[]>(() =>
      session
        ? ['name', 'date', 'range', ...(previousSession(session, sessions) ? ['difference'] : [])]
        : [],
    ),
    [file, setFile] = useState<File | undefined>(() =>
      initialMedia ? videoFile(initialMedia) : undefined,
    ),
    [error, setError] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  useEffect(() => {
    if (!file) {
      setMediaUrl('');
      return;
    }
    const url = URL.createObjectURL(file);
    setMediaUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  const previous = session ? previousSession(session, sessions) : undefined;
  const canSubmit = !!content.trim() || !!file || (!!session && choices.length > 0);
  function toggle(name: string) {
    setChoices((c) => (c.includes(name) ? c.filter((v) => v !== name) : [...c, name]));
  }
  return (
    <Modal title="게시물 만들기" onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const shared = buildSharedRecord(session, sessions, choices);
          if (!content.trim() && !file && !Object.keys(shared).length) return;
          if (file && file.size > 20 * 1024 * 1024) {
            setError('공유할 영상은 20MB 이하여야 해요. 짧게 촬영해 주세요.');
            return;
          }
          onSubmit(
            {
              id: createId(),
              userId,
              nickname,
              content:
                content.trim() || (file ? '운동 영상을 공유했어요.' : '운동 기록을 공유했어요.'),
              createdAt: new Date().toISOString(),
              shared,
              likes: [],
              comments: [],
            },
            file,
          );
        }}
      >
        <label className="field-label">
          나누고 싶은 이야기
          <textarea
            rows={4}
            maxLength={2000}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="오늘의 운동, 어땠나요?"
          />
        </label>
        {session && (
          <div className="share-options">
            <h3>공개할 기록을 직접 선택해 주세요</h3>
            {[
              { id: 'name', label: '운동 이름' },
              { id: 'date', label: '운동 날짜' },
              { id: 'range', label: '관측 각도 범위' },
              ...(previous ? [{ id: 'difference', label: '이전 기록과 각도 범위 차이' }] : []),
            ].map((item) => (
              <label className="checkbox" key={item.id}>
                <input
                  type="checkbox"
                  checked={choices.includes(item.id)}
                  onChange={() => toggle(item.id)}
                />
                {item.label}
              </label>
            ))}
          </div>
        )}
        <label className="field-label attachment-field">
          이미지 또는 영상 첨부 (선택)
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,video/mp4,video/webm,video/quicktime,.mov"
            onChange={(e) => {
              const media = e.target.files?.[0];
              if (
                media &&
                (media.size > 20 * 1024 * 1024 ||
                  ![
                    'image/png',
                    'image/jpeg',
                    'image/webp',
                    'video/mp4',
                    'video/webm',
                    'video/quicktime',
                  ].includes(media.type))
              ) {
                setError('PNG, JPG, WebP, MP4, MOV, WebM 파일을 20MB 이하로 선택해 주세요.');
                setFile(undefined);
                e.target.value = '';
              } else {
                setFile(media);
                setError('');
              }
              e.target.value = '';
            }}
          />
        </label>
        {file && mediaUrl && (
          <div className="compose-media-preview">
            {file.type.startsWith('video/') ? (
              <video src={mediaUrl} controls playsInline preload="metadata" />
            ) : (
              <img src={mediaUrl} alt="게시할 첨부 이미지 미리보기" />
            )}
            <p>선택한 파일만 게시글에 첨부돼요.</p>
          </div>
        )}
        {file && (
          <p className="micro">
            {file.name} ·{' '}
            <button
              className="text-button"
              type="button"
              onClick={() => {
                setFile(undefined);
                setError('');
              }}
            >
              첨부 제외
            </button>
          </p>
        )}
        {error && <p className="error">{error}</p>}
        <p className="post-visibility-note">
          {userId === 'local-demo'
            ? '이 기기의 데모 피드에 게시됩니다.'
            : '게시하면 선택한 영상과 글이 피드에 공유됩니다.'}
        </p>
        <button className="primary full-width" disabled={busy || !!error || !canSubmit}>
          <Heart size={17} />
          {busy ? '게시 중…' : '게시하기'}
        </button>
      </form>
    </Modal>
  );
}
