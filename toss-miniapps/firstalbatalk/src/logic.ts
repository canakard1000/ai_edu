import type { AppSettings, DashboardSummary, DaySummary, PayBreakdown, WorkEntry } from './types';
import { formatCurrency, parseNumber, toDateKey, toMonthKey, toWeekStartKey } from './utils';

function minutesBetween(startIso: string, endIso: string): number {
  return Math.max(0, Math.round((new Date(endIso).getTime() - new Date(startIso).getTime()) / 60000));
}

function getRangeOverlapMinutes(start: Date, end: Date, rangeStartHour: number, rangeEndHour: number): number {
  let total = 0;
  const cursor = new Date(start);
  cursor.setHours(0, 0, 0, 0);

  while (cursor < end) {
    const dayEnd = new Date(cursor);
    dayEnd.setDate(dayEnd.getDate() + 1);

    const windowStart = new Date(cursor);
    windowStart.setHours(rangeStartHour, 0, 0, 0);
    const windowEnd = new Date(cursor);
    windowEnd.setHours(rangeEndHour, 0, 0, 0);
    if (rangeEndHour <= rangeStartHour) {
      windowEnd.setDate(windowEnd.getDate() + 1);
    }

    const overlapStart = Math.max(start.getTime(), windowStart.getTime());
    const overlapEnd = Math.min(end.getTime(), windowEnd.getTime());
    if (overlapEnd > overlapStart) {
      total += (overlapEnd - overlapStart) / 60000;
    }

    cursor.setDate(cursor.getDate() + 1);
  }

  return Math.max(0, Math.round(total));
}

export function createActiveSession(settings: AppSettings, now = new Date()): WorkEntry {
  return {
    id: `session-${now.getTime()}`,
    dateKey: toDateKey(now),
    startedAt: now.toISOString(),
    breakMinutes: settings.breakMinutes,
    hourlyWage: settings.hourlyWage,
    memo: '',
    status: 'active'
  };
}

export function completeActiveSession(activeSession: WorkEntry, now = new Date()): WorkEntry {
  return {
    ...activeSession,
    endedAt: now.toISOString(),
    status: 'done'
  };
}

export function calculateWorkingMinutes(entry: WorkEntry, now = new Date()): number {
  const endedAt = entry.endedAt ?? now.toISOString();
  const gross = minutesBetween(entry.startedAt, endedAt);
  return Math.max(0, gross - parseNumber(entry.breakMinutes, 0));
}

export function calculateNightMinutes(entry: WorkEntry, now = new Date()): number {
  const start = new Date(entry.startedAt);
  const end = new Date(entry.endedAt ?? now.toISOString());
  return getRangeOverlapMinutes(start, end, 22, 6);
}

export function calculateOvertimeMinutes(entry: WorkEntry, now = new Date()): number {
  return Math.max(0, calculateWorkingMinutes(entry, now) - 480);
}

export function calculatePay(entry: WorkEntry, now = new Date()): PayBreakdown {
  const minutesWorked = calculateWorkingMinutes(entry, now);
  const wage = parseNumber(entry.hourlyWage, 0);
  const basePay = (minutesWorked / 60) * wage;
  const nightMinutes = calculateNightMinutes(entry, now);
  const overtimeMinutes = calculateOvertimeMinutes(entry, now);
  const nightPremium = (nightMinutes / 60) * wage * 0.5;
  const overtimePremium = (overtimeMinutes / 60) * wage * 0.5;

  return {
    minutesWorked,
    basePay: Math.round(basePay),
    nightMinutes,
    nightPremium: Math.round(nightPremium),
    overtimeMinutes,
    overtimePremium: Math.round(overtimePremium),
    totalEstimatedPay: Math.round(basePay + nightPremium + overtimePremium)
  };
}

function emptySummary(dateKey: string): DaySummary {
  return { dateKey, count: 0, minutesWorked: 0, pay: 0 };
}

