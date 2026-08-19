export function calculateBreakEvenSales(monthlyFixedCost: number, variableCostRate: number): number {
  if (variableCostRate >= 1) {
    return Number.POSITIVE_INFINITY;
  }

  return monthlyFixedCost / (1 - variableCostRate);
}
