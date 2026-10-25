import { useState } from 'react';
import { Camera, Check, ChevronRight } from 'lucide-react';
import type { Exercise, Side } from '../types';
import { exercises } from '../features/exercise-tracking/exercises';
import Modal from './Modal';
import ExerciseImage from './ExerciseImage';

export default function CameraExercisePicker({
  initial,
  initialSide = 'left',
  onClose,
  onStart,
}: {
  initial: Exercise;
  initialSide?: Side;
  onClose: () => void;
  onStart: (exercise: Exercise, side: Side) => void;
}) {
  const [selected, setSelected] = useState(initial),
    [side, setSide] = useState<Side>(initialSide);
  return (
    <Modal title="어떤 운동을 촬영할까요?" onClose={onClose}>
      <div className="camera-exercise-options">
        {exercises.map((exercise) => (
          <button
            key={exercise.id}
            className={selected.id === exercise.id ? 'selected' : ''}
            aria-pressed={selected.id === exercise.id}
            onClick={() => setSelected(exercise)}
          >
            <ExerciseImage exerciseId={exercise.id} />
            <div>
              <strong>{exercise.name}</strong>
              <span>
                {exercise.cameraDirection} 촬영 · {exercise.jointName} 추적
              </span>
            </div>
            {selected.id === exercise.id ? <Check size={19} /> : <ChevronRight size={18} />}
          </button>
        ))}
      </div>
      <div className="camera-side-select" aria-label="측정할 쪽">
        <button
          aria-pressed={side === 'left'}
          className={side === 'left' ? 'selected' : ''}
          onClick={() => setSide('left')}
        >
          왼쪽
        </button>
        <button
          aria-pressed={side === 'right'}
          className={side === 'right' ? 'selected' : ''}
          onClick={() => setSide('right')}
        >
          오른쪽
        </button>
      </div>
      <p className="camera-picker-note">
        카메라를 열면 기기 내 관절 분석이 시작돼요.
        <br />
        촬영한 영상은 기본 비공개로 보관됩니다.
      </p>
      <button
        className="primary full-width camera-picker-start"
        onClick={() => onStart(selected, side)}
      >
        <Camera size={18} /> 카메라 열기
      </button>
    </Modal>
  );
}
