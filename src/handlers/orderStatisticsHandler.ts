/**
 * Handler để thống kê và hiển thị tổng hợp R từ các orders
 */

import { Env } from '../types/env';
import { OrderData, CallbackDataPrefix, OrderResult } from '../types/orderTypes';
import { sendMessageToTelegram, TelegramInlineKeyboardMarkup, TelegramParseMode } from '../services/telegramService';
import { formatVietnamTime, formatVietnamTimeShort } from '../utils/timeUtils';
import { formatHarsiValue, OrderResultIcon } from '../utils/formatUtils';
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
  deleteOrderFromSupabase,
  getOpenOrdersForUser,
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
 * Helper functions to calculate date ranges for different periods
 */
function getCurrentMonthRange(): { start: Date; end: Date } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  return { start, end };
}

function getPreviousMonthRange(): { start: Date; end: Date } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
  return { start, end };
}

function getCurrentWeekRange(): { start: Date; end: Date } {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); // Adjust to Monday
  const start = new Date(now.getFullYear(), now.getMonth(), diff);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function getPreviousWeekRange(): { start: Date; end: Date } {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1) - 7; // Previous week
  const start = new Date(now.getFullYear(), now.getMonth(), diff);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

/**
 * Hiển thị menu thống kê với các tùy chọn
 */
