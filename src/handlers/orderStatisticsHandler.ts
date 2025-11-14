/**
 * Handler để thống kê và hiển thị tổng hợp R từ các orders
 */

import { Env } from '../types/env';
import { OrderData } from '../types/orderTypes';
import { sendMessageToTelegram, TelegramInlineKeyboardMarkup } from '../services/telegramService';
import { formatVietnamTime } from '../utils/timeUtils';
import { formatHarsiValue } from '../utils/formatUtils';
import {
  calculateRiskUnitStatistics,
  formatRiskUnit,
} from '../utils/orderCalcUtils';
import {
  saveOrderToSupabase,
  getUserOrdersFromSupabase,
  getUserOrdersByDateRangeFromSupabase,
  getOrderByIdFromSupabase,
  updateOrderWithClosePriceInSupabase,
  convertOrderRecordToOrderData,
} from '../services/supabaseService';

/**
 * Lưu order vào Supabase
 */
export async function saveOrder(
  userId: number,
  orderData: OrderData,
  env: Env
): Promise<void> {
  await saveOrderToSupabase(userId, orderData, env);
}

/**
 * Lấy tất cả orders của một user từ Supabase
 */
export async function getUserOrders(
  userId: number,
  env: Env
): Promise<OrderData[]> {
  const records = await getUserOrdersFromSupabase(userId, env);
  return records.map(convertOrderRecordToOrderData);
}

/**
 * Lấy orders trong khoảng thời gian từ Supabase
 */
export async function getUserOrdersByDateRange(
  userId: number,
  startDate: Date,
  endDate: Date,
  env: Env
): Promise<OrderData[]> {
  const records = await getUserOrdersByDateRangeFromSupabase(userId, startDate, endDate, env);
  return records.map(convertOrderRecordToOrderData);
}

/**
 * Hiển thị thống kê R cho user
 */
export async function showRiskUnitStatistics(
  userId: number,
  chatId: string,
  env: Env,
  startDate?: Date,
  endDate?: Date
): Promise<void> {
  let orders: OrderData[];

  if (startDate && endDate) {
    // Lấy orders trong khoảng thời gian
    orders = await getUserOrdersByDateRange(userId, startDate, endDate, env);
  } else {
    // Lấy tất cả orders
    orders = await getUserOrders(userId, env);
  }

  // Chỉ lấy orders có actualRiskRewardRatio (đã đóng lệnh)
  const closedOrders = orders.filter(
    (order) => order.actualRiskRewardRatio !== undefined
  );

  if (closedOrders.length === 0) {
    await sendMessageToTelegram(
      {
        chat_id: chatId,
        text: `📊 Thống kê R\n\nChưa có lệnh nào đã đóng để thống kê.`,
      },
      env
    );
    return;
  }

  const stats = calculateRiskUnitStatistics(closedOrders);

  // Format thống kê
  const dateRangeText =
    startDate && endDate
      ? `\n📅 Khoảng thời gian: ${startDate.toLocaleDateString('vi-VN')} - ${endDate.toLocaleDateString('vi-VN')}`
      : '';

  const summary = `
📊 Thống kê R (Risk Unit)

${dateRangeText}

📈 Tổng kết:
   • Tổng R: ${formatRiskUnit(stats.totalR)}
   ${stats.totalR > 0 ? '✅ (Lợi nhuận)' : stats.totalR < 0 ? '❌ (Thua lỗ)' : '⚪ (Hòa vốn)'}

📊 Chi tiết:
   • Tổng R lợi nhuận: +${stats.totalProfitR.toFixed(2)}R
   • Tổng R thua lỗ: ${stats.totalLossR > 0 ? '-' : ''}${stats.totalLossR.toFixed(2)}R
   • Số lệnh thắng: ${stats.winningOrders}
   • Số lệnh thua: ${stats.losingOrders}
   • Số lệnh hòa: ${stats.breakevenOrders}
   • Tổng số lệnh: ${stats.totalOrders}
   • Tỷ lệ thắng: ${stats.winRate.toFixed(1)}%

⏰ Thời gian: ${formatVietnamTime()}
  `.trim();

  await sendMessageToTelegram(
    {
      chat_id: chatId,
      text: summary,
    },
    env
  );
}

