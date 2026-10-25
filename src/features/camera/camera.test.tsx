// @vitest-environment jsdom
import { act, cleanup, render, renderHook, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cameraErrorMessage, requestCamera } from './camera';
import { useCamera } from './useCamera';
import ExercisePage from '../../pages/Exercise/ExercisePage';
import { StrictMode } from 'react';
import { exercises } from '../exercise-tracking/exercises';
vi.mock('../../services/local', () => ({ readMedia: vi.fn() }));
vi.mock('./useLivePose', () => ({
  useLivePose: () => ({ state: 'searching', angle: null, error: '', retry: vi.fn() }),
}));

const originalMedia = Object.getOwnPropertyDescriptor(navigator, 'mediaDevices');
const originalSecure = Object.getOwnPropertyDescriptor(window, 'isSecureContext');
const getUserMedia = vi.fn();
function fakeStream() {
  const track = Object.assign(new EventTarget(), { stop: vi.fn() });
  const stream = {
    getTracks: () => [track],
    getVideoTracks: () => [track],
  } as unknown as MediaStream;
  return { stream, track };
}
beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open');
  };
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia } });
  Object.defineProperty(window, 'isSecureContext', { configurable: true, value: true });
  getUserMedia.mockReset();
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
  if (originalMedia) Object.defineProperty(navigator, 'mediaDevices', originalMedia);
  else Reflect.deleteProperty(navigator, 'mediaDevices');
  if (originalSecure) Object.defineProperty(window, 'isSecureContext', originalSecure);
  else Reflect.deleteProperty(window, 'isSecureContext');
});

describe('camera access and actionable failures', () => {
  it('requests video without microphone and preserves front/rear preference', async () => {
    const { stream } = fakeStream();
    getUserMedia.mockResolvedValue(stream);
    expect(await requestCamera('environment')).toBe(stream);
    expect(getUserMedia).toHaveBeenCalledWith({
      audio: false,
      video: {
        facingMode: { ideal: 'environment' },
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
    });
  });
  it('retries unsupported device constraints without silently retrying permission denials', async () => {
    const { stream } = fakeStream();
    getUserMedia
      .mockRejectedValueOnce(new DOMException('', 'OverconstrainedError'))
      .mockResolvedValueOnce(stream);
    expect(await requestCamera('user')).toBe(stream);
    expect(getUserMedia).toHaveBeenLastCalledWith({ audio: false, video: true });
    getUserMedia.mockReset().mockRejectedValue(new DOMException('', 'NotAllowedError'));
    await expect(requestCamera('user')).rejects.toHaveProperty('name', 'NotAllowedError');
    expect(getUserMedia).toHaveBeenCalledTimes(1);
  });
  it('explains HTTP and missing browser support before attempting permission', async () => {
    Object.defineProperty(window, 'isSecureContext', { configurable: true, value: false });
    await expect(requestCamera('user')).rejects.toHaveProperty('name', 'InsecureContextError');
    expect(getUserMedia).not.toHaveBeenCalled();
    expect(cameraErrorMessage({ name: 'InsecureContextError' })).toContain('HTTPS');
    Object.defineProperty(window, 'isSecureContext', { configurable: true, value: true });
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: undefined });
    await expect(requestCamera('user')).rejects.toHaveProperty('name', 'UnsupportedCameraError');
  });
  it('gives distinct instructions for blocked, missing and busy cameras', () => {
    expect(cameraErrorMessage({ name: 'NotAllowedError' })).toContain('사이트 설정');
    expect(cameraErrorMessage({ name: 'NotFoundError' })).toContain('찾지 못했어요');
    expect(cameraErrorMessage({ name: 'NotReadableError' })).toContain('화상회의');
  });
});

describe('camera lifecycle', () => {
  it('releases a stream arriving after the user cancels a pending request', async () => {
    const { stream, track } = fakeStream();
    let resolve!: (s: MediaStream) => void;
    getUserMedia.mockReturnValue(
      new Promise<MediaStream>((done) => {
        resolve = done;
      }),
    );
    const hook = renderHook(() => useCamera());
    let pending!: Promise<void>;
    act(() => {
      pending = hook.result.current.connect();
    });
    expect(hook.result.current.connecting).toBe(true);
    act(() => hook.result.current.stop());
    await act(async () => {
      resolve(stream);
      await pending;
    });
    expect(track.stop).toHaveBeenCalledOnce();
    expect(hook.result.current.stream).toBeUndefined();
  });
  it('releases the camera when leaving the screen', async () => {
    const { stream, track } = fakeStream();
    getUserMedia.mockResolvedValue(stream);
    const hook = renderHook(() => useCamera());
    await act(() => hook.result.current.connect());
    expect(hook.result.current.stream).toBe(stream);
    hook.unmount();
    expect(track.stop).toHaveBeenCalledOnce();
  });
  it('ends a stalled permission request and disposes a later response', async () => {
    vi.useFakeTimers();
    const { stream, track } = fakeStream();
    let resolve!: (s: MediaStream) => void;
    getUserMedia.mockReturnValue(
      new Promise<MediaStream>((done) => {
        resolve = done;
      }),
    );
    const hook = renderHook(() => useCamera());
    let pending!: Promise<void>;
    act(() => {
      pending = hook.result.current.connect();
    });
    act(() => vi.advanceTimersByTime(30000));
    expect(hook.result.current.connecting).toBe(false);
    expect(hook.result.current.error).toContain('허용 창');
    await act(async () => {
      resolve(stream);
      await pending;
    });
    expect(track.stop).toHaveBeenCalledOnce();
  });
});

it('connects without a blocking checkbox, explains denial and permits retry', async () => {
  const user = userEvent.setup();
  getUserMedia.mockRejectedValueOnce(new DOMException('', 'NotAllowedError'));
  const view = render(
    <ExercisePage
      exercise={exercises[0]}
      sessions={[]}
      onBack={vi.fn()}
      onSave={vi.fn()}
      onShare={vi.fn()}
    />,
  );
  const button = screen.getByRole('button', { name: '카메라 연결' }) as HTMLButtonElement;
  expect(button.disabled).toBe(false);
  expect(screen.queryByRole('checkbox')).toBeNull();
  await user.click(button);
  expect((await screen.findByRole('alert')).textContent).toContain('사이트 설정');
  expect(screen.getByRole('button', { name: '영상 불러오기' })).toBeDefined();
  const { stream, track } = fakeStream();
  getUserMedia.mockResolvedValueOnce(stream);
  await user.click(screen.getByRole('button', { name: '다시 시도' }));
  await waitFor(() =>
    expect((screen.getByLabelText('실시간 카메라 미리보기') as HTMLVideoElement).srcObject).toBe(
      stream,
    ),
  );
  view.unmount();
  expect(track.stop).toHaveBeenCalledOnce();
});

it('automatically connects once after explicit course consent under StrictMode', async () => {
  const { stream, track } = fakeStream();
  getUserMedia.mockResolvedValue(stream);
  const screenView = render(
    <StrictMode>
      <ExercisePage
        exercise={exercises[0]}
        sessions={[]}
        onBack={vi.fn()}
        onSave={vi.fn()}
        onShare={vi.fn()}
        autoConnect
        consentGranted
      />
    </StrictMode>,
  );
  await waitFor(() => expect(getUserMedia).toHaveBeenCalledTimes(1));
  await waitFor(() =>
    expect((screen.getByLabelText('실시간 카메라 미리보기') as HTMLVideoElement).srcObject).toBe(
      stream,
    ),
  );
  screenView.unmount();
  expect(track.stop).toHaveBeenCalledOnce();
});