export async function showStatisticsMenu(
  userId: number,
  chatId: string,
  env: Env
): Promise<void> {
  const keyboard: TelegramInlineKeyboardMarkup = {
    inline_keyboard: [
      [
        {
          text: '📊 Tất cả',
          callback_data: CallbackDataPrefix.STATS_ALL,
        },
      ],
      [
        {
          text: '📅 Tháng này',
          callback_data: CallbackDataPrefix.STATS_CURRENT_MONTH,
        },
        {
          text: '📅 Tháng trước',
          callback_data: CallbackDataPrefix.STATS_PREVIOUS_MONTH,
        },
      ],
      [
        {
          text: '📆 Tuần này',
          callback_data: CallbackDataPrefix.STATS_CURRENT_WEEK,
        },
        {
          text: '📆 Tuần trước',
          callback_data: CallbackDataPrefix.STATS_PREVIOUS_WEEK,
        },
      ],
    ],
  };

  const message = `📊 Menu Thống kê\n\nChọn khoảng thời gian để xem thống kê:`;

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
 * Hiển thị thống kê cho tất cả orders
 */
export async function showAllStatistics(
  userId: number,
  chatId: string,
  env: Env
): Promise<void> {
  await showRiskUnitStatistics(userId, chatId, env);
}

/**
 * Hiển thị thống kê cho tháng hiện tại
 */
export async function showCurrentMonthStatistics(
  userId: number,
  chatId: string,
  env: Env
): Promise<void> {
  const { start, end } = getCurrentMonthRange();
  await showRiskUnitStatistics(userId, chatId, env, start, end);
}

/**
 * Hiển thị thống kê cho tháng trước
 */
export async function showPreviousMonthStatistics(
  userId: number,
  chatId: string,
  env: Env
): Promise<void> {
  const { start, end } = getPreviousMonthRange();
  await showRiskUnitStatistics(userId, chatId, env, start, end);
}

/**
 * Hiển thị thống kê cho tuần hiện tại
 */
export async function showCurrentWeekStatistics(
  userId: number,
  chatId: string,
  env: Env
): Promise<void> {
  const { start, end } = getCurrentWeekRange();
  await showRiskUnitStatistics(userId, chatId, env, start, end);
}

/**
 * Hiển thị thống kê cho tuần trước
 */
export async function showPreviousWeekStatistics(
  userId: number,
  chatId: string,
  env: Env
): Promise<void> {
  const { start, end } = getPreviousWeekRange();
  await showRiskUnitStatistics(userId, chatId, env, start, end);
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
  const records = await getOpenOrdersForUser(userId, env);
  const allOrders = records.map(convertOrderRecordToOrderData);
  
  // Lọc các orders chưa có actualRiskRewardRatio (chưa đóng)
  const openOrders = allOrders
    .filter((order) => {
      const orderWithMeta = order as OrderData & { orderId: string; timestamp: number };
      return (
        orderWithMeta.orderId &&
        !order.actualRiskRewardRatio
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
          callback_data: `${CallbackDataPrefix.CLOSE_ORDER}${orderWithMeta.orderId}`,
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
 * Hiển thị menu quản lý orders với inline keyboard và danh sách orders
 */
export async function showOrderMenu(
  userId: number,
  chatId: string,
  env: Env
): Promise<void> {
  // Menu buttons
  const menuButtons = [
    [
      {
        text: '➕ Tạo lệnh mới',
        callback_data: CallbackDataPrefix.ORDER_NEW,
      },
      {
        text: '📜 Xem tất cả lệnh',
        callback_data: CallbackDataPrefix.ORDER_VIEW,
      },
    ],
    [
      {
        text: '👀 Xem preview',
        callback_data: CallbackDataPrefix.ORDER_PREVIEW,
      },
      {
        text: '❌ Hủy lệnh',
        callback_data: CallbackDataPrefix.ORDER_CANCEL,
      },
    ],
  ];

  // Get orders list
  const allOrders = await getOpenOrders(userId, env);
  
  // Build order list buttons
  const orderButtons: TelegramInlineKeyboardMarkup['inline_keyboard'] = [];
  
  if (allOrders.length > 0) {
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
      .slice(0, 20); // Limit to 20 orders

    // Add order buttons
    sortedOrders.forEach((order) => {
      const orderWithMeta = order as OrderData & { orderId: string; timestamp: number };
      const statusKey = order.orderResult ?? OrderResult.IN_PROGRESS;
      const status = OrderResultIcon[statusKey].join('');
      
      // Format date and time using Vietnam time utility (short format)
      const dateTimeStr = orderWithMeta.timestamp 
        ? formatVietnamTimeShort(new Date(orderWithMeta.timestamp))
        : 'N/A';
      
      // Format entry price (no decimals)
      const entryStr = order.entry ? Math.round(order.entry).toString() : 'N/A';
      const directionStr = order.direction ? order.direction.toUpperCase() : '';
      // Remove USDT suffix from symbol (e.g., BTCUSDT -> BTC)
      const symbolStr = order.symbol ? order.symbol.replace(/USDT$/i, '') : 'N/A';
      
      // Create compact button text
      // Format: ✅ BTC LONG | $50000 | 25/12 14:30
      const buttonText = `${status} ${symbolStr} ${directionStr} | $${entryStr} | ${dateTimeStr}`;
      
      orderButtons.push([
        {
          text: buttonText,
          callback_data: `${CallbackDataPrefix.VIEW_ORDER}${orderWithMeta.orderId}`,
        },
      ]);
    });
  }

  // Add separator row (non-clickable visual separator)
  orderButtons.push([
    {
      text: '━━━━━━━━━━━━━━━━',
      callback_data: 'order_separator',
    },
  ]);
  
  // Combine menu and order buttons
  const keyboard: TelegramInlineKeyboardMarkup = {
    inline_keyboard: [...orderButtons, ...menuButtons],
  };

  // Build message
  let message = '📋 Menu quản lý lệnh mở\nChọn một hành động:';
  
  if (allOrders.length > 0) {
    message += `\n⏳ Đang mở: ${allOrders.length} lệnh\n` +
      `👉 Chọn lệnh bên dưới để xem chi tiết hoặc cập nhật:`;
  } else {
    message += `\n\n📋 Hiện không có lệnh mở nào.`;
  }

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
    inline_keyboard: sortedOrders.map((order) => {
      const orderWithMeta = order as OrderData & { orderId: string; timestamp: number };
      const status = order.orderResult !== undefined ? '✅' : '⏳';
      
      // Format date and time using Vietnam time utility (short format)
      const dateTimeStr = orderWithMeta.timestamp 
        ? formatVietnamTimeShort(new Date(orderWithMeta.timestamp))
        : 'N/A';
      
      // Format entry price (no decimals)
      const entryStr = order.entry ? Math.round(order.entry).toString() : 'N/A';
      const directionStr = order.direction ? order.direction.toUpperCase() : '';
      // Remove USDT suffix from symbol (e.g., BTCUSDT -> BTC)
      const symbolStr = order.symbol ? order.symbol.replace(/USDT$/i, '') : 'N/A';
      
      // Create compact button text
      // Format: ✅ BTC LONG | $50000 | 25/12 14:30
      const buttonText = `${status} ${symbolStr} ${directionStr} | $${entryStr} | ${dateTimeStr}`;
      
      return [
        {
          text: buttonText,
          callback_data: `${CallbackDataPrefix.VIEW_ORDER}${orderWithMeta.orderId}`,
        },
      ];
    }),
  };

  // Simplified message without full list
  const closedCount = sortedOrders.filter(order => order.orderResult && order.orderResult !== OrderResult.IN_PROGRESS).length;
  const openCount = sortedOrders.length - closedCount;
  
  const message = `📋 Danh sách lệnh\n\n` +
    `📊 Tổng số: ${sortedOrders.length}/${allOrders.length} lệnh\n` +
    `✅ Đã đóng: ${closedCount}\n` +
    `⏳ Chưa đóng: ${openCount}\n\n` +
    `👉 Chọn lệnh bên dưới để xem chi tiết:`;

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
   • HARSI 1W: ${formatHarsiValue(order.harsi1w)}
   • HARSI 3D: ${formatHarsiValue(order.harsi3d)}
   • HARSI 2D: ${formatHarsiValue(order.harsi2d)}
   • HARSI 1D: ${formatHarsiValue(order.harsi1d)}
   • HARSI 8H: ${formatHarsiValue(order.harsi8h)}
   • HARSI 4H: ${formatHarsiValue(order.harsi4h)}
   • Entry: ${order.entry || 'N/A'}
   • Stop Loss: ${order.stopLoss || 'N/A'}
   • Take Profit: ${order.takeProfit || 'N/A'}
   • Quantity: ${order.quantity || 'N/A'}
   ${!order?.actualClosePrice ? '' : `   • Close Price: ${safeToFixed(order.actualClosePrice as number, 2, 'N/A')}`}
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
    if (order.orderResult) {
      const statusKey = order.orderResult;
      const statusEmojis = OrderResultIcon[statusKey];
      const resultEmoji = statusEmojis.join('');
      const resultText = statusKey === OrderResult.WIN ? 'WIN' : statusKey === OrderResult.LOSS ? 'LOSS' : statusKey === OrderResult.BREAKEVEN ? 'BREAKEVEN' : 'IN_PROGRESS';
      details += `\n   • Kết quả: ${resultEmoji} ${resultText}`;
    }
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

  // Add update and delete buttons
  // Only show "Đóng lệnh" button if order is not closed (still in progress)
  const isOrderClosed = order.orderResult && order.orderResult !== OrderResult.IN_PROGRESS;
  const keyboardButtons: Array<Array<{ text: string; callback_data: string }>> = [];
  
  if (!isOrderClosed) {
    keyboardButtons.push([
      {
        text: '🔒 Đóng lệnh',
        callback_data: `${CallbackDataPrefix.CLOSE_ORDER}${orderWithMeta.orderId}`,
      },
    ]);
  }
  
  keyboardButtons.push([
    {
      text: '🗑️ Xóa lệnh',
      callback_data: `${CallbackDataPrefix.DELETE_ORDER}${orderWithMeta.orderId}`,
    },
  ]);
  
  const keyboard: TelegramInlineKeyboardMarkup = {
    inline_keyboard: keyboardButtons,
  };

  await sendMessageToTelegram(
    {
      chat_id: chatId,
      text: details,
      reply_markup: keyboard,
    },
    env
  );
}

/**
 * Show delete order confirmation dialog
 */
export async function showDeleteOrderConfirmation(
  orderId: string,
  userId: number,
  chatId: string,
  env: Env
): Promise<void> {
  // First verify the order exists and belongs to the user
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

  const orderWithMeta = order as OrderData & { userId: number; orderId: string; timestamp: number };
  
  // Verify ownership
  if (orderWithMeta.userId !== userId) {
    await sendMessageToTelegram(
      {
        chat_id: chatId,
        text: '❌ Bạn không có quyền xóa lệnh này.',
      },
      env
    );
    return;
  }

  // Format order info for confirmation message
  const symbolStr = order.symbol ? order.symbol.replace(/USDT$/i, '') : 'N/A';
  const directionStr = order.direction ? order.direction.toUpperCase() : 'N/A';
  const entryStr = order.entry ? Math.round(order.entry).toString() : 'N/A';
  
  // Format date/time
  const dateTimeStr = orderWithMeta.timestamp 
    ? formatVietnamTimeShort(new Date(orderWithMeta.timestamp))
    : 'N/A';

  const confirmationKeyboard: TelegramInlineKeyboardMarkup = {
    inline_keyboard: [
      [
        {
          text: '✅ Xác nhận xóa',
          callback_data: `${CallbackDataPrefix.DELETE_ORDER_CONFIRM}${orderId}`,
        },
        {
          text: '❌ Hủy',
          callback_data: CallbackDataPrefix.DELETE_ORDER_CANCEL,
        },
      ],
    ],
  };

  const message = `⚠️ Xác nhận xóa lệnh\n\n` +
    `📊 Thông tin lệnh:\n` +
    `   • Symbol: ${symbolStr}\n` +
    `   • Direction: ${directionStr}\n` +
    `   • Entry: $${entryStr}\n` +
    `   • Tạo lúc: ${dateTimeStr}\n\n` +
    `Bạn có chắc chắn muốn xóa lệnh này?`;

  await sendMessageToTelegram(
    {
      chat_id: chatId,
      text: message,
      reply_markup: confirmationKeyboard,
    },
    env
  );
}

/**
 * Delete an order
 */
export async function deleteOrder(
  orderId: string,
  userId: number,
  chatId: string,
  env: Env
): Promise<void> {
  // First verify the order exists and belongs to the user
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

  const orderWithMeta = order as OrderData & { userId: number };
  
  // Verify ownership
  if (orderWithMeta.userId !== userId) {
    await sendMessageToTelegram(
      {
        chat_id: chatId,
        text: '❌ Bạn không có quyền xóa lệnh này.',
      },
      env
    );
    return;
  }

  try {
    await deleteOrderFromSupabase(orderId, env);
    await sendMessageToTelegram(
      {
        chat_id: chatId,
        text: '✅ Đã xóa lệnh thành công.',
      },
      env
    );
  } catch (error) {
    console.error('Error deleting order:', error);
    await sendMessageToTelegram(
      {
        chat_id: chatId,
        text: `❌ Lỗi khi xóa lệnh: ${(error as Error).message}`,
      },
      env
    );
  }
}

/**
 * Hiển thị menu kinh nghiệm với các tùy chọn
 */
export async function showExperienceMenu(
  chatId: string,
  env: Env
): Promise<void> {
  const keyboard: TelegramInlineKeyboardMarkup = {
    inline_keyboard: [
      [
        {
          text: '🤖 Phân tích AI',
          callback_data: CallbackDataPrefix.ORDER_ANALYZE,
        },
        {
          text: '📖 Cách thoát hàng',
          callback_data: CallbackDataPrefix.EXIT_GUIDE,
        },
      ],
    ],
  };

  const message = '📚 **Menu Kinh nghiệm**\n\nChọn một tùy chọn:';

  await sendMessageToTelegram(
    {
      chat_id: chatId,
      text: message,
      reply_markup: keyboard,
      parse_mode: TelegramParseMode.Markdown,
    },
    env
  );
}

/**
 * Hiển thị hướng dẫn cách thoát hàng
 */
export async function showExitGuide(
  chatId: string,
  env: Env
): Promise<void> {
  const guideMessage = `📖 **Cách thoát hàng**

**1. Thoát hàng theo Stop Loss:**
• Khi giá chạm Stop Loss → Tự động đóng lệnh
• Đây là cách bảo vệ vốn khi thị trường đi ngược

**2. Thoát hàng theo Take Profit:**
• Khi giá chạm Take Profit → Tự động đóng lệnh
• Đây là cách chốt lời khi đạt mục tiêu

**3. Thoát hàng thủ công:**
• Sử dụng lệnh "Cập nhật lệnh" → Nhập giá đóng thực tế
• Áp dụng khi muốn đóng sớm hoặc muốn điều chỉnh

**4. Quy tắc Risk/Reward:**
• Luôn đặt Stop Loss và Take Profit
• Tỷ lệ R:R tối thiểu nên là 1:2 (rủi ro 1, lợi nhuận 2)
• Không bao giờ để lệnh không có Stop Loss

**5. Quản lý tâm lý:**
• Tuân thủ kế hoạch đã đặt ra
• Không FOMO (Fear Of Missing Out)
• Không để cảm xúc chi phối quyết định`;

  await sendMessageToTelegram(
    {
      chat_id: chatId,
      text: guideMessage,
      parse_mode: TelegramParseMode.Markdown,
    },
    env
  );
}

