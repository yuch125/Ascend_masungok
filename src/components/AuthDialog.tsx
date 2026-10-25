import { useState } from 'react';
import { LockKeyhole } from 'lucide-react';
import Modal from './Modal';
import { supabase } from '../services/cloud';

export default function AuthDialog({
  onClose,
  busy,
  run,
}: {
  onClose: () => void;
  busy: boolean;
  run: (action: () => Promise<void>) => Promise<boolean>;
}) {
  const [signUp, setSignUp] = useState(false),
    [message, setMessage] = useState('');
  return (
    <Modal title="함께하는 재활을 시작해요" onClose={onClose}>
      {!supabase ? (
        <>
          <div className="empty-state">
            <LockKeyhole size={28} />
            <h3>지금은 로컬 데모 모드예요</h3>
            <p>
              다른 사람과 글·영상을 나누려면
              <br />
              README에 따라 Supabase를 연결해 주세요.
            </p>
          </div>
          <p className="notice">
            프로젝트의 .env.local에 Supabase URL과 공개 키를 설정하고 개발 서버를 다시 실행하면
            가입·로그인이 활성화됩니다.
          </p>
          <button className="primary full-width" onClick={onClose}>
            데모 계속 사용하기
          </button>
        </>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const form = new FormData(e.currentTarget);
            const email = String(form.get('email')).trim(),
              password = String(form.get('password'));
            void run(async () => {
              setMessage('');
              const result = signUp
                ? await supabase!.auth.signUp({ email, password })
                : await supabase!.auth.signInWithPassword({ email, password });
              if (result.error) throw result.error;
              if (signUp && !result.data.session)
                setMessage('가입 확인 이메일을 보냈어요. 확인 후 로그인해 주세요.');
              else onClose();
            });
          }}
        >
          <label className="field-label">
            이메일
            <input type="email" name="email" autoComplete="email" required />
          </label>
          <label className="field-label">
            비밀번호
            <input
              type="password"
              name="password"
              minLength={8}
              autoComplete={signUp ? 'new-password' : 'current-password'}
              required
            />
          </label>
          {message && <p className="notice">{message}</p>}
          <button className="primary full-width" disabled={busy}>
            {busy ? '연결 중…' : signUp ? '회원가입' : '로그인'}
          </button>
          <button className="text-button" type="button" onClick={() => setSignUp(!signUp)}>
            {signUp ? '이미 계정이 있어요 · 로그인' : '처음 오셨나요? 회원가입'}
          </button>
          <p className="micro">로컬 데모의 기록과 증상은 계정으로 자동 복사하지 않아요.</p>
        </form>
      )}
    </Modal>
  );
}
