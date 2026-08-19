import type { LeadRecord, LeadStatus } from '../types/startup';

const STORAGE_KEY = 'changup-talk:leads';

function storage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function readAll(): LeadRecord[] {
  const store = storage();
  if (!store) return [];

  try {
    const raw = store.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as LeadRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAll(records: LeadRecord[]): void {
  const store = storage();
  if (!store) return;
  try {
    store.setItem(STORAGE_KEY, JSON.stringify(records));
  } catch {
    // ignore storage errors
  }
}

export function buildLeadRecord(input: Omit<LeadRecord, 'leadId' | 'createdAt' | 'status'> & { status?: LeadStatus }): LeadRecord {
  return {
    ...input,
    leadId: `lead_${Math.random().toString(36).slice(2, 10)}`,
    createdAt: new Date().toISOString(),
    status: input.status ?? 'requested'
  };
}

export function saveLead(record: LeadRecord): LeadRecord {
  const records = readAll();
  const next = [record, ...records.filter((item) => item.leadId !== record.leadId)];
  writeAll(next);
  return record;
}

export function listLeads(): LeadRecord[] {
  return readAll();
}

export function canSubmitLead(record: Pick<LeadRecord, 'contactConsent' | 'thirdPartyConsent'>): boolean {
  return record.contactConsent && record.thirdPartyConsent;
}
