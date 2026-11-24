import { describe, expect, test } from 'bun:test';
import { handle } from '../src/index.js';

// GEL guard `next-cta`: exactly one data-next-cta, with class next-cta, first link/button after the first <h1>.
const ORIGIN = 'https://host.flisk.si';
const env = { PUBLIC_ORIGIN: ORIGIN, SESSION_SECRET: 's3cret' };
const html = async () => (await handle(new Request(`${ORIGIN}/`), env)).text();

describe('next-cta marker on the home page', () => {
  test('exactly one data-next-cta, with class next-cta', async () => {
    const h = await html();
    expect(h.match(/data-next-cta/g)?.length).toBe(1);
    const tag = h.match(/<a\b[^>]*data-next-cta[^>]*>/)[0];
    expect(tag).toMatch(/class="[^"]*\bnext-cta\b[^"]*"/);
    expect(tag).toMatch(/class="[^"]*\bbtn-key\b/);
  });

  test('it is the first link or button after the first <h1>', async () => {
    const h = await html();
    const after = h.slice(h.indexOf('<h1'));
    const first = after.match(/<(a|button)\b[^>]*>/)[0];
    expect(first).toContain('data-next-cta');
  });

  test('CSS spins the border and has a prefers-reduced-motion rule', async () => {
    const h = await html();
    expect(h).toContain('@property --next-cta-angle');
    expect(h).toMatch(/\.next-cta[^}]*animation:[^;}]*next-cta-spin/);
    expect(h).toMatch(/@media \(prefers-reduced-motion:\s*reduce\)\{[^@]*\.next-cta/);
  });
});
