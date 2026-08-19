import type { DataSource } from '../types/startup';

type CacheEnvelope<T> = {
  savedAt: string;
  source: DataSource;
  data: T;
};

function storage(): Storage | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function readCache<T>(key: string): CacheEnvelope<T> | null {
  const store = storage();
  if (!store) return null;

  try {
    const raw = store.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as CacheEnvelope<T>;
  } catch {
    return null;
  }
}

export function writeCache<T>(key: string, source: DataSource, data: T): void {
  const store = storage();
  if (!store) return;

  try {
    const payload: CacheEnvelope<T> = {
      savedAt: new Date().toISOString(),
      source,
      data
    };
    store.setItem(key, JSON.stringify(payload));
  } catch {
    // Ignore storage quota or privacy restrictions.
  }
}
