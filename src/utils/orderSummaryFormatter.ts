import { OrderData, MarketState, OrderResult } from '../types/orderTypes';
import { hasNumericValue, safeToFixed, OrderResultIcon } from './formatUtils';
import { formatRiskUnit } from './orderCalcUtils';

const DEFAULT_FALLBACK = 'N/A';

type ResultDisplayMode = 'detailed' | 'simple';

export interface OrderSummaryOptions {
  includeClosePrice?: boolean;
  fallbackText?: string;
  resultDisplay?: ResultDisplayMode;
  createdAtText?: string;
  updatedAtText?: string;
}

export interface OrderSummarySections {
  headline: string;
  timeLine?: string;
  entryLine: string;
  harsiBlock: string;
  riskBlock?: string;
  resultBlock?: string;
}

export function buildOrderSummarySections(
  order: OrderData,
  options: OrderSummaryOptions = {},
): OrderSummarySections {
  const fallback = options.fallbackText ?? DEFAULT_FALLBACK;
  const includeClosePrice = options.includeClosePrice ?? false;
  const resultDisplay = options.resultDisplay ?? 'detailed';

  const directionLabel = order.direction ? order.direction.toUpperCase() : fallback;
  const entryText = formatNumberWithCommas(order.entry, undefined, fallback);
  const takeProfitText = formatNumberWithCommas(order.takeProfit, undefined, fallback);
  const stopLossText = formatNumberWithCommas(order.stopLoss, undefined, fallback);
  const quantityDecimals =
    hasNumericValue(order.quantity) && !Number.isInteger(order.quantity) ? 2 : 0;
  const quantityText = formatNumberWithCommas(order.quantity, quantityDecimals, fallback);

  const closePriceFragment =
    includeClosePrice && hasNumericValue(order.actualClosePrice)
      ? ` | Close: ${formatNumberWithCommas(order.actualClosePrice, 2, fallback)}`
      : '';

  const timeParts: string[] = [];
  if (options.createdAtText) {
    timeParts.push(`🕒 Tạo: ${options.createdAtText}`);
  }
  if (options.updatedAtText) {
    timeParts.push(`🔄 Cập nhật: ${options.updatedAtText}`);
  }
  const timeLine = timeParts.length ? timeParts.join(' | ') : undefined;
  const quantityWithClose = `Q: ${quantityText}${closePriceFragment}`;
  const headline = `📌 ${order.symbol || fallback} | ${directionLabel} | ${quantityWithClose}`;
  const entryLine = `🔥 E: ${entryText} | TP: ${takeProfitText} | SL: ${stopLossText}`;
  const harsiBlock = `📊 HARSI\n${buildHarsiLine(order)}`;
  const riskBlock = buildRiskBlock(order, fallback);
  const resultBlock = buildResultBlock(order, fallback, resultDisplay);

  return {
    headline,
    timeLine,
    entryLine,
    harsiBlock,
    riskBlock,
    resultBlock,
  };
}

function buildHarsiLine(order: OrderData): string {
  return [
    `1W ${formatHarsiEmoji(order.harsi1w)}`,
    `3D ${formatHarsiEmoji(order.harsi3d)}`,
    `2D ${formatHarsiEmoji(order.harsi2d)}`,
    `1D ${formatHarsiEmoji(order.harsi1d)}`,
    `8H ${formatHarsiEmoji(order.harsi8h)}`,
    `4H ${formatHarsiEmoji(order.harsi4h)}`,
    `2H ${formatHarsiEmoji(order.hasri2h)}`,
  ].join(' | ');
}

function buildRiskBlock(order: OrderData, fallback: string): string | undefined {
  const lines: string[] = [];

  if (hasNumericValue(order.potentialStopLoss)) {
    const percentText = hasNumericValue(order.potentialStopLossPercent)
      ? ` (${safeToFixed(order.potentialStopLossPercent, 2)}%)`
      : '';
    const usdText = hasNumericValue(order.potentialStopLossUsd)
      ? ` → $${safeToFixed(order.potentialStopLossUsd, 2)}`
      : '';
    lines.push(
      `SL: -${formatNumberWithCommas(order.potentialStopLoss, 0, fallback)}${percentText}${usdText}`,
    );
  }

  if (hasNumericValue(order.potentialProfit)) {
    const percentText = hasNumericValue(order.potentialProfitPercent)
      ? ` (${safeToFixed(order.potentialProfitPercent, 2)}%)`
      : '';
    const usdText = hasNumericValue(order.potentialProfitUsd)
      ? ` → $${safeToFixed(order.potentialProfitUsd, 2)}`
      : '';
    lines.push(
      `TP: +${formatNumberWithCommas(order.potentialProfit, 0, fallback)}${percentText}${usdText}`,
    );
  }

  if (hasNumericValue(order.potentialRiskRewardRatio)) {
    lines.push(`R:R = 1:${safeToFixed(order.potentialRiskRewardRatio, 2)}`);
  }

  if (!lines.length) {
    return undefined;
  }

  return `📍 Risk / Reward\n${lines.join('\n')}`;
}

