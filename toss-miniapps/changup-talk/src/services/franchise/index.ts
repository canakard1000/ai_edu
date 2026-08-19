import { APP_ENV } from '../config';
import type { IndustryProfile, SourceMeta } from '../../types/startup';
import { readCache, writeCache } from '../cache';

export interface FranchiseSnapshot {
  sourceMeta: SourceMeta;
  source: 'real' | 'cached' | 'regional' | 'mock';
  available: boolean;
  fee: number;
  educationFee: number;
  notice: string;
}

const CACHE_KEY_PREFIX = 'changup-talk:franchise:';
const TODAY = '2026-08-19';

function meta(source: FranchiseSnapshot['source'], reliability: number, label: string, details: string, isEstimated: boolean, basisDate = TODAY): SourceMeta {
  return { source, reliability, label, details, isEstimated, basisDate };
}

function fallbackFranchise(profile: IndustryProfile): FranchiseSnapshot {
  return {
    source: 'regional',
    sourceMeta: meta('regional', 73, '가맹사업 구조 추정치', '가맹사업정보 미연결 상태의 fallback', true),
    available: profile.franchiseFee > 0,
    fee: profile.franchiseFee,
    educationFee: profile.educationFee,
    notice: '가맹사업 데이터 미연결 상태입니다.'
  };
}

function hasValidFranchisePayload(payload: Partial<FranchiseSnapshot>): boolean {
  return [
    payload.available,
    payload.fee,
    payload.educationFee
  ].some((value) => typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value)));
}

async function fetchRealFranchise(profile: IndustryProfile): Promise<FranchiseSnapshot> {
  const apiUrl = APP_ENV.ftcApiUrl || APP_ENV.proxyBaseUrl;
  if (!apiUrl) {
    throw new Error('real franchise api not configured');
  }

  const response = await fetch(`${apiUrl.replace(/\/$/, '')}/franchise-info?industryId=${encodeURIComponent(profile.id)}&industryName=${encodeURIComponent(profile.name)}`, {
    headers: APP_ENV.ftcApiKey ? { Authorization: `Bearer ${APP_ENV.ftcApiKey}` } : undefined
  });

  if (!response.ok) {
    throw new Error(`real franchise api failed with ${response.status}`);
  }

  const payload = await response.json() as Partial<FranchiseSnapshot> & { sourceDate?: string; reliability?: number };
  if (!hasValidFranchisePayload(payload)) {
    throw new Error('real franchise api returned an invalid payload');
  }
  const snapshot: FranchiseSnapshot = {
    source: 'real',
    sourceMeta: meta('real', payload.reliability ?? 92, '공정거래위원회 가맹사업정보', '실데이터 응답', false, payload.sourceDate ?? TODAY),
    available: payload.available ?? profile.franchiseFee > 0,
    fee: payload.fee ?? profile.franchiseFee,
    educationFee: payload.educationFee ?? profile.educationFee,
    notice: payload.notice ?? '실데이터 기반 가맹 정보입니다.'
  };

  writeCache(`${CACHE_KEY_PREFIX}${profile.id}`, 'real', snapshot);
  return snapshot;
}

export async function resolveFranchiseSnapshot(profile: IndustryProfile): Promise<FranchiseSnapshot> {
  const cacheKey = `${CACHE_KEY_PREFIX}${profile.id}`;
  try {
    return await fetchRealFranchise(profile);
  } catch {
    const cached = readCache<FranchiseSnapshot>(cacheKey);
    if (cached?.data) {
      return {
        ...cached.data,
        source: 'cached',
        sourceMeta: meta('cached', 86, '캐시된 가맹 정보', '이전 실데이터를 브라우저 캐시에 저장', true)
      };
    }

    return fallbackFranchise(profile);
  }
}

export function getFranchiseSnapshot(profile: IndustryProfile): FranchiseSnapshot {
  return {
    source: 'mock',
    sourceMeta: meta('mock', 64, 'mock 가맹 비용', '동기 fallback', true),
    available: profile.franchiseFee > 0,
    fee: profile.franchiseFee,
    educationFee: profile.educationFee,
    notice: '가맹사업 데이터 연동 전 mock 프랜차이즈 비용입니다.'
  };
}
