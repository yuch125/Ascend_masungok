// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import App from './App';
import { readData } from './services/local';

vi.mock('framer-motion', () => ({
  AnimatePresence: ({ children }: { children: ReactNode }) => children,
  motion: { div: ({ children }: { children: ReactNode }) => <div>{children}</div> },
}));
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open');
  };
  window.scrollTo = vi.fn();
  Object.defineProperty(window, 'isSecureContext', { configurable: true, value: true });
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: { getUserMedia: vi.fn().mockRejectedValue(new DOMException('', 'NotAllowedError')) },
  });
});
afterEach(cleanup);

describe('four-tab mobile journey', () => {
  it('collects symptoms, matches courses, starts the camera with consent, edits symptoms and shares posts', async () => {
    const user = userEvent.setup();
    const first = render(<App />);
    const description = await screen.findByLabelText('내 증상 / 불편함');
    expect(screen.queryByRole('navigation')).toBeNull();
    await user.type(description, '계단을 내려갈 때 오른쪽 무릎이 불편해요.');
    await user.selectOptions(screen.getByLabelText('불편한 쪽'), 'right');
    await user.click(screen.getByRole('button', { name: '나를 위한 운동 보기' }));
    await screen.findByRole('heading', { name: '무릎 굽혔다 펴기' });
    expect(screen.queryByRole('heading', { name: '팔 들어 올리기' })).toBeNull();
    const nav = screen.getByRole('navigation', { name: '주 메뉴' });
    expect(
      within(nav)
        .getAllByRole('button')
        .map((button) => button.textContent),
    ).toEqual(['홈', '내 기록', '커뮤니티', '더보기']);
    expect((await readData('local-demo')).symptoms?.side).toBe('right');
    await user.click(screen.getByRole('button', { name: /무릎 굽혔다 펴기.*운동 선택/ }));
    await user.click(screen.getByRole('button', { name: '카메라 열기' }));
    expect((await screen.findByRole('alert')).textContent).toContain('사이트 설정');
    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledTimes(1);
    expect((screen.getByRole('button', { name: '다시 시도' }) as HTMLButtonElement).disabled).toBe(
      false,
    );
    expect(screen.getByRole('button', { name: '오른쪽 무릎' })).toBeDefined();
    expect(screen.queryByRole('navigation')).toBeNull();
    await user.click(screen.getByRole('button', { name: '촬영 화면 닫기' }));
    await user.click(screen.getByRole('button', { name: '더보기' }));
    await user.click(screen.getByRole('button', { name: '내 증상 / 불편함 수정' }));
    await user.clear(screen.getByLabelText('내 증상 / 불편함'));
    await user.type(
      screen.getByLabelText('내 증상 / 불편함'),
      '어깨가 불편해서 팔을 들어 올리기 어려워요.',
    );
    await user.click(screen.getByRole('button', { name: '저장하고 운동 다시 보기' }));
    await screen.findByRole('heading', { name: '팔 들어 올리기' });
    expect(screen.queryByRole('heading', { name: '무릎 굽혔다 펴기' })).toBeNull();
    first.unmount();
    render(<App />);
    await screen.findByRole('heading', { name: '팔 들어 올리기' });
    expect((await readData('local-demo')).symptoms?.areas).toEqual(['shoulder']);
    await user.click(screen.getByRole('button', { name: '내 기록' }));
    await screen.findByRole('heading', { name: '첫 기록을 기다리고 있어요' });
    await user.click(screen.getByRole('button', { name: '커뮤니티' }));
    await user.click(screen.getByRole('button', { name: '이야기 나누기' }));
    await user.type(screen.getByLabelText('나누고 싶은 이야기'), '오늘도 나의 속도로 한 걸음!');
    await user.click(screen.getByRole('button', { name: '게시하기' }));
    await screen.findByText('오늘도 나의 속도로 한 걸음!');
    expect((await readData('local-demo')).posts[0].shared).toEqual({});
    await user.click(screen.getByRole('button', { name: '좋아요' }));
    await waitFor(async () =>
      expect((await readData('local-demo')).posts[0].likes).toEqual(['local-demo']),
    );
    await user.click(screen.getByRole('button', { name: '댓글' }));
    await user.type(screen.getByLabelText('댓글 내용'), '꾸준히 기록해요!');
    await user.click(screen.getByRole('button', { name: '등록' }));
    await screen.findByText('꾸준히 기록해요!');
    await user.click(screen.getByRole('button', { name: '공유' }));
    expect(
      (screen.getByRole('textbox', { name: '공유할 글 내용' }) as HTMLTextAreaElement).value,
    ).toBe('오늘도 나의 속도로 한 걸음!');
    expect((await readData('local-demo')).sessions).toHaveLength(0);
  });
});
