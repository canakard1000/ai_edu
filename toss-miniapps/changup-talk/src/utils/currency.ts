const wonFormatter = new Intl.NumberFormat('ko-KR');

export function formatWon(value: number): string {
  return `${wonFormatter.format(Math.round(value))}원`;
}

export function formatCompactWon(value: number): string {
  const rounded = Math.round(value);

  if (Math.abs(rounded) >= 100000000) {
    const eok = Math.trunc(rounded / 100000000);
    const man = Math.trunc((Math.abs(rounded) % 100000000) / 10000);
    return man > 0 ? `${wonFormatter.format(eok)}억 ${wonFormatter.format(man)}만원` : `${wonFormatter.format(eok)}억원`;
  }

  return `${wonFormatter.format(Math.round(rounded / 10000))}만원`;
}

export function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

export function formatMonths(value: number | null): string {
  if (value === null || !Number.isFinite(value)) {
    return '현재 조건에서는 투자금 회수 어려움';
  }

  return `${value.toFixed(1)}개월`;
}

export function formatDelta(value: number): string {
  if (value === 0) return '0원';
  const prefix = value > 0 ? '+' : '-';
  return `${prefix}${formatCompactWon(Math.abs(value))}`;
}

export function formatScore(value: number): string {
  return `${Math.round(value)}/100`;
}