/**
 * Hiển thị thống kê tháng hiện tại
 */
export async function showMonthlyStatistics(
  userId: number,
  chatId: string,
  env: Env
): Promise<void> {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  await showRiskUnitStatistics(userId, chatId, env, startOfMonth, endOfMonth);
}

/**
 * Lấy order theo orderId từ Supabase
 */
export async function getOrderById(
  orderId: string,
  env: Env
): Promise<(OrderData & { orderId: string; userId: number; timestamp: number; updatedAt?: number }) | null> {
  const record = await getOrderByIdFromSupabase(orderId, env);
  if (!record) {
    return null;
  }
  return convertOrderRecordToOrderData(record);
}

/**
 * Cập nhật order với close price trong Supabase
 */
export async function updateOrderWithClosePrice(
  orderId: string,
  closePrice: number,
  env: Env
): Promise<OrderData | null> {
  const record = await updateOrderWithClosePriceInSupabase(orderId, closePrice, env);
  if (!record) {
    return null;
  }
  return convertOrderRecordToOrderData(record);
}

/**
 * Lấy danh sách orders chưa có close price (chưa đóng lệnh)
 */
export async function getOpenOrders(
  userId: number,
  env: Env,
  limit: number = 10
): Promise<(OrderData & { orderId: string; timestamp: number })[]> {
  const allOrders = await getUserOrders(userId, env);
  
  // Lọc các orders chưa có actualRiskRewardRatio (chưa đóng)
  const openOrders = allOrders
    .filter((order) => {
      const orderWithMeta = order as OrderData & { orderId: string; timestamp: number };
      return (
        orderWithMeta.orderId &&
        order.actualRiskRewardRatio === undefined
      );
    })
    .sort((a, b) => {
      const aTime = (a as OrderData & { timestamp: number }).timestamp || 0;
      const bTime = (b as OrderData & { timestamp: number }).timestamp || 0;
      return bTime - aTime; // Mới nhất trước
    })
    .slice(0, limit);

  return openOrders as (OrderData & { orderId: string; timestamp: number })[];
}

/**
 * Hiển thị danh sách orders để chọn update
 */
export async function showOrderSelectionForUpdate(
  userId: number,
  chatId: string,
  env: Env
): Promise<void> {
  const openOrders = await getOpenOrders(userId, env, 10);

  if (openOrders.length === 0) {
    await sendMessageToTelegram(
      {
        chat_id: chatId,
        text: `📋 Không có lệnh nào chưa đóng để cập nhật.`,
      },
      env
    );
    return;
  }

  // Tạo inline keyboard với danh sách orders
  const keyboard: TelegramInlineKeyboardMarkup = {
    inline_keyboard: openOrders.map((order, index) => {
      const orderWithMeta = order as OrderData & { orderId: string; timestamp: number };
      const date = orderWithMeta.timestamp
        ? new Date(orderWithMeta.timestamp).toLocaleDateString('vi-VN')
        : 'N/A';
      return [
        {
          text: `${index + 1}. ${order.symbol || 'N/A'} ${order.direction || ''} - ${date}`,
          callback_data: `update_order_${orderWithMeta.orderId}`,
        },
      ];
    }),
  };

  let message = `📋 Chọn lệnh cần cập nhật close price:\n\n`;
  openOrders.forEach((order, index) => {
    const orderWithMeta = order as OrderData & { orderId: string; timestamp: number };
    const date = orderWithMeta.timestamp
      ? new Date(orderWithMeta.timestamp).toLocaleDateString('vi-VN')
      : 'N/A';
    message += `${index + 1}. ${order.symbol || 'N/A'} ${order.direction || ''} - Entry: ${order.entry || 'N/A'} - ${date}\n`;
  });

  await sendMessageToTelegram(
    {
      chat_id: chatId,
      text: message,
      reply_markup: keyboard,
    },
    env
  );
}

/**
 * Hiển thị danh sách orders để xem chi tiết
 */
