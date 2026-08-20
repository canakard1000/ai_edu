import assert from 'node:assert/strict';
import test from 'node:test';
import { SELLER_MARGIN_DEEP_LINK, createShareMessage, shareSellerMargin } from '../src/share-flow.js';

test('official share flow creates a link from the seller-margin deep link', async () => {
  let requestedPath;
  let message;
  await shareSellerMargin({
    createLink: async (path) => { requestedPath = path; return 'https://share.example/seller'; },
    sendMessage: async (payload) => { message = payload.message; },
  });
  assert.equal(requestedPath, SELLER_MARGIN_DEEP_LINK);
  assert.match(message, /셀러마진/);
  assert.match(message, /https:\/\/share\.example\/seller/);
});

test('share copy includes the expected seller-margin description', () => {
  assert.match(createShareMessage('https://share.example/seller'), /판매 전에 순이익/);
});
