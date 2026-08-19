import type { IndustryProfile } from '../../types/startup';

export interface FranchiseSnapshot {
  source: 'mock';
  available: boolean;
  fee: number;
  educationFee: number;
  notice: string;
}

export function getFranchiseSnapshot(profile: IndustryProfile): FranchiseSnapshot {
  return {
    source: 'mock',
    available: profile.franchiseFee > 0,
    fee: profile.franchiseFee,
    educationFee: profile.educationFee,
    notice: '가맹사업 데이터 연동 전 mock 프랜차이즈 비용입니다.'
  };
}