export async function showOrderListForView(
  userId: number,
  chatId: string,
  env: Env,
  limit: number = 20
): Promise<void> {
  const allOrders = await getUserOrders(userId, env);
  
  if (allOrders.length === 0) {
    await sendMessageToTelegram(
      {
        chat_id: chatId,
        text: `📋 Không có lệnh nào.`,
      },
      env
    );
    return;
  }

  // Sắp xếp theo thời gian mới nhất trước
  const sortedOrders = allOrders
    .filter((order) => {
      const orderWithMeta = order as OrderData & { orderId: string; timestamp: number };
      return orderWithMeta.orderId && orderWithMeta.timestamp;
    })
    .sort((a, b) => {
      const aTime = (a as OrderData & { timestamp: number }).timestamp || 0;
      const bTime = (b as OrderData & { timestamp: number }).timestamp || 0;
      return bTime - aTime; // Mới nhất trước
    })
    .slice(0, limit);

  // Tạo inline keyboard với danh sách orders
  const keyboard: TelegramInlineKeyboardMarkup = {
    inline_keyboard: sortedOrders.map((order, index) => {
      const orderWithMeta = order as OrderData & { orderId: string; timestamp: number };
      const date = orderWithMeta.timestamp
        ? new Date(orderWithMeta.timestamp).toLocaleDateString('vi-VN')
        : 'N/A';
      const status = order.actualRiskRewardRatio !== undefined ? '✅' : '⏳';
      return [
        {
          text: `${status} ${index + 1}. ${order.symbol || 'N/A'} ${order.direction || ''} - ${date}`,
          callback_data: `view_order_${orderWithMeta.orderId}`,
        },
      ];
    }),
  };

  let message = `📋 Danh sách lệnh (${sortedOrders.length}/${allOrders.length}):\n\n`;
  message += `✅ = Đã đóng | ⏳ = Chưa đóng\n\n`;
  
  sortedOrders.forEach((order, index) => {
    const orderWithMeta = order as OrderData & { orderId: string; timestamp: number };
    const date = orderWithMeta.timestamp
      ? new Date(orderWithMeta.timestamp).toLocaleDateString('vi-VN')
      : 'N/A';
    const status = order.actualRiskRewardRatio !== undefined ? '✅' : '⏳';
    message += `${status} ${index + 1}. ${order.symbol || 'N/A'} ${order.direction || ''} - Entry: ${order.entry || 'N/A'} - ${date}\n`;
  });

  await sendMessageToTelegram(
    {
      chat_id: chatId,
      text: message,
      reply_markup: keyboard,
    },
    env
  );
}

/**
 * Hiển thị chi tiết một order
 */
