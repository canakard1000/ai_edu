import assert from 'node:assert/strict';
import test from 'node:test';
import { createEntitlementHandler } from '../api/pro/entitlement.js';
import { createSubscriptionWebhookHandler } from '../api/toss/subscription-webhook.js';
import { createMemoryEntitlementStore } from '../src/store.js';

const config = { annualSku: 'year', kvToken: 'unused', kvUrl: 'https://unused.test', monthlySku: 'month', webhookAuthorization: 'Basic valid' };

function responseRecorder() {
  return {
    body: null,
    code: null,
    json(payload) { this.body = payload; return this; },
    status(code) { this.code = code; return this; },
  };
}

test('webhook only allows POST', async () => {
  const response = responseRecorder();
  await createSubscriptionWebhookHandler({ config, store: createMemoryEntitlementStore() })({ method: 'GET', headers: {}, body: {} }, response);
  assert.equal(response.code, 405);
});

test('entitlement only allows GET', async () => {
  const response = responseRecorder();
  await createEntitlementHandler({ config, store: createMemoryEntitlementStore() })({ method: 'POST', query: {} }, response);
  assert.equal(response.code, 405);
});

test('entitlement cannot be created with a client GET request', async () => {
  const response = responseRecorder();
  await createEntitlementHandler({ config, store: createMemoryEntitlementStore() })({ method: 'GET', query: { userId: 'attempted-grant' } }, response);
  assert.deepEqual(response.body, { expiresAt: null, granted: false, plan: null });
});
