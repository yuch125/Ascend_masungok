// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { AppData, Frame, Landmark, Session } from '../types';
import { measureFrame, summarize } from '../features/pose-analysis/math';
import { defaultPlans, exercises } from '../features/exercise-tracking/exercises';
import { readMedia } from '../services/local';
import MobileHome from '../pages/Home/MobileHome';
import LatestAnalysisCard from './LatestAnalysisCard';

vi.mock('../services/local', () => ({ readMedia: vi.fn() }));
const points: Landmark[] = Array.from({ length: 33 }, () => ({
  x: 0.5,
  y: 0.5,
  z: 0,
  visibility: 1,
  presence: 1,
}));
points[23] = { ...points[23], y: 0.25 };
points[27] = { ...points[27], x: 0.75 };
const angle = measureFrame(points, exercises[0], 'left', 640, 480);
const frames: Frame[] = Array.from({ length: 5 }, (_, i) => ({
  time: i * 0.1,
  angle,
  landmarks: points,
}));
const latest: Session = {
  id: 'latest-test',
  exerciseId: 'knee',
  recordedAt: '2026-10-24T00:00:00Z',
  duration: 0.5,
  side: 'left',
  cameraDirection: '측면',
  version: 'test-v1',
  mediaId: 'latest-video-test',
  analysis: summarize(frames, exercises[0]),
};
const ctx = {
  clearRect: vi.fn(),
  beginPath: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  stroke: vi.fn(),
  arc: vi.fn(),
  fill: vi.fn(),
  fillText: vi.fn(),
};
beforeEach(() => {
  const NativeURL = URL;
  vi.stubGlobal(
    'URL',
    Object.assign(class extends NativeURL {}, {
      createObjectURL: vi.fn(() => 'blob:latest-stored-video'),
      revokeObjectURL: vi.fn(),
    }),
  );
  vi.stubGlobal(
    'requestAnimationFrame',
    vi.fn(() => 1),
  );
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
    () => ctx as unknown as CanvasRenderingContext2D,
  );
  Object.values(ctx).forEach((mock) => {
    if (vi.isMockFunction(mock)) mock.mockClear();
  });
  vi.mocked(readMedia).mockReset();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it('loads the latest actual stored video on home and draws its measured joint angle', async () => {
  const user = userEvent.setup();
  vi.mocked(readMedia).mockResolvedValue(new Blob(['test-only'], { type: 'video/webm' }));
  const data: AppData = {
    captures: [],
    symptoms: null,
    preferences: { saveOriginal: true },
    goals: [],
    plans: structuredClone(defaultPlans),
    sessions: [],
    posts: [],
    nickname: '테스트',
  };
  data.symptoms = {
    description: '무릎이 불편해요.',
    areas: ['knee'],
    side: 'left',
    professionalGuidance: false,
    updatedAt: '2026-10-24T00:00:00Z',
  };
  data.sessions = [
    {
      ...latest,
      id: 'older-test',
      recordedAt: '2026-10-22T00:00:00Z',
      mediaId: 'older-video-test',
    },
    latest,
  ];
  render(
    <MobileHome
      data={data}
      userId="account-test"
      onSelect={vi.fn()}
      onEditSymptoms={vi.fn()}
      onRecords={vi.fn()}
      onBrowse={vi.fn()}
      onGoal={vi.fn()}
      onDetail={vi.fn()}
      onCapture={vi.fn()}
    />,
  );
  const video = await screen.findByLabelText('무릎 굽혔다 펴기 분석 영상');
  expect(video.getAttribute('src')).toBe('blob:latest-stored-video');
  expect(readMedia).toHaveBeenCalledWith('account-test', 'latest-video-test');
  expect(readMedia).not.toHaveBeenCalledWith('account-test', 'older-video-test');
  expect(ctx.fillText).toHaveBeenCalledWith('90.0°', expect.any(Number), expect.any(Number));
  const card = screen.getByRole('region', { name: '가장 최근 운동 영상 분석' });
  expect(
    card.compareDocumentPosition(screen.getByRole('heading', { name: '나의 운동' })) &
      Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
  ctx.fillText.mockClear();
  await user.click(screen.getByLabelText('분석 표시'));
  expect(ctx.fillText).not.toHaveBeenCalled();
  expect(screen.getByLabelText('무릎 굽혔다 펴기 분석 영상')).toBe(video);
  await user.click(screen.getByLabelText('분석 표시'));
  expect(ctx.fillText).toHaveBeenCalledWith('90.0°', expect.any(Number), expect.any(Number));
});
it('keeps measurements but never fabricates a video when its private original is absent', async () => {
  vi.mocked(readMedia).mockResolvedValue(undefined);
  const detail = vi.fn();
  render(
    <LatestAnalysisCard
      session={latest}
      userId="another-device"
      onDetail={detail}
      onRecords={vi.fn()}
      onStart={vi.fn()}
    />,
  );
  await waitFor(() =>
    expect(readMedia).toHaveBeenCalledWith('another-device', 'latest-video-test'),
  );
  await screen.findByText('이 기기에 원본 영상이 없어요');
  expect(screen.queryByLabelText('무릎 굽혔다 펴기 분석 영상')).toBeNull();
  expect(screen.getAllByText('90.0')).toHaveLength(2);
  await userEvent.setup().click(screen.getByRole('button', { name: '분석 자세히' }));
  expect(detail).toHaveBeenCalledWith(latest);
});
