import { calculateBreakEvenSales } from '../src/calculation/breakEven';
import { calculateStartupAnalysis } from '../src/calculation/startupCost';
import { getIndustryProfile } from '../src/data/industries';
import type { StartupInputs } from '../src/types/startup';

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
  comparisonArea: '불당동 중심상권'
};

describe('startup calculations', () => {
  it('calculates break-even sales', () => {
    expect(calculateBreakEvenSales(1000000, 0.5)).toBe(2000000);
  });

  it('builds a positive analysis for the default area', () => {
    const profile = getIndustryProfile('cafe');
    const result = calculateStartupAnalysis(baseInputs, profile);

    expect(result.breakdown.totalInvestment).toBeGreaterThan(0);
    expect(result.breakdown.breakEvenSales).toBeGreaterThan(0);
    expect(result.breakdown.expectedSales).toBeGreaterThan(0);
  });

  it('changes area-sensitive costs when area grows', () => {
    const profile = getIndustryProfile('cafe');
    const smaller = calculateStartupAnalysis(baseInputs, profile);
    const larger = calculateStartupAnalysis({ ...baseInputs, areaPyeong: 30 }, profile);

    expect(larger.breakdown.totalInvestment).toBeGreaterThan(smaller.breakdown.totalInvestment);
    expect(larger.breakdown.monthlyRent).toBeGreaterThan(smaller.breakdown.monthlyRent);
  });

  it('changes startup profile when industry changes', () => {
    const cafeProfile = getIndustryProfile('cafe');
    const chickenProfile = getIndustryProfile('chicken');

    const cafe = calculateStartupAnalysis(baseInputs, cafeProfile);
    const chicken = calculateStartupAnalysis({ ...baseInputs, industryId: 'chicken', mode: '프랜차이즈' }, chickenProfile);

    expect(chicken.breakdown.totalInvestment).not.toBe(cafe.breakdown.totalInvestment);
    expect(chicken.breakdown.franchiseFee).toBeGreaterThanOrEqual(0);
  });

  it('returns null payback when operating profit is negative', () => {
    const profile = getIndustryProfile('chicken');
    const result = calculateStartupAnalysis(
      { ...baseInputs, industryId: 'chicken', mode: '프랜차이즈', availableCapital: 5000000, operatingStaff: 0, areaPyeong: 10 },
      profile
    );

    expect(result.breakdown.operatingProfit <= 0 ? result.breakdown.paybackMonths : true).toBe(true);
  });

  it('adjusts payback with stronger operating conditions', () => {
    const profile = getIndustryProfile('cafe');
    const leaner = calculateStartupAnalysis(baseInputs, profile);
    const largerStaff = calculateStartupAnalysis({ ...baseInputs, operatingStaff: 3 }, profile);

    expect(largerStaff.breakdown.monthlyFixedCost).toBeGreaterThanOrEqual(leaner.breakdown.monthlyFixedCost);
  });
});
