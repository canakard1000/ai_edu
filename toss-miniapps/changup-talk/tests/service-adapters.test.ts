import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/services/config', () => ({
  APP_ENV: {
    appName: '창업톡',
    baseUrl: 'http://localhost:5173',
    adGroupId: '',
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

import { PUBLIC_API_SOURCES } from '../src/services/apiCatalog';
import { resolveCommercialDistrictContext } from '../src/services/commercialDistrict';
import { resolveFranchiseSnapshot } from '../src/services/franchise';
import { resolveRentSnapshot } from '../src/services/rent';
import { resolveRegionStatistics } from '../src/services/statistics';
import { getIndustryProfile } from '../src/data/industries';
import type { CommercialDistrictContext } from '../src/types/startup';

function createResponse(payload: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    json: async () => payload
  } as Response;
}

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

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('service adapters', () => {
  it('connects commercial district real data and caches it', async () => {
    const profile = getIndustryProfile('cafe');
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(
      createResponse({
        depositPerPyeong: 1500000,
        monthlyRentPerPyeong: 110000,
        competitionIndex: 1.4,
        demandIndex: 1.2,
        footTrafficIndex: 1.35,
        vacancyRate: 0.08,
        sourceDate: '2026-08-01',
        reliability: 95
      })
    );

    const result = await resolveCommercialDistrictContext({
      province: '충청남도',
      district: '천안시',
      neighborhood: '불당동',
      commercialArea: '불당 상권',
      mode: '일반 점포',
      industryId: 'cafe',
      areaPyeong: 15,
      useCustomArea: false,
      customAreaPyeong: 15,
      availableCapital: 30000000,
      operatingStaff: 1,
      deliveryRatio: 20,
      operationHours: '오전 10시~오후 10시',
      secondaryDistrict: '천안시 두정동',
      comparisonArea: '불당동 중심상권',
      actualQuotes: {}
    }, profile);

    expect(result.sourceMeta.source).toBe('real');
    expect(result.depositPerPyeong).toBe(1500000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('falls back to regional district data when the response is empty', async () => {
    const profile = getIndustryProfile('cafe');
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(createResponse({}));

    const result = await resolveCommercialDistrictContext({
      province: '충청남도',
      district: '천안시',
      neighborhood: '불당동',
      commercialArea: '불당 상권',
      mode: '일반 점포',
      industryId: 'cafe',
      areaPyeong: 15,
      useCustomArea: false,
      customAreaPyeong: 15,
      availableCapital: 30000000,
      operatingStaff: 1,
      deliveryRatio: 20,
      operationHours: '오전 10시~오후 10시',
      secondaryDistrict: '천안시 두정동',
      comparisonArea: '불당동 중심상권',
      actualQuotes: {}
    }, profile);

    expect(result.sourceMeta.source).toBe('regional');
    expect(result.reasonSummary.length).toBeGreaterThan(0);
  });

  it('connects rent data and reuses the cached payload on failure', async () => {
    const { localStorage } = installStorage();
    const fetchMock = vi.mocked(fetch);
    const context: CommercialDistrictContext = {
      sourceMeta: {
        source: 'real',
        label: '상권',
        basisDate: '2026-08-19',
        isEstimated: false,
        reliability: 95,
        details: '실데이터'
      },
      province: '충청남도',
      district: '천안시',
      neighborhood: '불당동',
      commercialArea: '불당 상권',
      rentIndex: 1.1,
      demandIndex: 1.2,
      competitionIndex: 1.3,
      footTrafficIndex: 1.15,
      vacancyRate: 0.08,
      depositPerPyeong: 1800000,
      monthlyRentPerPyeong: 130000,
      premiumAvailable: true,
      premiumEstimate: 20000000,
      competitorExamples: ['예시 점포'],
      reasonSummary: ['예시'],
      notes: '예시',
      updatedAt: '2026-08-19',
      regionStatistics: {
        sourceMeta: {
          source: 'real',
          label: 'KOSIS',
          basisDate: '2026-08-19',
          isEstimated: false,
          reliability: 95,
          details: '실데이터'
        },
        floatingPopulation: 30000,
        householdDensity: 1800,
        commercialDensity: 45,
        youngPopulationRate: 28,
        apartmentDensity: 60,
        businessDensity: 40,
        summary: '예시'
      }
    };

    fetchMock.mockResolvedValueOnce(createResponse({
      depositPerPyeong: 1800000,
      monthlyRentPerPyeong: 130000,
      sourceDate: '2026-08-01'
    }));

    const realResult = await resolveRentSnapshot(context);
    expect(realResult.source).toBe('real');
    expect(localStorage.setItem).toHaveBeenCalled();

    fetchMock.mockRejectedValueOnce(new Error('timeout'));
    const cachedResult = await resolveRentSnapshot(context);
    expect(cachedResult.source).toBe('cached');
    expect(cachedResult.monthlyRentPerPyeong).toBe(130000);
  });

  it('falls back to regional rent data when nothing is cached', async () => {
    installStorage();
    vi.mocked(fetch).mockRejectedValueOnce(new Error('500'));
    const context: CommercialDistrictContext = {
      sourceMeta: {
        source: 'regional',
        label: '지역',
        basisDate: '2026-08-19',
        isEstimated: true,
        reliability: 70,
        details: 'fallback'
      },
      province: '충청남도',
      district: '천안시',
      neighborhood: '불당동',
      commercialArea: '불당 상권',
      rentIndex: 1.05,
      demandIndex: 1.0,
      competitionIndex: 1.1,
      footTrafficIndex: 1.0,
      vacancyRate: 0.1,
      depositPerPyeong: 1700000,
      monthlyRentPerPyeong: 125000,
      premiumAvailable: false,
      premiumEstimate: null,
      competitorExamples: [],
      reasonSummary: [],
      notes: 'fallback',
      updatedAt: '2026-08-19',
      regionStatistics: {
        sourceMeta: {
          source: 'regional',
          label: 'KOSIS',
          basisDate: '2026-08-19',
          isEstimated: true,
          reliability: 70,
          details: 'fallback'
        },
        floatingPopulation: 20000,
        householdDensity: 1000,
        commercialDensity: 30,
        youngPopulationRate: 24,
        apartmentDensity: 50,
        businessDensity: 35,
        summary: 'fallback'
      }
    };

    const result = await resolveRentSnapshot(context);
    expect(result.source).toBe('regional');
  });

  it('rejects malformed rent data and falls back cleanly', async () => {
    installStorage();
    vi.mocked(fetch).mockResolvedValueOnce(createResponse({}));
    const context: CommercialDistrictContext = {
      sourceMeta: {
        source: 'regional',
        label: '지역',
        basisDate: '2026-08-19',
        isEstimated: true,
        reliability: 70,
        details: 'fallback'
      },
      province: '충청남도',
      district: '천안시',
      neighborhood: '불당동',
      commercialArea: '불당 상권',
      rentIndex: 1.0,
      demandIndex: 1.0,
      competitionIndex: 1.0,
      footTrafficIndex: 1.0,
      vacancyRate: 0.1,
      depositPerPyeong: 1700000,
      monthlyRentPerPyeong: 125000,
      premiumAvailable: false,
      premiumEstimate: null,
      competitorExamples: [],
      reasonSummary: [],
      notes: 'fallback',
      updatedAt: '2026-08-19',
      regionStatistics: {
        sourceMeta: {
          source: 'regional',
          label: 'KOSIS',
          basisDate: '2026-08-19',
          isEstimated: true,
          reliability: 70,
          details: 'fallback'
        },
        floatingPopulation: 20000,
        householdDensity: 1000,
        commercialDensity: 30,
        youngPopulationRate: 24,
        apartmentDensity: 50,
        businessDensity: 35,
        summary: 'fallback'
      }
    };

    const result = await resolveRentSnapshot(context);
    expect(result.source).toBe('regional');
  });

  it('connects regional statistics and caches it', async () => {
    installStorage();
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(createResponse({
      floatingPopulation: 42000,
      householdDensity: 2500,
      commercialDensity: 77,
      youngPopulationRate: 29,
      apartmentDensity: 68,
      businessDensity: 40,
      sourceDate: '2026-08-01',
      reliability: 94
    }));

    const result = await resolveRegionStatistics('충청남도', '천안시');
    expect(result.source).toBe('real');
    expect(result.floatingPopulation).toBe(42000);
  });

  it('falls back to regional statistics when the response is empty', async () => {
    installStorage();
    vi.mocked(fetch).mockResolvedValueOnce(createResponse({}));

    const result = await resolveRegionStatistics('충청남도', '천안시');
    expect(result.source).toBe('regional');
  });

  it('reuses cached statistics after a timeout', async () => {
    installStorage();
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(createResponse({
      floatingPopulation: 42000,
      householdDensity: 2500,
      commercialDensity: 77,
      youngPopulationRate: 29,
      apartmentDensity: 68,
      businessDensity: 40,
      sourceDate: '2026-08-01',
      reliability: 94
    }));
    await resolveRegionStatistics('충청남도', '천안시');

    fetchMock.mockRejectedValueOnce(new Error('timeout'));
    const cached = await resolveRegionStatistics('충청남도', '천안시');
    expect(cached.source).toBe('cached');
  });

  it('connects franchise data and caches it', async () => {
    installStorage();
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(createResponse({
      available: true,
      fee: 20000000,
      educationFee: 3000000,
      notice: '브랜드 비용',
      sourceDate: '2026-08-01',
      reliability: 92
    }));

    const profile = getIndustryProfile('chicken');
    const result = await resolveFranchiseSnapshot(profile);
    expect(result.source).toBe('real');
    expect(result.fee).toBe(20000000);
  });

  it('falls back to regional franchise data when the response is empty', async () => {
    installStorage();
    vi.mocked(fetch).mockResolvedValueOnce(createResponse({}));

    const profile = getIndustryProfile('chicken');
    const result = await resolveFranchiseSnapshot(profile);
    expect(result.source).toBe('regional');
  });

  it('reuses cached franchise data after a timeout', async () => {
    installStorage();
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(createResponse({
      available: true,
      fee: 20000000,
      educationFee: 3000000,
      notice: '브랜드 비용',
      sourceDate: '2026-08-01',
      reliability: 92
    }));
    const profile = getIndustryProfile('chicken');
    await resolveFranchiseSnapshot(profile);

    fetchMock.mockRejectedValueOnce(new Error('timeout'));
    const cached = await resolveFranchiseSnapshot(profile);
    expect(cached.source).toBe('cached');
  });

  it('catalogs the official public APIs used by the app', () => {
    expect(PUBLIC_API_SOURCES).toHaveLength(4);
    expect(PUBLIC_API_SOURCES[0].applicationUrl).toContain('data.go.kr');
    expect(PUBLIC_API_SOURCES[1].endpoint).toContain('reb.or.kr');
    expect(PUBLIC_API_SOURCES[2].envVars).toContain('VITE_KOSIS_API_KEY');
  });
});

