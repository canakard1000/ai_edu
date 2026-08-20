const ACTIVE_STATUSES = new Set(['ACTIVE', 'TRIAL', 'GRACE_PERIOD']);
const INACTIVE_STATUSES = new Set(['CANCELED', 'CANCELLED', 'EXPIRED', 'REFUNDED', 'REVOKED']);

function stringValue(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function isoDate(value) {
  if (value == null || value === '') return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

// Toss documents describe the notification URL and Basic Auth header but do not
// publish a payload schema. Unknown fields are therefore rejected by default.
export function normalizeSubscriptionNotification(body, config) {
  const userId = stringValue(body?.userId ?? body?.userKey);
  const productId = stringValue(body?.productId ?? body?.sku);
  const status = stringValue(body?.status)?.toUpperCase();
  const updatedAt = isoDate(body?.updatedAt);
  const expiresAt = isoDate(body?.expiresAt);
  const eventId = stringValue(body?.eventId) ?? [body?.subscriptionId, status, updatedAt].filter(Boolean).join(':');

  if (!userId || !productId || !status || !updatedAt || !eventId) {
    throw new Error('INVALID_NOTIFICATION_PAYLOAD');
  }
  if (productId !== config.monthlySku && productId !== config.annualSku) {
    throw new Error('UNSUPPORTED_PRODUCT');
  }
  if (!ACTIVE_STATUSES.has(status) && !INACTIVE_STATUSES.has(status)) {
    throw new Error('UNSUPPORTED_SUBSCRIPTION_STATUS');
  }
  if (ACTIVE_STATUSES.has(status) && !expiresAt) {
    throw new Error('ACTIVE_SUBSCRIPTION_EXPIRY_REQUIRED');
  }

  return {
    eventId,
    expiresAt,
    plan: productId === config.monthlySku ? 'monthly' : 'yearly',
    productId,
    status,
    updatedAt,
    userId,
  };
}

export function isEntitled(record, now = new Date()) {
  if (!record || !ACTIVE_STATUSES.has(record.status) || !record.expiresAt) return false;
  return new Date(record.expiresAt).getTime() > now.getTime();
}
