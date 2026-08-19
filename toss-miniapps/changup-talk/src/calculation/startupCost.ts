import { getAllIndustryOptions } from '../data/industries';
import { resolveCommercialDistrictContext } from '../services/commercialDistrict';
import { resolveFranchiseSnapshot } from '../services/franchise';
import { resolveRentSnapshot } from '../services/rent';
import { resolveRegionStatistics } from '../services/statistics';
import type {
  AnalysisConfidence,
  AnalysisResult,
  CostBand,
  IndustryProfile,
  RecommendationCandidate,
  ScenarioResult,
  StartupCostBreakdown,
  StartupInputs,
  StressTestScenario
} from '../types/startup';
import { formatCompactWon } from '../utils/currency';
import { calculateBreakEvenSales } from './breakEven';
import { buildScoringSummary } from './scoring';

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function roundMoney(value: number): number {
  return Math.round(value / 10000) * 10000;
}

function selectedArea(inputs: StartupInputs, profile: IndustryProfile): number {
  const area = inputs.useCustomArea ? inputs.customAreaPyeong : inputs.areaPyeong;
  return Math.max(1, area || profile.defaultArea);
}

function band(base: number, confidence: number, spread = 0.14, minSpread = 0.08): CostBand {
  const uncertainty = Math.max(minSpread, spread * (1 - confidence / 100));
  return {
    min: roundMoney(base * (1 - uncertainty)),
    base: roundMoney(base),
    max: roundMoney(base * (1 + uncertainty))
  };
}

function applyOverride(base: number, override?: number): number {
  return typeof override === 'number' && Number.isFinite(override) && override >= 0 ? override : base;
}

function buildCostBand(base: number, confidence: number, override?: number): CostBand {
  const adjusted = applyOverride(base, override);
  return band(adjusted, override !== undefined ? Math.max(95, confidence) : confidence, override !== undefined ? 0.1 : 0.22, override !== undefined ? 0.005 : 0.08);
}

function selectedStaff(inputs: StartupInputs): number {
  return Math.max(0, inputs.actualQuotes.actualStaffCount ?? inputs.operatingStaff);
}

function staffMultiplier(inputs: StartupInputs, profile: IndustryProfile): number {
  const gap = Math.max(0, selectedStaff(inputs) - profile.requiredStaff);
  return 1 + Math.min(0.32, gap * 0.08);
}

function deliveryAdjustment(inputs: StartupInputs): number {
  const delivery = clamp(inputs.deliveryRatio, 0, 100) / 100;
  return 1 + delivery * 0.1;
}

function buildSalesMultiplier(
  context: Awaited<ReturnType<typeof resolveCommercialDistrictContext>>,
  profile: IndustryProfile,
  area: number
): number {
  const regionStats = context.regionStatistics;
  const demandSignal = 0.84
    + (context.demandIndex - 1) * 0.22
    + (context.footTrafficIndex - 1) * 0.14
    + (regionStats.floatingPopulation / 100000) * 0.08
    + (regionStats.householdDensity / 10000) * 0.02
    + (regionStats.commercialDensity / 100) * 0.015;
  const competitionPenalty = 1 - Math.max(0, context.competitionIndex - 1) * 0.14;
  const areaAdjustment = 0.9 + Math.min(0.12, Math.max(0, area / profile.defaultArea - 1) * 0.05);
  const fitAdjustment = 0.92 + profile.fitStrength / 500;
  const accessAdjustment = context.vacancyRate > 0.12 ? 0.96 : 1;

  return clamp(demandSignal * competitionPenalty * areaAdjustment * fitAdjustment * accessAdjustment, 0.72, 1.28);
}

