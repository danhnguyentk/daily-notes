/**
 * Order handlers - Process completed order data
 */

import { Env } from '../types/env';
import { OrderData, MarketState } from '../types/orderTypes';
import { sendMessageToTelegram, TelegramReplyKeyboardRemove } from '../services/telegramService';
import { formatNotes, attachLatestTrendDataToOrder } from '../services/orderConversationService';
import { calculateOrderLoss } from '../utils/orderCalcUtils';
import { buildOrderSummarySections } from '../utils/orderSummaryFormatter';
import { saveOrder } from './orderStatisticsHandler';

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

function buildOrderSummary(orderData: OrderData, formattedNotes: string): string {
  const sections = buildOrderSummarySections(orderData, {
    includeClosePrice: true,
    fallbackText: 'N/A',
    resultDisplay: 'simple',
  });

  let summary = '✅ Lệnh đã được xử lý thành công!';
  summary += `\n${sections.headline}`;
  if (sections.timeLine) {
    summary += `\n${sections.timeLine}`;
  }
  summary += `\n${sections.entryLine}`;
  summary += `\n${sections.harsiBlock}`;

  if (sections.riskBlock) {
    summary += `\n${sections.riskBlock}`;
  }

  if (sections.resultBlock) {
    summary += `\n${sections.resultBlock}`;
  }

  summary += `\n📝 Notes:\n${formattedNotes || 'Không có ghi chú.'}`;

  return summary.trim();
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