function sumEntries(entries: WorkEntry[], now = new Date()): DaySummary {
  if (entries.length === 0) {
    return emptySummary(toDateKey(now));
  }

  return entries.reduce<DaySummary>(
    (acc, entry) => {
      const breakdown = calculatePay(entry, now);
      return {
        dateKey: acc.dateKey,
        count: acc.count + 1,
        minutesWorked: acc.minutesWorked + breakdown.minutesWorked,
        pay: acc.pay + breakdown.totalEstimatedPay
      };
    },
    emptySummary(entries[0].dateKey)
  );
}

function sumWeekHoliday(entries: WorkEntry[], now = new Date()): number {
  const groups = new Map<string, WorkEntry[]>();
  for (const entry of entries) {
    const weekKey = toWeekStartKey(new Date(entry.startedAt));
    const list = groups.get(weekKey) ?? [];
    list.push(entry);
    groups.set(weekKey, list);
  }

  let total = 0;
  for (const weekEntries of groups.values()) {
    const minutes = weekEntries.reduce((acc, entry) => acc + calculateWorkingMinutes(entry, now), 0);
    if (minutes >= 900) {
      const wage = weekEntries[0]?.hourlyWage ?? 0;
      total += wage * 8;
    }
  }

  return Math.round(total);
}

export function buildDashboard(records: WorkEntry[], activeSession: WorkEntry | null, settings: AppSettings, now = new Date()): DashboardSummary {
  const currentMonthKey = toMonthKey(now);
  const currentDateKey = toDateKey(now);
  const currentWeekKey = toWeekStartKey(now);
  const currentMonthRecords = records.filter((entry) => entry.dateKey.startsWith(currentMonthKey));
  const todayRecords = records.filter((entry) => entry.dateKey === currentDateKey);
  const weekRecords = records.filter((entry) => toWeekStartKey(new Date(entry.startedAt)) === currentWeekKey);
  const weekEntries = activeSession ? [...weekRecords, activeSession] : weekRecords;

  const activeEstimate = activeSession ? calculatePay(activeSession, now) : null;
  const todaySummary = sumEntries(todayRecords, now);
  const monthSummary = sumEntries(currentMonthRecords, now);
  const weekMinutes = weekEntries.reduce((acc, entry) => acc + calculateWorkingMinutes(entry, now), 0);
  const weeklyHolidayReference = sumWeekHoliday(weekEntries, now);
  const activeEstimateTotal = activeEstimate?.totalEstimatedPay ?? 0;

  return {
    today: {
      ...todaySummary,
      dateKey: currentDateKey,
      pay: todaySummary.pay + activeEstimateTotal
    },
    month: {
      ...monthSummary,
      dateKey: currentMonthKey,
      pay: monthSummary.pay + weeklyHolidayReference + activeEstimateTotal
    },
    weekMinutes,
    weeklyHolidayReference,
    recentRecords: [...records]
      .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
      .slice(0, 5),
    activeEstimate
  };
}

export function getShiftLabel(entry: WorkEntry): string {
  const start = new Date(entry.startedAt);
  const end = entry.endedAt ? new Date(entry.endedAt) : null;
  return end ? `${start.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })} ~ ${end.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}` : `${start.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })} 시작`;
}

export function describeReferenceNotes(entry: WorkEntry, settings: AppSettings, now = new Date()): string[] {
  const notes = ['법률 판단이 아닌 참고 정보입니다.'];
  if (calculateWorkingMinutes(entry, now) >= 900) {
    notes.push('주 15시간 이상 근무한 주에는 주휴수당 참고값이 함께 표시됩니다.');
  }
  if (calculateNightMinutes(entry, now) > 0) {
    notes.push('22시~06시 사이 근무는 야간근로 참고값이 포함됩니다.');
  }
  if (calculateOvertimeMinutes(entry, now) > 0) {
    notes.push('8시간 초과분은 연장근로 참고값이 포함됩니다.');
  }
  if (settings.hourlyWage <= 0) {
    notes.push('시급이 0원 이하로 설정되어 있어 계산이 비어 있습니다.');
  }
  return notes;
}

export function summarizePayText(value: number): string {
  return formatCurrency(value);
}
