import { timingSafeEqual } from 'node:crypto';

export function hasMatchingAuthorization(received, expected) {
  if (typeof received !== 'string' || typeof expected !== 'string') return false;
  const actual = Buffer.from(received);
  const secret = Buffer.from(expected);
  return actual.length === secret.length && timingSafeEqual(actual, secret);
}
