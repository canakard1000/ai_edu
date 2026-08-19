import { buildAlternativeRecommendations, buildConfidence, buildStressTests, calculateBreakEvenSales, calculateStartupAnalysis } from '../src/calculation';
import { getIndustryProfile } from '../src/data/industries';
import type { IndustryProfile, StartupInputs } from '../src/types/startup';

const baseInputs: StartupInputs = {
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
};

function cloneProfile(profile: IndustryProfile, patch: Partial<IndustryProfile> = {}): IndustryProfile {
  return { ...profile, ...patch };
}

describe('core calculations', () => {
  it('calculates break-even sales', () => {
    expect(calculateBreakEvenSales(1000000, 0.5)).toBe(2000000);
  });

  it('returns infinity when variable cost rate reaches 1', () => {
    expect(calculateBreakEvenSales(1000000, 1)).toBe(Number.POSITIVE_INFINITY);
  });

  it('builds a positive analysis for the default area', async () => {
    const profile = getIndustryProfile('cafe');
    const result = await calculateStartupAnalysis(baseInputs, profile);

    expect(result.breakdown.totalInvestment).toBeGreaterThan(0);
    expect(result.breakdown.breakEvenSales).toBeGreaterThan(0);
    expect(result.breakdown.expectedSales).toBeGreaterThan(0);
  });

  it('calculates operating profit from expected sales and fixed cost', async () => {
    const profile = getIndustryProfile('cafe');
    const result = await calculateStartupAnalysis(baseInputs, profile);
    const expectedOperatingProfit = result.breakdown.expectedSales - result.breakdown.variableCost - result.breakdown.monthlyFixedCost;

    expect(Math.abs(result.breakdown.operatingProfit - expectedOperatingProfit)).toBeLessThanOrEqual(10000);
  });

  it('returns null payback when operating profit is negative', async () => {
    const profile = cloneProfile(getIndustryProfile('chicken'), {
      salesPerPyeong: 0,
      variableCostRate: 0.9,
      riskLevel: 80
    });
    const result = await calculateStartupAnalysis({ ...baseInputs, industryId: 'chicken', mode: '프랜차이즈', availableCapital: 5000000 }, profile);

    expect(result.breakdown.operatingProfit).toBeLessThan(0);
    expect(result.breakdown.paybackMonths).toBeNull();
  });

  it('handles zero revenue input without crashing', async () => {
    const profile = cloneProfile(getIndustryProfile('nail'), { salesPerPyeong: 0 });
    const result = await calculateStartupAnalysis(baseInputs, profile);

    expect(result.breakdown.expectedSales).toBe(0);
    expect(result.breakdown.operatingProfit).toBeLessThanOrEqual(0);
  });

  it('keeps break-even sales finite with extreme but valid rates', async () => {
    const profile = cloneProfile(getIndustryProfile('small-office'), { variableCostRate: 0.78 });
    const result = await calculateStartupAnalysis(baseInputs, profile);

    expect(result.breakdown.breakEvenSales).toBeGreaterThan(result.breakdown.monthlyFixedCost);
  });
});

