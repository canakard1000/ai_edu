import { APP_ENV } from '../config';
import { getCommercialAreaHints, getNeighborhoodHints, getRegionNode } from '../../data/regions';
import type {
  CommercialDistrictContext,
  IndustryProfile,
  RegionalStatisticsSnapshot,
  SourceMeta,
  StartupInputs
} from '../../types/startup';
import { readCache, writeCache } from '../cache';
import { resolveWithFallback } from '../fallback';
import { getRegionStatistics } from '../statistics';

type DistrictApiPayload = {
  depositPerPyeong?: number;
  monthlyRentPerPyeong?: number;
  competitionIndex?: number;
  demandIndex?: number;
  footTrafficIndex?: number;
  vacancyRate?: number;
  premiumEstimate?: number | null;
  competitorExamples?: string[];
  updatedAt?: string;
};

const CACHE_KEY_PREFIX = 'changup-talk:district:';
const TODAY = '2026-08-19';

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

function sourceMeta(source: SourceMeta['source'], label: string, details: string, isEstimated: boolean, reliability: number, basisDate = TODAY): SourceMeta {
  return {
    source,
    label,
    details,
    isEstimated,
    reliability,
    basisDate
  };
}

function buildRegionalStatistics(inputs: StartupInputs, _profile: IndustryProfile): RegionalStatisticsSnapshot {
  const regionStats = getRegionStatistics(inputs.province, inputs.district);
  return {
    sourceMeta: sourceMeta('regional', 'KOSIS 지역 통계 추정치', regionStats.summary, true, 74),
    floatingPopulation: regionStats.floatingPopulation,
    householdDensity: regionStats.householdDensity,
    commercialDensity: regionStats.commercialDensity,
    youngPopulationRate: clamp(18 + ratio(`${inputs.province}|${inputs.district}|young`, 0, 12), 14, 33),
    apartmentDensity: clamp(40 + ratio(`${inputs.province}|${inputs.district}|apartment`, 0, 60), 22, 92),
    businessDensity: clamp(30 + ratio(`${inputs.province}|${inputs.district}|business`, 0, 50), 18, 86),
    summary: `${inputs.district}의 생활권 수요 추정치입니다.`
  };
}

function fallbackDistrictContext(inputs: StartupInputs, profile: IndustryProfile): CommercialDistrictContext {
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
  const regionStatistics = buildRegionalStatistics(inputs, profile);
  const node = getRegionNode(inputs.province, inputs.district);
  const neighborhoodHints = getNeighborhoodHints(inputs.province, inputs.district);
  const areaHints = getCommercialAreaHints(inputs.province, inputs.district);

  return {
    sourceMeta: sourceMeta('regional', '지역 상권 추정 모델', `${inputs.province} ${inputs.district} ${inputs.neighborhood}`, true, 69),
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
      node ? `${node.district}의 확인된 세부 지역 데이터를 보조로 사용했습니다.` : '세부 읍면동 데이터는 전국 확장 구조의 fallback 데이터를 사용했습니다.',
      neighborhoodHints.length > 0 ? `주요 읍/면/동 후보: ${neighborhoodHints.slice(0, 3).join(', ')}` : '읍면동 후보는 지역 모델에서 자동 보완했습니다.',
      areaHints.length > 0 ? `상권 후보: ${areaHints.slice(0, 3).join(', ')}` : '상권 후보는 상권 일반값으로 보완했습니다.',
      `${regionStatistics.summary} 기반의 regional fallback입니다.`
    ],
    notes: `실제 공공데이터 미연결 상태의 regional fallback입니다. ${
      premiumAvailable ? '권리금 추정값을 함께 제공합니다.' : '권리금 데이터가 충분하지 않아 권리금은 0으로 처리했습니다.'
    }`,
    updatedAt: new Date().toISOString(),
    regionStatistics
  };
}

