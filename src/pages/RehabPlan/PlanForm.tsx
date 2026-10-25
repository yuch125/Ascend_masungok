import type { Plan } from '../../types';
import Modal from '../../components/Modal';
export default function PlanForm({
  plan,
  busy,
  onClose,
  onSave,
}: {
  plan: Plan;
  busy: boolean;
  onClose: () => void;
  onSave: (p: Plan) => void;
}) {
  return (
    <Modal title="직접 받은 운동 계획 등록" onClose={onClose}>
      <p className="notice">
        전문가에게 받은 계획을 직접 옮겨 적는 기능입니다. 자격·처방을 인증하지 않으며, 시스템이 운동
        강도를 자동으로 정하지 않습니다.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const form = new FormData(e.currentTarget);
          onSave({
            ...plan,
            source: 'personal',
            confirmed: true,
            sets: Number(form.get('sets')),
            repetitions: Number(form.get('repetitions')),
            frequency: String(form.get('frequency')).trim(),
            notes: String(form.get('notes')).trim(),
          });
        }}
      >
        <div className="form-columns">
          <label className="field-label">
            세트 수
            <input name="sets" type="number" min="1" max="20" defaultValue={plan.sets} required />
          </label>
          <label className="field-label">
            세트별 횟수
            <input
              name="repetitions"
              type="number"
              min="1"
              max="100"
              defaultValue={plan.repetitions}
              required
            />
          </label>
        </div>
        <label className="field-label">
          운동 주기
          <input
            name="frequency"
            maxLength={80}
            placeholder="예: 주 3회"
            defaultValue={plan.source === 'personal' ? plan.frequency : ''}
            required
          />
        </label>
        <label className="field-label">
          전달받은 주의사항 · 범위 · 단계
          <textarea
            name="notes"
            rows={4}
            maxLength={1000}
            defaultValue={plan.source === 'personal' ? plan.notes : ''}
            required
            placeholder="의료진이 안내한 내용을 입력해 주세요."
          />
        </label>
        <label className="checkbox">
          <input type="checkbox" required /> 적합성을 확인받은 계획을 그대로 입력했습니다.
        </label>
        <button className="primary full-width" disabled={busy}>
          계획 저장하기
        </button>
      </form>
    </Modal>
  );
}
