import { createId } from '../../utils/id';
import { useState } from 'react';
import { Check } from 'lucide-react';
import type { Goal } from '../../types';
import Modal from '../../components/Modal';
export default function GoalForm({
  goal,
  onClose,
  onSave,
  busy,
}: {
  goal?: Goal;
  onClose: () => void;
  onSave: (goal: Goal) => void;
  busy: boolean;
}) {
  const [title, setTitle] = useState(goal?.title ?? ''),
    [description, setDescription] = useState(goal?.description ?? ''),
    [primary, setPrimary] = useState(goal?.primary ?? true),
    [achieved, setAchieved] = useState(goal?.status === 'achieved');
  return (
    <Modal title={goal ? '나의 목표 수정하기' : '나의 첫걸음, 목표 설정'} onClose={onClose}>
      <p className="form-description">다시 하고 싶은 일상의 순간이 있나요?</p>
      <div className="goal-presets">
        {['다시 두 발로 걷기', '계단 오르기', '팔을 자유롭게 들어 올리기', '일상생활 복귀'].map(
          (text) => (
            <button
              key={text}
              className={text === title ? 'selected' : ''}
              onClick={() => setTitle(text)}
            >
              {text}
            </button>
          ),
        )}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!title.trim()) return;
          onSave({
            id: goal?.id ?? createId(),
            title: title.trim(),
            description: description.trim(),
            status: achieved ? 'achieved' : 'active',
            primary,
            createdAt: goal?.createdAt ?? new Date().toISOString(),
          });
        }}
      >
        <label className="field-label">
          목표 이름
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={80}
            placeholder="나만의 목표를 직접 입력해도 좋아요"
            required
          />
        </label>
        <label className="field-label">
          나에게 이 목표가 소중한 이유
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={500}
            rows={3}
            placeholder="예: 가족과 함께 편안하게 산책하고 싶어요."
          />
        </label>
        <label className="checkbox">
          <input type="checkbox" checked={primary} onChange={(e) => setPrimary(e.target.checked)} />{' '}
          홈에 표시할 대표 목표로 설정
        </label>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={achieved}
            onChange={(e) => setAchieved(e.target.checked)}
          />{' '}
          이 목표를 달성했어요 (직접 기록)
        </label>
        <button className="primary full-width" disabled={busy}>
          <Check size={17} /> 목표 저장하기
        </button>
      </form>
    </Modal>
  );
}
