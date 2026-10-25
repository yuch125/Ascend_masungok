import {
  ArrowRight,
  BookOpen,
  ChevronRight,
  Edit3,
  Flag,
  HeartPulse,
  LockKeyhole,
  LogOut,
  Settings2,
  ShieldCheck,
  Target,
  UserRound,
} from 'lucide-react';
import type { AppData, Plan, Preferences } from '../../types';
import { bodyAreas } from '../../features/exercise-tracking/personalize';
import { getExercise } from '../../features/exercise-tracking/exercises';
import { formatDate } from '../../utils/date';
import InstallApp from '../../pwa/InstallApp';

export default function MorePage({
  data,
  local,
  busy,
  onSymptoms,
  onNickname,
  onPreferences,
  onPlan,
  onGoal,
  onOwnPosts,
  onAuth,
  onHelp,
}: {
  data: AppData;
  local: boolean;
  busy: boolean;
  onSymptoms: () => void;
  onNickname: (name: string) => void;
  onPreferences: (preferences: Preferences) => void;
  onPlan: (plan: Plan) => void;
  onGoal: (id?: string) => void;
  onOwnPosts: () => void;
  onAuth: () => void;
  onHelp: () => void;
}) {
  const goal = data.goals.find((goal) => goal.primary) ?? data.goals[0];
  const days = new Set(data.sessions.map((session) => new Date(session.recordedAt).toDateString()))
    .size;
  return (
    <div className="more-page">
      <div className="tab-page-heading">
        <h1>
          더보기<span>.</span>
        </h1>
        <p>나의 일상과 재활을 한곳에서 관리해요.</p>
      </div>
      <section className="card more-profile">
        <div className="avatar big-avatar">{data.nickname.slice(0, 1)}</div>
        <div>
          <h2>{data.nickname}님</h2>
          <span className="pill">{local ? '이 기기의 데모 계정' : '나의 재활 공간'}</span>
        </div>
      </section>
      <div className="profile-counts-strip">
        <div>
          <strong>{data.sessions.length}</strong>
          <span>운동 기록</span>
        </div>
        <div>
          <strong>{days}</strong>
          <span>움직인 날</span>
        </div>
        <div>
          <strong>{data.goals.length}</strong>
          <span>나의 목표</span>
        </div>
      </div>
      <button className="reference-goal-card" onClick={() => onGoal(goal?.id)}>
        <span className="goal-card-icon">
          <Target size={21} />
        </span>
        <div>
          <span>나의 재활 목표</span>
          <strong>{goal?.title ?? '되찾고 싶은 나의 일상'}</strong>
          <p>{goal?.description || '내가 바라는 작은 변화를 목표로 남겨요.'}</p>
        </div>
        <ChevronRight size={18} />
      </button>
      <section className="card my-condition-card">
        <div className="section-heading">
          <h2>
            <HeartPulse size={18} /> 내 증상 / 불편함
          </h2>
          <button className="icon-button" onClick={onSymptoms} aria-label="내 증상 / 불편함 수정">
            <Edit3 size={17} />
          </button>
        </div>
        <p>{data.symptoms?.description}</p>
        <div className="condition-tags">
          {data.symptoms?.areas.map((id) => (
            <small key={id}>{bodyAreas.find((area) => area.id === id)?.name}</small>
          ))}
        </div>
        <button className="secondary full-width" onClick={onSymptoms}>
          내용 수정하고 운동 다시 정하기 <ArrowRight size={15} />
        </button>
        <small className="micro">
          {data.symptoms && formatDate(data.symptoms.updatedAt)} 수정 · 나만 보기
        </small>
      </section>
      <details className="reference-settings-details">
        <summary>
          <span>
            <BookOpen size={18} /> 나의 재활 계획
          </span>
          <ChevronRight size={17} />
        </summary>
        <section className="card more-plans">
          <div className="section-heading">
            <h2>운동 계획 관리</h2>
          </div>
          {data.plans.map((plan) => (
            <button className="more-row" key={plan.id} onClick={() => onPlan(plan)}>
              <div>
                <strong>{getExercise(plan.exerciseId).name}</strong>
                <small>
                  {plan.source === 'personal' ? '직접 등록한 계획' : '공개 참고 예시'} ·{' '}
                  {plan.repetitions}회 × {plan.sets}세트
                </small>
              </div>
              <ChevronRight size={16} />
            </button>
          ))}
        </section>
      </details>
      <details className="reference-settings-details">
        <summary>
          <span>
            <Settings2 size={18} /> 기본 설정
          </span>
          <ChevronRight size={17} />
        </summary>
        <section className="card more-settings">
          <h2>기본 설정</h2>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const name = String(new FormData(event.currentTarget).get('nickname')).trim();
              if (name) onNickname(name);
            }}
          >
            <label className="field-label">
              닉네임
              <input
                name="nickname"
                defaultValue={data.nickname}
                key={data.nickname}
                maxLength={20}
                required
              />
            </label>
            <button className="secondary" disabled={busy}>
              닉네임 저장
            </button>
          </form>
          <label className="checkbox settings-switch">
            <input
              type="checkbox"
              checked={data.preferences.saveOriginal}
              disabled={busy}
              onChange={(event) =>
                onPreferences({ ...data.preferences, saveOriginal: event.target.checked })
              }
            />
            <span>
              <strong>원본 영상을 이 기기에 보관</strong>
              <small>분석 저장 시 기본값이에요. 기록마다 바꿀 수 있어요.</small>
            </span>
          </label>
        </section>
      </details>
      <details className="reference-settings-details">
        <summary>
          <span>
            <Flag size={18} /> 나의 목표 관리
          </span>
          <ChevronRight size={17} />
        </summary>
        <section className="card">
          <button className="text-button" onClick={() => onGoal()}>
            새로운 목표 추가 <ArrowRight size={14} />
          </button>
          {data.goals.map((goal) => (
            <button className="more-row" key={goal.id} onClick={() => onGoal(goal.id)}>
              <div>
                <strong>{goal.title}</strong>
                <small>
                  {goal.status === 'achieved' ? '직접 달성 기록' : '나의 속도로 도전 중'}
                  {goal.primary ? ' · 대표 목표' : ''}
                </small>
              </div>
              <ChevronRight size={16} />
            </button>
          ))}
        </section>
      </details>
      <section className="card more-links">
        <InstallApp row />
        <button className="more-row" onClick={onOwnPosts}>
          <span>내가 작성한 게시글</span>
          <ChevronRight size={17} />
        </button>
        <button className="more-row" onClick={onHelp}>
          <span>Re:Move 이용 안내</span>
          <ChevronRight size={17} />
        </button>
        <button className="more-row" onClick={onAuth}>
          {local ? <UserRound size={18} /> : <LogOut size={18} />}
          <span>{local ? '로그인 / 회원가입' : '로그아웃'}</span>
          <ChevronRight size={17} />
        </button>
      </section>
      <div className="more-privacy">
        <ShieldCheck size={20} />
        <p>
          나의 불편함과 운동 기록은 기본 비공개예요.
          <br />
          커뮤니티에는 직접 선택한 정보만 공유됩니다.
        </p>
        <LockKeyhole size={14} />
      </div>
    </div>
  );
}
