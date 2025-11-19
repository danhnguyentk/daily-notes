import { MarketState, OrderResult } from '../types/orderTypes';

/**
 * Order result icon mapping
 */
export const OrderResultIcon: Record<OrderResult, string[]> = {
  [OrderResult.WIN]: ['🟢', '📈'],
  [OrderResult.LOSS]: ['🔴', '📉'],
  [OrderResult.BREAKEVEN]: ['⚪', '➖'],
  [OrderResult.IN_PROGRESS]: ['🟡', '⏳'],
};

/**
 * Format HARSI market state value with emoji indicator
 * @param value MarketState value or undefined
 * @returns Formatted string with emoji (🟢 Bullish, 🔴 Bearish, ⚪ Neutral) or 'N/A'
 */

export function formatHarsiValue(value: MarketState | undefined): string {
  if (!value) return 'N/A';
  switch (value) {
    case MarketState.Bullish:
      return '🟢 Bullish';
    case MarketState.Bearish:
      return '🔴 Bearish';
    case MarketState.Neutral:
      return '⚪ Neutral';
    default:
      return value;
  }
}

/**
 * Check if a numeric value is defined and not NaN
 */
export function hasNumericValue(value: number | undefined | null): value is number {
  return typeof value === 'number' && !Number.isNaN(value);
}

/**
 * Safely format numeric values using toFixed with fallback text
 */
export function safeToFixed(
  value: number | undefined | null,
  decimals: number,
  fallback = 'N/A',
): string {
  if (!hasNumericValue(value)) {
    return fallback;
  }
  return value.toFixed(decimals);
}

/**
 * Format ratio result into risk units (R)
 */
export function formatRiskUnit(ratio: number | undefined | null): string {
  if (!hasNumericValue(ratio)) {
    return 'N/A';
  }

  const formatted = ratio.toFixed(2);
  if (ratio > 0) {
    return `+${formatted}R`;
  }
  if (ratio < 0) {
    return `${formatted}R`;
  }
  return '0R';
}