async function fetchRealDistrict(inputs: StartupInputs, profile: IndustryProfile): Promise<CommercialDistrictContext> {
  const apiUrl = APP_ENV.sbdcApiUrl || APP_ENV.proxyBaseUrl;
  if (!apiUrl) {
    throw new Error('real district api not configured');
  }

  const cacheKey = `${CACHE_KEY_PREFIX}${inputs.province}:${inputs.district}:${inputs.neighborhood}:${profile.id}`;
  const response = await fetch(`${apiUrl.replace(/\/$/, '')}/commercial-district?province=${encodeURIComponent(inputs.province)}&district=${encodeURIComponent(inputs.district)}&neighborhood=${encodeURIComponent(inputs.neighborhood)}&industryId=${encodeURIComponent(profile.id)}`, {
    headers: APP_ENV.sbdcApiKey ? { Authorization: `Bearer ${APP_ENV.sbdcApiKey}` } : undefined
  });

  if (!response.ok) {
    throw new Error(`real district api failed with ${response.status}`);
  }

  const payload = (await response.json()) as DistrictApiPayload & { sourceDate?: string; reliability?: number; summary?: string };
  const regional = fallbackDistrictContext(inputs, profile);
  const context: CommercialDistrictContext = {
    ...regional,
    sourceMeta: sourceMeta('real', '소상공인시장진흥공단 상가(상권)정보', '실데이터 응답', false, payload.reliability ?? 91, payload.sourceDate ?? TODAY),
    depositPerPyeong: payload.depositPerPyeong ?? regional.depositPerPyeong,
    monthlyRentPerPyeong: payload.monthlyRentPerPyeong ?? regional.monthlyRentPerPyeong,
    competitionIndex: payload.competitionIndex ?? regional.competitionIndex,
    demandIndex: payload.demandIndex ?? regional.demandIndex,
    footTrafficIndex: payload.footTrafficIndex ?? regional.footTrafficIndex,
    vacancyRate: payload.vacancyRate ?? regional.vacancyRate,
    premiumEstimate: payload.premiumEstimate ?? regional.premiumEstimate,
    competitorExamples: payload.competitorExamples?.length ? payload.competitorExamples : regional.competitorExamples,
    notes: payload.summary ?? regional.notes,
    updatedAt: payload.sourceDate ?? regional.updatedAt
  };

  writeCache(cacheKey, 'real', context);
  return context;
}

async function getCachedDistrict(inputs: StartupInputs, profile: IndustryProfile): Promise<CommercialDistrictContext | null> {
  const cacheKey = `${CACHE_KEY_PREFIX}${inputs.province}:${inputs.district}:${inputs.neighborhood}:${profile.id}`;
  const cached = readCache<CommercialDistrictContext>(cacheKey);
  return cached?.data ?? null;
}

export async function resolveCommercialDistrictContext(
  inputs: StartupInputs,
  profile: IndustryProfile
): Promise<CommercialDistrictContext> {
  const cacheKey = `${CACHE_KEY_PREFIX}${inputs.province}:${inputs.district}:${inputs.neighborhood}:${profile.id}`;
  const result = await resolveWithFallback<CommercialDistrictContext>({
    cacheKey,
    sourceLabel: '소상공인시장진흥공단 상가(상권)정보',
    basisDate: TODAY,
    real: () => fetchRealDistrict(inputs, profile),
    cachedFallback: () => getCachedDistrict(inputs, profile),
    regionalFallback: () => Promise.resolve(fallbackDistrictContext(inputs, profile)),
    mockFallback: () => Promise.resolve(fallbackDistrictContext(inputs, profile)),
    reliabilityBySource: {
      real: 94,
      cached: 87,
      regional: 74,
      mock: 62
    },
    detailBySource: {
      real: '실데이터 상권 정보 응답',
      cached: '이전 실데이터를 브라우저 캐시에 저장한 값',
      regional: '전국 지역 구조를 사용한 지역 fallback',
      mock: '기본 mock 상권 모델'
    }
  });

  return result.data;
}

export async function resolveCommercialDistrictContextSync(
  inputs: StartupInputs,
  profile: IndustryProfile
): Promise<CommercialDistrictContext> {
  return resolveCommercialDistrictContext(inputs, profile);
}
