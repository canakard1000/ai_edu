import type { CommercialDistrictContext, IndustryProfile, ScoringFactor, ScoringSummary } from '../types/startup';

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function gradeForScore(score: number): ScoringSummary['grade'] {
  if (score >= 85) return 'A';
  if (score >= 77) return 'B+';
  if (score >= 68) return 'B';
  if (score >= 60) return 'C+';
  if (score >= 50) return 'C';
  return 'D';
}

export function buildScoringSummary(profile: IndustryProfile, context: CommercialDistrictContext): ScoringSummary {
  const rentPressure = clamp(100 - context.rentIndex * 28, 0, 100);
  const demand = clamp(context.demandIndex * 74, 0, 100);
  const competition = clamp(100 - context.competitionIndex * 32, 0, 100);
  const fit = clamp(profile.fitStrength + (profile.requiredStaff === 0 ? 4 : 0), 0, 100);
  const risk = clamp(100 - profile.riskLevel, 0, 100);

  const factors: ScoringFactor[] = [
    { label: '수요 잠재력', score: demand, weight: 0.25, explanation: '유동인구와 지역 수요를 반영한 값입니다.' },
    { label: '경쟁강도', score: competition, weight: 0.2, explanation: '점포 수와 유사 업종 밀도를 반영했습니다.' },
    { label: '임대료 부담', score: rentPressure, weight: 0.2, explanation: '예상 월세와 투자비 대비 부담을 반영했습니다.' },
    { label: '업종 적합성', score: fit, weight: 0.2, explanation: '해당 업종의 일반적인 상권 적합도를 반영했습니다.' },
    { label: '운영 위험도', score: risk, weight: 0.15, explanation: '인력, 자동화, 회전율, 복잡도를 반영했습니다.' }
  ];

  const score = factors.reduce((sum, factor) => sum + factor.score * factor.weight, 0);
  const warnings: string[] = [];

  if (context.competitionIndex > 1.15) {
    warnings.push('경쟁강도가 높아 차별화 포인트가 필요합니다.');
  }

  if (context.rentIndex > 1.25) {
    warnings.push('임대료 부담이 높은 편이라 회전율 관리가 중요합니다.');
  }

  if (profile.operationalComplexity > 55) {
    warnings.push('초기 운영 숙련도가 성패에 큰 영향을 줍니다.');
  }

  return {
    score: Number(score.toFixed(1)),
    grade: gradeForScore(score),
    factors,
    warnings
  };
}
