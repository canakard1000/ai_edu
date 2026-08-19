import type { RevenueEventType } from '../types/startup';

export interface RevenueEvent {
  id: string;
  type: RevenueEventType;
  amount: number | null;
  createdAt: string;
}

const STORAGE_KEY = 'changup-talk:revenue';

function storage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function recordRevenueEvent(type: RevenueEventType, amount: number | null = null): RevenueEvent {
  const event: RevenueEvent = {
    id: `rev_${Math.random().toString(36).slice(2, 10)}`,
    type,
    amount,
    createdAt: new Date().toISOString()
  };
  const store = storage();
  if (!store) return event;

  try {
    const raw = store.getItem(STORAGE_KEY);
    const existing = raw ? (JSON.parse(raw) as RevenueEvent[]) : [];
    store.setItem(STORAGE_KEY, JSON.stringify([event, ...existing].slice(0, 100)));
  } catch {
    // ignore storage errors
  }

  return event;
}

export function listRevenueEvents(): RevenueEvent[] {
  const store = storage();
  if (!store) return [];
  try {
    const raw = store.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as RevenueEvent[]) : [];
  } catch {
    return [];
  }
}
