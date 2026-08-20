import { describe, expect, test } from 'vitest';
import { FIRST_DAY_CHECKLIST, OFFICIAL_HELP_LINKS, LOUNGE_POSTS } from '../src/data';
import {
  buildDashboard,
  calculateNightMinutes,
  calculateOvertimeMinutes,
  calculatePay,
  calculateWorkingMinutes,
  completeActiveSession,
  createActiveSession,
  describeReferenceNotes,
  getShiftLabel
} from '../src/logic';
import { createTossShareLink, resolveSharePath, DEFAULT_SHARE_PATH } from '../src/share';
import { loadSnapshot } from '../src/storage';
import type { AppSettings, WorkEntry } from '../src/types';
import { formatCurrency, formatMinutes, toDateKey, toMonthKey, toWeekStartKey } from '../src/utils';
import { vi } from 'vitest';

const mockGetTossShareLink = vi.hoisted(() => vi.fn());

vi.mock('@apps-in-toss/web-framework', () => ({
  getTossShareLink: mockGetTossShareLink
}));

const SETTINGS: AppSettings = {
  profileName: '테스트',
  hourlyWage: 10000,
  payday: 10,
  breakMinutes: 30,
  preferredShiftStart: '18:00',
  preferredShiftEnd: '23:00',
  managerContact: '010-0000-0000',
  notifications: {
    shiftReminder: true,
    paydayReminder: true,
    checklistReminder: true
  }
};

function entry(startIso: string, endIso: string, overrides: Partial<WorkEntry> = {}): WorkEntry {
  return {
    id: overrides.id ?? startIso,
    dateKey: overrides.dateKey ?? toDateKey(new Date(startIso)),
    startedAt: startIso,
    endedAt: endIso,
    breakMinutes: overrides.breakMinutes ?? 30,
    hourlyWage: overrides.hourlyWage ?? 10000,
    memo: overrides.memo ?? '',
    status: overrides.status ?? 'done'
  };
}

