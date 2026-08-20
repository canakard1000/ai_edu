import type { ChecklistItem, HelpLink, LoungePost, AppSettings } from './types';

export const APP_NAME = '첫알바톡';

export const DEFAULT_SETTINGS: AppSettings = {
  profileName: '처음 알바생',
  hourlyWage: 10030,
  payday: 10,
  breakMinutes: 30,
  preferredShiftStart: '18:00',
  preferredShiftEnd: '23:00',
  managerContact: '',
  notifications: {
    shiftReminder: true,
    paydayReminder: true,
    checklistReminder: true
  }
};

export const FIRST_DAY_CHECKLIST: Omit<ChecklistItem, 'done'>[] = [
  {
    id: 'contract',
    title: '근로계약서 확인',
    detail: '시급, 근무시간, 휴게시간, 급여일, 담당자 연락처를 먼저 확인하세요.'
  },
  {
    id: 'id',
    title: '신분증/계좌 준비',
    detail: '급여 이체에 필요한 계좌 정보와 신분증을 챙겨두세요.'
  },
  {
    id: 'clothes',
    title: '복장/준비물 확인',
    detail: '매장 규정이 있으면 미리 확인하고 필요한 준비물을 챙기세요.'
  },
  {
    id: 'commute',
    title: '출근 경로 점검',
    detail: '첫 출근 전까지 이동 시간과 도착 경로를 미리 확인해 두세요.'
  },
  {
    id: 'manager',
    title: '담당자 연락처 저장',
    detail: '지각이나 문의 상황에 대비해 담당자 연락처를 저장해 두세요.'
  },
  {
    id: 'rights',
    title: '내 권리 빠르게 보기',
    detail: '임금 미지급, 휴게시간, 주휴수당, 야간/연장근로 안내를 참고하세요.'
  }
];

export const OFFICIAL_HELP_LINKS: HelpLink[] = [
  {
    id: 'moel',
    title: '고용노동부 노동포털',
    summary: '임금체불, 진정, 민원 안내를 확인할 수 있습니다.',
    url: 'https://labor.moel.go.kr/'
  },
  {
    id: 'wage-arrears',
    title: '체불임금 해결 방법',
    summary: '임금이 늦게 지급되었을 때의 공식 안내입니다.',
    url: 'https://labor.moel.go.kr/minwonSysInfo/wagesolway.do'
  },
  {
    id: 'minimum-wage',
    title: '최저임금위원회',
    summary: '최저임금 관련 공식 정보를 확인할 수 있습니다.',
    url: 'https://www.minimumwage.go.kr/'
  },
  {
    id: 'comwel',
    title: '근로복지공단',
    summary: '근로복지와 관련한 공식 서비스를 확인할 수 있습니다.',
    url: 'https://www.comwel.or.kr/'
  }
];

export const LOUNGE_POSTS: LoungePost[] = [
  {
    id: 'sample-1',
    author: '샘플 게시글',
    title: '첫 출근 전에 꼭 확인한 것',
    body: '근로계약서, 급여일, 휴게시간을 먼저 확인하니 마음이 훨씬 편했어요.',
    createdAt: '2026-08-12T09:20:00.000Z',
    likes: 18,
    comments: 4,
    isSample: true
  },
  {
    id: 'sample-2',
    author: '샘플 게시글',
    title: '시급 입력만 해도 계산이 쉬워졌어요',
    body: '내 시급과 휴게시간을 넣으니 오늘 급여와 월 예상 급여를 바로 볼 수 있었어요.',
    createdAt: '2026-08-13T13:40:00.000Z',
    likes: 22,
    comments: 6,
    isSample: true
  },
  {
    id: 'sample-3',
    author: '샘플 게시글',
    title: '임금이 늦어질 때 도움받는 법',
    body: '노동포털의 체불임금 안내를 먼저 확인하고, 증빙 자료를 정리해 두는 게 도움이 됐어요.',
    createdAt: '2026-08-14T18:05:00.000Z',
    likes: 15,
    comments: 3,
    isSample: true
  }
];
