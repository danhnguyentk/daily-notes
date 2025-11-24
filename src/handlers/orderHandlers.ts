/**
 * Order handlers - Process completed order data
 */

import { Env } from '../types/env';
import { OrderData, MarketState } from '../types/orderTypes';
import { sendMessageToTelegram, TelegramReplyKeyboardRemove } from '../services/telegramService';
import { formatVietnamTime } from '../utils/timeUtils';
import { formatNotes, attachLatestTrendDataToOrder } from '../services/orderConversationService';
import { calculateOrderLoss } from '../utils/orderCalcUtils';
import { formatHarsiValue, formatRiskUnit, hasNumericValue, safeToFixed } from '../utils/formatUtils';
import { saveOrder } from './orderStatisticsHandler';

const VALUE_NOT_AVAILABLE = 'N/A';

const HARSI_8H_BEARISH_WARNING = `
⚠️ CẢNH BÁO RỦI RO

HARSI 8H đang ở trạng thái Bearish (Giảm).

📌 Lưu ý:
   • Thị trường có xu hướng giảm trên khung thời gian 8 giờ
   • Dễ dàng chạm Stop Loss nếu xu hướng giảm tiếp tục
   • Nên cân nhắc kỹ trước khi vào lệnh
   • Đảm bảo Stop Loss được đặt hợp lý và quản lý rủi ro tốt

💡 Gợi ý:
   • Kiểm tra lại các khung thời gian khác (1D, 12H, 6H, 4H)
   • Xem xét các tín hiệu phân tích kỹ thuật khác
   • Quản lý vốn cẩn thận, không nên risk quá nhiều
`.trim();

function withFallback<T>(value: T | undefined | null, fallback = VALUE_NOT_AVAILABLE): T | string {
  return value ?? fallback;
}

function buildLossInfo(orderData: OrderData): string | undefined {
  if (!hasNumericValue(orderData.potentialStopLoss)) {
    return undefined;
  }

  return [
    '📉 Thông tin rủi ro (nếu chạm Stop Loss):',
    `   • Mức thua lỗ: ${safeToFixed(orderData.potentialStopLoss, 4)} (${safeToFixed(orderData.potentialStopLossPercent, 2)}%)`,
    `   • Thua lỗ USD: $${safeToFixed(orderData.potentialStopLossUsd, 2)}`,
  ].join('\n');
}

function buildProfitInfo(orderData: OrderData): string | undefined {
  if (!hasNumericValue(orderData.potentialProfit)) {
    return undefined;
  }

  return [
    '📈 Thông tin lợi nhuận (nếu chạm Take Profit):',
    `   • Mức tăng giá: ${safeToFixed(orderData.potentialProfit, 4)} (${safeToFixed(orderData.potentialProfitPercent, 2)}%)`,
    `   • Lợi nhuận USD: $${safeToFixed(orderData.potentialProfitUsd, 2)}`,
  ].join('\n');
}

function buildPotentialRiskRewardInfo(orderData: OrderData): string | undefined {
  if (!hasNumericValue(orderData.potentialRiskRewardRatio)) {
    return undefined;
  }

  return `⚖️ Tỷ lệ Risk/Reward (tiềm năng): 1:${safeToFixed(orderData.potentialRiskRewardRatio, 2)}`;
}

function buildActualRiskRewardInfo(orderData: OrderData): string | undefined {
  if (!hasNumericValue(orderData.actualRiskRewardRatio)) {
    return undefined;
  }

  const ratio = orderData.actualRiskRewardRatio;
  const directionText =
    ratio > 0
      ? `(Lợi nhuận ${safeToFixed(ratio * 100, 1)}% rủi ro)`
      : `(Thua lỗ ${safeToFixed(Math.abs(ratio * 100), 1)}% rủi ro)`;

  return [
    `📊 Kết quả thực tế: ${formatRiskUnit(ratio)}`,
    `   ${directionText}`,
    `   • 1R = ${safeToFixed(orderData.potentialStopLoss, 4)} (rủi ro tiềm năng)`,
  ].join('\n');
}

