import { useState } from 'react';
import { Activity, ArrowRight, Camera, CircleHelp, Hospital, ShieldCheck } from 'lucide-react';
import type { Exercise, Plan } from '../../types';
import Modal from '../../components/Modal';
import ExerciseImage from '../../components/ExerciseImage';

export default function ExercisePlanDialog({
  exercise,
  plan,
  onClose,
  onStart,
}: {
  exercise: Exercise;
  plan: Plan;
  onClose: () => void;
  onStart: () => void;
}) {
  const [tab, setTab] = useState<'plan' | 'precautions' | 'guide'>('plan');
  return (
    <Modal title="나의 재활 계획" onClose={onClose}>
      <div className="plan-provider">
        <span>
          <Hospital size={21} />
        </span>
        <div>
          <strong>
            {plan.source === 'personal' ? '직접 등록한 운동 계획' : '공개 자료 기반 참고 계획'}
          </strong>
          <p>
            의료기관 연동 전 ·{' '}
            {plan.source === 'personal' ? '사용자가 옮겨 적은 계획' : '공식 공개 자료 참고'}
          </p>
        </div>
        <CircleHelp size={17} />
      </div>
      <div className="plan-view-tabs" role="tablist" aria-label="운동 계획 정보">
        {[
          { id: 'plan', label: '운동 계획' },
          { id: 'precautions', label: '주의사항' },
          { id: 'guide', label: '설명' },
        ].map((item) => (
          <button
            role="tab"
            aria-selected={tab === item.id}
            key={item.id}
            className={tab === item.id ? 'active' : ''}
            onClick={() => setTab(item.id as typeof tab)}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className="plan-tab-content" role="tabpanel">
        {tab === 'plan' && (
          <>
            <ExerciseImage exerciseId={exercise.id} className="plan-cover" badge />
            <div className="plan-exercise-title">
              <span>오늘의 운동</span>
              <h3>{exercise.name}</h3>
              <p>
                {plan.repetitions}회 × {plan.sets}세트{' '}
                {plan.source === 'reference' ? '· 참고 예시' : ''}
              </p>
            </div>
            <div className="start-exercise-meta">
              <span>
                <Camera size={15} /> {exercise.cameraDirection} 촬영
              </span>
              <span>
                <Activity size={15} /> {exercise.jointName} 각도 측정
              </span>
            </div>
            <p className="plan-notes">{plan.notes}</p>
          </>
        )}
        {tab === 'precautions' && (
          <>
            <h3>시작 전에 확인해 주세요</h3>
            <p className="notice">{exercise.precautions}</p>
            <p className="plan-notes">
              의료진이 안내한 자세와 운동 범위에 따라 진행하세요. 표시된 예시 횟수와 세트가 개인에게
              적합하다는 의미는 아닙니다.
            </p>
          </>
        )}
        {tab === 'guide' && (
          <>
            <h3>{exercise.name}</h3>
            <ol className="instructions">
              {exercise.instructions.map((text) => (
                <li key={text}>{text}</li>
              ))}
            </ol>
            <a
              className="text-button"
              href={exercise.referenceUrl}
              target="_blank"
              rel="noreferrer"
            >
              공식 운동 자료 확인 <ArrowRight size={15} />
            </a>
          </>
        )}
      </div>
      <div className="start-consent">
        <ShieldCheck size={18} />
        <p>본인 영상은 기기 안에서 분석해요. 시작하면 카메라 사용 권한을 요청합니다.</p>
      </div>
      <button className="primary full-width start-course-button" onClick={onStart}>
        <Camera size={18} /> 동의하고 시작
      </button>
      <p className="micro start-consent-caption">
        본인 영상의 기기 내 분석에 동의하고 카메라를 연결합니다.
      </p>
    </Modal>
  );
}
