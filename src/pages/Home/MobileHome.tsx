import { ChevronRight, Flag, HeartPulse } from 'lucide-react';
import type { AppData, CaptureRecord, Exercise, Session } from '../../types';
import { matchedExercises } from '../../features/exercise-tracking/personalize';
import { getPlan } from '../../features/exercise-tracking/exercises';
import ExerciseImage from '../../components/ExerciseImage';
import LatestCaptureCard from '../../components/LatestCaptureCard';

export default function MobileHome({
  data,
  userId,
  onSelect,
  onEditSymptoms,
  onRecords,
  onBrowse,
  onGoal,
  onDetail,
  onCapture,
}: {
  data: AppData;
  userId: string;
  onSelect: (exercise: Exercise) => void;
  onEditSymptoms: () => void;
  onRecords: () => void;
  onBrowse: () => void;
  onGoal: () => void;
  onDetail: (session: Session) => void;
  onCapture: (capture: CaptureRecord) => void;
}) {
  const matched = matchedExercises(data.symptoms!),
    goal = data.goals.find((goal) => goal.primary) ?? data.goals[0];
  return (
    <div className="mobile-home clean-home">
      <div className="clean-home-heading">
        <div>
          <span>RE:MOVE</span>
          <h1>{data.nickname}님의 움직임</h1>
        </div>
        <button onClick={onGoal} aria-label="나의 재활 목표">
          <Flag size={18} />
        </button>
      </div>
      <LatestCaptureCard
        sessions={data.sessions}
        captures={data.captures}
        userId={userId}
        onDetail={onDetail}
        onCapture={onCapture}
        onRecords={onRecords}
        onStart={() => onSelect(matched[0] ?? getDefaultExercise())}
      />
      <section className="home-workout-list">
        <div className="section-heading">
          <h2>나의 운동</h2>
          <button className="text-button" onClick={onBrowse}>
            전체 <ChevronRight size={14} />
          </button>
        </div>
        {matched.length ? (
          matched.map((exercise) => {
            const plan = getPlan(exercise.id, data.plans);
            return (
              <button
                className="reference-exercise-row"
                key={exercise.id}
                onClick={() => onSelect(exercise)}
              >
                <ExerciseImage exerciseId={exercise.id} />
                <div>
                  <h3>{exercise.name}</h3>
                  <p>
                    {exercise.cameraDirection} ·{' '}
                    {plan.source === 'reference'
                      ? '참고 운동'
                      : `${plan.repetitions}회 × ${plan.sets}세트`}
                  </p>
                </div>
                <span className="row-start">
                  운동 선택 <ChevronRight size={14} />
                </span>
              </button>
            );
          })
        ) : (
          <button className="more-row" onClick={onEditSymptoms}>
            불편한 부위 다시 확인 <ChevronRight size={16} />
          </button>
        )}
      </section>
      <button className="clean-condition-row" onClick={onEditSymptoms}>
        <HeartPulse size={18} />
        <span>{data.symptoms!.description}</span>
        <ChevronRight size={16} />
      </button>
      {goal && (
        <button className="clean-goal-row" onClick={onGoal}>
          <Flag size={16} />
          <span>{goal.title}</span>
          <ChevronRight size={15} />
        </button>
      )}
    </div>
  );
}
import { exercises } from '../../features/exercise-tracking/exercises';
function getDefaultExercise() {
  return exercises[0];
}
