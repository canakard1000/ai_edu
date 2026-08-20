function key(prefix, value) {
  return `${prefix}:${encodeURIComponent(value)}`;
}

export function createMemoryEntitlementStore() {
  const entitlements = new Map();
  const events = new Set();
  return {
    async getEntitlement(userId) { return entitlements.get(userId) ?? null; },
    async hasEvent(eventId) { return events.has(eventId); },
    async saveEntitlement(record) { entitlements.set(record.userId, record); },
    async saveEvent(eventId) { events.add(eventId); },
  };
}

export function createRedisRestEntitlementStore({ url, token, fetchImpl = fetch }) {
  const baseUrl = url.replace(/\/$/, '');
  async function command(path) {
    const response = await fetchImpl(`${baseUrl}/${path}`, {
      headers: { authorization: `Bearer ${token}` },
      method: 'POST',
    });
    if (!response.ok) throw new Error('ENTITLEMENT_STORE_UNAVAILABLE');
    return response.json();
  }
  async function getJson(storeKey) {
    const payload = await command(`get/${encodeURIComponent(storeKey)}`);
    return payload.result ? JSON.parse(payload.result) : null;
  }
  async function setJson(storeKey, value) {
    await command(`set/${encodeURIComponent(storeKey)}/${encodeURIComponent(JSON.stringify(value))}`);
  }
  return {
    async getEntitlement(userId) { return getJson(key('entitlement', userId)); },
    async hasEvent(eventId) { return (await getJson(key('event', eventId))) === true; },
    async saveEntitlement(record) { return setJson(key('entitlement', record.userId), record); },
    async saveEvent(eventId) { return setJson(key('event', eventId), true); },
  };
}
