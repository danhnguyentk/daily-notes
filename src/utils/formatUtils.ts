import { MarketState } from '../types/orderTypes';

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