function buildResultBlock(
  order: OrderData,
  fallback: string,
  mode: ResultDisplayMode,
): string | undefined {
  if (!hasNumericValue(order.actualRiskRewardRatio)) {
    return undefined;
  }

  const lines: string[] = ['🏁 Result'];
  const headerParts: string[] = [];

  if (mode === 'detailed' && order.orderResult) {
    const icons = OrderResultIcon[order.orderResult] || [];
    const emoji = icons.join('');
    if (emoji) {
      headerParts.push(emoji);
    }
    headerParts.push(formatOrderResultText(order.orderResult));
  }

  headerParts.push(formatRiskUnit(order.actualRiskRewardRatio));
  lines.push(headerParts.join(' ').trim());

  const pnlLine = buildPnlLine(order, fallback);
  if (pnlLine) {
    lines.push(pnlLine);
  }

  return lines.join('\n');
}

function buildPnlLine(order: OrderData, fallback: string): string | null {
  if (!hasNumericValue(order.actualRealizedPnL)) {
    return null;
  }

  const pnlDecimals =
    hasNumericValue(order.actualRealizedPnL) && Math.abs(order.actualRealizedPnL) < 1 ? 4 : 0;
  const pnlText = formatSignedNumber(order.actualRealizedPnL, pnlDecimals, fallback);
  if (pnlText === fallback) {
    return null;
  }

  let line = `PnL: ${pnlText}`;
  const usdText = formatCurrencyArrow(order.actualRealizedPnLUsd);
  if (usdText) {
    line += ` → ${usdText}`;
  }

  if (hasNumericValue(order.actualRealizedPnLPercent)) {
    line += ` (${safeToFixed(order.actualRealizedPnLPercent, 2)}%)`;
  }

  return line;
}

function formatHarsiEmoji(value?: MarketState): string {
  if (!value) return DEFAULT_FALLBACK;
  switch (value) {
    case MarketState.Bullish:
      return '🟢';
    case MarketState.Bearish:
      return '🔴';
    case MarketState.Neutral:
      return '⚪';
    default:
      return DEFAULT_FALLBACK;
  }
}

function formatNumberWithCommas(
  value: number | undefined | null,
  decimals?: number,
  fallback = DEFAULT_FALLBACK,
): string {
  if (!hasNumericValue(value)) return fallback;
  const numericValue = value;
  const resolvedDecimals = decimals ?? (Number.isInteger(numericValue) ? 0 : 2);
  return numericValue.toLocaleString('en-US', {
    minimumFractionDigits: resolvedDecimals,
    maximumFractionDigits: resolvedDecimals,
  });
}

function formatSignedNumber(
  value: number | undefined | null,
  decimals?: number,
  fallback = DEFAULT_FALLBACK,
): string {
  if (!hasNumericValue(value)) return fallback;
  const numericValue = value;
  const resolvedDecimals = decimals ?? (Number.isInteger(numericValue) ? 0 : 2);
  const magnitude = formatNumberWithCommas(Math.abs(numericValue), resolvedDecimals, fallback);
  if (numericValue > 0) return `+${magnitude}`;
  if (numericValue < 0) return `-${magnitude}`;
  return magnitude;
}

function formatCurrencyArrow(value: number | undefined | null): string | null {
  if (!hasNumericValue(value)) return null;
  const numericValue = value;
  const absText = safeToFixed(Math.abs(numericValue), 2);
  const sign = numericValue < 0 ? '-' : '';
  return `${sign}$${absText}`;
}

function formatOrderResultText(result: OrderResult): string {
  switch (result) {
    case OrderResult.WIN:
      return 'WIN';
    case OrderResult.LOSS:
      return 'LOSS';
    case OrderResult.BREAKEVEN:
      return 'BREAKEVEN';
    default:
      return 'IN_PROGRESS';
  }
}

