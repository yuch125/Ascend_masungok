import { describe, expect, it, vi } from 'vitest';
import { createServiceWorker } from './serviceWorkerSource';

const shell =
  '<meta name="application-name" content="Re:Move"><script src="/assets/index-unit.js"></script>';
const html = (value = shell) => new Response(value, { headers: { 'Content-Type': 'text/html' } });
function harness() {
  const stored = new Map<string, Response>(),
    events = new Map<string, (event: unknown) => void>();
  const cache = {
    put: vi.fn(async (key: string, value: Response) => {
      stored.set(key, value.clone());
    }),
    match: vi.fn(async (key: string) => stored.get(key)?.clone()),
  };
  const caches = {
    open: vi.fn(async () => cache),
    keys: vi.fn(async () => ['re-move-app-old', 'unrelated-cache', 're-move-app-unit']),
    delete: vi.fn(),
  };
  const fetch = vi.fn(async (request: string | { url: string }) =>
    (typeof request === 'string' ? request : request.url) === '/'
      ? html()
      : new Response('static', { headers: { 'Content-Type': 'application/javascript' } }),
  );
  const scope = {
    location: { origin: 'https://app.test' },
    clients: { claim: vi.fn() },
    addEventListener: (name: string, listener: (event: unknown) => void) =>
      events.set(name, listener),
  };
  new Function(
    'self',
    'caches',
    'fetch',
    'URL',
    'Response',
    createServiceWorker(['/assets/index-unit.js'], 'unit'),
  )(scope, caches, fetch, URL, Response);
  async function lifetime(name: string) {
    let work!: Promise<void>;
    events.get(name)!({
      waitUntil: (job: Promise<void>) => {
        work = job;
      },
    });
    await work;
  }
  function request(path: string, mode = 'cors') {
    let response: Promise<Response> | undefined;
    events.get('fetch')!({
      request: { url: new URL(path, 'https://app.test').href, method: 'GET', mode },
      respondWith: (job: Promise<Response>) => {
        response = job;
      },
    });
    return response;
  }
  return { stored, cache, caches, fetch, scope, lifetime, request };
}

describe('installable application offline cache', () => {
  it('opens a complete cached shell offline and reuses models only after a successful download', async () => {
    const app = harness();
    await app.lifetime('install');
    expect(await (await app.cache.match('/'))?.text()).toBe(shell);
    app.fetch.mockRejectedValueOnce(new TypeError('offline'));
    expect(await (await app.request('/', 'navigate'))?.text()).toBe(shell);
    await app.request('/models/pose_landmarker_lite.task');
    app.fetch.mockClear();
    expect(await (await app.request('/models/pose_landmarker_lite.task'))?.text()).toBe('static');
    expect(app.fetch).not.toHaveBeenCalled();
    expect(await (await app.request('/assets/index-unit.js'))?.text()).toBe('static');
  });
  it('never intercepts sign-in, APIs, media uploads or third-party services', () => {
    const app = harness();
    for (const path of [
      '/signin-with-chatgpt',
      '/callback',
      '/api/records',
      '/community-media/video.mp4',
      'https://supabase.test/rest/v1/posts',
    ]) {
      expect(app.request(path, 'navigate')).toBeUndefined();
    }
    expect(app.fetch).not.toHaveBeenCalled();
  });
  it('rejects a sign-in page instead of installing it as the app shell', async () => {
    const app = harness();
    app.fetch.mockResolvedValueOnce(html('<h1>Sign in</h1>'));
    await expect(app.lifetime('install')).rejects.toThrow('shell is unavailable');
    expect(app.stored.has('/')).toBe(false);
  });
  it('returns authentication failures online and preserves the matching offline app version', async () => {
    const app = harness();
    await app.lifetime('install');
    app.fetch.mockResolvedValueOnce(new Response('Login required', { status: 401 }));
    expect((await app.request('/', 'navigate'))?.status).toBe(401);
    app.fetch.mockResolvedValueOnce(html(shell.replace('index-unit.js', 'index-new.js')));
    expect(await (await app.request('/', 'navigate'))?.text()).toContain('index-new.js');
    expect(await (await app.cache.match('/'))?.text()).toContain('index-unit.js');
  });
  it('cleans only obsolete app caches when an update activates', async () => {
    const app = harness();
    await app.lifetime('activate');
    expect(app.caches.delete).toHaveBeenCalledExactlyOnceWith('re-move-app-old');
    expect(app.scope.clients.claim).toHaveBeenCalledOnce();
  });
});
