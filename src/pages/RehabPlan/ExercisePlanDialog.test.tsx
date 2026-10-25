// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, expect, it, vi } from 'vitest';
import { defaultPlans, exercises, getPlan } from '../../features/exercise-tracking/exercises';
import ExercisePlanDialog from './ExercisePlanDialog';
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open');
  };
});
afterEach(cleanup);
it('preserves entered plans and uses a reference plan for an exercise missing from the account', () => {
  const entered = { ...defaultPlans[0], sets: 4, source: 'personal' as const };
  expect(getPlan('knee', [entered])).toBe(entered);
  expect(getPlan('shoulder', [entered]).source).toBe('reference');
  expect(getPlan('shoulder', [entered]).exerciseId).toBe('shoulder');
});
it('shows plan details and precautions before starting only on the explicit consent action', async () => {
  const user = userEvent.setup(),
    start = vi.fn();
  render(
    <ExercisePlanDialog
      exercise={exercises[0]}
      plan={defaultPlans[0]}
      onClose={vi.fn()}
      onStart={start}
    />,
  );
  expect(screen.getByRole('heading', { name: exercises[0].name })).toBeDefined();
  expect(screen.getByText(/의료기관 연동 전/)).toBeDefined();
  await user.click(screen.getByRole('tab', { name: '주의사항' }));
  expect(screen.getByText(exercises[0].precautions)).toBeDefined();
  await user.click(screen.getByRole('tab', { name: '설명' }));
  expect(screen.getByText(exercises[0].instructions[0])).toBeDefined();
  expect(start).not.toHaveBeenCalled();
  await user.click(screen.getByRole('button', { name: '동의하고 시작' }));
  expect(start).toHaveBeenCalledOnce();
});
