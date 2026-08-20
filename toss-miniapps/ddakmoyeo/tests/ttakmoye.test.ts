import { describe, expect, test, vi } from 'vitest';
import { DEFAULT_PROFILE, HELP_ITEMS, SAMPLE_GROUPS } from '../src/data';
import { createGroup, isJoined, isMine, joinGroup, leaveGroup, monthParticipation, statusOf } from '../src/logic';
import { createShareLink, SHARE_DESCRIPTION, SHARE_PATH, SHARE_TITLE } from '../src/share';
import { loadSnapshot } from '../src/storage';
import type { Gathering } from '../src/types';

const mockGetTossShareLink = vi.hoisted(() => vi.fn());
vi.mock('@apps-in-toss/web-framework', () => ({ getTossShareLink: mockGetTossShareLink }));

const open: Gathering = { ...SAMPLE_GROUPS[0], participantIds: ['other'] };
const full: Gathering = { ...SAMPLE_GROUPS[0], capacity: 1, participantIds: ['other'] };

describe('딱모여 모임 흐름', () => {
  test('예시 모임을 제공합니다', () => expect(SAMPLE_GROUPS.length).toBeGreaterThanOrEqual(3));
  test('기본 프로필은 내 사용자 ID를 가집니다', () => expect(DEFAULT_PROFILE.id).toBe('me'));
  test('정원 미만 모임은 모집 중입니다', () => expect(statusOf(open)).toBe('open'));
  test('정원 도달 모임은 마감입니다', () => expect(statusOf(full)).toBe('full'));
  test('참여하지 않은 모임을 식별합니다', () => expect(isJoined(open, 'me')).toBe(false));
  test('참여한 모임을 식별합니다', () => expect(isJoined(joinGroup(open, 'me'), 'me')).toBe(true));
  test('내가 만든 모임을 식별합니다', () => expect(isMine({ ...open, creatorId: 'me' }, 'me')).toBe(true));
  test('다른 사람이 만든 모임을 구분합니다', () => expect(isMine(open, 'me')).toBe(false));
  test('참여하기는 참여자를 추가합니다', () => expect(joinGroup(open, 'me').participantIds).toContain('me'));
  test('이미 참여한 경우 중복 참여시키지 않습니다', () => expect(joinGroup(joinGroup(open, 'me'), 'me').participantIds.filter((id) => id === 'me')).toHaveLength(1));
  test('마감 모임에는 참여자를 추가하지 않습니다', () => expect(joinGroup(full, 'me').participantIds).not.toContain('me'));
  test('참여 취소는 내 참여만 제거합니다', () => expect(leaveGroup(joinGroup(open, 'me'), 'me').participantIds).toEqual(['other']));
  test('이번 달 참여 기록을 계산합니다', () => expect(monthParticipation([joinGroup(open, 'me')], 'me', '2026-08')).toBe(1));
  test('다른 달 모임은 이번 달 기록에서 제외합니다', () => expect(monthParticipation([{ ...joinGroup(open, 'me'), date: '2026-09-01 10:00' }], 'me', '2026-08')).toBe(0));
  test('미참여 모임은 참여 기록에서 제외합니다', () => expect(monthParticipation([open], 'me', '2026-08')).toBe(0));
  test('새 모임은 만든 사람이 자동 참여합니다', () => expect(createGroup({ title: '새 모임', category: '취미', date: '2026-08-30 14:00', place: '서울', capacity: 4, description: '소개' }, 'me', new Date('2026-08-21T00:00:00Z')).participantIds).toEqual(['me']));
  test('새 모임은 고유 ID를 만듭니다', () => expect(createGroup({ title: '새', category: '친목', date: '2026-08-30', place: '서울', capacity: 3, description: '소개' }, 'me', new Date('2026-08-21T00:00:00Z')).id).toBe('group-1787270400000'));
  test('새 모임은 주최자를 저장합니다', () => expect(createGroup({ title: '새', category: '친목', date: '2026-08-30', place: '서울', capacity: 3, description: '소개' }, 'me').creatorId).toBe('me'));
  test('모임 상세용 설명을 저장합니다', () => expect(createGroup({ title: '새', category: '친목', date: '2026-08-30', place: '서울', capacity: 3, description: '상세 설명' }, 'me').description).toBe('상세 설명'));
});

describe('딱모여 안전성 및 공유', () => {
  test('도움 항목을 제공합니다', () => expect(HELP_ITEMS.length).toBeGreaterThanOrEqual(3));
  test('도움 항목은 제목과 본문을 가집니다', () => expect(HELP_ITEMS.every(([title, body]) => Boolean(title && body))).toBe(true));
  test('로컬 저장소가 없어도 안전하게 기본값을 불러옵니다', () => expect(loadSnapshot().groups.length).toBeGreaterThanOrEqual(3));
  test('공유 앱 경로는 딱모여 공식 딥링크입니다', () => expect(SHARE_PATH).toBe('intoss://ddakmoyeo'));
  test('공유 제목은 앱 이름입니다', () => expect(SHARE_TITLE).toBe('딱모여'));
  test('공유 설명을 제공합니다', () => expect(SHARE_DESCRIPTION.length).toBeGreaterThan(10));
  test('공유는 Toss SDK 결과를 사용합니다', async () => { mockGetTossShareLink.mockResolvedValueOnce('https://share.example/ttak'); await expect(createShareLink()).resolves.toBe('https://share.example/ttak'); expect(mockGetTossShareLink).toHaveBeenCalledWith(SHARE_PATH); });
  test('공유 SDK 실패 시 딥링크로 안전하게 대체합니다', async () => { mockGetTossShareLink.mockRejectedValueOnce(new Error('offline')); await expect(createShareLink()).resolves.toBe(SHARE_PATH); });
  test.each([2, 3, 4, 8])('정원 %i은 그대로 저장됩니다', (capacity) => expect(createGroup({ title: '정원', category: '친목', date: '2026-08-30', place: '서울', capacity, description: '소개' }, 'me').capacity).toBe(capacity));
  test.each(['친목', '운동', '스터디', '취미', '동네'])('%s 카테고리 모임을 만들 수 있습니다', (category) => expect(createGroup({ title: '카테고리', category, date: '2026-08-30', place: '서울', capacity: 4, description: '소개' }, 'me').category).toBe(category));
});
