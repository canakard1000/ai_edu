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

import { buildAlternativeRecommendations, calculateStartupAnalysis } from '../src/calculation/startupCost';
import { getIndustryProfile } from '../src/data/industries';
import { resolveCommercialDistrictContext } from '../src/services/commercialDistrict';
import { resolveRegionStatistics } from '../src/services/statistics';
import type { StartupInputs } from '../src/types/startup';

function createResponse(payload: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    json: async () => payload
  } as Response;
}

function buildInputs(overrides: Partial<StartupInputs> = {}): StartupInputs {
  return {
    province: '서울특별시',
    district: '강남구',
    neighborhood: '역삼동',
    commercialArea: '강남역 상권',
    mode: '일반 점포',
    industryId: 'cafe',
    areaPyeong: 15,
    useCustomArea: false,
    customAreaPyeong: 15,
    availableCapital: 30000000,
    operatingStaff: 1,
    deliveryRatio: 20,
    operationHours: '오전 10시~오후 10시',
    secondaryDistrict: '마포구',
    comparisonArea: '홍대 상권',
    actualQuotes: {},
    ...overrides
  };
}

function installLiveFetchMock() {
  vi.stubGlobal('fetch', vi.fn(async (input) => {
    const url = new URL(String(input));
    const province = url.searchParams.get('province') ?? '';
    const district = url.searchParams.get('district') ?? '';
    const neighborhood = url.searchParams.get('neighborhood') ?? '';

    if (url.pathname.includes('/commercial-district')) {
      if (district.includes('강남')) {
        return createResponse({
          depositPerPyeong: 1500000,
          monthlyRentPerPyeong: 135000,
          competitionIndex: 1.6,
          demandIndex: 1.3,
          footTrafficIndex: 1.25,
          vacancyRate: 0.08,
          sourceDate: '2026-08-19',
          reliability: 94,
          summary: '강남구 실데이터'
        });
      }

      if (province.includes('부산')) {
        return createResponse({
          depositPerPyeong: 1100000,
          monthlyRentPerPyeong: 109000,
          competitionIndex: 1.18,
          demandIndex: 1.08,
          footTrafficIndex: 1.05,
          vacancyRate: 0.09,
          sourceDate: '2026-08-19',
          reliability: 91,
          summary: '해운대구 실데이터'
        });
      }

      return createResponse({
        depositPerPyeong: 950000,
        monthlyRentPerPyeong: 89000,
        competitionIndex: 1.02,
        demandIndex: 1.02,
        footTrafficIndex: 1.01,
        vacancyRate: 0.1,
        sourceDate: '2026-08-19',
        reliability: 90,
        summary: `${province} ${district || neighborhood} 실데이터`
      });
    }

    if (url.pathname.includes('/commercial-rent')) {
      if (district.includes('강남')) {
        return createResponse({
          depositPerPyeong: 1700000,
          monthlyRentPerPyeong: 180000,
          sourceDate: '2024-01',
          referenceDate: '2024-01'
        });
      }

      if (province.includes('부산')) {
        return createResponse({
          depositPerPyeong: 1200000,
          monthlyRentPerPyeong: 121000,
          sourceDate: '2024-01',
          referenceDate: '2024-01'
        });
      }

      return createResponse({
        depositPerPyeong: 980000,
        monthlyRentPerPyeong: 93000,
        sourceDate: '2024-01',
        referenceDate: '2024-01'
      });
    }

    if (url.pathname.includes('/regional-statistics')) {
      if (district.includes('강남')) {
        return createResponse({
          floatingPopulation: 72000,
          householdDensity: 2690,
          commercialDensity: 60,
          youngPopulationRate: 30.1,
          apartmentDensity: 68,
          businessDensity: 46.4,
          sourceDate: '2026',
          referenceDate: '2026',
          reliability: 92
        });
      }

      if (province.includes('부산')) {
        return createResponse({
          floatingPopulation: 51000,
          householdDensity: 2200,
          commercialDensity: 41,
          youngPopulationRate: 25.4,
          apartmentDensity: 58,
          businessDensity: 38.8,
          sourceDate: '2026',
          referenceDate: '2026',
          reliability: 89
        });
      }

      return createResponse({
        floatingPopulation: 39000,
        householdDensity: 1800,
        commercialDensity: 32,
        youngPopulationRate: 23.7,
        apartmentDensity: 53,
        businessDensity: 34.2,
        sourceDate: '2026',
        referenceDate: '2026',
        reliability: 88
      });
    }

    if (url.pathname.includes('/franchise-info')) {
      return createResponse({
        available: true,
        fee: 2900000,
        educationFee: 1100000,
        deposit: 0,
        sourceDate: '2026-08-19',
        referenceDate: '2026-08-19',
        reliability: 89
      });
    }

    return createResponse({}, false, 404);
  }));
}

