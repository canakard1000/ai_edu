import { getFranchiseSnapshot } from '../services/franchise';
import { getMockCommercialDistrictContext } from '../services/commercialDistrict';
import { getRentSnapshot } from '../services/rent';
import type {
  AnalysisResult,
  IndustryProfile,
  StartupInputs
} from '../types/startup';
import { formatCompactWon } from '../utils/currency';
import { calculateBreakEvenSales } from './breakEven';
import { buildScenarioResults } from './scenarios';
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

function staffMultiplier(inputs: StartupInputs, profile: IndustryProfile): number {
  const gap = Math.max(0, inputs.operatingStaff - profile.requiredStaff);
  return 1 + Math.min(0.32, gap * 0.08);
}

function deliveryAdjustment(inputs: StartupInputs): number {
  const delivery = clamp(inputs.deliveryRatio, 0, 100) / 100;
  return 1 + delivery * 0.1;
}

export function calculateStartupAnalysis(inputs: StartupInputs, profile: IndustryProfile): AnalysisResult {
  const area = selectedArea(inputs, profile);
  const context = getMockCommercialDistrictContext(inputs, profile);
  const rentSnapshot = getRentSnapshot(context);
  const franchiseSnapshot = getFranchiseSnapshot(profile);
  const areaScale = Math.max(0.72, area / profile.defaultArea);
  const operatingScale = staffMultiplier(inputs, profile) * deliveryAdjustment(inputs);
  const deposit = roundMoney(rentSnapshot.depositPerPyeong * area * (1 + Math.max(0, areaScale - 1) * 0.12));
  const monthlyRent = roundMoney(rentSnapshot.monthlyRentPerPyeong * area * (1 + Math.max(0, areaScale - 1) * 0.07));
  const premium = context.premiumEstimate ?? 0;
  const interior = roundMoney(profile.interiorPerPyeong * area * operatingScale);
  const equipment = roundMoney(profile.equipmentBase * (0.7 + areaScale * 0.55));
  const furniture = roundMoney(profile.furnitureBase * (0.7 + areaScale * 0.45));
  const initialInventory = roundMoney(profile.inventoryBase * (0.8 + areaScale * 0.5));
  const licenseCost = roundMoney(profile.licenseCost);
  const franchiseFee = roundMoney(franchiseSnapshot.available ? franchiseSnapshot.fee : 0);
  const educationFee = roundMoney(franchiseSnapshot.educationFee || profile.educationFee);
  const laborCost = roundMoney(profile.laborBaseCost * Math.max(0.7, inputs.operatingStaff / Math.max(1, profile.requiredStaff + 0.5)));
  const utilities = roundMoney(profile.utilitiesBaseCost * (0.9 + areaScale * 0.2));
  const managementFee = roundMoney(profile.managementBaseCost * (0.95 + context.rentIndex * 0.08));
  const marketingCost = roundMoney(profile.marketingBaseCost * (0.9 + context.demandIndex * 0.08));
  const otherMonthlyCost = roundMoney(profile.otherMonthlyCost * (0.9 + context.competitionIndex * 0.05));
  const workingCapital = roundMoney((monthlyRent + laborCost + utilities + managementFee + marketingCost + otherMonthlyCost) * 3);
  const otherCost = roundMoney(profile.otherSetupCost + (context.premiumAvailable ? context.premiumEstimate! * 0.05 : 0));
  const totalInvestment = deposit + premium + interior + equipment + furniture + initialInventory + licenseCost + franchiseFee + educationFee + workingCapital + otherCost;
  const monthlyFixedCost = monthlyRent + laborCost + utilities + managementFee + marketingCost + otherMonthlyCost;
  const variableCostRate = clamp(
    profile.variableCostRate - (inputs.deliveryRatio / 100) * 0.03 + (inputs.operatingStaff <= 1 ? -0.02 : 0.01),
    0.08,
    0.68
  );
  const expectedSales = roundMoney(profile.salesPerPyeong * area * context.demandIndex * operatingScale);
  const variableCost = roundMoney(expectedSales * variableCostRate);
  const breakEvenSales = roundMoney(calculateBreakEvenSales(monthlyFixedCost, variableCostRate));
  const operatingProfit = roundMoney(expectedSales - variableCost - monthlyFixedCost);
  const paybackMonths = operatingProfit > 0 ? totalInvestment / operatingProfit : null;
  const capitalGap = inputs.availableCapital - totalInvestment;
  const scenarios = buildScenarioResults({
    deposit,
    monthlyRent,
    premium,
    interior,
    equipment,
    furniture,
    initialInventory,
    licenseCost,
    franchiseFee,
    educationFee,
    workingCapital,
    otherCost,
    laborCost,
    utilities,
    managementFee,
    marketingCost,
    otherMonthlyCost,
    totalInvestment,
    monthlyFixedCost,
    variableCostRate,
    breakEvenSales,
    expectedSales,
    variableCost,
    operatingProfit,
    paybackMonths
  });
  const scoring = buildScoringSummary(profile, context);
  const risks: string[] = [
    `${context.competitorExamples[0]} 기준으로 경쟁 점포가 존재합니다.`,
    context.rentIndex > 1.15 ? '임대료 부담이 기준보다 높은 편입니다.' : '임대료 부담은 비교적 완만합니다.',
    profile.requiredStaff <= 1 ? '1인 운영은 체력과 업무 집중도가 중요합니다.' : '운영 인원 배치가 고정비에 영향을 줍니다.'
  ];
  const suggestions: string[] = [
    `면적을 ${profile.recommendedAreas[0]}평 수준으로 줄이면 초기 투자비를 약 ${formatCompactWon(area > profile.recommendedAreas[0] ? (area - profile.recommendedAreas[0]) * profile.interiorPerPyeong * 0.8 : 0)} 절감할 수 있습니다.`,
    context.premiumAvailable
      ? '권리금이 있는 지역은 협상 전후 비교를 통해 회수 가능성을 검토해 보세요.'
      : '권리금 데이터가 부족하므로 동일 업종의 실제 매물 확인이 필요합니다.',
    scoring.grade === 'D'
      ? '상권 적합도가 낮아 보수적인 매출 가정과 업종 재검토가 필요합니다.'
      : '현재 조건에서는 기준 시나리오와 보수적 시나리오를 함께 보며 판단하는 것이 좋습니다.'
  ];

  return {
    source: 'mock',
    profile,
    context,
    breakdown: {
      deposit,
      monthlyRent,
      premium,
      interior,
      equipment,
      furniture,
      initialInventory,
      licenseCost,
      franchiseFee,
      educationFee,
      workingCapital,
      otherCost,
      laborCost,
      utilities,
      managementFee,
      marketingCost,
      otherMonthlyCost,
      totalInvestment,
      monthlyFixedCost,
      variableCostRate,
      breakEvenSales,
      expectedSales,
      variableCost,
      operatingProfit,
      paybackMonths
    },
    scenarios,
    scoring,
    risks,
    suggestions,
    capitalGap,
    affiliateNotice: '제휴 고지: 본 화면에는 운영용 제휴/광고 영역이 포함될 수 있으며, 실제 운영 ID는 환경변수로 주입해야 합니다.'
  };
}
