import { readConfig } from '../../src/config.js';
import { receiveSubscriptionNotification } from '../../src/entitlement-service.js';
import { createRedisRestEntitlementStore } from '../../src/store.js';

export function createSubscriptionWebhookHandler({ config = readConfig(), store = createRedisRestEntitlementStore({ url: config.kvUrl, token: config.kvToken }) } = {}) {
  return async function subscriptionWebhook(request, response) {
    if (request.method !== 'POST') return response.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
    const result = await receiveSubscriptionNotification({
      authorization: request.headers.authorization,
      body: request.body,
      config,
      store,
    });
    return response.status(result.status).json({ status: result.code });
  };
}

export default async function handler(request, response) {
  try {
    return await createSubscriptionWebhookHandler()(request, response);
  } catch (error) {
    return response.status(503).json({ error: error.message === 'ENTITLEMENT_STORE_UNAVAILABLE' ? error.message : 'SERVER_NOT_CONFIGURED' });
  }
}