beforeEach(() => {
  installLiveFetchMock();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('live analysis integration', () => {
  it('raises rent in Gangnam above Cheonan', async () => {
    const profile = getIndustryProfile('cafe');
    const gangnam = await calculateStartupAnalysis(buildInputs({
      province: '서울특별시',
      district: '강남구',
      neighborhood: '역삼동',
      commercialArea: '강남역 상권'
    }), profile);
    const cheonan = await calculateStartupAnalysis(buildInputs({
      province: '충청남도',
      district: '천안시',
      neighborhood: '불당동',
      commercialArea: '불당 상권'
    }), profile);

    expect(gangnam.context.monthlyRentPerPyeong).toBeGreaterThan(cheonan.context.monthlyRentPerPyeong);
  });

  it('raises competition in Gangnam above Cheonan', async () => {
    const profile = getIndustryProfile('cafe');
    const gangnam = await calculateStartupAnalysis(buildInputs({
      province: '서울특별시',
      district: '강남구',
      neighborhood: '역삼동',
      commercialArea: '강남역 상권'
    }), profile);
    const cheonan = await calculateStartupAnalysis(buildInputs({
      province: '충청남도',
      district: '천안시',
      neighborhood: '불당동',
      commercialArea: '불당 상권'
    }), profile);

    expect(gangnam.context.competitionIndex).toBeGreaterThan(cheonan.context.competitionIndex);
  });

  it('raises expected sales in Gangnam above Cheonan', async () => {
    const profile = getIndustryProfile('cafe');
    const gangnam = await calculateStartupAnalysis(buildInputs({
      province: '서울특별시',
      district: '강남구',
      neighborhood: '역삼동',
      commercialArea: '강남역 상권'
    }), profile);
    const cheonan = await calculateStartupAnalysis(buildInputs({
      province: '충청남도',
      district: '천안시',
      neighborhood: '불당동',
      commercialArea: '불당 상권'
    }), profile);

    expect(gangnam.breakdown.expectedSales).toBeGreaterThan(cheonan.breakdown.expectedSales);
  });

  it('changes BEP between regions', async () => {
    const profile = getIndustryProfile('cafe');
    const gangnam = await calculateStartupAnalysis(buildInputs({
      province: '서울특별시',
      district: '강남구',
      neighborhood: '역삼동',
      commercialArea: '강남역 상권'
    }), profile);
    const cheonan = await calculateStartupAnalysis(buildInputs({
      province: '충청남도',
      district: '천안시',
      neighborhood: '불당동',
      commercialArea: '불당 상권'
    }), profile);

    expect(gangnam.breakdown.breakEvenSales).not.toBe(cheonan.breakdown.breakEvenSales);
  });

  it('applies actual monthly rent overrides', async () => {
    const profile = getIndustryProfile('cafe');
    const result = await calculateStartupAnalysis(buildInputs({
      province: '서울특별시',
      district: '강남구',
      neighborhood: '역삼동',
      commercialArea: '강남역 상권',
      actualQuotes: { actualMonthlyRent: 2100000 }
    }), profile);

    expect(result.breakdown.monthlyRent).toBe(2100000);
    expect(result.costBand.monthlyRent.base).toBe(2100000);
  });

  it('applies actual deposit overrides', async () => {
    const profile = getIndustryProfile('cafe');
    const result = await calculateStartupAnalysis(buildInputs({
      province: '서울특별시',
      district: '강남구',
      neighborhood: '역삼동',
      commercialArea: '강남역 상권',
      actualQuotes: { actualDeposit: 24000000 }
    }), profile);

    expect(result.breakdown.deposit).toBe(24000000);
    expect(result.costBand.deposit.base).toBe(24000000);
  });

  it('includes a -30 percent stress test row', async () => {
    const profile = getIndustryProfile('cafe');
    const result = await calculateStartupAnalysis(buildInputs(), profile);

    expect(result.stressTests.map((item) => item.label)).toContain('-30%');
  });

  it('uses live franchise fee data', async () => {
    const profile = getIndustryProfile('chicken');
    const result = await calculateStartupAnalysis(buildInputs({
      mode: '프랜차이즈',
      industryId: 'chicken'
    }), profile);

    expect(result.breakdown.franchiseFee).toBe(2900000);
    expect(result.breakdown.educationFee).toBe(1100000);
    expect(result.dataTrace.some((item) => item.source === 'real')).toBe(true);
  });

  it('lowers confidence when live responses are missing', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => createResponse({})));
    const profile = getIndustryProfile('cafe');
    const result = await calculateStartupAnalysis(buildInputs(), profile);

    expect(result.confidence.overall).toBeLessThan(85);
    expect(result.context.sourceMeta.source).not.toBe('real');
  });

  it('returns different top recommendations by region', async () => {
    const cheonan = await buildAlternativeRecommendations(buildInputs({
      province: '충청남도',
      district: '천안시',
      neighborhood: '불당동',
      commercialArea: '불당 상권'
    }), getIndustryProfile('cafe'));

    const gangnam = await buildAlternativeRecommendations(buildInputs({
      province: '서울특별시',
      district: '강남구',
      neighborhood: '역삼동',
      commercialArea: '강남역 상권'
    }), getIndustryProfile('cafe'));

    expect(cheonan.map((item) => item.profile.id)).not.toEqual(gangnam.map((item) => item.profile.id));
  });

  it('sorts recommendations in descending order', async () => {
    const result = await buildAlternativeRecommendations(buildInputs({
      province: '서울특별시',
      district: '강남구',
      neighborhood: '역삼동',
      commercialArea: '강남역 상권'
    }), getIndustryProfile('cafe'));

    const scores = result.map((item) => item.orderScore);
    const sorted = [...scores].sort((left, right) => right - left);
    expect(scores).toEqual(sorted);
  });

  it('keeps the confidence trace aligned with live sources', async () => {
    const profile = getIndustryProfile('cafe');
    const result = await calculateStartupAnalysis(buildInputs({
      province: '부산광역시',
      district: '해운대구',
      neighborhood: '우동',
      commercialArea: '해운대 해변 상권'
    }), profile);

    expect(result.confidence.reasonSummary).toHaveLength(5);
    expect(result.dataTrace.every((item) => typeof item.reliability === 'number')).toBe(true);
  });

  it('marks SBDC district data as real when the live payload is valid', async () => {
    const profile = getIndustryProfile('cafe');
    const result = await resolveCommercialDistrictContext(buildInputs({
      province: '서울특별시',
      district: '강남구',
      neighborhood: '역삼동',
      commercialArea: '강남역 상권'
    }), profile);

    expect(result.sourceMeta.source).toBe('real');
    expect(result.competitorExamples.length).toBeGreaterThan(0);
    expect(result.sourceMeta.isEstimated).toBe(false);
  });

  it('marks KOSIS region statistics as real when the live payload is valid', async () => {
    const result = await resolveRegionStatistics('서울특별시', '강남구');

    expect(result.source).toBe('real');
    expect(result.sourceMeta.source).toBe('real');
    expect(result.floatingPopulation).toBeGreaterThan(0);
  });

  it('keeps the final analysis trace real across SBDC, REB, FTC, and KOSIS', async () => {
    const profile = getIndustryProfile('cafe');
    const result = await calculateStartupAnalysis(buildInputs({
      province: '서울특별시',
      district: '강남구',
      neighborhood: '역삼동',
      commercialArea: '강남역 상권'
    }), profile);

    expect(result.dataTrace.map((item) => item.source)).toEqual(['real', 'real', 'real', 'real']);
    expect(result.confidence.overall).toBeGreaterThan(70);
  });

  it('changes the final analysis numbers between Cheonan and Gangnam', async () => {
    const profile = getIndustryProfile('cafe');
    const cheonan = await calculateStartupAnalysis(buildInputs({
      province: '충청남도',
      district: '천안시',
      neighborhood: '불당동',
      commercialArea: '불당 상권'
    }), profile);
    const gangnam = await calculateStartupAnalysis(buildInputs({
      province: '서울특별시',
      district: '강남구',
      neighborhood: '역삼동',
      commercialArea: '강남역 상권'
    }), profile);

    expect(cheonan.breakdown.monthlyRent).not.toBe(gangnam.breakdown.monthlyRent);
    expect(cheonan.breakdown.expectedSales).not.toBe(gangnam.breakdown.expectedSales);
    expect(cheonan.confidence.overall).not.toBe(gangnam.confidence.overall);
  });

  it('falls back to regional SBDC data when the district payload is empty', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input) => {
      const url = new URL(String(input));
      if (url.pathname.includes('/commercial-district')) {
        return createResponse({});
      }
      return createResponse({});
    }));

    const profile = getIndustryProfile('cafe');
    const result = await resolveCommercialDistrictContext(buildInputs({
      province: '서울특별시',
      district: '강남구',
      neighborhood: '역삼동',
      commercialArea: '강남역 상권'
    }), profile);

    expect(result.sourceMeta.source).toBe('regional');
  });

  it('falls back to regional KOSIS data when the statistics payload is empty', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input) => {
      const url = new URL(String(input));
      if (url.pathname.includes('/regional-statistics')) {
        return createResponse({});
      }
      return createResponse({});
    }));

    const result = await resolveRegionStatistics('서울특별시', '강남구');

    expect(result.source).toBe('regional');
  });

  it('lowers sales confidence when only modeled demand is available', async () => {
    const profile = getIndustryProfile('cafe');
    const result = await calculateStartupAnalysis(buildInputs({
      province: '서울특별시',
      district: '강남구',
      neighborhood: '역삼동',
      commercialArea: '강남역 상권'
    }), profile);

    expect(result.confidence.salesForecast).toBeLessThan(result.confidence.rent);
    expect(result.confidence.salesForecast).toBeLessThan(80);
  });

  it('adds a payback warning when the modeled payback period is short', async () => {
    const profile = getIndustryProfile('cafe');
    const result = await calculateStartupAnalysis(buildInputs({
      province: '서울특별시',
      district: '강남구',
      neighborhood: '역삼동',
      commercialArea: '강남역 상권',
      areaPyeong: 30,
      actualQuotes: {
        actualMonthlyRent: 950000,
        actualDeposit: 5000000,
        actualInteriorCost: 6000000,
        actualEquipmentCost: 7000000,
        actualLaborCost: 1500000
      }
    }), profile);

    expect(result.breakdown.paybackMonths).not.toBeNull();
    expect(result.breakdown.paybackMonths as number).toBeLessThan(12);
    expect(result.risks.some((risk) => risk.includes('회수기간이 12개월 미만'))).toBe(true);
  });

  it('keeps actual monthly rent overrides in the final analysis', async () => {
    const profile = getIndustryProfile('cafe');
    const result = await calculateStartupAnalysis(buildInputs({
      province: '서울특별시',
      district: '강남구',
      neighborhood: '역삼동',
      commercialArea: '강남역 상권',
      actualQuotes: { actualMonthlyRent: 2100000 }
    }), profile);

    expect(result.breakdown.monthlyRent).toBe(2100000);
    expect(result.costBand.monthlyRent.base).toBe(2100000);
  });
});
