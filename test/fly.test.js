import { expect, test } from 'bun:test';
import fly from '../src/providers/fly.js';

const app = 'fleetd-test';
const root = 'https://api.machines.dev/v1/apps';

test.each([204, 503])('Fly rolls back the app after machine creation fails (cleanup status %i)', async (cleanupStatus) => {
  const seen = [];
  const fetchImpl = async (url, init) => {
    seen.push([init.method, url, init.headers.authorization]);
    if (seen.length === 1) return new Response(null, { status: 201 });
    if (seen.length === 2) return Response.json({ message: 'machine rejected' }, { status: 422 });
    return new Response(null, { status: cleanupStatus });
  };
  await expect(fly.create('my-org:example-key', { name: app, token: 'example' }, { fetchImpl }))
    .rejects.toThrow('HTTP 422: machine rejected');
  expect(seen).toEqual([
    ['POST', root, 'Bearer example-key'],
    ['POST', `${root}/${app}/machines`, 'Bearer example-key'],
    ['DELETE', `${root}/${app}`, 'Bearer example-key'],
  ]);
});

test('Fly does not delete an app when app creation itself is refused', async () => {
  const seen = [];
  const fetchImpl = async (url, init) => {
    seen.push([init.method, url]);
    return Response.json({ message: 'app name already taken' }, { status: 409 });
  };
  await expect(fly.create('example-key', { name: app, token: 'example' }, { fetchImpl }))
    .rejects.toThrow('HTTP 409: app name already taken');
  expect(seen).toEqual([['POST', root]]);
});
