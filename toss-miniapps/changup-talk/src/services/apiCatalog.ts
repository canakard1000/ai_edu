export interface PublicApiSource {
  name: string;
  applicationUrl: string;
  endpoint: string;
  access: 'free';
  approval: 'automatic' | 'review';
  envVars: string[];
  notes: string;
}

export const PUBLIC_API_SOURCES: PublicApiSource[] = [
  {
    name: '소상공인시장진흥공단 상가(상권)정보',
    applicationUrl: 'https://www.data.go.kr/data/15012005/openapi.do',
    endpoint: 'http://apis.data.go.kr/B553077/api/open/sdsc2',
    access: 'free',
    approval: 'automatic',
    envVars: ['VITE_SBDC_API_URL', 'VITE_SBDC_API_KEY', 'VITE_API_PROXY_BASE_URL'],
    notes: '상권 경쟁밀도, 업종별 점포 수, 위치 기반 경쟁 분석에 사용'
  },
  {
    name: '한국부동산원 상업용부동산 임대 데이터',
    applicationUrl: 'https://www.reb.or.kr/r-one/portal/openapi/openApiIntroPage.do',
    endpoint: 'https://www.reb.or.kr/r-one/openapi/SttsApiTblData.do',
    access: 'free',
    approval: 'automatic',
    envVars: ['VITE_REB_API_URL', 'VITE_REB_API_KEY', 'VITE_API_PROXY_BASE_URL'],
    notes: 'R-ONE Open API를 통해 임대료, 공실률, 상업용부동산 통계 조회'
  },
  {
    name: 'KOSIS 지역 통계',
    applicationUrl: 'https://kosis.kr/serviceInfo/openAPIGuide.do',
    endpoint: 'https://kosis.kr/openapi/statisticsSearch.do?method=getList',
    access: 'free',
    approval: 'automatic',
    envVars: ['VITE_KOSIS_API_URL', 'VITE_KOSIS_API_KEY', 'VITE_API_PROXY_BASE_URL'],
    notes: '인구, 가구, 연령구조, 사업체, 지역 수요 통계를 표준화해 사용'
  },
  {
    name: '공정거래위원회 가맹사업정보',
    applicationUrl: 'https://www.data.go.kr/data/15125478/openapi.do',
    endpoint: '',
    access: 'free',
    approval: 'review',
    envVars: ['VITE_FTC_API_URL', 'VITE_FTC_API_KEY', 'VITE_API_PROXY_BASE_URL'],
    notes: '가맹비, 교육비, 예치금, 기타비용, 브랜드 분포, 매출 참고 데이터에 사용. 세부 호출 URL은 명세서 확인 필요'
  }
];
