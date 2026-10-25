// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import RehabSetup from './RehabSetup';

afterEach(cleanup);

it('applies a weekly frequency request to the plan that is saved', async () => {
  const onSave = vi.fn(),
    user = userEvent.setup();
  render(<RehabSetup busy={false} onSave={onSave} />);

  await user.click(screen.getByRole('button', { name: '저장하기' }));
  await user.type(screen.getByLabelText('재활 계획 요청 사항'), '오전 시간대, 주 3일');
  await user.click(screen.getByRole('button', { name: '반영' }));
  expect(screen.getByRole('status').textContent).toContain('주간 일정에 반영');

  await user.click(screen.getByRole('button', { name: '이 계획으로 시작' }));
  expect(onSave).toHaveBeenCalledWith(
    expect.objectContaining({
      plan: expect.objectContaining({
        days: [0, 1, 2],
        frequency: '주 3회',
        notes: '오전 시간대, 주 3일',
      }),
    }),
  );
});
