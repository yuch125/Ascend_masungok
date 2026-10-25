import { useState } from 'react';
import { ArrowLeft, ArrowRight, Check, ShieldCheck } from 'lucide-react';
import ExerciseArt from '../../components/ExerciseArt';
import type { BodyArea, SymptomProfile } from '../../types';
import { bodyAreas, inferAreas } from '../../features/exercise-tracking/personalize';

export default function SymptomForm({
  profile,
  busy,
  onSave,
  onCancel,
}: {
  profile?: SymptomProfile | null;
  busy: boolean;
  onSave: (profile: SymptomProfile) => void;
  onCancel?: () => void;
}) {
  const [description, setDescription] = useState(profile?.description ?? '');
  const [areas, setAreas] = useState<BodyArea[]>(profile?.areas ?? []);
  const [manual, setManual] = useState(false);
  const [side, setSide] = useState<SymptomProfile['side']>(profile?.side ?? 'unsure');
  const [guidance, setGuidance] = useState(profile?.professionalGuidance ?? false);
  const [error, setError] = useState('');
  function changeText(text: string) {
    setDescription(text);
    if (!manual) setAreas(inferAreas(text));
  }
  function toggle(area: BodyArea) {
    setManual(true);
    setAreas((current) =>
      current.includes(area) ? current.filter((a) => a !== area) : [...current, area],
    );
  }
  return (
    <div className="symptom-onboarding">
      {onCancel && (
        <button className="back-button" onClick={onCancel}>
          <ArrowLeft size={18} /> 돌아가기
        </button>
      )}
      <span className="onboarding-step">{profile ? 'MY CONDITION' : 'LET’S GET TO KNOW YOU'}</span>
      <div className="onboarding-symbol">
        <ExerciseArt type="shoulder" />
        <span>✦</span>
      </div>
      <h1>
        {profile ? (
          '지금의 내 몸을 알려주세요'
        ) : (
          <>
            어떤 움직임이
            <br />
            불편하신가요?
          </>
        )}
      </h1>
      <p className="onboarding-lead">
        나의 이야기를 남기면,
        <br />
        관련 부위의 운동을 모아서 보여드려요.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!description.trim()) {
            setError('불편한 점을 한 줄 이상 적어 주세요.');
            return;
          }
          if (!areas.length) {
            setError('불편한 부위를 선택해 주세요.');
            return;
          }
          setError('');
          onSave({
            description: description.trim(),
            areas,
            side,
            professionalGuidance: guidance,
            updatedAt: new Date().toISOString(),
          });
        }}
      >
        <label className="field-label symptom-description">
          내 증상 / 불편함
          <textarea
            autoFocus
            rows={4}
            maxLength={1500}
            value={description}
            onChange={(e) => changeText(e.target.value)}
            placeholder="예: 계단을 내려갈 때 오른쪽 무릎이 불편해요."
            required
          />
        </label>
        <div className="example-symptoms">
          {[
            '계단을 오를 때 무릎이 불편해요',
            '팔을 들어 올리기 어려워요',
            '팔꿈치를 굽히기 불편해요',
          ].map((text) => (
            <button
              type="button"
              key={text}
              onClick={() => {
                setManual(false);
                setDescription(text);
                setAreas(inferAreas(text));
              }}
            >
              {text} <ArrowRight size={12} />
            </button>
          ))}
        </div>
        <fieldset className="body-area-field">
          <legend>
            어느 부위인가요? <span>여러 개 선택 가능</span>
          </legend>
          <div className="body-area-grid">
            {bodyAreas.map((area) => (
              <button
                type="button"
                aria-pressed={areas.includes(area.id)}
                className={areas.includes(area.id) ? 'selected' : ''}
                key={area.id}
                onClick={() => toggle(area.id)}
              >
                <span>{area.name}</span>
                {areas.includes(area.id) && <Check size={16} />}
                <small>{area.hint}</small>
              </button>
            ))}
          </div>
        </fieldset>
        <label className="field-label">
          불편한 쪽
          <select value={side} onChange={(e) => setSide(e.target.value as SymptomProfile['side'])}>
            <option value="unsure">아직 잘 모르겠어요</option>
            <option value="left">왼쪽</option>
            <option value="right">오른쪽</option>
            <option value="both">양쪽</option>
          </select>
        </label>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={guidance}
            onChange={(e) => setGuidance(e.target.checked)}
          />{' '}
          이 부위의 운동 방법과 범위를 의료진에게 안내받았어요.
        </label>
        <div className="symptom-privacy">
          <ShieldCheck size={18} />
          <p>
            입력 내용은 기본 비공개예요. 운동은 선택한 부위를 기준으로 모아 보여드리며, 진단이나
            개인 맞춤 처방은 하지 않아요.
          </p>
        </div>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <button className="primary full-width onboarding-submit" disabled={busy}>
          {busy ? '저장 중…' : profile ? '저장하고 운동 다시 보기' : '나를 위한 운동 보기'}
          <ArrowRight size={18} />
        </button>
      </form>
    </div>
  );
}
