import type { Gathering, Profile } from './types';

export const DEFAULT_PROFILE: Profile = { id: 'me', nickname: '나', notifications: true };
export const SAMPLE_GROUPS: Gathering[] = [
  { id: 'coffee', title: '퇴근 후 동네 커피 한 잔', category: '친목', date: '2026-08-24 19:30', place: '성수역 2번 출구', capacity: 6, participantIds: ['sample-1', 'sample-2'], creatorId: 'sample-1', description: '가볍게 이야기하며 동네 정보를 나눠요.', createdAt: '2026-08-20T09:00:00.000Z' },
  { id: 'walk', title: '토요일 한강 산책', category: '운동', date: '2026-08-29 10:00', place: '여의나루역', capacity: 8, participantIds: ['sample-3'], creatorId: 'sample-3', description: '천천히 걷는 초보 환영 모임입니다.', createdAt: '2026-08-20T10:00:00.000Z' },
  { id: 'study', title: '독서 30분 같이 하기', category: '스터디', date: '2026-08-27 20:00', place: '온라인', capacity: 4, participantIds: ['sample-4', 'sample-5', 'sample-6'], creatorId: 'sample-4', description: '각자 읽고 마지막 10분만 나눕니다.', createdAt: '2026-08-20T11:00:00.000Z' }
];

export const HELP_ITEMS = [
  ['안전한 모임 참여', '처음 만나는 모임은 공개된 장소에서 진행하고, 개인 연락처 공유는 신중하게 결정하세요.'],
  ['신고 및 차단', '불편한 모임이나 사용자는 앱 내 신고 기능이 준비되기 전까지 운영 문의를 이용해 주세요.'],
  ['개인정보 안내', '프로필에는 모임에 필요한 최소 정보만 입력하세요.']
];
