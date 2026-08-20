export type Screen = 'home' | 'groups' | 'detail' | 'create' | 'profile' | 'help';
export type GroupStatus = 'open' | 'full' | 'closed';

export interface Gathering {
  id: string;
  title: string;
  category: string;
  date: string;
  place: string;
  capacity: number;
  participantIds: string[];
  creatorId: string;
  description: string;
  createdAt: string;
}

export interface Profile { id: string; nickname: string; notifications: boolean; }
export interface Snapshot { groups: Gathering[]; profile: Profile; }
