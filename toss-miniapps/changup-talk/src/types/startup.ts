export type StartupMode =
  | '일반 점포'
  | '배달 전문점'
  | '무인 창업'
  | '1인·소자본 창업'
  | '프랜차이즈';

export type AnalysisPhase = 'idle' | 'loading' | 'ready' | 'error';
export type DataSource = 'mock' | 'api';

export interface IndustryProfile {
  id: string;
  name: string;
  group: StartupMode;
  tags: string[];
  summary: string;
  defaultArea: number;
  recommendedAreas: number[];
  minCapital: number;
  riskLevel: number;
  fitStrength: number;
  variableCostRate: number;
  salesPerPyeong: number;
  baseDepositPerPyeong: number;
  baseRentPerPyeong: number;
  interiorPerPyeong: number;
  equipmentBase: number;
  furnitureBase: number;
  inventoryBase: number;
  licenseCost: number;
  franchiseFee: number;
  educationFee: number;
  otherSetupCost: number;
  laborBaseCost: number;
  utilitiesBaseCost: number;
  managementBaseCost: number;
  marketingBaseCost: number;
  otherMonthlyCost: number;
  requiredStaff: number;
  operationalComplexity: number;
}

export interface StartupInputs {
  province: string;
  district: string;
  neighborhood: string;
  commercialArea: string;
  mode: StartupMode;
  industryId: string;
  areaPyeong: number;
  useCustomArea: boolean;
  customAreaPyeong: number;
  availableCapital: number;
  operatingStaff: number;
  deliveryRatio: number;
  operationHours: string;
  secondaryDistrict: string;
  comparisonArea: string;
}

export interface CommercialDistrictContext {
  dataSource: DataSource;
  province: string;
  district: string;
  neighborhood: string;
  commercialArea: string;
  rentIndex: number;
  demandIndex: number;
  competitionIndex: number;
  footTrafficIndex: number;
  vacancyRate: number;
  depositPerPyeong: number;
  monthlyRentPerPyeong: number;
  premiumAvailable: boolean;
  premiumEstimate: number | null;
  competitorExamples: string[];
  reasonSummary: string[];
  notes: string;
  updatedAt: string;
}

export interface StartupCostBreakdown {
  deposit: number;
  monthlyRent: number;
  premium: number;
  interior: number;
  equipment: number;
  furniture: number;
  initialInventory: number;
  licenseCost: number;
  franchiseFee: number;
  educationFee: number;
  workingCapital: number;
  otherCost: number;
  laborCost: number;
  utilities: number;
  managementFee: number;
  marketingCost: number;
  otherMonthlyCost: number;
  totalInvestment: number;
  monthlyFixedCost: number;
  variableCostRate: number;
  breakEvenSales: number;
  expectedSales: number;
  variableCost: number;
  operatingProfit: number;
  paybackMonths: number | null;
}

export interface ScenarioResult {
  label: '보수적' | '기준' | '낙관적';
  sales: number;
  totalCost: number;
  operatingProfit: number;
  breakEvenBufferRate: number;
  paybackMonths: number | null;
  notes: string[];
}

export interface ScoringFactor {
  label: string;
  score: number;
  weight: number;
  explanation: string;
}

export interface ScoringSummary {
  score: number;
  grade: 'A' | 'B+' | 'B' | 'C+' | 'C' | 'D';
  factors: ScoringFactor[];
  warnings: string[];
}

export interface AnalysisResult {
  source: DataSource;
  profile: IndustryProfile;
  context: CommercialDistrictContext;
  breakdown: StartupCostBreakdown;
  scenarios: ScenarioResult[];
  scoring: ScoringSummary;
  risks: string[];
  suggestions: string[];
  capitalGap: number;
  affiliateNotice: string;
}

export interface ReverseCandidate {
  profile: IndustryProfile;
  analysis: AnalysisResult;
  affordabilityScore: number;
  operatingDifficulty: number;
  suitabilityNote: string;
}

export interface ComparisonResult {
  left: AnalysisResult;
  right: AnalysisResult;
  deltas: {
    deposit: number;
    monthlyRent: number;
    totalInvestment: number;
    competitorCount: number;
    expectedSales: number;
    breakEvenSales: number;
    operatingProfit: number;
    paybackMonths: number | null;
    scoring: number;
  };
}