export async function showOrderDetails(
  orderId: string,
  chatId: string,
  env: Env
): Promise<void> {
  const order = await getOrderById(orderId, env);
  
  if (!order) {
    await sendMessageToTelegram(
      {
        chat_id: chatId,
        text: '❌ Không tìm thấy lệnh này.',
      },
      env
    );
    return;
  }

  const orderWithMeta = order as OrderData & { orderId: string; timestamp: number; updatedAt?: number };
  const date = orderWithMeta.timestamp
    ? new Date(orderWithMeta.timestamp).toLocaleDateString('vi-VN') + ' ' + new Date(orderWithMeta.timestamp).toLocaleTimeString('vi-VN')
    : 'N/A';
  const updatedDate = orderWithMeta.updatedAt
    ? new Date(orderWithMeta.updatedAt).toLocaleDateString('vi-VN') + ' ' + new Date(orderWithMeta.updatedAt).toLocaleTimeString('vi-VN')
    : null;

  const formatRiskUnit = (ratio: number | undefined | null): string => {
    if (ratio === undefined || ratio === null) return 'N/A';
    if (ratio > 0) {
      return `+${ratio.toFixed(2)}R`;
    } else if (ratio < 0) {
      return `${ratio.toFixed(2)}R`;
    }
    return '0R';
  };

  // Helper function to safely format numbers with toFixed
  const safeToFixed = (value: number | undefined | null, decimals: number, fallback: string = 'N/A'): string => {
    if (value === undefined || value === null || isNaN(value)) return fallback;
    return value.toFixed(decimals);
  };

  let details = `
📋 Chi tiết lệnh

📊 Thông tin cơ bản:
   • Symbol: ${order.symbol || 'N/A'}
   • Direction: ${order.direction || 'N/A'}
   • HARSI 1D: ${formatHarsiValue(order.harsi1d)}
   • HARSI 12H: ${formatHarsiValue(order.harsi12h)}
   • HARSI 8H: ${formatHarsiValue(order.harsi8h)}
   • HARSI 6H: ${formatHarsiValue(order.harsi6h)}
   • HARSI 4H: ${formatHarsiValue(order.harsi4h)}
   • Entry: ${order.entry || 'N/A'}
   • Stop Loss: ${order.stopLoss || 'N/A'}
   • Take Profit: ${order.takeProfit || 'N/A'}
   • Quantity: ${order.quantity || 'N/A'}
   • Tạo lúc: ${date}
   ${updatedDate ? `   • Cập nhật lúc: ${updatedDate}` : ''}
  `.trim();

  // Thông tin rủi ro tiềm năng
  if (order.potentialStopLoss !== undefined && order.potentialStopLoss !== null) {
    details += `\n\n📉 Rủi ro tiềm năng:`;
    details += `\n   • Potential Stop Loss: ${safeToFixed(order.potentialStopLoss, 4)} (${safeToFixed(order.potentialStopLossPercent, 2)}%)`;
    details += `\n   • Potential Stop Loss USD: $${safeToFixed(order.potentialStopLossUsd, 2)}`;
  }

  if (order.potentialProfit !== undefined && order.potentialProfit !== null) {
    details += `\n\n📈 Lợi nhuận tiềm năng:`;
    details += `\n   • Potential Profit: ${safeToFixed(order.potentialProfit, 4)} (${safeToFixed(order.potentialProfitPercent, 2)}%)`;
    details += `\n   • Potential Profit USD: $${safeToFixed(order.potentialProfitUsd, 2)}`;
  }

  if (order.potentialRiskRewardRatio !== undefined && order.potentialRiskRewardRatio !== null) {
    details += `\n   • Potential Risk/Reward: 1:${safeToFixed(order.potentialRiskRewardRatio, 2)}`;
  }

  // Thông tin kết quả thực tế (nếu đã đóng)
  if (order.actualRiskRewardRatio !== undefined && order.actualRiskRewardRatio !== null) {
    details += `\n\n📊 Kết quả thực tế:`;
    details += `\n   • R: ${formatRiskUnit(order.actualRiskRewardRatio)}`;
    const ratioPercent = order.actualRiskRewardRatio * 100;
    details += `\n   ${order.actualRiskRewardRatio > 0
      ? `(Lợi nhuận ${safeToFixed(ratioPercent, 1)}% rủi ro)`
      : `(Thua lỗ ${safeToFixed(Math.abs(ratioPercent), 1)}% rủi ro)`}`;
    
    if (order.actualRealizedPnL !== undefined && order.actualRealizedPnL !== null) {
      const pnlSign = order.actualRealizedPnL > 0 ? '+' : '';
      const pnlUsdSign = order.actualRealizedPnLUsd && order.actualRealizedPnLUsd > 0 ? '+' : '';
      const pnlPercentSign = order.actualRealizedPnLPercent && order.actualRealizedPnLPercent > 0 ? '+' : '';
      details += `\n   • Actual PnL: ${pnlSign}${safeToFixed(order.actualRealizedPnL, 4)}`;
      details += `\n   • Actual PnL USD: ${pnlUsdSign}$${safeToFixed(order.actualRealizedPnLUsd, 2)}`;
      details += `\n   • Actual PnL %: ${pnlPercentSign}${safeToFixed(order.actualRealizedPnLPercent, 2)}%`;
    }
  } else {
    details += `\n\n⏳ Lệnh chưa đóng`;
  }

  // Notes
  if (order.notes) {
    details += `\n\n📝 Notes:\n${order.notes}`;
  }

  await sendMessageToTelegram(
    {
      chat_id: chatId,
      text: details,
    },
    env
  );
}

