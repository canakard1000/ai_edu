import { APP_ENV } from '../config';
import type { CommercialDistrictContext, SourceMeta } from '../../types/startup';
import { readCache, writeCache } from '../cache';

export interface RentSnapshot {
  sourceMeta: SourceMeta;
  source: 'real' | 'cached' | 'regional' | 'mock';
  depositPerPyeong: number;
  monthlyRentPerPyeong: number;
  warning: string;
}

const CACHE_KEY_PREFIX = 'changup-talk:rent:';
const TODAY = '2026-08-19';

function meta(source: RentSnapshot['source'], reliability: number, label: string, details: string, isEstimated: boolean, basisDate = TODAY): SourceMeta {
  return { source, reliability, label, details, isEstimated, basisDate };
}

async function fetchRealRent(context: CommercialDistrictContext): Promise<RentSnapshot> {
  const apiUrl = APP_ENV.rebApiUrl || APP_ENV.proxyBaseUrl;
  if (!apiUrl) {
    throw new Error('real rent api not configured');
  }

  const response = await fetch(`${apiUrl.replace(/\/$/, '')}/commercial-rent?province=${encodeURIComponent(context.province)}&district=${encodeURIComponent(context.district)}&neighborhood=${encodeURIComponent(context.neighborhood)}`, {
    headers: APP_ENV.rebApiKey ? { Authorization: `Bearer ${APP_ENV.rebApiKey}` } : undefined
  });

  if (!response.ok) {
    throw new Error(`real rent api failed with ${response.status}`);
  }

  const payload = await response.json() as { depositPerPyeong?: number; monthlyRentPerPyeong?: number; sourceDate?: string };
  const snapshot: RentSnapshot = {
    source: 'real',
    sourceMeta: meta('real', 93, '한국부동산원 상업용부동산 임대 데이터', '실데이터 응답', false, payload.sourceDate ?? TODAY),
    depositPerPyeong: payload.depositPerPyeong ?? context.depositPerPyeong,
    monthlyRentPerPyeong: payload.monthlyRentPerPyeong ?? context.monthlyRentPerPyeong,
    warning: '실데이터 기반 임대 추정치입니다.'
  };

  writeCache(`${CACHE_KEY_PREFIX}${context.province}:${context.district}:${context.neighborhood}`, 'real', snapshot);
  return snapshot;
}

function regionalRent(context: CommercialDistrictContext): RentSnapshot {
  return {
    source: 'regional',
    sourceMeta: meta('regional', 75, '지역 임대 추정치', '부동산원 연동 전 지역 fallback', true),
    depositPerPyeong: context.depositPerPyeong,
    monthlyRentPerPyeong: context.monthlyRentPerPyeong,
    warning: '한국부동산원 데이터 미연결 상태입니다.'
  };
}

function mockRent(context: CommercialDistrictContext): RentSnapshot {
  return {
    source: 'mock',
    sourceMeta: meta('mock', 64, 'mock 임대 데이터', '기본 모형', true),
    depositPerPyeong: context.depositPerPyeong,
    monthlyRentPerPyeong: context.monthlyRentPerPyeong,
    warning: '한국부동산원 연동 전 mock 렌트 모델입니다.'
  };
}

export async function resolveRentSnapshot(context: CommercialDistrictContext): Promise<RentSnapshot> {
  const cacheKey = `${CACHE_KEY_PREFIX}${context.province}:${context.district}:${context.neighborhood}`;
  try {
    return await fetchRealRent(context);
  } catch {
    const cached = readCache<RentSnapshot>(cacheKey);
    if (cached?.data) {
      return {
        ...cached.data,
        source: 'cached',
        sourceMeta: meta('cached', 88, '캐시된 임대 데이터', '이전 실데이터를 브라우저 캐시에 보관', true)
      };
    }

    return context.rentIndex >= 0.9 ? regionalRent(context) : mockRent(context);
  }
}

export function getRentSnapshot(context: CommercialDistrictContext): RentSnapshot {
  return {
    source: 'mock',
    sourceMeta: meta('mock', 64, 'mock 임대 데이터', '동기 fallback', true),
    depositPerPyeong: context.depositPerPyeong,
    monthlyRentPerPyeong: context.monthlyRentPerPyeong,
    warning: '한국부동산원 연동 전 mock 렌트 모델입니다.'
  };
}
