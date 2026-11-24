import { expect, test } from 'bun:test';
import koyeb from '../src/providers/koyeb.js';

const API = 'https://app.koyeb.com/v1';

function createHost({ serviceStatus = 200, domain, deleteStatus = 204 } = {}) {
  const requests = [];
  const fetchImpl = async (url, { method, headers }) => {
    requests.push(`${method} ${url}`);
    expect(headers.authorization).toBe('Bearer example');
    if (method === 'POST' && url === `${API}/apps`) return Response.json({ app: { id: 'app-1' } });
    if (method === 'POST' && url === `${API}/services`) {
      return Response.json({ message: 'service rejected' }, { status: serviceStatus });
    }
    if (method === 'GET' && url === `${API}/apps/app-1`) {
      return Response.json({ app: { domains: domain ? [{ name: domain }] : [] } });
    }
    if (method === 'DELETE' && url === `${API}/apps/app-1`) {
      return new Response(null, { status: deleteStatus });
    }
    throw new Error(`Unexpected request: ${method} ${url}`);
  };
  return {
    result: koyeb.create('example', { name: 'test-host', token: 'example' }, { fetchImpl }),
    requests,
  };
}

test('Koyeb deletes a new app if its service is rejected', async () => {
  const { result, requests } = createHost({ serviceStatus: 422 });
  await expect(result).rejects.toThrow('HTTP 422: service rejected');
  expect(requests).toEqual([
    `POST ${API}/apps`,
    `POST ${API}/services`,
    `DELETE ${API}/apps/app-1`,
  ]);
});

test('Koyeb tries to delete an app with no domain without hiding the original error', async () => {
  const { result, requests } = createHost({ deleteStatus: 500 });
  await expect(result).rejects.toThrow('Koyeb returned no public domain yet');
  expect(requests).toEqual([
    `POST ${API}/apps`,
    `POST ${API}/services`,
    `GET ${API}/apps/app-1`,
    `DELETE ${API}/apps/app-1`,
  ]);
});

test('Koyeb keeps an app that gets a public domain', async () => {
  const { result, requests } = createHost({ domain: 'fleetd.example.com' });
  expect(await result).toEqual({ id: 'app-1', url: 'https://fleetd.example.com' });
  expect(requests).toEqual([
    `POST ${API}/apps`,
    `POST ${API}/services`,
    `GET ${API}/apps/app-1`,
  ]);
});
