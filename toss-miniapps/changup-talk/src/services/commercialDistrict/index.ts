import type {
  CommercialDistrictContext,
  IndustryProfile,
  StartupInputs
} from '../../types/startup';
import { getRegionStatistics } from '../statistics';

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function hashString(input: string): number {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash);
}

function ratio(seed: string, min: number, max: number): number {
  const value = hashString(seed) % 1000;
  return min + ((max - min) * value) / 999;
}

const PROVINCE_BIAS: Record<string, number> = {
  서울특별시: 1.28,
  부산광역시: 1.08,
  대구광역시: 1.02,
  인천광역시: 1.06,
  광주광역시: 0.98,
  대전광역시: 1.0,
  울산광역시: 1.01,
  세종특별자치시: 1.04,
  경기도: 1.12,
  강원특별자치도: 0.92,
  충청북도: 0.9,
  충청남도: 0.95,
  전북특별자치도: 0.89,
  전라남도: 0.88,
  경상북도: 0.91,
  경상남도: 0.96,
  제주특별자치도: 1.14
};

export function getMockCommercialDistrictContext(
  inputs: StartupInputs,
  profile: IndustryProfile
): CommercialDistrictContext {
  const key = [inputs.province, inputs.district, inputs.neighborhood, inputs.commercialArea, profile.id].join('|');
  const provinceBias = PROVINCE_BIAS[inputs.province] ?? 1;
  const demandIndex = clamp(ratio(`${key}:demand`, 0.76, 1.34) * provinceBias, 0.7, 1.55);
  const competitionIndex = clamp(ratio(`${key}:competition`, 0.72, 1.42) * (2 - Math.min(1.15, provinceBias / 1.25)), 0.55, 1.6);
  const rentIndex = clamp(ratio(`${key}:rent`, 0.8, 1.28) * provinceBias, 0.7, 1.7);
  const footTrafficIndex = clamp(ratio(`${key}:traffic`, 0.7, 1.45) * (demandIndex / 1.1), 0.6, 1.65);
  const vacancyRate = clamp(ratio(`${key}:vacancy`, 0.04, 0.16) * (1.15 - Math.min(0.35, demandIndex / 3)), 0.03, 0.18);
  const depositPerPyeong = Math.round(profile.baseDepositPerPyeong * rentIndex);
  const monthlyRentPerPyeong = Math.round(profile.baseRentPerPyeong * rentIndex);
  const premiumScore = ratio(`${key}:premium`, 0, 1);
  const premiumAvailable = premiumScore > 0.42;
  const premiumEstimate = premiumAvailable ? Math.round((profile.baseRentPerPyeong * rentIndex * 12) * premiumScore) : null;
  const regionStats = getRegionStatistics(inputs.province, inputs.district);

  return {
    dataSource: 'mock',
    province: inputs.province,
    district: inputs.district,
    neighborhood: inputs.neighborhood,
    commercialArea: inputs.commercialArea,
    rentIndex: Number(rentIndex.toFixed(2)),
    demandIndex: Number(demandIndex.toFixed(2)),
    competitionIndex: Number(competitionIndex.toFixed(2)),
    footTrafficIndex: Number(footTrafficIndex.toFixed(2)),
    vacancyRate: Number(vacancyRate.toFixed(3)),
    depositPerPyeong,
    monthlyRentPerPyeong,
    premiumAvailable,
    premiumEstimate,
    competitorExamples: [
      `${inputs.district} 중심가 경쟁 점포 ${Math.max(3, Math.round(competitionIndex * 4))}곳`,
      `${inputs.district} 인근 유사 업종 ${Math.max(2, Math.round(competitionIndex * 3))}곳`,
      `${inputs.commercialArea} 유동객 중심 업장 ${Math.max(1, Math.round(footTrafficIndex * 2))}곳`
    ],
    reasonSummary: [
      `유동인구 지수 ${footTrafficIndex.toFixed(2)}로 수요 변동성이 ${footTrafficIndex >= 1 ? '낮지 않습니다' : '상대적으로 안정적입니다'}.`,
      `경쟁강도 지수 ${competitionIndex.toFixed(2)}는 ${competitionIndex > 1.05 ? '주의가 필요한 수준' : '상대적으로 완만한 수준'}입니다.`,
      `${regionStats.summary} 기반의 mock 데이터입니다.`
    ],
    notes: `실제 공공데이터 미연결 상태의 mock 상권 분석입니다. ${
      premiumAvailable ? '권리금 추정값을 함께 제공합니다.' : '권리금 데이터가 충분하지 않아 권리금은 0으로 처리했습니다.'
    }`,
    updatedAt: new Date().toISOString()
  };
}

export function compareCommercialDistricts(
  leftInputs: StartupInputs,
  rightInputs: StartupInputs,
  profile: IndustryProfile
): { left: CommercialDistrictContext; right: CommercialDistrictContext } {
  return {
    left: getMockCommercialDistrictContext(leftInputs, profile),
    right: getMockCommercialDistrictContext(rightInputs, profile)
  };
}