export function buildConfidence(
  contextSource: number,
  rentSource: number,
  statsSource: number,
  franchiseSource: number,
  profile: IndustryProfile,
  inputs: StartupInputs,
  rentOverridden: boolean,
  depositOverridden: boolean,
  costOverridden: boolean
): AnalysisConfidence {
  const overrideBoost = [rentOverridden, depositOverridden, costOverridden].filter(Boolean).length * 6;
  const rent = clamp(rentSource + (rentOverridden ? 6 : 0) + (depositOverridden ? 4 : 0), 30, 98);
  const competition = clamp((contextSource + statsSource) / 2, 32, 97);
  const demand = clamp(statsSource + (selectedArea(inputs, profile) <= profile.defaultArea ? 2 : 0), 28, 96);
  const startupCost = clamp(60 + overrideBoost + (costOverridden ? 16 : 0), 34, 98);
  const sourcePenalty = (contextSource < 90 ? 5 : 0) + (rentSource < 90 ? 3 : 0) + (statsSource < 85 ? 6 : 0) + (franchiseSource < 90 ? 2 : 0);
  const salesForecast = clamp(
    48 + (demand - 50) * 0.22 + (competition - 50) * 0.08 + (profile.fitStrength - 70) * 0.16 + (profile.variableCostRate <= 0.25 ? 2 : 0) - sourcePenalty,
    32,
    84
  );
  const overall = clamp(
    rent * 0.2 + competition * 0.18 + demand * 0.22 + startupCost * 0.2 + salesForecast * 0.2 + franchiseSource * 0.02,
    18,
    97
  );

  const reasonSummary = [
    `임대 신뢰도 ${Math.round(rent)}점`,
    `경쟁 신뢰도 ${Math.round(competition)}점`,
    `수요 신뢰도 ${Math.round(demand)}점`,
    `창업비 신뢰도 ${Math.round(startupCost)}점`,
    `매출 예측 신뢰도 ${Math.round(salesForecast)}점`
  ];

  return {
    overall: Math.round(overall),
    rent: Math.round(rent),
    competition: Math.round(competition),
    demand: Math.round(demand),
    startupCost: Math.round(startupCost),
    salesForecast: Math.round(salesForecast),
    reasonSummary
  };
}

function buildScenarioResults(breakdown: StartupCostBreakdown): ScenarioResult[] {
  const scenarios = [
    { label: '보수적' as const, salesMultiplier: 0.82, costMultiplier: 1.08, variableCostDelta: 0.03 },
    { label: '기준' as const, salesMultiplier: 1, costMultiplier: 1, variableCostDelta: 0 },
    { label: '낙관적' as const, salesMultiplier: 1.18, costMultiplier: 0.95, variableCostDelta: -0.02 }
  ];

  return scenarios.map((scenario) => {
    const sales = breakdown.expectedSales * scenario.salesMultiplier;
    const fixedCost = breakdown.monthlyFixedCost * scenario.costMultiplier;
    const variableRate = Math.max(0.05, Math.min(0.9, breakdown.variableCostRate + scenario.variableCostDelta));
    const variableCost = sales * variableRate;
    const operatingProfit = sales - variableCost - fixedCost;
    const breakEvenSales = calculateBreakEvenSales(fixedCost, variableRate);
    const breakEvenBufferRate = breakEvenSales > 0 ? ((sales - breakEvenSales) / breakEvenSales) * 100 : 0;
    const cashFlow = operatingProfit - breakdown.workingCapital / 12;

    return {
      label: scenario.label,
      sales: roundMoney(sales),
      totalCost: roundMoney(fixedCost + variableCost),
      operatingProfit: roundMoney(operatingProfit),
      breakEvenBufferRate,
      paybackMonths: operatingProfit > 0 ? breakdown.totalInvestment / operatingProfit : null,
      cashFlow: roundMoney(cashFlow),
      notes: [
        `매출 배수 ${scenario.salesMultiplier.toFixed(2)} 적용`,
        `비용 배수 ${scenario.costMultiplier.toFixed(2)} 적용`,
        `가변비율 ${Math.round(variableRate * 100)}%`
      ]
    };
  });
}

export function buildStressTests(breakdown: StartupCostBreakdown): StressTestScenario[] {
  const multipliers = [-0.3, -0.2, -0.1, 0, 0.1, 0.2];

  return multipliers.map((multiplier) => {
    const sales = roundMoney(Math.max(0, breakdown.expectedSales * (1 + multiplier)));
    const variableCost = sales * breakdown.variableCostRate;
    const operatingProfit = sales - variableCost - breakdown.monthlyFixedCost;
    const breakEvenSales = calculateBreakEvenSales(breakdown.monthlyFixedCost, breakdown.variableCostRate);
    const cashFlow = operatingProfit - breakdown.workingCapital / 12;

    return {
      label: multiplier === 0 ? '기준' : `${multiplier > 0 ? '+' : ''}${Math.round(multiplier * 100)}%`,
      salesMultiplier: multiplier,
      sales,
      operatingProfit: roundMoney(operatingProfit),
      breakEvenSales: roundMoney(breakEvenSales),
      cashFlow: roundMoney(cashFlow),
      paybackMonths: operatingProfit > 0 ? breakdown.totalInvestment / operatingProfit : null
    };
  });
}

