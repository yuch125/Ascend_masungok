// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, expect, it, vi } from 'vitest';
import type { Session } from '../../types';
import SessionDetail from './SessionDetail';

const storedVideo = new Blob(['stored-video'], { type: 'video/webm' });

vi.mock('../../services/local', () => ({
  readMedia: vi.fn(async () => storedVideo),
}));

vi.mock('../../components/Charts', () => ({
  RangeChart: () => <div data-testid="range-chart" />,
  TimelineChart: () => <div data-testid="timeline-chart" />,
}));

vi.mock('../../components/VideoOverlay', () => ({
  VideoOverlay: () => <div data-testid="video-overlay" />,
}));

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open');
  };
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const session: Session = {
  id: 'session-1',
  exerciseId: 'knee',
  recordedAt: '2026-10-25T00:00:00Z',
  duration: 4,
  side: 'right',
  cameraDirection: '측면',
  version: '2d-projected-v1',
  mediaId: 'media-1',
  analysis: {
    min: 80,
    max: 165,
    range: 85,
    validFrames: 30,
    totalFrames: 30,
    validRatio: 1,
    repetitions: 2,
    frames: [],
  },
};

it('passes the stored recording to community sharing and confirms record deletion', async () => {
  vi.stubGlobal(
    'URL',
    Object.assign(class extends URL {}, {
      createObjectURL: vi.fn(() => 'blob:stored-video'),
      revokeObjectURL: vi.fn(),
    }),
  );
  const onShare = vi.fn(),
    onDelete = vi.fn(),
    user = userEvent.setup();

  render(
    <SessionDetail
      session={session}
      sessions={[session]}
      userId="local-demo"
      busy={false}
      onClose={vi.fn()}
      onNavigate={vi.fn()}
      onDelete={onDelete}
      onShare={onShare}
      onRemoveVideo={vi.fn()}
    />,
  );

  await waitFor(() => expect(screen.getByTestId('video-overlay')).toBeTruthy());
  await user.click(screen.getByRole('button', { name: /내 기록을 커뮤니티에 공유/ }));
  expect(onShare).toHaveBeenCalledWith(storedVideo);

  await user.click(screen.getByRole('button', { name: /기록 삭제/ }));
  await user.click(screen.getByRole('button', { name: /^삭제$/ }));
  expect(onDelete).toHaveBeenCalledTimes(1);
});
