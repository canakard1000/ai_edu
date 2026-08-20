import { DEFAULT_SETTINGS, FIRST_DAY_CHECKLIST } from './data';
import type { AppSnapshot, ChecklistItem, WorkEntry } from './types';

const RECORDS_KEY = 'firstalbatalk.records';
const ACTIVE_KEY = 'firstalbatalk.active';
const SETTINGS_KEY = 'firstalbatalk.settings';
const CHECKLIST_KEY = 'firstalbatalk.checklist';

function safeParse<T>(value: string | null, fallback: T): T {
  if (!value) {
    return fallback;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function storageAvailable(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

export function loadSnapshot(): AppSnapshot {
  if (!storageAvailable()) {
    return {
      records: [],
      activeSession: null,
      settings: DEFAULT_SETTINGS,
      checklist: FIRST_DAY_CHECKLIST.map((item) => ({ ...item, done: false }))
    };
  }

  return {
    records: safeParse<WorkEntry[]>(window.localStorage.getItem(RECORDS_KEY), []),
    activeSession: safeParse<WorkEntry | null>(window.localStorage.getItem(ACTIVE_KEY), null),
    settings: safeParse(window.localStorage.getItem(SETTINGS_KEY), DEFAULT_SETTINGS),
    checklist: safeParse<ChecklistItem[]>(
      window.localStorage.getItem(CHECKLIST_KEY),
      FIRST_DAY_CHECKLIST.map((item) => ({ ...item, done: false }))
    )
  };
}

export function saveSnapshot(snapshot: AppSnapshot): void {
  if (!storageAvailable()) {
    return;
  }

  window.localStorage.setItem(RECORDS_KEY, JSON.stringify(snapshot.records));
  window.localStorage.setItem(ACTIVE_KEY, JSON.stringify(snapshot.activeSession));
  window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(snapshot.settings));
  window.localStorage.setItem(CHECKLIST_KEY, JSON.stringify(snapshot.checklist));
}
