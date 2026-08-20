import assert from 'node:assert/strict';
import test from 'node:test';
import { getEntitlement, receiveSubscriptionNotification } from '../src/entitlement-service.js';
import { createMemoryEntitlementStore } from '../src/store.js';

const config = {
  annualSku: 'seller.pro.year',
  monthlySku: 'seller.pro.month',
  webhookAuthorization: 'Basic webhook-secret',
};

function activeMonthly(overrides = {}) {
  return {
    eventId: 'event-1',
    expiresAt: '2030-02-01T00:00:00.000Z',
    productId: config.monthlySku,
    status: 'ACTIVE',
    updatedAt: '2030-01-01T00:00:00.000Z',
    userId: 'user-1',
    ...overrides,
  };
}

test('an unpurchased user has no entitlement', async () => {
  const result = await getEntitlement({ store: createMemoryEntitlementStore(), userId: 'new-user' });
  assert.deepEqual(result, { expiresAt: null, granted: false, plan: null });
});

test('an active monthly notification grants the monthly plan', async () => {
  const store = createMemoryEntitlementStore();
  const accepted = await receiveSubscriptionNotification({ authorization: config.webhookAuthorization, body: activeMonthly(), config, store });
  assert.equal(accepted.code, 'ACCEPTED');
  assert.deepEqual(await getEntitlement({ store, userId: 'user-1', now: new Date('2030-01-15') }), {
    expiresAt: '2030-02-01T00:00:00.000Z', granted: true, plan: 'monthly',
  });
});

test('an active annual notification grants the yearly plan', async () => {
  const store = createMemoryEntitlementStore();
  await receiveSubscriptionNotification({
    authorization: config.webhookAuthorization,
    body: activeMonthly({ eventId: 'annual-1', productId: config.annualSku }), config, store,
  });
  assert.equal((await getEntitlement({ store, userId: 'user-1', now: new Date('2030-01-15') })).plan, 'yearly');
});

test('an expired entitlement is not granted', async () => {
  const store = createMemoryEntitlementStore();
  await receiveSubscriptionNotification({ authorization: config.webhookAuthorization, body: activeMonthly({ expiresAt: '2030-01-02T00:00:00.000Z' }), config, store });
  assert.equal((await getEntitlement({ store, userId: 'user-1', now: new Date('2030-01-03') })).granted, false);
});

test('a cancellation revokes entitlement', async () => {
  const store = createMemoryEntitlementStore();
  await receiveSubscriptionNotification({ authorization: config.webhookAuthorization, body: activeMonthly(), config, store });
  await receiveSubscriptionNotification({
    authorization: config.webhookAuthorization,
    body: activeMonthly({ eventId: 'cancel-1', status: 'CANCELED', updatedAt: '2030-01-02T00:00:00.000Z' }), config, store,
  });
  assert.equal((await getEntitlement({ store, userId: 'user-1', now: new Date('2030-01-03') })).granted, false);
});

test('unknown SKUs cannot create entitlement', async () => {
  const result = await receiveSubscriptionNotification({
    authorization: config.webhookAuthorization,
    body: activeMonthly({ productId: 'other.product' }), config, store: createMemoryEntitlementStore(),
  });
  assert.deepEqual(result, { code: 'UNSUPPORTED_PRODUCT', status: 422 });
});

test('a forged webhook authorization is rejected', async () => {
  const result = await receiveSubscriptionNotification({
    authorization: 'Basic forged', body: activeMonthly(), config, store: createMemoryEntitlementStore(),
  });
  assert.deepEqual(result, { code: 'UNAUTHORIZED', status: 401 });
});

test('a duplicate webhook is idempotent', async () => {
  const store = createMemoryEntitlementStore();
  const first = await receiveSubscriptionNotification({ authorization: config.webhookAuthorization, body: activeMonthly(), config, store });
  const duplicate = await receiveSubscriptionNotification({ authorization: config.webhookAuthorization, body: activeMonthly(), config, store });
  assert.equal(first.code, 'ACCEPTED');
  assert.deepEqual(duplicate, { code: 'DUPLICATE', status: 200 });
});

test('missing notification fields are rejected instead of inferred', async () => {
  const result = await receiveSubscriptionNotification({
    authorization: config.webhookAuthorization, body: { status: 'ACTIVE' }, config, store: createMemoryEntitlementStore(),
  });
  assert.deepEqual(result, { code: 'INVALID_NOTIFICATION_PAYLOAD', status: 422 });
});