describe('area and mode behavior', () => {
  it('changes startup cost when area grows from 5 to 30 pyeong', async () => {
    const profile = getIndustryProfile('cafe');
    const smaller = await calculateStartupAnalysis({ ...baseInputs, areaPyeong: 5 }, profile);
    const larger = await calculateStartupAnalysis({ ...baseInputs, areaPyeong: 30 }, profile);

    expect(larger.breakdown.totalInvestment).toBeGreaterThan(smaller.breakdown.totalInvestment);
    expect(larger.breakdown.monthlyRent).toBeGreaterThan(smaller.breakdown.monthlyRent);
  });

  it('covers 10평 and 15평 area presets', async () => {
    const profile = getIndustryProfile('nail');
    const ten = await calculateStartupAnalysis({ ...baseInputs, industryId: 'nail', areaPyeong: 10 }, profile);
    const fifteen = await calculateStartupAnalysis({ ...baseInputs, industryId: 'nail', areaPyeong: 15 }, profile);

    expect(fifteen.breakdown.totalInvestment).toBeGreaterThan(ten.breakdown.totalInvestment);
  });

  it('covers 30평 area preset', async () => {
    const profile = getIndustryProfile('korean');
    const result = await calculateStartupAnalysis({ ...baseInputs, industryId: 'korean', areaPyeong: 30 }, profile);

    expect(result.breakdown.totalInvestment).toBeGreaterThan(0);
  });

  it('supports 배달전문 calculations', async () => {
    const profile = getIndustryProfile('shared-kitchen');
    const result = await calculateStartupAnalysis({ ...baseInputs, mode: '배달 전문점', industryId: 'shared-kitchen' }, profile);

    expect(result.profile.group).toBe('배달 전문점');
    expect(result.breakdown.monthlyFixedCost).toBeGreaterThan(0);
  });

  it('supports 무인창업 calculations', async () => {
    const profile = getIndustryProfile('unmanned-cafe');
    const result = await calculateStartupAnalysis({ ...baseInputs, mode: '무인 창업', industryId: 'unmanned-cafe' }, profile);

    expect(result.profile.group).toBe('무인 창업');
    expect(result.breakdown.operatingProfit).toBeDefined();
  });

  it('supports 일반점포 calculations', async () => {
    const profile = getIndustryProfile('cafe');
    const result = await calculateStartupAnalysis({ ...baseInputs, mode: '일반 점포', industryId: 'cafe' }, profile);

    expect(result.profile.group).toBe('일반 점포');
    expect(result.scoring.grade).toBeDefined();
  });

  it('supports 프랜차이즈 calculations', async () => {
    const profile = getIndustryProfile('chicken');
    const result = await calculateStartupAnalysis({ ...baseInputs, mode: '프랜차이즈', industryId: 'chicken' }, profile);

    expect(result.profile.group).toBe('프랜차이즈');
    expect(result.breakdown.franchiseFee).toBeGreaterThanOrEqual(0);
  });
});

describe('user overrides', () => {
  it('uses user actual monthly rent override', async () => {
    const profile = getIndustryProfile('cafe');
    const result = await calculateStartupAnalysis({ ...baseInputs, actualQuotes: { actualMonthlyRent: 1230000 } }, profile);

    expect(result.breakdown.monthlyRent).toBe(1230000);
    expect(result.costBand.monthlyRent.base).toBe(1230000);
  });

  it('uses user actual deposit override', async () => {
    const profile = getIndustryProfile('cafe');
    const result = await calculateStartupAnalysis({ ...baseInputs, actualQuotes: { actualDeposit: 34500000 } }, profile);

    expect(result.breakdown.deposit).toBe(34500000);
    expect(result.costBand.deposit.base).toBe(34500000);
  });

  it('uses user actual interior override', async () => {
    const profile = getIndustryProfile('cafe');
    const result = await calculateStartupAnalysis({ ...baseInputs, actualQuotes: { actualInteriorCost: 12000000 } }, profile);

    expect(result.breakdown.interior).toBe(12000000);
  });

  it('uses user actual staff count and labor cost override', async () => {
    const profile = getIndustryProfile('cafe');
    const result = await calculateStartupAnalysis(
      { ...baseInputs, actualQuotes: { actualStaffCount: 3, actualLaborCost: 5000000 } },
      profile
    );

    expect(result.breakdown.laborCost).toBe(5000000);
    expect(result.breakdown.monthlyFixedCost).toBeGreaterThanOrEqual(5000000);
  });

  it('narrows cost bands when actual quotes are present', async () => {
    const profile = getIndustryProfile('cafe');
    const result = await calculateStartupAnalysis(
      { ...baseInputs, actualQuotes: { actualDeposit: 30000000, actualMonthlyRent: 1000000 } },
      profile
    );

    expect(result.costBand.deposit.max - result.costBand.deposit.min).toBeLessThan(1000000);
    expect(result.costBand.monthlyRent.max - result.costBand.monthlyRent.min).toBeLessThan(400000);
  });
});

describe('confidence and fallback', () => {
  it('returns a finite confidence score', async () => {
    const profile = getIndustryProfile('cafe');
    const result = await calculateStartupAnalysis(baseInputs, profile);

    expect(result.confidence.overall).toBeGreaterThan(0);
    expect(result.confidence.overall).toBeLessThanOrEqual(100);
  });

  it('keeps low confidence below 90 when data is sparse', () => {
    const confidence = buildConfidence(50, 50, 45, 70, getIndustryProfile('cafe'), baseInputs, false, false, false);
    expect(confidence.overall).toBeLessThan(90);
  });

  it('includes reason summaries for confidence', () => {
    const confidence = buildConfidence(50, 50, 45, 70, getIndustryProfile('cafe'), baseInputs, false, false, false);
    expect(confidence.reasonSummary.length).toBeGreaterThan(0);
  });

  it('falls back when real APIs are unavailable', async () => {
    const profile = getIndustryProfile('cafe');
    const result = await calculateStartupAnalysis(baseInputs, profile);

    expect(['real', 'cached', 'regional', 'mock']).toContain(result.sourceMeta.source);
    expect(result.dataTrace.length).toBeGreaterThan(0);
  });

  it('fills partial data with fallback values', async () => {
    const profile = getIndustryProfile('cafe');
    const result = await calculateStartupAnalysis({ ...baseInputs, actualQuotes: { actualDeposit: 12000000 } }, profile);

    expect(result.breakdown.deposit).toBe(12000000);
    expect(result.breakdown.monthlyRent).toBeGreaterThan(0);
  });

  it('tracks low confidence when cost input data is missing', () => {
    const confidence = buildConfidence(42, 43, 41, 50, getIndustryProfile('nail'), baseInputs, false, false, false);
    expect(confidence.overall).toBeLessThan(90);
  });
});

