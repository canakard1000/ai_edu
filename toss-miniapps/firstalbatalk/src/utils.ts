export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function parseNumber(value: string | number | undefined, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number(value.replace(/,/g, '').trim());
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return fallback;
}

export function pad(value: number): string {
  return value.toString().padStart(2, '0');
}

export function toDateKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function toMonthKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
}

export function toWeekStartKey(date: Date): string {
  const copy = new Date(date);
  const day = copy.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + offset);
  return toDateKey(copy);
}

export function formatCurrency(value: number): string {
  return `${Math.round(value).toLocaleString('ko-KR')}원`;
}

export function formatCompactCurrency(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 100000000) {
    return `${(value / 100000000).toFixed(value % 100000000 === 0 ? 0 : 1)}억`;
  }
  if (abs >= 10000) {
    return `${(value / 10000).toFixed(value % 10000 === 0 ? 0 : 1)}만`;
  }
  return `${Math.round(value).toLocaleString('ko-KR')}원`;
}

export function formatMinutes(minutes: number): string {
  const safeMinutes = Math.max(0, Math.round(minutes));
  const hours = Math.floor(safeMinutes / 60);
  const remaining = safeMinutes % 60;
  if (hours === 0) {
    return `${remaining}분`;
  }
  if (remaining === 0) {
    return `${hours}시간`;
  }
  return `${hours}시간 ${remaining}분`;
}

export function formatTimeLabel(iso: string): string {
  const date = new Date(iso);
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function formatDateLabel(dateKey: string): string {
  const [, month, day] = dateKey.split('-');
  return `${month}.${day}`;
}

export function formatPercent(value: number): string {
  return `${value.toFixed(0)}%`;
}