function buildBreakdownAndBands(
  inputs: StartupInputs,
  profile: IndustryProfile,
  context: Awaited<ReturnType<typeof resolveCommercialDistrictContext>>,
  rentSnapshot: Awaited<ReturnType<typeof resolveRentSnapshot>>,
  franchiseSnapshot: Awaited<ReturnType<typeof resolveFranchiseSnapshot>>
): {
  breakdown: StartupCostBreakdown;
  costBand: AnalysisResult['costBand'];
  salesBand: CostBand;
  capitalGap: number;
  risks: string[];
  suggestions: string[];
} {
  const area = selectedArea(inputs, profile);
  const areaScale = Math.max(0.72, area / profile.defaultArea);
  const operatingScale = staffMultiplier(inputs, profile) * deliveryAdjustment(inputs);
  const salesMultiplier = buildSalesMultiplier(context, profile, area);

  const depositBase = applyOverride(rentSnapshot.depositPerPyeong * area, inputs.actualQuotes.actualDeposit);
  const rentBase = applyOverride(rentSnapshot.monthlyRentPerPyeong * area, inputs.actualQuotes.actualMonthlyRent);
  const premiumBase = applyOverride(context.premiumEstimate ?? 0, inputs.actualQuotes.actualPremium);
  const interiorBase = applyOverride(profile.interiorPerPyeong * area * operatingScale, inputs.actualQuotes.actualInteriorCost);
  const equipmentBase = applyOverride(profile.equipmentBase * (0.7 + areaScale * 0.55), inputs.actualQuotes.actualEquipmentCost);
  const furnitureBase = profile.furnitureBase * (0.7 + areaScale * 0.45);
  const inventoryBase = profile.inventoryBase * (0.8 + areaScale * 0.5);
  const licenseCost = profile.licenseCost;
  const franchiseFee = franchiseSnapshot.available ? franchiseSnapshot.fee : 0;
  const educationFee = franchiseSnapshot.educationFee || profile.educationFee;
  const laborCost = applyOverride(profile.laborBaseCost * Math.max(0.7, selectedStaff(inputs) / Math.max(1, profile.requiredStaff + 0.5)), inputs.actualQuotes.actualLaborCost);
  const employerBurden = laborCost * clamp(0.12 + selectedStaff(inputs) * 0.01, 0.12, 0.2);
  const utilities = profile.utilitiesBaseCost * (0.9 + areaScale * 0.2);
  const managementFee = profile.managementBaseCost * (0.95 + context.sourceMeta.reliability / 150);
  const marketingCost = profile.marketingBaseCost * (0.9 + context.demandIndex * 0.08);
  const otherMonthlyCost = profile.otherMonthlyCost * (0.9 + context.competitionIndex * 0.05);
  const workingCapital = (rentBase + laborCost + employerBurden + utilities + managementFee + marketingCost + otherMonthlyCost) * 3;
  const otherCost = profile.otherSetupCost + (context.premiumAvailable ? context.premiumEstimate! * 0.05 : 0);
  const totalInvestment = depositBase + premiumBase + interiorBase + equipmentBase + furnitureBase + inventoryBase + licenseCost + franchiseFee + educationFee + workingCapital + otherCost;
  const monthlyFixedCost = rentBase + laborCost + employerBurden + utilities + managementFee + marketingCost + otherMonthlyCost;
  const variableCostRate = clamp(
    profile.variableCostRate
      + 0.018
      + (inputs.deliveryRatio / 100) * (profile.group === '배달 전문점' ? 0.04 : 0.015)
      - (selectedStaff(inputs) <= 1 ? 0.02 : 0.01),
    0.05,
    0.78
  );
  const expectedSales = profile.salesPerPyeong * area * salesMultiplier * operatingScale;
  const variableCost = expectedSales * variableCostRate;
  const breakEvenSales = calculateBreakEvenSales(monthlyFixedCost, variableCostRate);
  const operatingProfit = expectedSales - variableCost - monthlyFixedCost;
  const paybackMonths = operatingProfit > 0 ? totalInvestment / operatingProfit : null;

  const confidence = buildConfidence(
    context.sourceMeta.reliability,
    rentSnapshot.sourceMeta.reliability,
    context.regionStatistics.sourceMeta.reliability,
    franchiseSnapshot.sourceMeta.reliability,
    profile,
    inputs,
    inputs.actualQuotes.actualMonthlyRent !== undefined,
    inputs.actualQuotes.actualDeposit !== undefined,
    inputs.actualQuotes.actualInteriorCost !== undefined || inputs.actualQuotes.actualEquipmentCost !== undefined || inputs.actualQuotes.actualLaborCost !== undefined
  );

  const costBand = {
    deposit: buildCostBand(depositBase, confidence.rent, inputs.actualQuotes.actualDeposit),
    monthlyRent: buildCostBand(rentBase, confidence.rent, inputs.actualQuotes.actualMonthlyRent),
    interior: buildCostBand(interiorBase, confidence.startupCost, inputs.actualQuotes.actualInteriorCost),
    equipment: buildCostBand(equipmentBase, confidence.startupCost, inputs.actualQuotes.actualEquipmentCost),
    totalInvestment: band(totalInvestment, confidence.overall, 0.26, 0.1)
  };

  const salesBand = band(expectedSales, confidence.salesForecast, 0.32, 0.14);
  const capitalGap = inputs.availableCapital - totalInvestment;
  const risks: string[] = [];
  if (capitalGap < 0) risks.push(`보유자금이 ${formatCompactWon(Math.abs(capitalGap))} 부족합니다.`);
  if (costBand.monthlyRent.base > inputs.availableCapital * 0.08) risks.push('월세 부담이 보유자금 대비 과합니다.');
  if (context.competitionIndex > 1.15) risks.push('경쟁 과밀이 예상됩니다.');
  if (selectedStaff(inputs) > 1 && profile.requiredStaff <= 1) risks.push('인건비 부담이 낮지 않습니다.');
  if (profile.variableCostRate > 0.4) risks.push('낮은 마진 구조라 매출 방어가 중요합니다.');
  if (paybackMonths !== null && paybackMonths < 12) risks.push('회수기간이 12개월 미만입니다. 높은 매출 가정을 전제로 한 결과입니다.');
  if (paybackMonths !== null && paybackMonths > 36) risks.push('투자회수기간이 길어질 수 있습니다.');
  if (confidence.overall < 60) risks.push('데이터 신뢰도가 낮아 실제 견적 확인이 필요합니다.');

  const suggestions: string[] = [
    context.premiumAvailable
      ? '권리금이 있는 지역은 협상 전후 비교와 계약 조건 검토가 필요합니다.'
      : '권리금 데이터가 부족해 동일 업종 실제 매물 확인이 필요합니다.',
    selectedStaff(inputs) <= 1 ? '1인 운영 가능성은 높지만 피크타임 대응 계획이 필요합니다.' : '운영 인원에 맞춘 업무 분장을 점검하세요.',
    capitalGap < 0 ? '보유자금에 맞추려면 면적 축소, 장비 축소, 권리금 협상 순으로 조정하세요.' : '보유자금 안에 들어오지만 비상자금은 별도로 남겨두는 것이 좋습니다.'
  ];

  return {
    breakdown: {
      deposit: roundMoney(depositBase),
      monthlyRent: roundMoney(rentBase),
      premium: roundMoney(premiumBase),
      interior: roundMoney(interiorBase),
      equipment: roundMoney(equipmentBase),
      furniture: roundMoney(furnitureBase),
      initialInventory: roundMoney(inventoryBase),
      licenseCost: roundMoney(licenseCost),
      franchiseFee: roundMoney(franchiseFee),
      educationFee: roundMoney(educationFee),
      workingCapital: roundMoney(workingCapital),
      otherCost: roundMoney(otherCost),
      laborCost: roundMoney(laborCost),
      utilities: roundMoney(utilities),
      managementFee: roundMoney(managementFee),
      marketingCost: roundMoney(marketingCost),
      otherMonthlyCost: roundMoney(otherMonthlyCost),
      totalInvestment: roundMoney(totalInvestment),
      monthlyFixedCost: roundMoney(monthlyFixedCost),
      variableCostRate,
      breakEvenSales: roundMoney(breakEvenSales),
      expectedSales: roundMoney(expectedSales),
      variableCost: roundMoney(variableCost),
      operatingProfit: roundMoney(operatingProfit),
      paybackMonths
    },
    costBand,
    salesBand,
    capitalGap,
    risks,
    suggestions
  };
}