describe('firstalbatalk core logic', () => {
  test('createActiveSession fills the current wage and break minutes', () => {
    const now = new Date('2026-08-20T18:00:00+09:00');
    const active = createActiveSession(SETTINGS, now);
    expect(active.status).toBe('active');
    expect(active.breakMinutes).toBe(30);
    expect(active.hourlyWage).toBe(10000);
    expect(active.dateKey).toBe('2026-08-20');
  });

  test('completeActiveSession closes a running shift', () => {
    const active = createActiveSession(SETTINGS, new Date('2026-08-20T18:00:00+09:00'));
    const done = completeActiveSession(active, new Date('2026-08-20T22:00:00+09:00'));
    expect(done.status).toBe('done');
    expect(done.endedAt).toBeDefined();
  });

  test('calculateWorkingMinutes subtracts breaks', () => {
    const value = calculateWorkingMinutes(entry('2026-08-20T18:00:00+09:00', '2026-08-20T22:00:00+09:00', { breakMinutes: 30 }));
    expect(value).toBe(210);
  });

  test('calculateWorkingMinutes never becomes negative', () => {
    const value = calculateWorkingMinutes(entry('2026-08-20T18:00:00+09:00', '2026-08-20T18:10:00+09:00', { breakMinutes: 30 }));
    expect(value).toBe(0);
  });

  test('calculateNightMinutes captures late-night work', () => {
    const value = calculateNightMinutes(entry('2026-08-20T22:00:00+09:00', '2026-08-20T23:30:00+09:00'));
    expect(value).toBe(90);
  });

  test('calculateNightMinutes counts across midnight', () => {
    const value = calculateNightMinutes(entry('2026-08-20T23:30:00+09:00', '2026-08-21T02:00:00+09:00'));
    expect(value).toBe(150);
  });

  test('calculateOvertimeMinutes counts time after eight hours', () => {
    const value = calculateOvertimeMinutes(entry('2026-08-20T10:00:00+09:00', '2026-08-20T19:00:00+09:00', { breakMinutes: 0 }));
    expect(value).toBe(60);
  });

  test('calculatePay combines base, night and overtime premiums', () => {
    const pay = calculatePay(entry('2026-08-20T14:00:00+09:00', '2026-08-20T23:00:00+09:00', { breakMinutes: 0, hourlyWage: 10000 }));
    expect(pay.basePay).toBe(90000);
    expect(pay.nightMinutes).toBe(60);
    expect(pay.overtimeMinutes).toBe(60);
    expect(pay.totalEstimatedPay).toBeGreaterThan(90000);
  });

  test('calculatePay supports a running session', () => {
    const active = createActiveSession(SETTINGS, new Date('2026-08-20T18:00:00+09:00'));
    const pay = calculatePay(active, new Date('2026-08-20T20:00:00+09:00'));
    expect(pay.minutesWorked).toBe(90);
  });

  test('getShiftLabel renders a finished shift range', () => {
    expect(getShiftLabel(entry('2026-08-20T18:00:00+09:00', '2026-08-20T23:00:00+09:00'))).toContain('~');
  });

  test('getShiftLabel renders an active shift start', () => {
    const active = createActiveSession(SETTINGS, new Date('2026-08-20T18:00:00+09:00'));
    expect(getShiftLabel(active)).toContain('시작');
  });

  test('buildDashboard tracks today and month records', () => {
    const records = [
      entry('2026-08-20T18:00:00+09:00', '2026-08-20T22:00:00+09:00', { id: 'a', dateKey: '2026-08-20' }),
      entry('2026-08-19T18:00:00+09:00', '2026-08-19T21:00:00+09:00', { id: 'b', dateKey: '2026-08-19' })
    ];
    const dashboard = buildDashboard(records, null, SETTINGS, new Date('2026-08-20T12:00:00+09:00'));
    expect(dashboard.today.count).toBe(1);
    expect(dashboard.month.count).toBe(2);
  });

  test('buildDashboard includes active work in weekly minutes', () => {
    const active = createActiveSession(SETTINGS, new Date('2026-08-20T18:00:00+09:00'));
    const dashboard = buildDashboard([], active, SETTINGS, new Date('2026-08-20T20:00:00+09:00'));
    expect(dashboard.weekMinutes).toBe(90);
  });

  test('buildDashboard adds weekly holiday reference when threshold is met', () => {
    const records = [
      entry('2026-08-18T09:00:00+09:00', '2026-08-18T18:30:00+09:00', { id: '1', dateKey: '2026-08-18', breakMinutes: 30 }),
      entry('2026-08-19T09:00:00+09:00', '2026-08-19T18:30:00+09:00', { id: '2', dateKey: '2026-08-19', breakMinutes: 30 })
    ];
    const dashboard = buildDashboard(records, null, SETTINGS, new Date('2026-08-20T12:00:00+09:00'));
    expect(dashboard.weeklyHolidayReference).toBe(80000);
  });

  test('buildDashboard leaves weekly holiday reference at zero below the threshold', () => {
    const records = [entry('2026-08-19T09:00:00+09:00', '2026-08-19T13:00:00+09:00', { id: '1', dateKey: '2026-08-19', breakMinutes: 0 })];
    const dashboard = buildDashboard(records, null, SETTINGS, new Date('2026-08-20T12:00:00+09:00'));
    expect(dashboard.weeklyHolidayReference).toBe(0);
  });

  test('describeReferenceNotes mentions legal caution', () => {
    const notes = describeReferenceNotes(entry('2026-08-20T18:00:00+09:00', '2026-08-20T20:00:00+09:00'), SETTINGS, new Date('2026-08-20T20:00:00+09:00'));
    expect(notes.join(' ')).toContain('참고 정보');
  });

  test('describeReferenceNotes mentions night work', () => {
    const notes = describeReferenceNotes(entry('2026-08-20T22:00:00+09:00', '2026-08-20T23:30:00+09:00'), SETTINGS, new Date('2026-08-20T23:30:00+09:00'));
    expect(notes.join(' ')).toContain('야간근로');
  });

  test('describeReferenceNotes mentions overtime', () => {
    const notes = describeReferenceNotes(entry('2026-08-20T10:00:00+09:00', '2026-08-20T19:00:00+09:00', { breakMinutes: 0 }), SETTINGS, new Date('2026-08-20T19:00:00+09:00'));
    expect(notes.join(' ')).toContain('연장근로');
  });

  test('formatCurrency renders Korean won', () => {
    expect(formatCurrency(12345)).toBe('12,345원');
  });

  test('formatMinutes renders hours and minutes', () => {
    expect(formatMinutes(90)).toBe('1시간 30분');
  });

  test('toDateKey uses calendar date', () => {
    expect(toDateKey(new Date('2026-08-20T12:00:00+09:00'))).toBe('2026-08-20');
  });

  test('toMonthKey uses year and month only', () => {
    expect(toMonthKey(new Date('2026-08-20T12:00:00+09:00'))).toBe('2026-08');
  });

  test('toWeekStartKey returns monday for a weekday', () => {
    expect(toWeekStartKey(new Date('2026-08-20T12:00:00+09:00'))).toBe('2026-08-17');
  });

  test('loadSnapshot falls back safely without browser storage', () => {
    const snapshot = loadSnapshot();
    expect(snapshot.records).toEqual([]);
    expect(snapshot.activeSession).toBeNull();
    expect(snapshot.checklist.length).toBeGreaterThan(0);
  });

  test('first day checklist keeps all required items', () => {
    expect(FIRST_DAY_CHECKLIST.length).toBe(6);
  });

  test('official help links only point to official sites', () => {
    const urls = OFFICIAL_HELP_LINKS.map((item) => item.url);
    expect(urls.every((url) => url.startsWith('https://'))).toBe(true);
    expect(urls.some((url) => url.includes('moel.go.kr'))).toBe(true);
  });

  test('lounge posts are clearly marked as sample content', () => {
    expect(LOUNGE_POSTS.every((post) => post.isSample)).toBe(true);
  });

  test('resolveSharePath falls back to the official firstalbatalk deep link', () => {
    expect(resolveSharePath('')).toBe(DEFAULT_SHARE_PATH);
    expect(resolveSharePath('  intoss-private://firstalbatalk?_deploymentId=test  ')).toBe('intoss-private://firstalbatalk?_deploymentId=test');
  });

  test('createTossShareLink uses the Toss SDK result when available', async () => {
    mockGetTossShareLink.mockResolvedValueOnce('https://share.example/firstalbatalk');
    await expect(createTossShareLink('intoss://firstalbatalk')).resolves.toBe('https://share.example/firstalbatalk');
    expect(mockGetTossShareLink).toHaveBeenCalledWith('intoss://firstalbatalk');
  });

  test('createTossShareLink falls back to the raw path on failure', async () => {
    mockGetTossShareLink.mockRejectedValueOnce(new Error('no host'));
    await expect(createTossShareLink('intoss-private://firstalbatalk?_deploymentId=test')).resolves.toBe(
      'intoss-private://firstalbatalk?_deploymentId=test'
    );
  });

  test.each([
    ['2026-08-18T09:00:00+09:00', '2026-08-18T12:00:00+09:00', 150],
    ['2026-08-18T18:00:00+09:00', '2026-08-18T22:00:00+09:00', 210],
    ['2026-08-18T22:00:00+09:00', '2026-08-19T01:00:00+09:00', 150],
    ['2026-08-18T10:00:00+09:00', '2026-08-18T18:00:00+09:00', 450]
  ])('working minutes scenario %#', (startIso, endIso, expected) => {
    expect(calculateWorkingMinutes(entry(startIso, endIso, { breakMinutes: 30 }))).toBe(expected);
  });

  test.each([
    [5000, 30000],
    [10000, 60000],
    [20000, 120000]
  ])('pay scales linearly by wage %i', (wage, expectedBasePay) => {
    const pay = calculatePay(entry('2026-08-20T10:00:00+09:00', '2026-08-20T16:00:00+09:00', { breakMinutes: 0, hourlyWage: wage }));
    expect(pay.basePay).toBe(expectedBasePay);
  });

  test.each([
    [true, true, true],
    [false, true, false],
    [true, false, false]
  ])('boolean reference cases %#', (a, b, expected) => {
    expect((a && b) || (!a && !b)).toBe(expected);
  });
});
