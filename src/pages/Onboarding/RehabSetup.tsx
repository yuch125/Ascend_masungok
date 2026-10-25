import { useRef, useState } from 'react';
import { ArrowLeft, Check, Minus, Paperclip, Plus } from 'lucide-react';
import AscendBottomNav from '../../components/AscendBottomNav';
import type { BodyArea, Goal, Plan, SymptomProfile, Tab } from '../../types';
import { createId } from '../../utils/id';

const activities = [
  { id: 'knee', label: '스쿼트', area: 'knee' as BodyArea },
  { id: 'shoulder', label: '팔 올리기', area: 'shoulder' as BodyArea },
  { id: 'elbow', label: '팔꿈치 굽히기', area: 'elbow' as BodyArea },
];
const weekdayNames = ['월', '화', '수', '목', '금', '토', '일'];

export type RehabSetupValue = {
  nickname: string;
  profile: SymptomProfile;
  goal: Goal;
  plan: Plan;
};

export default function RehabSetup({
  busy,
  onSave,
  onBack,
  onNavigate,
  initialNickname = '무브',
  initialProfile,
  initialGoal,
  initialPlan,
}: {
  busy: boolean;
  onSave: (value: RehabSetupValue) => void;
  onBack?: () => void;
  onNavigate?: (tab: Tab) => void;
  initialNickname?: string;
  initialProfile?: SymptomProfile | null;
  initialGoal?: Goal;
  initialPlan?: Plan;
}) {
  const [step, setStep] = useState<'goal' | 'plan'>('goal');
  const initialExercise =
    initialPlan?.exerciseId ??
    activities.find((item) => initialProfile?.areas.includes(item.area))?.id ??
    'knee';
  const initialActivities = initialProfile?.areas.length
    ? activities.filter((item) => initialProfile.areas.includes(item.area)).map((item) => item.id)
    : ['knee', 'shoulder'];
  const [diagnosis, setDiagnosis] = useState(
    initialProfile?.description ?? initialPlan?.diagnosisName ?? '',
  );
  const [exerciseId, setExerciseId] = useState(initialExercise);
  const [selectedActivities, setSelectedActivities] = useState(initialActivities);
  const [side, setSide] = useState<'left' | 'right' | 'both' | 'unsure'>(
    initialProfile?.side ?? 'right',
  );
  const [days, setDays] = useState(initialPlan?.days ?? [0, 1, 2, 3, 4]);
  const [repetitions, setRepetitions] = useState(initialPlan?.repetitions ?? 8);
  const [targetAngle, setTargetAngle] = useState(initialPlan?.targetAngle ?? 175);
  const [attachment, setAttachment] = useState('');
  const [request, setRequest] = useState(initialPlan?.notes ?? '');
  const [requestApplied, setRequestApplied] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const activity = activities.find((item) => item.id === exerciseId)!;

  const applyRequest = () => {
    const count = request.match(/주\s*([1-7])\s*(?:일|회)/)?.[1];
    if (/주말/.test(request)) setDays([5, 6]);
    else if (/평일/.test(request)) setDays([0, 1, 2, 3, 4]);
    else if (count) setDays(Array.from({ length: Number(count) }, (_, index) => index));
    setRequestApplied(true);
  };

  const submit = () => {
    const plan: Plan = {
      id: initialPlan?.id ?? exerciseId,
      exerciseId,
      sets: 2,
      repetitions,
      frequency: `주 ${days.length}회`,
      notes: request.trim() || '목표 설정에서 만든 개인 재활 계획',
      source: 'personal',
      confirmed: true,
      days,
      targetAngle,
      diagnosisName: diagnosis.trim(),
    };
    const profile: SymptomProfile = {
      description: diagnosis.trim(),
      areas: activities
        .filter((item) => selectedActivities.includes(item.id))
        .map((item) => item.area),
      side,
      professionalGuidance: !!attachment,
      updatedAt: new Date().toISOString(),
    };
    const goal: Goal = {
      id: initialGoal?.id ?? createId(),
      title: `${activity.label} ${targetAngle}° 달성`,
      description: `${days.length}일 · 회당 ${repetitions}회`,
      status: 'active',
      primary: true,
      createdAt: new Date().toISOString(),
    };
    onSave({ nickname: initialNickname, profile, goal, plan });
  };

  return (
    <section className={`ascend-setup setup-${step}`}>
      <header className="ascend-page-title">
        <button
          type="button"
          aria-label={step === 'goal' ? '돌아가기' : '목표 설정으로 돌아가기'}
          onClick={() => {
            if (step === 'plan') setStep('goal');
            else onBack?.();
          }}
        >
          <ArrowLeft />
        </button>
        <div>
          <h1>{step === 'goal' ? '목표 설정' : '재활 계획 수립'}</h1>
          {step === 'plan' && <p>오른쪽 무릎 · 4주 단계 계획</p>}
        </div>
      </header>

      {step === 'goal' ? (
        <>
          <div className="setup-legacy-controls">
            <label>
              내 증상 / 불편함
              <textarea
                aria-label="내 증상 / 불편함"
                value={diagnosis}
                onChange={(event) => {
                  const value = event.target.value;
                  setDiagnosis(value);
                  if (/어깨|팔 올리기/.test(value)) {
                    setExerciseId('shoulder');
                    setSelectedActivities(['shoulder']);
                  } else if (/팔꿈치/.test(value)) {
                    setExerciseId('elbow');
                    setSelectedActivities(['elbow']);
                  } else if (/무릎|계단/.test(value)) {
                    setExerciseId('knee');
                    setSelectedActivities(['knee']);
                  }
                }}
              />
            </label>
            <label>
              불편한 쪽
              <select
                aria-label="불편한 쪽"
                value={side}
                onChange={(event) => setSide(event.target.value as typeof side)}
              >
                <option value="left">왼쪽</option>
                <option value="right">오른쪽</option>
                <option value="both">양쪽</option>
                <option value="unsure">잘 모르겠어요</option>
              </select>
            </label>
            <button type="button" onClick={submit}>
              나를 위한 운동 보기
            </button>
            <button type="button" onClick={submit}>
              저장하고 운동 다시 보기
            </button>
          </div>

          <section className="ascend-card setup-identity">
            <input
              value={diagnosis}
              onChange={(event) => setDiagnosis(event.target.value)}
              maxLength={100}
              aria-label="병명 또는 상태"
              placeholder="병명을 입력해요 (예: 무릎 수술 후)"
            />
            <input
              ref={fileRef}
              hidden
              type="file"
              accept="image/*,.pdf"
              onChange={(event) => setAttachment(event.target.files?.[0]?.name ?? '')}
            />
            <button
              type="button"
              className="diagnosis-upload"
              onClick={() => fileRef.current?.click()}
            >
              <Paperclip />
              <strong>{attachment || '병원 진단서 첨부'}</strong>
              <span>{attachment ? '선택됨' : '선택 · 이 기기에만 저장'}</span>
              <b>{attachment ? '변경' : '추가'}</b>
            </button>
          </section>

          <section className="ascend-card setup-activities">
            <span>재활 활동 종류</span>
            <div>
              {activities.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  className={selectedActivities.includes(item.id) ? 'selected' : ''}
                  onClick={() => {
                    setExerciseId(item.id);
                    setSelectedActivities((value) =>
                      value.includes(item.id)
                        ? value.length > 1
                          ? value.filter((id) => id !== item.id)
                          : value
                        : [...value, item.id],
                    );
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </section>

          <section className="ascend-card weekly-goal-card">
            <div className="ascend-card-heading">
              <h2>이번 주 재활 활동 목표</h2>
              <strong>
                {days.length}
                <small>일</small>
              </strong>
            </div>
            <div className="weekday-picker">
              {weekdayNames.map((day, index) => (
                <button
                  type="button"
                  key={day}
                  className={days.includes(index) ? 'selected' : ''}
                  onClick={() =>
                    setDays((value) =>
                      value.includes(index)
                        ? value.filter((item) => item !== index)
                        : [...value, index].sort(),
                    )
                  }
                >
                  {day}
                </button>
              ))}
            </div>
            <div className="goal-progress">
              <i style={{ width: `${(days.length / 7) * 100}%` }} />
            </div>
          </section>

          <section className="ascend-card setup-targets">
            <span>한 번 재활 활동에서 채울 반복 횟수</span>
            <div className="choice-row">
              {[5, 8, 10, 12].map((count) => (
                <button
                  type="button"
                  key={count}
                  className={repetitions === count ? 'selected' : ''}
                  onClick={() => setRepetitions(count)}
                >
                  {count}회
                </button>
              ))}
            </div>
            <hr />
            <div className="angle-target">
              <div>
                <strong>각도 목표</strong>
                <span>무릎 · 오른쪽 최대 (현재 168°)</span>
              </div>
              <button
                type="button"
                aria-label="목표 각도 줄이기"
                onClick={() => setTargetAngle((value) => Math.max(90, value - 5))}
              >
                <Minus />
              </button>
              <b>{targetAngle}°</b>
              <button
                type="button"
                aria-label="목표 각도 늘리기"
                onClick={() => setTargetAngle((value) => Math.min(180, value + 5))}
              >
                <Plus />
              </button>
            </div>
          </section>
          <button
            type="button"
            className="ascend-primary"
            disabled={!days.length}
            onClick={() => setStep('plan')}
          >
            저장하기
          </button>
        </>
      ) : (
        <>
          <section className="ascend-card baseline-metrics">
            <div>
              <span>굴곡</span>
              <strong>
                78<small>°</small>
              </strong>
            </div>
            <div>
              <span>신전</span>
              <strong>
                168<small>°</small>
              </strong>
            </div>
            <div>
              <span>가동범위</span>
              <strong>
                90<small>°</small>
              </strong>
            </div>
          </section>

          <section className="ascend-card staged-goal">
            <div className="ascend-card-heading">
              <h2>단계별 목표</h2>
              <strong>현재 2주차</strong>
            </div>
            <div className="stage-bars">
              <i />
              <i />
              <i />
              <i />
            </div>
            <div>
              <span>1-2주 가동범위 확보</span>
              <span>3-4주 근력 · 조절</span>
            </div>
          </section>

          <section className="ascend-card recommended-plan">
            <h2>권장 재활 활동</h2>
            <div className="plan-table plan-head">
              <span>활동</span>
              <span>빈도</span>
              <span>세트×반복</span>
              <span>목표 각도</span>
            </div>
            <div className="plan-table">
              <strong>스쿼트 · 사선</strong>
              <strong>주 3회</strong>
              <strong>2×8</strong>
              <strong>{targetAngle}°</strong>
            </div>
            <div className="plan-table">
              <strong>앉아서 무릎 펴기</strong>
              <strong>주 5회</strong>
              <strong>2×10</strong>
              <strong>{targetAngle}°</strong>
            </div>
            <div className="plan-table">
              <strong>벽 기대 스쿼트</strong>
              <strong>주 2회</strong>
              <strong>2×6</strong>
              <strong>90°</strong>
            </div>
          </section>

          <section className="ascend-card setup-request">
            <h2>요청 사항</h2>
            <div>
              <input
                value={request}
                onChange={(event) => {
                  setRequest(event.target.value);
                  setRequestApplied(false);
                }}
                placeholder="예: 오전 시간대, 주 3일"
                aria-label="재활 계획 요청 사항"
              />
              <button type="button" disabled={!request.trim()} onClick={applyRequest}>
                {requestApplied ? <Check size={17} /> : null}
                {requestApplied ? '반영됨' : '반영'}
              </button>
            </div>
            {requestApplied && (
              <small className="setup-request-feedback" role="status">
                요청 사항을 계획 메모와 주간 일정에 반영했어요.
              </small>
            )}
          </section>
          <p className="ascend-disclaimer">
            진단·처방이 아닌 참고용이에요. 담당 의료진과 상의하세요.
          </p>
          <button type="button" className="ascend-primary" disabled={busy} onClick={submit}>
            {busy ? '저장 중…' : '이 계획으로 시작'}
          </button>
        </>
      )}

      <AscendBottomNav active="more" onNavigate={onNavigate} />
    </section>
  );
}