describe('recommendations and stress tests', () => {
  function installRecommendationFetchMock() {
    vi.stubGlobal('fetch', vi.fn(async (input) => {
      const url = new URL(String(input));
      const district = url.searchParams.get('district') ?? '';
      const province = url.searchParams.get('province') ?? '';

      if (url.pathname.includes('/commercial-district')) {
        const isSeoul = province.includes('서울');
        return {
          ok: true,
          status: 200,
          json: async () => ({
            depositPerPyeong: isSeoul ? 1500000 : 950000,
            monthlyRentPerPyeong: isSeoul ? 180000 : 120000,
            competitionIndex: district.includes('강남') ? 1.72 : 1.12,
            demandIndex: district.includes('강남') ? 1.14 : 0.98,
            footTrafficIndex: district.includes('강남') ? 1.12 : 1.01,
            vacancyRate: 0.1,
            sourceDate: '2026-08-19',
            reliability: district.includes('강남') ? 94 : 90,
            summary: `${province} ${district} 실데이터`
          })
        } as Response;
      }

      if (url.pathname.includes('/commercial-rent')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            depositPerPyeong: province.includes('서울') ? 1700000 : 980000,
            monthlyRentPerPyeong: province.includes('서울') ? 180000 : 93000,
            sourceDate: '2024-01',
            referenceDate: '2024-01'
          })
        } as Response;
      }

      if (url.pathname.includes('/regional-statistics')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            floatingPopulation: province.includes('서울') ? 72000 : 39000,
            householdDensity: province.includes('서울') ? 2690 : 1800,
            commercialDensity: province.includes('서울') ? 60 : 32,
            youngPopulationRate: province.includes('서울') ? 30.1 : 23.7,
            apartmentDensity: province.includes('서울') ? 68 : 53,
            businessDensity: province.includes('서울') ? 46.4 : 34.2,
            sourceDate: '2026',
            referenceDate: '2026',
            reliability: province.includes('서울') ? 92 : 88
          })
        } as Response;
      }

      if (url.pathname.includes('/franchise-info')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            available: true,
            fee: 2900000,
            educationFee: 1100000,
            deposit: 0,
            sourceDate: '2026-08-19',
            referenceDate: '2026-08-19',
            reliability: 89
          })
        } as Response;
      }

      return { ok: false, status: 404, json: async () => ({}) } as Response;
    }));
  }

  it('builds top 5 ranked recommendations', async () => {
    installRecommendationFetchMock();
    const recommendations = await buildAlternativeRecommendations(baseInputs, getIndustryProfile('cafe'));

    expect(recommendations).toHaveLength(5);
    expect(recommendations[0].orderScore).toBeGreaterThanOrEqual(recommendations[1].orderScore);
  });

  it('includes recommendation reasons', async () => {
    installRecommendationFetchMock();
    const recommendations = await buildAlternativeRecommendations(baseInputs, getIndustryProfile('cafe'));

    expect(recommendations[0].reasons.length).toBeGreaterThan(0);
  });

  it('creates a recommendation set when selected grade is low', async () => {
    installRecommendationFetchMock();
    const profile = cloneProfile(getIndustryProfile('cafe'), {
      salesPerPyeong: 200000,
      riskLevel: 85,
      fitStrength: 20,
      variableCostRate: 0.65
    });
    const analysis = await calculateStartupAnalysis(baseInputs, profile);

    expect(analysis.scoring.grade === 'C' || analysis.scoring.grade === 'D' || analysis.scoring.grade === 'C+').toBe(true);
    const recommendations = await buildAlternativeRecommendations(baseInputs, profile);
    expect(recommendations.length).toBe(5);
  });

  it('builds stress tests for sales -30% to +20%', async () => {
    const profile = getIndustryProfile('cafe');
    const result = await calculateStartupAnalysis(baseInputs, profile);
    const stressTests = buildStressTests(result.breakdown);

    expect(stressTests).toHaveLength(6);
    expect(stressTests[0].label).toContain('-30%');
    expect(stressTests[5].label).toContain('+20%');
  });

  it('keeps cash flow and payback metrics in stress tests', async () => {
    const profile = getIndustryProfile('cafe');
    const result = await calculateStartupAnalysis(baseInputs, profile);
    const stressTests = buildStressTests(result.breakdown);

    expect(stressTests[3].cashFlow).toBeDefined();
    expect(stressTests[3].paybackMonths === null || stressTests[3].paybackMonths > 0).toBe(true);
  });
});

