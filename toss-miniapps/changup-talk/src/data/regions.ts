export interface RegionNode {
  district: string;
  neighborhoods: string[];
  commercialAreas: string[];
}

export interface ProvinceNode {
  province: string;
  districts: RegionNode[];
}

export const REGION_TREE: ProvinceNode[] = [
  {
    province: '서울특별시',
    districts: [
      { district: '강남구', neighborhoods: ['역삼동', '삼성동', '논현동'], commercialAreas: ['강남역 상권', '테헤란로', '압구정 로데오'] },
      { district: '마포구', neighborhoods: ['홍대입구', '합정동', '상수동'], commercialAreas: ['홍대 상권', '합정 상권'] },
      { district: '송파구', neighborhoods: ['잠실동', '문정동', '방이동'], commercialAreas: ['잠실 상권', '문정 로데오'] }
    ]
  },
  {
    province: '부산광역시',
    districts: [
      { district: '해운대구', neighborhoods: ['우동', '좌동', '중동'], commercialAreas: ['해운대 해변 상권', '센텀시티'] },
      { district: '수영구', neighborhoods: ['광안동', '민락동'], commercialAreas: ['광안리 상권'] }
    ]
  },
  {
    province: '대구광역시',
    districts: [{ district: '수성구', neighborhoods: ['범어동', '황금동'], commercialAreas: ['범어 상권', '수성못 상권'] }]
  },
  {
    province: '인천광역시',
    districts: [
      { district: '남동구', neighborhoods: ['구월동', '논현동'], commercialAreas: ['구월 로데오'] },
      { district: '연수구', neighborhoods: ['송도동', '청학동'], commercialAreas: ['송도 센트럴파크'] }
    ]
  },
  {
    province: '광주광역시',
    districts: [{ district: '서구', neighborhoods: ['치평동', '상무동'], commercialAreas: ['상무지구'] }]
  },
  {
    province: '대전광역시',
    districts: [{ district: '서구', neighborhoods: ['둔산동', '탄방동'], commercialAreas: ['둔산 상권'] }]
  },
  {
    province: '울산광역시',
    districts: [{ district: '남구', neighborhoods: ['삼산동', '달동'], commercialAreas: ['삼산동 상권'] }]
  },
  {
    province: '세종특별자치시',
    districts: [{ district: '나성동', neighborhoods: ['나성동', '어진동'], commercialAreas: ['나성 상권'] }]
  },
  {
    province: '경기도',
    districts: [
      { district: '수원시', neighborhoods: ['영통동', '인계동', '권선동'], commercialAreas: ['인계동 로데오'] },
      { district: '성남시', neighborhoods: ['분당동', '서현동'], commercialAreas: ['서현 상권'] },
      { district: '용인시', neighborhoods: ['수지구', '기흥구'], commercialAreas: ['기흥 상권'] },
      { district: '고양시', neighborhoods: ['일산동', '마두동'], commercialAreas: ['일산 라페스타'] }
    ]
  },
  {
    province: '강원특별자치도',
    districts: [{ district: '춘천시', neighborhoods: ['퇴계동', '후평동'], commercialAreas: ['춘천 명동'] }]
  },
  {
    province: '충청북도',
    districts: [{ district: '청주시', neighborhoods: ['복대동', '율량동'], commercialAreas: ['복대동 상권'] }]
  },
  {
    province: '충청남도',
    districts: [
      { district: '천안시', neighborhoods: ['불당동', '두정동', '성정동'], commercialAreas: ['불당 상권', '두정동 상권', '천안역 상권'] },
      { district: '아산시', neighborhoods: ['배방읍', '탕정면'], commercialAreas: ['탕정 상권'] }
    ]
  },
  {
    province: '전북특별자치도',
    districts: [{ district: '전주시', neighborhoods: ['효자동', '서신동'], commercialAreas: ['전주 객사'] }]
  },
  {
    province: '전라남도',
    districts: [{ district: '순천시', neighborhoods: ['조례동', '연향동'], commercialAreas: ['순천역 상권'] }]
  },
  {
    province: '경상북도',
    districts: [{ district: '포항시', neighborhoods: ['죽도동', '두호동'], commercialAreas: ['영일대 상권'] }]
  },
  {
    province: '경상남도',
    districts: [{ district: '창원시', neighborhoods: ['상남동', '중앙동'], commercialAreas: ['상남동 상권'] }]
  },
  {
    province: '제주특별자치도',
    districts: [{ district: '제주시', neighborhoods: ['노형동', '연동'], commercialAreas: ['연동 상권'] }]
  }
];

export const REGION_PROVINCES = REGION_TREE.map((node) => node.province) as readonly string[];

const REGION_HINTS: Record<string, string[]> = Object.fromEntries(
  REGION_TREE.map((province) => [
    province.province,
    province.districts.map((district) => district.district)
  ])
);

export function getRegionHints(province: string): string[] {
  return REGION_HINTS[province] ?? [];
}

export function getRegionNode(province: string, district: string): RegionNode | null {
  return REGION_TREE.find((item) => item.province === province)?.districts.find((item) => item.district === district) ?? null;
}

export function getNeighborhoodHints(province: string, district: string): string[] {
  return getRegionNode(province, district)?.neighborhoods ?? [];
}

export function getCommercialAreaHints(province: string, district: string): string[] {
  return getRegionNode(province, district)?.commercialAreas ?? [];
}

export function isKnownProvince(value: string): boolean {
  return REGION_TREE.some((item) => item.province === value);
}
