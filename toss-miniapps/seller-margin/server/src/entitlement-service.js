import { hasMatchingAuthorization } from './crypto.js';
import { isEntitled, normalizeSubscriptionNotification } from './notification.js';

export async function receiveSubscriptionNotification({ authorization, body, config, store }) {
  if (!hasMatchingAuthorization(authorization, config.webhookAuthorization)) {
    return { code: 'UNAUTHORIZED', status: 401 };
  }

  let record;
  try {
    record = normalizeSubscriptionNotification(body, config);
  } catch (error) {
    return { code: error.message, status: 422 };
  }

  if (await store.hasEvent(record.eventId)) {
    return { code: 'DUPLICATE', status: 200 };
  }
  await store.saveEntitlement(record);
  await store.saveEvent(record.eventId);
  return { code: 'ACCEPTED', status: 200 };
}

export async function getEntitlement({ now = new Date(), store, userId }) {
  const record = await store.getEntitlement(userId);
  if (!isEntitled(record, now)) {
    return { expiresAt: null, granted: false, plan: null };
  }
  return { expiresAt: record.expiresAt, granted: true, plan: record.plan };
}
