// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, expect, it, vi } from 'vitest';
import ComposeForm from './ComposeForm';
import type { Session } from '../../types';
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open');
  };
});
it('attaches the just-recorded video automatically and toggles optional analysis fields independently', async () => {
  vi.stubGlobal(
    'URL',
    Object.assign(class extends URL {}, {
      createObjectURL: vi.fn(() => 'blob:captured'),
      revokeObjectURL: vi.fn(),
    }),
  );
  const submit = vi.fn(),
    user = userEvent.setup();
  const session: Session = {
    id: 'recorded',
    exerciseId: 'knee',
    recordedAt: '2026-10-24T00:00:00Z',
    duration: 2,
    side: 'left',
    cameraDirection: '측면',
    version: '2d-projected-v1',
    analysis: {
      min: 80,
      max: 150,
      range: 70,
      validFrames: 20,
      totalFrames: 20,
      validRatio: 1,
      repetitions: 0,
      frames: [],
    },
  };
  render(
    <ComposeForm
      sessions={[session]}
      session={session}
      nickname="테스트"
      userId="local-demo"
      busy={false}
      onClose={vi.fn()}
      onSubmit={submit}
      initialMedia={new Blob(['clip'], { type: 'video/webm;codecs=vp8' })}
    />,
  );
  const checkbox = screen.getByLabelText('관측 각도 범위') as HTMLInputElement;
  expect(checkbox.checked).toBe(true);
  await user.click(checkbox);
  expect(checkbox.checked).toBe(false);
  await user.click(checkbox);
  expect(checkbox.checked).toBe(true);
  expect(submit).not.toHaveBeenCalled();
  await user.click(screen.getByRole('button', { name: '게시하기' }));
  expect(submit.mock.calls[0][0]).toEqual(
    expect.objectContaining({
      content: '운동 영상을 공유했어요.',
      shared: {
        exerciseName: '무릎 굽혔다 펴기',
        date: '2026-10-24T00:00:00Z',
        range: 70,
      },
    }),
  );
  expect(submit.mock.calls[0][1].type).toBe('video/webm');
  expect(submit.mock.calls[0][1].size).toBe(4);
});

it('allows sharing selected record fields even without a caption or stored video', async () => {
  const submit = vi.fn(),
    user = userEvent.setup();
  const session: Session = {
    id: 'analysis-only',
    exerciseId: 'knee',
    recordedAt: '2026-10-25T00:00:00Z',
    duration: 2,
    side: 'right',
    cameraDirection: '측면',
    version: '2d-projected-v1',
    analysis: {
      min: 85,
      max: 160,
      range: 75,
      validFrames: 20,
      totalFrames: 20,
      validRatio: 1,
      repetitions: 1,
      frames: [],
    },
  };
  render(
    <ComposeForm
      sessions={[session]}
      session={session}
      nickname="테스트"
      userId="local-demo"
      busy={false}
      onClose={vi.fn()}
      onSubmit={submit}
    />,
  );
  await user.click(screen.getByRole('button', { name: '게시하기' }));
  expect(submit).toHaveBeenCalledWith(
    expect.objectContaining({
      content: '운동 기록을 공유했어요.',
      shared: expect.objectContaining({ range: 75 }),
    }),
    undefined,
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
it('previews only the chosen attachment and submits it with the explicit sharing selection', async () => {
  const NativeURL = URL;
  vi.stubGlobal(
    'URL',
    Object.assign(class extends NativeURL {}, {
      createObjectURL: vi.fn(() => 'blob:test-selected-attachment'),
      revokeObjectURL: vi.fn(),
    }),
  );
  const user = userEvent.setup(),
    submit = vi.fn();
  render(
    <ComposeForm
      sessions={[]}
      nickname="테스트"
      userId="local-demo"
      busy={false}
      onClose={vi.fn()}
      onSubmit={submit}
    />,
  );
  await user.type(screen.getByLabelText('나누고 싶은 이야기'), '오늘의 움직임을 남겨요.');
  const file = new File(['test-only'], 'selected.png', { type: 'image/png' });
  await user.upload(screen.getByLabelText('이미지 또는 영상 첨부 (선택)'), file);
  expect((await screen.findByAltText('게시할 첨부 이미지 미리보기')).getAttribute('src')).toBe(
    'blob:test-selected-attachment',
  );
  expect(submit).not.toHaveBeenCalled();
  await user.click(screen.getByRole('button', { name: '게시하기' }));
  expect(submit).toHaveBeenCalledWith(
    expect.objectContaining({ content: '오늘의 움직임을 남겨요.', shared: {} }),
    file,
  );
});
