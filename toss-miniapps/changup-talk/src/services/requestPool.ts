const inflight = new Map<string, Promise<unknown>>();

export function dedupePromise<T>(key: string, factory: () => Promise<T>): Promise<T> {
  const existing = inflight.get(key);
  if (existing) {
    return existing as Promise<T>;
  }

  const promise = factory().finally(() => {
    if (inflight.get(key) === promise) {
      inflight.delete(key);
    }
  });

  inflight.set(key, promise);
  return promise;
}

export function clearDedupeCache(): void {
  inflight.clear();
}
