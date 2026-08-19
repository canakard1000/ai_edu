import type { ScenarioResult, StartupCostBreakdown } from '../types/startup';
import { calculateBreakEvenSales } from './breakEven';

interface ScenarioInput {
  label: ScenarioResult['label'];
  salesMultiplier: number;
  costMultiplier: number;
  variableCostDelta: number;
}

const SCENARIOS: ScenarioInput[] = [
  { label: '보수적', salesMultiplier: 0.82, costMultiplier: 1.08, variableCostDelta: 0.03 },
  { label: '기준', salesMultiplier: 1, costMultiplier: 1, variableCostDelta: 0 },
  { label: '낙관적', salesMultiplier: 1.18, costMultiplier: 0.95, variableCostDelta: -0.02 }
];

export function buildScenarioResults(breakdown: StartupCostBreakdown): ScenarioResult[] {
  return SCENARIOS.map((scenario) => {
    const sales = breakdown.expectedSales * scenario.salesMultiplier;
    const fixedCost = breakdown.monthlyFixedCost * scenario.costMultiplier;
    const variableRate = Math.max(0.05, Math.min(0.9, breakdown.variableCostRate + scenario.variableCostDelta));
    const variableCost = sales * variableRate;
    const operatingProfit = sales - variableCost - fixedCost;
    const breakEvenSales = calculateBreakEvenSales(fixedCost, variableRate);
    const breakEvenBufferRate = breakEvenSales > 0 ? ((sales - breakEvenSales) / breakEvenSales) * 100 : 0;

    return {
      label: scenario.label,
      sales,
      totalCost: fixedCost + variableCost,
      operatingProfit,
      breakEvenBufferRate,
      paybackMonths: operatingProfit > 0 ? breakdown.totalInvestment / operatingProfit : null,
      notes: [
        `매출 배수 ${scenario.salesMultiplier.toFixed(2)} 적용`,
        `비용 배수 ${scenario.costMultiplier.toFixed(2)} 적용`,
        `가변비율 ${Math.round(variableRate * 100)}%`
      ]
    };
  });
}
