function hashString(input: string): number {
  let hash = 5381;
  for (let index = 0; index < input.length; index += 1) {
    hash = ((hash << 5) + hash) + input.charCodeAt(index);
  }
  return Math.abs(hash);
}

export interface RegionStatistics {
  source: 'mock';
  floatingPopulation: number;
  householdDensity: number;
  commercialDensity: number;
  summary: string;
}

export function getRegionStatistics(province: string, district: string): RegionStatistics {
  const seed = `${province}|${district}`;
  const base = hashString(seed);
  const floatingPopulation = 18000 + (base % 28000);
  const householdDensity = 900 + (base % 2600);
  const commercialDensity = 18 + (base % 90);

  return {
    source: 'mock',
    floatingPopulation,
    householdDensity,
    commercialDensity,
    summary: `${district || province}의 생활권 특성을 반영한 규모 추정치입니다.`
  };
}
