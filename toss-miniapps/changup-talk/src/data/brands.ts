import type { BrandCategory } from '../types/startup';

export interface BrandCategoryGroup {
  category: BrandCategory;
  title: string;
  profileIds: string[];
  description: string;
}

export const BRAND_CATEGORY_GROUPS: BrandCategoryGroup[] = [
  { category: '카페', title: '카페', profileIds: ['cafe', 'unmanned-cafe', 'study-cafe'], description: '체류형·무인형 카페와 독립 매장을 함께 살펴봅니다.' },
  { category: '치킨', title: '치킨', profileIds: ['chicken'], description: '배달 중심 프랜차이즈 비교에 적합합니다.' },
  { category: '한식', title: '한식', profileIds: ['korean'], description: '점심/저녁 수요가 중요한 식사형 업종입니다.' },
  { category: '분식', title: '분식', profileIds: ['bunsik'], description: '소자본 및 배달 동시 검토에 유리합니다.' },
  { category: '피자', title: '피자', profileIds: ['pizza'], description: '배달 반응과 본사 비용 구조를 함께 봅니다.' },
  { category: '베이커리', title: '베이커리', profileIds: ['cafe'], description: '아직 모델 확장 준비용 카테고리입니다.' },
  { category: '배달', title: '배달', profileIds: ['shared-kitchen', 'bunsik'], description: '배달전문 운영 구조를 중심으로 봅니다.' },
  { category: '무인', title: '무인', profileIds: ['unmanned-cafe', 'unmanned-convenience', 'self-laundry', 'study-cafe'], description: '인건비 절감과 자동화 운영을 함께 검토합니다.' },
  { category: '교육', title: '교육', profileIds: ['education'], description: '강의실/학습공간 중심 창업입니다.' },
  { category: '서비스', title: '서비스', profileIds: ['beauty-hair', 'nail', 'laundry', 'pet-service', 'small-office'], description: '지역 밀착 서비스 업종을 포함합니다.' },
  { category: '기타', title: '기타', profileIds: ['cafe'], description: '기타 업종은 실데이터 연결 범위를 점진 확장합니다.' }
];

export function getBrandCategoryGroup(category: BrandCategory): BrandCategoryGroup | undefined {
  return BRAND_CATEGORY_GROUPS.find((item) => item.category === category);
}