export async function calculateStartupAnalysis(inputs: StartupInputs, profile: IndustryProfile): Promise<AnalysisResult> {
  const context = await resolveCommercialDistrictContext(inputs, profile);
  const [rentSnapshot, franchiseSnapshot] = await Promise.all([
    resolveRentSnapshot(context),
    resolveFranchiseSnapshot(profile)
  ]);
  const regionalStats = context.regionStatistics ?? await resolveRegionStatistics(inputs.province, inputs.district);

  const { breakdown, costBand, salesBand, capitalGap, risks, suggestions } = buildBreakdownAndBands(
    inputs,
    profile,
    { ...context, regionStatistics: regionalStats },
    rentSnapshot,
    franchiseSnapshot
  );

  const scenarios = buildScenarioResults(breakdown);
  const stressTests = buildStressTests(breakdown);
  const scoring = buildScoringSummary(profile, context);
  const sourceMeta = context.sourceMeta;
  const dataTrace = [context.sourceMeta, rentSnapshot.sourceMeta, franchiseSnapshot.sourceMeta, regionalStats.sourceMeta];

  const confidence = buildConfidence(
    context.sourceMeta.reliability,
    rentSnapshot.sourceMeta.reliability,
    regionalStats.sourceMeta.reliability,
    franchiseSnapshot.sourceMeta.reliability,
    profile,
    inputs,
    inputs.actualQuotes.actualMonthlyRent !== undefined,
    inputs.actualQuotes.actualDeposit !== undefined,
    inputs.actualQuotes.actualInteriorCost !== undefined || inputs.actualQuotes.actualEquipmentCost !== undefined || inputs.actualQuotes.actualLaborCost !== undefined
  );

  return {
    sourceMeta,
    profile,
    context: { ...context, regionStatistics: regionalStats },
    confidence,
    breakdown,
    salesBand,
    costBand,
    scenarios,
    stressTests,
    scoring,
    risks,
    suggestions,
    capitalGap,
    affiliateNotice: '제휴 고지: 본 화면에는 운영용 제휴/광고 영역이 포함될 수 있으며, 실제 운영 ID는 환경변수로 주입해야 합니다.',
    dataTrace
  };
}

