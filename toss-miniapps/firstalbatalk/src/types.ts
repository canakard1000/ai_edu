export type Screen = 'home' | 'records' | 'pay' | 'checklist' | 'help' | 'lounge' | 'profile';

export interface WorkEntry {
  id: string;
  dateKey: string;
  startedAt: string;
  endedAt?: string;
  breakMinutes: number;
  hourlyWage: number;
  memo: string;
  status: 'active' | 'done';
}

export interface NotificationSettings {
  shiftReminder: boolean;
  paydayReminder: boolean;
  checklistReminder: boolean;
}

export interface AppSettings {
  profileName: string;
  hourlyWage: number;
  payday: number;
  breakMinutes: number;
  preferredShiftStart: string;
  preferredShiftEnd: string;
  managerContact: string;
  notifications: NotificationSettings;
}

export interface ChecklistItem {
  id: string;
  title: string;
  detail: string;
  done: boolean;
}

export interface LoungePost {
  id: string;
  author: string;
  title: string;
  body: string;
  createdAt: string;
  likes: number;
  comments: number;
  isSample: boolean;
}

export interface HelpLink {
  id: string;
  title: string;
  summary: string;
  url: string;
}

export interface PayBreakdown {
  minutesWorked: number;
  basePay: number;
  nightMinutes: number;
  nightPremium: number;
  overtimeMinutes: number;
  overtimePremium: number;
  totalEstimatedPay: number;
}

export interface DaySummary {
  dateKey: string;
  count: number;
  minutesWorked: number;
  pay: number;
}

export interface DashboardSummary {
  today: DaySummary;
  month: DaySummary;
  weekMinutes: number;
  weeklyHolidayReference: number;
  recentRecords: WorkEntry[];
  activeEstimate: PayBreakdown | null;
}

export interface AppSnapshot {
  records: WorkEntry[];
  activeSession: WorkEntry | null;
  settings: AppSettings;
  checklist: ChecklistItem[];
}
