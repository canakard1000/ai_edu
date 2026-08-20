import assert from 'node:assert/strict';
import test from 'node:test';
import { createSubscriptionGateway } from '../src/subscription-gateway.js';
import { isSubscriptionReady } from '../src/runtime-config.js';

test('subscription is unavailable without an SKU and grant endpoint', () => {
  assert.equal(isSubscriptionReady({ monthlySku: '', annualSku: '', grantEndpoint: '' }, 'monthly'), false);
});

test('subscription requires the grant endpoint even when an SKU exists', () => {
  assert.equal(isSubscriptionReady({ monthlySku: 'monthly', annualSku: 'annual', grantEndpoint: '' }, 'annual'), false);
});

test('subscription opens IAP only when the real configuration is complete', () => {
  const messages = [];
  let received;
  const gateway = createSubscriptionGateway({
    config: { monthlySku: 'seller.month', annualSku: 'seller.year', grantEndpoint: 'https://example.test/grant' },
    iap: { createSubscriptionPurchaseOrder: Object.assign((options) => { received = options; return () => {}; }, { isSupported: () => true }) },
    setStatus: (message) => messages.push(message),
  });
  gateway.start('monthly');
  assert.equal(received.options.sku, 'seller.month');
  assert.match(messages.at(-1), /결제 화면/);
});

test('product grant stays locked when server verification rejects the order', async () => {
  let received;
  const gateway = createSubscriptionGateway({
    config: { monthlySku: 'seller.month', annualSku: 'seller.year', grantEndpoint: 'https://example.test/grant' },
    iap: { createSubscriptionPurchaseOrder: Object.assign((options) => { received = options; return () => {}; }, { isSupported: () => true }) },
    fetchImpl: async () => ({ ok: true, json: async () => ({ granted: false }) }),
    setStatus: () => {},
  });
  gateway.start('monthly');
  assert.equal(await received.options.processProductGrant({ orderId: 'order-1' }), false);
});
