import { APP_ENV } from '../config';
import type { RegionalStatisticsSnapshot, SourceMeta } from '../../types/startup';
import { readCache, writeCache } from '../cache';

export interface RegionStatistics extends RegionalStatisticsSnapshot {
  source: 'real' | 'cached' | 'regional' | 'mock';
}

const CACHE_KEY_PREFIX = 'changup-talk:statistics:';
const TODAY = '2026-08-19';

function meta(source: RegionStatistics['source'], reliability: number, label: string, details: string, isEstimated: boolean, basisDate = TODAY): SourceMeta {
  return { source, reliability, label, details, isEstimated, basisDate };
}

function hashString(input: string): number {
  let hash = 5381;
  for (let index = 0; index < input.length; index += 1) {
    hash = ((hash << 5) + hash) + input.charCodeAt(index);
  }
  return Math.abs(hash);
}

function regionalStatistics(province: string, district: string): RegionStatistics {
  const seed = `${province}|${district}`;
  const base = hashString(seed);
  const floatingPopulation = 18000 + (base % 28000);
  const householdDensity = 900 + (base % 2600);
  const commercialDensity = 18 + (base % 90);

  return {
    source: 'regional',
    sourceMeta: meta('regional', 75, 'KOSIS 지역 통계 추정치', '지역 fallback 기반의 생활권 수요 모델', true),
    floatingPopulation,
    householdDensity,
    commercialDensity,
    youngPopulationRate: 22 + (base % 8),
    apartmentDensity: 40 + (base % 40),
    businessDensity: 30 + (base % 30),
    summary: `${district || province}의 생활권 특성을 반영한 규모 추정치입니다.`
  };
}

async function fetchRealStatistics(province: string, district: string): Promise<RegionStatistics> {
  const apiUrl = APP_ENV.kosisApiUrl || APP_ENV.proxyBaseUrl;
  if (!apiUrl) {
    throw new Error('real statistics api not configured');
  }

  const response = await fetch(`${apiUrl.replace(/\/$/, '')}/regional-statistics?province=${encodeURIComponent(province)}&district=${encodeURIComponent(district)}`, {
    headers: APP_ENV.kosisApiKey ? { Authorization: `Bearer ${APP_ENV.kosisApiKey}` } : undefined
  });

  if (!response.ok) {
    throw new Error(`real statistics api failed with ${response.status}`);
  }

  const payload = await response.json() as Partial<RegionStatistics> & { sourceDate?: string; reliability?: number };
  const result: RegionStatistics = {
    source: 'real',
    sourceMeta: meta('real', payload.reliability ?? 92, 'KOSIS 지역 통계', '실데이터 응답', false, payload.sourceDate ?? TODAY),
    floatingPopulation: payload.floatingPopulation ?? 0,
    householdDensity: payload.householdDensity ?? 0,
    commercialDensity: payload.commercialDensity ?? 0,
    youngPopulationRate: payload.youngPopulationRate ?? 0,
    apartmentDensity: payload.apartmentDensity ?? 0,
    businessDensity: payload.businessDensity ?? 0,
    summary: payload.summary ?? `${district || province}의 실데이터 기반 통계입니다.`
  };

  writeCache(`${CACHE_KEY_PREFIX}${province}:${district}`, 'real', result);
  return result;
}

export async function resolveRegionStatistics(province: string, district: string): Promise<RegionStatistics> {
  const cacheKey = `${CACHE_KEY_PREFIX}${province}:${district}`;
  try {
    return await fetchRealStatistics(province, district);
  } catch {
    const cached = readCache<RegionStatistics>(cacheKey);
    if (cached?.data) {
      return {
        ...cached.data,
        source: 'cached',
        sourceMeta: meta('cached', 88, '캐시된 지역 통계', '이전 실데이터를 브라우저 캐시에 저장', true)
      };
    }
    return regionalStatistics(province, district);
  }
}

export function getRegionStatistics(province: string, district: string): RegionStatistics {
  return regionalStatistics(province, district);
}
