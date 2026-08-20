import { DEFAULT_PROFILE, SAMPLE_GROUPS } from './data';
import type { Snapshot } from './types';

const KEY = 'ddakmoyeo.snapshot';
export function loadSnapshot(): Snapshot {
  if (typeof window === 'undefined' || !window.localStorage) return { groups: SAMPLE_GROUPS, profile: DEFAULT_PROFILE };
  try { const value = window.localStorage.getItem(KEY); return value ? JSON.parse(value) as Snapshot : { groups: SAMPLE_GROUPS, profile: DEFAULT_PROFILE }; } catch { return { groups: SAMPLE_GROUPS, profile: DEFAULT_PROFILE }; }
}
export function saveSnapshot(snapshot: Snapshot): void { if (typeof window !== 'undefined' && window.localStorage) window.localStorage.setItem(KEY, JSON.stringify(snapshot)); }