export async function buildAlternativeRecommendations(
  inputs: StartupInputs,
  _selectedProfile: IndustryProfile
): Promise<RecommendationCandidate[]> {
  const profiles = getAllIndustryOptions();
  const analyses = await Promise.all(
    profiles.map(async (profile) => {
      const analysis = await calculateStartupAnalysis({ ...inputs, industryId: profile.id, mode: profile.group }, profile);
      const affordabilityScore = clamp(100 - Math.abs(analysis.capitalGap) / 3000000, 0, 100);
      const onePersonFit = inputs.operatingStaff <= 1 && profile.requiredStaff <= 1 ? 12 : 0;
      const orderScore =
        affordabilityScore * 0.18 +
        analysis.scoring.score * 0.22 +
        analysis.confidence.overall * 0.12 +
        (100 - profile.operationalComplexity) * 0.1 +
        (100 - analysis.breakdown.monthlyFixedCost / 120000) * 0.12 +
        (analysis.breakdown.paybackMonths ? Math.max(0, 40 - analysis.breakdown.paybackMonths) : 0) * 0.08 +
        (analysis.breakdown.operatingProfit > 0 ? 12 : -8) +
        onePersonFit;
      const reasons = [
        analysis.capitalGap >= 0
          ? `현재 보유자금 안에서 시작 가능성이 높습니다.`
          : `필요자금이 ${formatCompactWon(Math.abs(analysis.capitalGap))} 초과됩니다.`,
        analysis.context.rentIndex < 1.05 ? '임대료 부담이 비교적 낮습니다.' : '임대료 부담은 높지만 관리 가능한 범위입니다.',
        analysis.context.competitionIndex < 1.05 ? '동일 업종 경쟁밀도가 상대적으로 낮습니다.' : '경쟁밀도는 중간 이상입니다.',
        inputs.operatingStaff <= 1 && profile.requiredStaff <= 1 ? '1인 운영에 적합합니다.' : '운영인원 계획을 다시 봐야 합니다.',
        `데이터 신뢰도 ${analysis.confidence.overall}/100`
      ];

      return {
        profile,
        analysis,
        orderScore,
        suitabilityNote: analysis.capitalGap >= 0 ? '현재 조건에서 시작 가능성이 있는 후보입니다.' : '추가 자금 또는 비용 조정이 필요합니다.',
        reasons
      } satisfies RecommendationCandidate;
    })
  );

  return analyses.sort((left, right) => right.orderScore - left.orderScore).slice(0, 5);
}
