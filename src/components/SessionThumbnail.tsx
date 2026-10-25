import { useEffect, useState } from 'react';
import { Film, Play } from 'lucide-react';
import type { Session } from '../types';
import { readMedia } from '../services/local';

export default function SessionThumbnail({
  session,
  userId,
}: {
  session: Pick<Session, 'mediaId'>;
  userId: string;
}) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    let active = true,
      objectUrl = '';
    setUrl('');
    if (session.mediaId)
      readMedia(userId, session.mediaId)
        .then((blob) => {
          if (blob && active) {
            objectUrl = URL.createObjectURL(blob);
            setUrl(objectUrl);
          }
        })
        .catch(() => {});
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [session.mediaId, userId]);
  return (
    <div className={`session-thumbnail ${url ? 'has-video' : ''}`}>
      {url ? (
        <>
          <video
            src={`${url}#t=0.1`}
            muted
            playsInline
            preload="metadata"
            aria-label="저장한 운동 영상 미리보기"
          />
          <span className="thumbnail-play">
            <Play size={13} fill="currentColor" />
          </span>
        </>
      ) : (
        <>
          <Film size={22} />
          <span>분석 기록</span>
        </>
      )}
    </div>
  );
}