describe('region and comparison', () => {
  it('compares two regions for the same industry', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input) => {
      const url = new URL(String(input));
      const district = url.searchParams.get('district') ?? '';
      const province = url.searchParams.get('province') ?? '';
      if (url.pathname.includes('/commercial-district')) {
        if (district.includes('강남')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              depositPerPyeong: 1500000,
              monthlyRentPerPyeong: 180000,
              competitionIndex: 1.72,
              demandIndex: 1.14,
              footTrafficIndex: 1.12,
              vacancyRate: 0.11,
              sourceDate: '2026-08-19',
              reliability: 94,
              summary: '강남구 실데이터'
            })
          } as Response;
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({
            depositPerPyeong: 950000,
            monthlyRentPerPyeong: 120000,
            competitionIndex: 1.12,
            demandIndex: 0.98,
            footTrafficIndex: 1.01,
            vacancyRate: 0.08,
            sourceDate: '2026-08-19',
            reliability: 90,
            summary: `${province} ${district} 실데이터`
          })
        } as Response;
      }

      if (url.pathname.includes('/commercial-rent')) {
        if (district.includes('강남')) {
          return { ok: true, status: 200, json: async () => ({ depositPerPyeong: 1700000, monthlyRentPerPyeong: 180000, sourceDate: '2024-01', referenceDate: '2024-01' }) } as Response;
        }
        return { ok: true, status: 200, json: async () => ({ depositPerPyeong: 980000, monthlyRentPerPyeong: 93000, sourceDate: '2024-01', referenceDate: '2024-01' }) } as Response;
      }

      if (url.pathname.includes('/regional-statistics')) {
        if (district.includes('강남')) {
          return { ok: true, status: 200, json: async () => ({ floatingPopulation: 72000, householdDensity: 2690, commercialDensity: 60, youngPopulationRate: 30.1, apartmentDensity: 68, businessDensity: 46.4, sourceDate: '2026', referenceDate: '2026', reliability: 92 }) } as Response;
        }
        return { ok: true, status: 200, json: async () => ({ floatingPopulation: 39000, householdDensity: 1800, commercialDensity: 32, youngPopulationRate: 23.7, apartmentDensity: 53, businessDensity: 34.2, sourceDate: '2026', referenceDate: '2026', reliability: 88 }) } as Response;
      }

      if (url.pathname.includes('/franchise-info')) {
        return { ok: true, status: 200, json: async () => ({ available: true, fee: 2900000, educationFee: 1100000, deposit: 0, sourceDate: '2026-08-19', referenceDate: '2026-08-19', reliability: 89 }) } as Response;
      }

      return { ok: false, status: 404, json: async () => ({}) } as Response;
    }));

    const profile = getIndustryProfile('cafe');
    const left = await calculateStartupAnalysis({ ...baseInputs, comparisonArea: '불당동 상권', district: '천안시' }, profile);
    const right = await calculateStartupAnalysis({ ...baseInputs, district: '아산시', neighborhood: '배방읍', commercialArea: '탕정 상권' }, profile);

    expect(left.breakdown.totalInvestment).not.toBe(right.breakdown.totalInvestment);
  });

  it('reflects region differences in rent and competition', async () => {
    const profile = getIndustryProfile('cafe');
    const left = await calculateStartupAnalysis({ ...baseInputs, district: '천안시', neighborhood: '불당동', commercialArea: '불당 상권' }, profile);
    const right = await calculateStartupAnalysis({
      ...baseInputs,
      province: '서울특별시',
      district: '강남구',
      neighborhood: '역삼동',
      commercialArea: '강남역 상권'
    }, profile);

    expect(left.breakdown.monthlyRent).not.toBe(right.breakdown.monthlyRent);
    expect(left.context.competitionIndex).not.toBe(right.context.competitionIndex);
  });
});
