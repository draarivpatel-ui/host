import { describe, expect, test } from 'bun:test';
import { handle } from '../src/index.js';
import { makeSession } from '../src/session.js';

// The org bar (flisk.si/assets/bar.js) reads the signed-in login from [data-flisk-login] in the second-level header.
const ORIGIN = 'https://host.flisk.si';
const env = { PUBLIC_ORIGIN: ORIGIN, SESSION_SECRET: 's3cret' };
const HOOK = '<span data-flisk-login hidden></span>';
const page = (path, cookie) => handle(new Request(`${ORIGIN}${path}`, { headers: cookie ? { cookie } : {} }), env);
const cookieFor = async (login) => (await makeSession(env, login)).split(';')[0];

describe('header login for the org bar', () => {
  test.each(['/', '/docs'])('signed out: %s has the empty hook, a Console button and its usual caching', async (path) => {
    const res = await page(path);
    const html = await res.text();
    expect(html).toContain(HOOK);
    expect(html).toContain('class="cta" href="/console"');
    expect(res.headers.get('cache-control')).toContain('public');
  });

  test.each(['/', '/docs'])('signed in: %s carries the login, private and uncached', async (path) => {
    const res = await page(path, await cookieFor('octo-cat'));
    const html = await res.text();
    expect(html).toContain('<span data-flisk-login hidden>octo-cat</span>');
    expect(html).not.toContain(HOOK);
    expect(html.match(/data-flisk-login/g).length).toBe(1);
    expect(res.headers.get('cache-control')).toBe('private, no-store');
    expect(res.headers.get('vary')).toContain('Cookie');
  });

  test('a forged session shows no login and stays cacheable', async () => {
    const res = await page('/', 'host_sess=evil.99999999999999.AAAA');
    expect(await res.text()).toContain(HOOK);
    expect(res.headers.get('cache-control')).toContain('public');
  });

  test('the login is escaped', async () => {
    const cookie = (await makeSession(env, '<b>x')).split(';')[0];
    const html = await (await page('/', cookie)).text();
    expect(html).toContain('hidden>&lt;b&gt;x</span>');
  });

  test('a non-page response is not touched', async () => {
    const res = await page('/robots.txt', await cookieFor('octo'));
    expect(res.headers.get('cache-control')).not.toBe('private, no-store');
  });
});
