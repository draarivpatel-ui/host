// SnapDeploy (snapdeploy.dev) container from a public Docker image. API: https://snapdeploy.dev/api/mobile (docs: https://snapdeploy.dev/api).
// Not tested on a real account: written from the public docs on 2026-11-17; tests pin what host sends.
// The key needs the "deploy" scope. The free plan sleeps after 15 minutes idle and allows 5 deploys per 12 hours.
import { call, FLEETD_IMAGE } from './http.js';

const API = 'https://snapdeploy.dev/api/mobile';
const auth = (key) => ({ 'x-api-key': key });
const [IMAGE, TAG] = FLEETD_IMAGE.split(/:(?=[^/]*$)/);

export default {
  label: 'SnapDeploy',
  untested: true,
  async create(key, { name, token }, { fetchImpl = fetch } = {}) {
    const c = await call(fetchImpl, `${API}/containers`, {
      method: 'POST',
      headers: auth(key),
      body: {
        name,
        image: IMAGE,
        imageTag: TAG || 'latest',
        port: 7860,
        memory: 512,
        environmentVariables: { FLEETD_TOKEN: token, HOST: '0.0.0.0', PORT: '7860' },
      },
    });
    const box = c?.container || c;
    const id = box?.id || box?.containerId;
    if (!id) throw new Error('SnapDeploy returned no container id');
    // A public image is created stopped: start it. A 402 means the free hours are used up, so it is not retried.
    const started = await call(fetchImpl, `${API}/containers/${encodeURIComponent(id)}/start`, { method: 'POST', headers: auth(key) });
    const url = box?.url || started?.url || started?.container?.url || `https://${name}.containers.snapdeploy.app`;
    return { id: String(id), url };
  },
  async remove(key, id, { fetchImpl = fetch } = {}) {
    try {
      await call(fetchImpl, `${API}/containers/${encodeURIComponent(id)}`, { method: 'DELETE', headers: auth(key) });
    } catch (e) {
      if (e.status === 403) throw new Error('SnapDeploy does not let an API key delete a container: delete it in the SnapDeploy dashboard');
      throw e;
    }
  },
};
