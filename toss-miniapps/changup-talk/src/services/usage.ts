import type { EntitlementPlan, UsageSnapshot } from '../types/startup';

const STORAGE_KEY = 'changup-talk:usage';

function storage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function defaultSnapshot(): UsageSnapshot {
  return {
    userId: 'local-user',
    freeLimit: 1,
    freeUsed: 0,
    purchasedPasses: 0,
    purchasedUsed: 0,
    lastPurchasedPlan: undefined,
    previewOnly: true,
    updatedAt: new Date().toISOString()
  };
}

export function getUsageSnapshot(): UsageSnapshot {
  const store = storage();
  if (!store) return defaultSnapshot();

  try {
    const raw = store.getItem(STORAGE_KEY);
    if (!raw) return defaultSnapshot();
    const parsed = JSON.parse(raw) as Partial<UsageSnapshot>;
    return {
      ...defaultSnapshot(),
      ...parsed,
      freeLimit: typeof parsed.freeLimit === 'number' ? parsed.freeLimit : 1,
      freeUsed: typeof parsed.freeUsed === 'number' ? parsed.freeUsed : 0,
      purchasedPasses: typeof parsed.purchasedPasses === 'number' ? parsed.purchasedPasses : 0,
      purchasedUsed: typeof parsed.purchasedUsed === 'number' ? parsed.purchasedUsed : 0,
      lastPurchasedPlan: parsed.lastPurchasedPlan,
      previewOnly: parsed.previewOnly ?? true
    };
  } catch {
    return defaultSnapshot();
  }
}

function saveUsageSnapshot(snapshot: UsageSnapshot): void {
  const store = storage();
  if (!store) return;
  try {
    store.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    // ignore local storage restrictions
  }
}

export function getRemainingAnalyses(snapshot = getUsageSnapshot()): number {
  return Math.max(0, snapshot.freeLimit - snapshot.freeUsed + snapshot.purchasedPasses - snapshot.purchasedUsed);
}

export function recordAnalysisUse(snapshot = getUsageSnapshot()): UsageSnapshot {
  const next: UsageSnapshot = {
    ...snapshot,
    freeUsed: snapshot.freeUsed < snapshot.freeLimit ? snapshot.freeUsed + 1 : snapshot.freeUsed,
    purchasedUsed: snapshot.freeUsed >= snapshot.freeLimit ? snapshot.purchasedUsed + 1 : snapshot.purchasedUsed,
    updatedAt: new Date().toISOString()
  };
  saveUsageSnapshot(next);
  return next;
}

export function grantAnalysisPass(plan: Exclude<EntitlementPlan, 'FREE'>, quantity = 1): UsageSnapshot {
  const snapshot = getUsageSnapshot();
  const next: UsageSnapshot = {
    ...snapshot,
    purchasedPasses: snapshot.purchasedPasses + Math.max(1, quantity),
    lastPurchasedPlan: plan,
    previewOnly: true,
    updatedAt: new Date().toISOString()
  };
  saveUsageSnapshot(next);
  return next;
}

export function resetUsageSnapshot(): void {
  const store = storage();
  if (!store) return;
  store.removeItem(STORAGE_KEY);
}
