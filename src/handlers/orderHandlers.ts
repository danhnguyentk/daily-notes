/**
 * Order handlers - Process completed order data
 */

import { Env } from '../types';
import { OrderData, MarketState } from '../types/orderTypes';
import { sendMessageToTelegram, TelegramReplyKeyboardRemove } from '../telegramService';
import { formatVietnamTime } from '../utils/timeUtils';
import { formatNotes } from '../services/orderConversationService';
import { calculateOrderLoss } from '../utils/orderCalcUtils';
import { saveOrder } from './orderStatisticsHandler';

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
  // Calculate loss fields before processing
  orderData = calculateOrderLoss(orderData);
  console.log('Processing order data:', orderData);

  // Lưu order vào KV store để thống kê sau này
  await saveOrder(userId, orderData, env);

  // TODO: Hook to your API here
  // Uncomment and modify the example above to connect to your API

  // Format order summary
  const formattedNotes = formatNotes(orderData.notes);
  
  // Format loss information
  const lossInfo = orderData.potentialStopLoss !== undefined ? `
📉 Thông tin rủi ro (nếu chạm Stop Loss):
   • Mức thua lỗ: ${orderData.potentialStopLoss.toFixed(4)} (${orderData.potentialStopLossPercent?.toFixed(2) || 'N/A'}%)
   • Thua lỗ USD: $${orderData.potentialStopLossUsd?.toFixed(2) || 'N/A'}
  `.trim() : '';

  // Format profit information
  const profitInfo = orderData.potentialProfit !== undefined ? `
📈 Thông tin lợi nhuận (nếu chạm Take Profit):
   • Mức tăng giá: ${orderData.potentialProfit.toFixed(4)} (${orderData.potentialProfitPercent?.toFixed(2) || 'N/A'}%)
   • Lợi nhuận USD: $${orderData.potentialProfitUsd?.toFixed(2) || 'N/A'}
  `.trim() : '';

  // Format potential risk/reward ratio
  const potentialRiskRewardInfo = orderData.potentialRiskRewardRatio !== undefined ? `
⚖️ Tỷ lệ Risk/Reward (tiềm năng): 1:${orderData.potentialRiskRewardRatio.toFixed(2)}
  `.trim() : '';

  // Format actual risk/reward ratio theo đơn vị R (if order was closed early)
  // Dương = lợi nhuận, Âm = thua lỗ
  const formatRiskUnit = (ratio: number): string => {
    const absRatio = Math.abs(ratio);
    const formatted = absRatio.toFixed(2);
    
    if (ratio > 0) {
      // Lợi nhuận: hiển thị +0.5R, +1R, +2R
      return `+${formatted}R`;
    } else if (ratio < 0) {
      // Thua lỗ: hiển thị -0.5R, -1R, -1.5R
      return `${ratio.toFixed(2)}R`;
    }
    return '0R';
  };

  const actualRiskRewardInfo = orderData.actualRiskRewardRatio !== undefined ? `
📊 Kết quả thực tế: ${formatRiskUnit(orderData.actualRiskRewardRatio)}
   ${orderData.actualRiskRewardRatio > 0 
     ? `(Lợi nhuận ${(orderData.actualRiskRewardRatio * 100).toFixed(1)}% rủi ro)`
     : `(Thua lỗ ${Math.abs(orderData.actualRiskRewardRatio * 100).toFixed(1)}% rủi ro)`}
   • 1R = ${orderData.potentialStopLoss?.toFixed(4) || 'N/A'} (rủi ro tiềm năng)
  `.trim() : '';

  const summary = `
✅ Lệnh đã được xử lý thành công!

📋 Thông tin lệnh:
Symbol: ${orderData.symbol}
Direction: ${orderData.direction}
HARSI 1D: ${orderData.harsi1d || 'N/A'}
HARSI 12H: ${orderData.harsi12h || 'N/A'}
HARSI 8H: ${orderData.harsi8h || 'N/A'}
HARSI 6H: ${orderData.harsi6h || 'N/A'}
HARSI 4H: ${orderData.harsi4h || 'N/A'}
Entry: ${orderData.entry}
Stop Loss: ${orderData.stopLoss}
Take Profit: ${orderData.takeProfit || 'N/A'}
Quantity: ${orderData.quantity || 'N/A'}
${lossInfo ? '\n' + lossInfo : ''}
${profitInfo ? '\n' + profitInfo : ''}
${potentialRiskRewardInfo ? '\n' + potentialRiskRewardInfo : ''}
${actualRiskRewardInfo ? '\n' + actualRiskRewardInfo : ''}
Notes:
${formattedNotes}

⏰ Thời gian: ${formatVietnamTime()}
  `.trim();

  // Remove any remaining keyboards khi hoàn thành order
  const removeKeyboard: TelegramReplyKeyboardRemove = { remove_keyboard: true };
  await sendMessageToTelegram({
    chat_id: chatId,
    text: summary,
    reply_markup: removeKeyboard,
  }, env);

  // Warning alert if HARSI 8h is Bearish
  if (orderData.harsi8h === MarketState.Bearish) {
    const warningMessage = `
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

    await sendMessageToTelegram({
      chat_id: chatId,
      text: warningMessage,
    }, env);
  }

  // You can also send to a logging channel or save to database
  // TODO: Implement this
}

