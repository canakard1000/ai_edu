import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/services/config', () => ({
  APP_ENV: {
    appName: '창업톡',
    baseUrl: 'http://localhost:5173',
    adGroupId: '',
    analysisPass3ProductId: '',
    analysisPass20ProductId: '',
    proProductId: '',
    proxyBaseUrl: 'https://proxy.example.test',
    sbdcApiKey: '',
    rebApiKey: '',
    kosisApiKey: '',
    ftcApiKey: '',
    sbdcApiUrl: '',
    rebApiUrl: '',
    kosisApiUrl: '',
    ftcApiUrl: ''
  }
}));

import { BRAND_CATEGORY_GROUPS } from '../src/data/brands';
import { getIndustryProfile } from '../src/data/industries';
import { resolveBrandComparison, resolveBrandRecord, inferBrandCategory } from '../src/services/brands';
import { buildLeadRecord, canSubmitLead } from '../src/services/leads';
import { clearDedupeCache, dedupePromise } from '../src/services/requestPool';
import {
  getRemainingAnalyses,
  getUsageSnapshot,
  grantAnalysisPass,
  recordAnalysisUse,
  resetUsageSnapshot
} from '../src/services/usage';

function installStorage() {
  const store = new Map<string, string>();
  const localStorage = {
    getItem: vi.fn((key: string) => store.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store.set(key, value);
    }),
    removeItem: vi.fn((key: string) => {
      store.delete(key);
    }),
    clear: vi.fn(() => {
      store.clear();
    })
  };

  vi.stubGlobal('window', { localStorage });
  return { localStorage, store };
}

function createResponse(payload: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    json: async () => payload
  } as Response;
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
  clearDedupeCache();
  resetUsageSnapshot();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('operational prep models', () => {
  it('shares a deduped promise for identical work', async () => {
    let calls = 0;
    const result = await Promise.all([
      dedupePromise('shared-key', async () => {
        calls += 1;
        return 42;
      }),
      dedupePromise('shared-key', async () => {
        calls += 1;
        return 99;
      })
    ]);

    expect(result).toEqual([42, 42]);
    expect(calls).toBe(1);
  });

  it('tracks remaining analyses with free and purchased passes', () => {
    installStorage();
    let snapshot = getUsageSnapshot();
    expect(getRemainingAnalyses(snapshot)).toBe(1);

    snapshot = recordAnalysisUse(snapshot);
    expect(snapshot.freeUsed).toBe(1);
    expect(getRemainingAnalyses(snapshot)).toBe(0);

    snapshot = grantAnalysisPass('ANALYSIS_3', 3);
    expect(snapshot.purchasedPasses).toBe(3);
    expect(snapshot.lastPurchasedPlan).toBe('ANALYSIS_3');
    expect(getRemainingAnalyses(snapshot)).toBe(3);
  });

  it('builds lead records without consent leakage', () => {
    const lead = buildLeadRecord({
      userId: 'user-1',
      brandId: 'brand-1',
      desiredRegion: '충청남도 천안시',
      availableCapital: 30000000,
      desiredArea: 15,
      contactConsent: false,
      thirdPartyConsent: false
    });

    expect(lead.status).toBe('requested');
    expect(canSubmitLead(lead)).toBe(false);
    expect(lead.leadId).toContain('lead_');

    const consented = { ...lead, contactConsent: true, thirdPartyConsent: true };
    expect(canSubmitLead(consented)).toBe(true);
  });

  it('infers brand category from industry profile shape', () => {
    expect(inferBrandCategory(getIndustryProfile('cafe'))).toBe('카페');
    expect(inferBrandCategory(getIndustryProfile('shared-kitchen'))).toBe('배달');
    expect(inferBrandCategory(getIndustryProfile('unmanned-convenience'))).toBe('무인');
  });

  it('knows brand category group definitions', () => {
    expect(BRAND_CATEGORY_GROUPS.map((item) => item.category)).toContain('무인');
    expect(BRAND_CATEGORY_GROUPS.find((item) => item.category === '카페')?.profileIds).toContain('cafe');
  });

  it('resolves a brand record from real FTC data', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      createResponse({
        available: true,
        brandName: '테스트브랜드',
        brandMnno: 'BRD_TEST',
        fee: 2500000,
        educationFee: 900000,
        deposit: 500000,
        otherCost: 700000,
        totalStartupCost: 5100000,
        notice: '실데이터',
        sourceDate: '2026-08-19',
        reliability: 91
      })
    );

    const record = await resolveBrandRecord(getIndustryProfile('chicken'));
    expect(record.brandName).toBe('테스트브랜드');
    expect(record.sourceMeta.source).toBe('real');
    expect(record.totalStartupCost?.base).toBeGreaterThan(0);
  });

  it('compares brands and preserves capital gap ordering', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        available: true,
        brandName: '비교브랜드',
        fee: 1500000,
        educationFee: 500000,
        deposit: 0,
        otherCost: 500000,
        totalStartupCost: 2500000,
        notice: '비교용',
        sourceDate: '2026-08-19',
        reliability: 88
      })
    } as Response);

    const rows = await resolveBrandComparison([getIndustryProfile('chicken'), getIndustryProfile('pizza')], 30000000);
    expect(rows).toHaveLength(2);
    expect(rows[0].capitalGap).toBeGreaterThan(0);
    expect(rows[0].brandName).toBe('비교브랜드');
  });

  it('falls back to regional brand data when FTC fetch fails', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error('timeout'));

    const record = await resolveBrandRecord(getIndustryProfile('cafe'));
    expect(record.sourceMeta.source).toBe('regional');
    expect(record.isRealData).toBe(false);
  });
});
