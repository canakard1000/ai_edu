import type { DataSource, SourceMeta } from '../types/startup';
import { writeCache } from './cache';

export interface ResolveOptions<T> {
  cacheKey: string;
  sourceLabel: string;
  basisDate: string;
  real: () => Promise<T>;
  cachedFallback: () => Promise<T | null> | T | null;
  regionalFallback: () => Promise<T | null> | T | null;
  mockFallback: () => Promise<T>;
  reliabilityBySource: Record<DataSource, number>;
  detailBySource: Record<DataSource, string>;
}

function buildMeta(
  source: DataSource,
  label: string,
  basisDate: string,
  reliability: number,
  details: string,
  isEstimated: boolean
): SourceMeta {
  return {
    source,
    label,
    basisDate,
    reliability,
    details,
    isEstimated
  };
}

export async function resolveWithFallback<T>(options: ResolveOptions<T>): Promise<{ data: T; sourceMeta: SourceMeta }> {
  try {
    const data = await options.real();
    writeCache(options.cacheKey, 'real', data);
    return {
      data,
      sourceMeta: buildMeta('real', options.sourceLabel, options.basisDate, options.reliabilityBySource.real, options.detailBySource.real, false)
    };
  } catch {
    const cached = await options.cachedFallback();
    if (cached) {
      return {
        data: cached,
        sourceMeta: buildMeta('cached', options.sourceLabel, options.basisDate, options.reliabilityBySource.cached, options.detailBySource.cached, true)
      };
    }

    const regional = await options.regionalFallback();
    if (regional) {
      writeCache(options.cacheKey, 'regional', regional);
      return {
        data: regional,
        sourceMeta: buildMeta('regional', options.sourceLabel, options.basisDate, options.reliabilityBySource.regional, options.detailBySource.regional, true)
      };
    }

    const mock = await options.mockFallback();
    return {
      data: mock,
      sourceMeta: buildMeta('mock', options.sourceLabel, options.basisDate, options.reliabilityBySource.mock, options.detailBySource.mock, true)
    };
  }
}
