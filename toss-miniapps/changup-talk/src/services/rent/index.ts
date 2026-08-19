import type { CommercialDistrictContext } from '../../types/startup';

export interface RentSnapshot {
  source: 'mock';
  depositPerPyeong: number;
  monthlyRentPerPyeong: number;
  warning: string;
}

export function getRentSnapshot(context: CommercialDistrictContext): RentSnapshot {
  return {
    source: 'mock',
    depositPerPyeong: context.depositPerPyeong,
    monthlyRentPerPyeong: context.monthlyRentPerPyeong,
    warning: '한국부동산원 연동 전 mock 렌트 모델입니다.'
  };
}
