import { afterEach, expect, it, vi } from 'vitest';
import { createVideoRecorder, recordingMime } from './recording';
afterEach(() => vi.unstubAllGlobals());
const stream = {} as MediaStream;

it('prefers MP4 using capabilities even when the device has a desktop user agent', () => {
  const constructor = vi.fn();
  vi.stubGlobal(
    'MediaRecorder',
    class {
      static isTypeSupported = () => true;
      constructor(...args: unknown[]) {
        constructor(...args);
      }
    },
  );
  expect(recordingMime()).toBe('video/mp4');
  createVideoRecorder(stream);
  expect(constructor).toHaveBeenCalledWith(stream, {
    mimeType: 'video/mp4',
    videoBitsPerSecond: 800_000,
  });
});
it('uses WebM on a browser without MP4 recording', () => {
  const constructor = vi.fn();
  vi.stubGlobal(
    'MediaRecorder',
    class {
      static isTypeSupported = (type: string) => type === 'video/webm;codecs=vp8';
      constructor(...args: unknown[]) {
        constructor(...args);
      }
    },
  );
  createVideoRecorder(stream);
  expect(constructor).toHaveBeenCalledWith(stream, {
    mimeType: 'video/webm;codecs=vp8',
    videoBitsPerSecond: 800_000,
  });
});
it('lets Safari select native options if explicitly advertised containers are rejected', () => {
  const constructor = vi.fn();
  vi.stubGlobal(
    'MediaRecorder',
    class {
      static isTypeSupported = () => true;
      constructor(...args: unknown[]) {
        constructor(...args);
        if (args.length > 1) throw new DOMException('unsupported options', 'NotSupportedError');
      }
    },
  );
  expect(() => createVideoRecorder(stream)).not.toThrow();
  expect(constructor).toHaveBeenLastCalledWith(stream);
});
