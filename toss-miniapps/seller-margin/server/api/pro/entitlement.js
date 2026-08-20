import { readConfig } from '../../src/config.js';
import { getEntitlement } from '../../src/entitlement-service.js';
import { createRedisRestEntitlementStore } from '../../src/store.js';

export function createEntitlementHandler({ config = readConfig(), store = createRedisRestEntitlementStore({ url: config.kvUrl, token: config.kvToken }) } = {}) {
  return async function entitlement(request, response) {
    if (request.method !== 'GET') return response.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
    const userId = typeof request.query.userId === 'string' ? request.query.userId.trim() : '';
    if (!userId) return response.status(400).json({ error: 'USER_ID_REQUIRED' });
    return response.status(200).json(await getEntitlement({ store, userId }));
  };
}

export default async function handler(request, response) {
  try {
    return await createEntitlementHandler()(request, response);
  } catch {
    return response.status(503).json({ error: 'SERVER_NOT_CONFIGURED' });
  }
}
