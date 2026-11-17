// Railway (railway.com) project + service from a Docker image, public address from a generated domain.
// API: GraphQL at https://backboard.railway.com/graphql/v2 (docs: https://docs.railway.com/integrations/api).
// Not tested on a real account: written from the public docs on 2026-11-17; tests pin what host sends.
// Use an account token (created with "No workspace") so the key can create a project.
import { call, FLEETD_IMAGE } from './http.js';

const API = 'https://backboard.railway.com/graphql/v2';
const auth = (key) => ({ authorization: `Bearer ${key}` });

async function gql(fetchImpl, key, query, variables) {
  const data = await call(fetchImpl, API, { method: 'POST', headers: auth(key), body: { query, variables } });
  if (data?.errors?.length) throw new Error(`Railway: ${data.errors[0].message}`);
  return data?.data || {};
}

export default {
  label: 'Railway',
  untested: true,
  async create(key, { name, token }, { fetchImpl = fetch } = {}) {
    const p = await gql(fetchImpl, key, 'mutation($input: ProjectCreateInput!){projectCreate(input:$input){id name}}', { input: { name } });
    const projectId = p.projectCreate?.id;
    if (!projectId) throw new Error('Railway returned no project id');
    try {
      const e = await gql(fetchImpl, key, 'query($id: String!){project(id:$id){environments{edges{node{id name}}}}}', { id: projectId });
      const envs = (e.project?.environments?.edges || []).map((x) => x.node);
      const environmentId = (envs.find((x) => x.name === 'production') || envs[0])?.id;
      if (!environmentId) throw new Error('Railway returned no environment');
      const s = await gql(fetchImpl, key, 'mutation($input: ServiceCreateInput!){serviceCreate(input:$input){id name}}', {
        input: {
          projectId,
          name: 'fleetd',
          source: { image: FLEETD_IMAGE },
          variables: { FLEETD_TOKEN: token, HOST: '0.0.0.0', PORT: '7860' },
        },
      });
      const serviceId = s.serviceCreate?.id;
      if (!serviceId) throw new Error('Railway returned no service id');
      const d = await gql(fetchImpl, key, 'mutation($input: ServiceDomainCreateInput!){serviceDomainCreate(input:$input){id domain}}', {
        input: { serviceId, environmentId, targetPort: 7860 },
      });
      const domain = d.serviceDomainCreate?.domain;
      if (!domain) throw new Error('Railway returned no public address');
      return { id: projectId, url: `https://${domain}` };
    } catch (err) {
      await gql(fetchImpl, key, 'mutation($id: String!){projectDelete(id:$id)}', { id: projectId }).catch(() => {});
      throw err;
    }
  },
  async remove(key, id, { fetchImpl = fetch } = {}) {
    await gql(fetchImpl, key, 'mutation($id: String!){projectDelete(id:$id)}', { id });
  },
};
