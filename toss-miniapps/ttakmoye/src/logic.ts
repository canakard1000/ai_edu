import type { Gathering } from './types';

export function statusOf(group: Gathering): 'open' | 'full' {
  return group.participantIds.length >= group.capacity ? 'full' : 'open';
}
export function isJoined(group: Gathering, userId: string): boolean { return group.participantIds.includes(userId); }
export function isMine(group: Gathering, userId: string): boolean { return group.creatorId === userId; }
export function joinGroup(group: Gathering, userId: string): Gathering {
  if (isJoined(group, userId) || statusOf(group) === 'full') return group;
  return { ...group, participantIds: [...group.participantIds, userId] };
}
export function leaveGroup(group: Gathering, userId: string): Gathering { return { ...group, participantIds: group.participantIds.filter((id) => id !== userId) }; }
export function monthParticipation(groups: Gathering[], userId: string, month: string): number { return groups.filter((group) => group.date.startsWith(month) && isJoined(group, userId)).length; }
export function createGroup(input: Omit<Gathering, 'id' | 'participantIds' | 'creatorId' | 'createdAt'>, userId: string, now = new Date()): Gathering {
  return { ...input, id: `group-${now.getTime()}`, participantIds: [userId], creatorId: userId, createdAt: now.toISOString() };
}
