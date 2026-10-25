import { getExercise } from '../features/exercise-tracking/exercises';
export default function ExerciseImage({
  exerciseId,
  className = '',
  badge = false,
}: {
  exerciseId: string;
  className?: string;
  badge?: boolean;
}) {
  return (
    <div
      className={`exercise-photo photo-${exerciseId} ${className}`}
      role="img"
      aria-label={`${getExercise(exerciseId).name} 운동 예시 · AI 생성 이미지`}
    >
      {badge && <span className="example-photo-label">운동 예시</span>}
    </div>
  );
}
