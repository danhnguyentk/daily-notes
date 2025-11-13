/**
 * Order handlers - Process completed order data
 */

import { Env } from '../types';
import { OrderData } from '../types/orderTypes';
import { sendMessageToTelegram } from '../telegramService';
import { formatVietnamTime } from '../utils/timeUtils';
import { formatNotes } from '../services/orderConversationService';

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
  console.log('Processing order data:', orderData);

  // TODO: Hook to your API here
  // Uncomment and modify the example above to connect to your API

  // Format order summary
  const formattedNotes = formatNotes(orderData.notes);
  
  const summary = `
✅ Lệnh đã được xử lý thành công!

📋 Thông tin lệnh:
Symbol: ${orderData.symbol}
Direction: ${orderData.direction}
Entry: ${orderData.entry}
Stop Loss: ${orderData.stopLoss}
Take Profit: ${orderData.takeProfit || 'N/A'}
Quantity: ${orderData.quantity || 'N/A'}
Notes:
${formattedNotes}

⏰ Thời gian: ${formatVietnamTime()}
  `.trim();

  await sendMessageToTelegram({
    chat_id: chatId,
    text: summary,
  }, env);

  // You can also send to a logging channel or save to database
  // TODO: Implement this
}