function buildOrderSummary(orderData: OrderData, formattedNotes: string): string {
  const summarySections = [
    buildLossInfo(orderData),
    buildProfitInfo(orderData),
    buildPotentialRiskRewardInfo(orderData),
    buildActualRiskRewardInfo(orderData),
  ]
    .filter(Boolean)
    .join('\n\n');

  const summaryLines = [
    '✅ Lệnh đã được xử lý thành công!',
    '',
    '📋 Thông tin lệnh:',
    `Symbol: ${withFallback(orderData.symbol)}`,
    `Direction: ${withFallback(orderData.direction)}`,
    `HARSI 1W: ${formatHarsiValue(orderData.harsi1w)}`,
    `HARSI 3D: ${formatHarsiValue(orderData.harsi3d)}`,
    `HARSI 2D: ${formatHarsiValue(orderData.harsi2d)}`,
    `HARSI 1D: ${formatHarsiValue(orderData.harsi1d)}`,
    `HARSI 8H: ${formatHarsiValue(orderData.harsi8h)}`,
    `HARSI 4H: ${formatHarsiValue(orderData.harsi4h)}`,
    `Entry: ${withFallback(orderData.entry)}`,
    `Stop Loss: ${withFallback(orderData.stopLoss)}`,
    `Take Profit: ${withFallback(orderData.takeProfit)}`,
    `Quantity: ${withFallback(orderData.quantity)}`,
  ];

  if (hasNumericValue(orderData.actualClosePrice)) {
    summaryLines.push(`Close Price: ${safeToFixed(orderData.actualClosePrice, 2)}`);
  }

  if (summarySections) {
    summaryLines.push('');
    summaryLines.push(summarySections);
  }

  summaryLines.push('');
  summaryLines.push('Notes:');
  summaryLines.push(formattedNotes);
  summaryLines.push('');
  summaryLines.push(`⏰ Thời gian: ${formatVietnamTime()}`);

  return summaryLines.join('\n').trim();
}

/**
 * Process completed order data
 * This function will be called when user completes the order form
 * You can hook to your API here
 * 
 * @example
 * // To hook to your API, uncomment and modify:
 * // const response = await fetch('YOUR_API_ENDPOINT', {
 * //   method: 'POST',
 * //   headers: { 
 * //     'Content-Type': 'application/json',
 * //     'Authorization': `Bearer ${env.API_KEY}` // if needed
 * //   },
 * //   body: JSON.stringify({
 * //     ...orderData,
 * //     userId,
 * //     timestamp: Date.now(),
 * //   }),
 * // });
 * // 
 * // if (!response.ok) {
 * //   throw new Error(`API call failed: ${response.statusText}`);
 * // }
 * // const result = await response.json();
 */
export async function processOrderData(
  orderData: OrderData,
  userId: number,
  chatId: string,
  env: Env
): Promise<void> {
  // Attach latest trend data (HARSI) to order before processing
  await attachLatestTrendDataToOrder(orderData, env);
  
  // Calculate loss fields before processing
  orderData = calculateOrderLoss(orderData);
  console.log('Processing order data:', orderData);

  // Lưu order vào KV store để thống kê sau này
  await saveOrder(userId, orderData, env);

  // TODO: Hook to your API here
  // Uncomment and modify the example above to connect to your API

  // Format order summary
  const formattedNotes = formatNotes(orderData.notes);
  const summary = buildOrderSummary(orderData, formattedNotes);

  // Remove any remaining keyboards khi hoàn thành order
  const removeKeyboard: TelegramReplyKeyboardRemove = { remove_keyboard: true };
  await sendMessageToTelegram({
    chat_id: chatId,
    text: summary,
    reply_markup: removeKeyboard,
  }, env);

  // Warning alert if HARSI 8h is Bearish
  if (orderData.harsi8h === MarketState.Bearish) {
    await sendMessageToTelegram({
      chat_id: chatId,
      text: HARSI_8H_BEARISH_WARNING,
    }, env);
  }

  // You can also send to a logging channel or save to database
  // TODO: Implement this
}

