import { OrderData, OrderDirection } from '../types/orderTypes';

/**
 * Interface cho thống kê tổng hợp R
 */
export interface RiskUnitStatistics {
  totalR: number; // Tổng R (dương = lời, âm = lỗ, có thể âm hoặc dương, không tính lệnh hòa)
  totalProfitR: number; // Tổng R lợi nhuận (chỉ tính các lệnh lời, luôn dương)
  totalLossR: number; // Tổng R thua lỗ (chỉ tính các lệnh lỗ, luôn dương - giá trị tuyệt đối)
  totalOrders: number; // Tổng số lệnh
  winningOrders: number; // Số lệnh thắng (r > 0.2)
  losingOrders: number; // Số lệnh thua (r < -0.2)
  breakevenOrders: number; // Số lệnh hòa (r trong khoảng -0.2 đến 0.2)
  winRate: number; // Tỷ lệ thắng (%)
}

/**
 * Calculates expected and actual loss fields for an order.
 * - potentialStopLoss: entry - stopLoss (LONG) or stopLoss - entry (SHORT)
 * - potentialStopLossUsd: potentialStopLoss * quantity
 * - potentialStopLossPercent: (potentialStopLoss / entry) * 100
 * - actualRealizedPnL: closePrice - entry (LONG) or entry - closePrice (SHORT)
 * - actualRealizedPnLUsd: actualRealizedPnL * quantity
 * - actualRealizedPnLPercent: (actualRealizedPnL / entry) * 100
 * - potentialProfit: takeProfit - entry (LONG) or entry - takeProfit (SHORT)
 * - potentialProfitUsd: potentialProfit * quantity
 * - potentialProfitPercent: (potentialProfit / entry) * 100
 * - potentialRiskRewardRatio: potentialProfit / potentialStopLoss
 * - actualRiskRewardRatio: actualRealizedPnL / potentialStopLoss
 *
 * @param data OrderData object
 * @param closePrice (optional) close price when order is closed
 * @returns OrderData with calculated fields
 */
export function calculateOrderLoss(
  data: OrderData,
  closePrice?: number
): OrderData {
  let potentialStopLoss: number | undefined = undefined;
  let potentialStopLossUsd: number | undefined = undefined;
  let potentialStopLossPercent: number | undefined = undefined;
  let actualRealizedPnL: number | undefined = undefined;
  let actualRealizedPnLUsd: number | undefined = undefined;
  let actualRealizedPnLPercent: number | undefined = undefined;
  let potentialProfit: number | undefined = undefined;
  let potentialProfitUsd: number | undefined = undefined;
  let potentialProfitPercent: number | undefined = undefined;
  let potentialRiskRewardRatio: number | undefined = undefined;
  let actualRiskRewardRatio: number | undefined = undefined;

  const isLong = data.direction === OrderDirection.LONG;
  const isShort = data.direction === OrderDirection.SHORT;

  // Calculate potential loss (stop loss scenario)
  if (typeof data.entry === 'number' && typeof data.stopLoss === 'number') {
    if (isLong) {
      // LONG: loss when price drops below stop loss
      potentialStopLoss = data.entry - data.stopLoss;
    } else if (isShort) {
      // SHORT: loss when price rises above stop loss
      potentialStopLoss = data.stopLoss - data.entry;
    } else {
      // Default to LONG behavior if direction not specified
      potentialStopLoss = Math.abs(data.entry - data.stopLoss);
    }
    
    if (data.entry > 0) {
      potentialStopLossPercent = (potentialStopLoss / data.entry) * 100;
    }
    if (typeof data.quantity === 'number') {
      potentialStopLossUsd = potentialStopLoss * data.quantity;
    }
  }

  // Calculate actual realized PnL (if close price provided)
  // Positive = profit, Negative = loss
  if (
    typeof data.entry === 'number' &&
    typeof closePrice === 'number'
  ) {
    if (isLong) {
      // LONG: positive = profit (price went up), negative = loss (price went down)
      actualRealizedPnL = closePrice - data.entry;
    } else if (isShort) {
      // SHORT: positive = profit (price went down), negative = loss (price went up)
      actualRealizedPnL = data.entry - closePrice;
    } else {
      // Default: use absolute value if direction not specified
      actualRealizedPnL = Math.abs(closePrice - data.entry);
    }
    
    if (data.entry > 0) {
      actualRealizedPnLPercent = (actualRealizedPnL / data.entry) * 100;
    }
    if (typeof data.quantity === 'number') {
      actualRealizedPnLUsd = actualRealizedPnL * data.quantity;
    }
  }

  // Calculate potential profit (take profit scenario)
  if (typeof data.entry === 'number' && typeof data.takeProfit === 'number') {
    if (isLong) {
      // LONG: profit when price rises above take profit
      potentialProfit = data.takeProfit - data.entry;
    } else if (isShort) {
      // SHORT: profit when price drops below take profit
      potentialProfit = data.entry - data.takeProfit;
    } else {
      potentialProfit = Math.abs(data.takeProfit - data.entry);
    }
    
    if (data.entry > 0) {
      potentialProfitPercent = (potentialProfit / data.entry) * 100;
    }
    if (typeof data.quantity === 'number') {
      potentialProfitUsd = potentialProfit * data.quantity;
    }
  }

  // Calculate potential risk/reward ratio
  if (
    typeof data.entry === 'number' &&
    typeof data.stopLoss === 'number' &&
    typeof data.takeProfit === 'number' &&
    potentialStopLoss !== undefined &&
    potentialStopLoss > 0 &&
    potentialProfit !== undefined
  ) {
    potentialRiskRewardRatio = potentialProfit / potentialStopLoss;
  }

  // Tính tỷ lệ Risk/Reward thực tế (khi đóng lệnh sớm)
  // So sánh kết quả thực tế với rủi ro tiềm năng ban đầu
  // Giá trị DƯƠNG = lợi nhuận, giá trị ÂM = thua lỗ
  // actualRealizedPnL: dương = lợi nhuận, âm = thua lỗ
  if (
    actualRealizedPnL !== undefined &&
    potentialStopLoss !== undefined &&
    potentialStopLoss > 0
  ) {
    // actualRealizedPnL đã đúng dấu: dương = lợi nhuận, âm = thua lỗ
    actualRiskRewardRatio = actualRealizedPnL / potentialStopLoss;
  }

  return {
    ...data,
    potentialStopLoss,
    potentialStopLossUsd,
    potentialStopLossPercent,
    potentialProfit,
    potentialProfitUsd,
    potentialProfitPercent,
    potentialRiskRewardRatio,
    actualRealizedPnL,
    actualRealizedPnLUsd,
    actualRealizedPnLPercent,
    actualRiskRewardRatio,
  };
}

/**
 * Tính tổng hợp thống kê R từ một mảng các orders
 * 
 * @param orders Mảng các OrderData đã có actualRiskRewardRatio
 * @returns Thống kê tổng hợp
 * 
 * Lưu ý: actualRiskRewardRatio - Positive = profit (lợi nhuận), Negative = loss (thua lỗ)
 * 
 * @example
 * const orders = [
 *   { actualRiskRewardRatio: +1.5 }, // Lời 1.5R (positive = profit, > 0.2)
 *   { actualRiskRewardRatio: -0.5 }, // Lỗ 0.5R (negative = loss, < -0.2)
 *   { actualRiskRewardRatio: +2.0 }, // Lời 2R (positive = profit, > 0.2)
 *   { actualRiskRewardRatio: 0 },    // Hòa 0R (trong khoảng -0.2 đến 0.2)
 *   { actualRiskRewardRatio: +0.1 }, // Hòa 0.1R (trong khoảng -0.2 đến 0.2)
 *   { actualRiskRewardRatio: -0.15 }, // Hòa -0.15R (trong khoảng -0.2 đến 0.2)
 * ];
 * const stats = calculateRiskUnitStatistics(orders);
 * // stats.totalR = +3.0 (tổng cộng lời 3R, có thể âm nếu tổng lỗ)
 * // stats.totalProfitR = 3.5 (tổng lời 3.5R, luôn dương)
 * // stats.totalLossR = 0.5 (tổng lỗ 0.5R, luôn dương - giá trị tuyệt đối)
 * // stats.winningOrders = 2 (2 lệnh thắng)
 * // stats.losingOrders = 1 (1 lệnh thua)
 * // stats.breakevenOrders = 1 (1 lệnh hòa)
 */
export function calculateRiskUnitStatistics(
  orders: OrderData[]
): RiskUnitStatistics {
  let totalR = 0;
  let totalProfitR = 0;
  let totalLossR = 0;
  let winningOrders = 0;
  let losingOrders = 0;
  let breakevenOrders = 0;

  orders.forEach((order) => {
    if (order.actualRiskRewardRatio !== undefined) {
      const r = order.actualRiskRewardRatio;
      
      // Nếu trong khoảng -0.2 đến 0.2 thì tính là hòa
      if (r >= -0.2 && r <= 0.2) {
        // Hòa vốn (r trong khoảng -0.2 đến 0.2)
        breakevenOrders++;
        // Vẫn cộng vào totalProfitR nếu dương (0 -> 0.2), hoặc totalLossR nếu âm (-0.2 -> 0)
        if (r > 0) {
          totalProfitR += r;
        } else if (r < 0) {
          totalLossR += Math.abs(r);
        }
        // Không cộng vào totalR vì coi như hòa vốn
      } else if (r > 0.2) {
        // Lợi nhuận (giá trị dương > 0.2)
        totalR += r;
        totalProfitR += r;
        winningOrders++;
      } else {
        // Thua lỗ (giá trị âm < -0.2)
        totalR += r;
        totalLossR += Math.abs(r);
        losingOrders++;
      }
    }
  });

  const totalOrders = orders.length;
  const winRate = totalOrders > 0 ? (winningOrders / totalOrders) * 100 : 0;

  return {
    totalR,
    totalProfitR,
    totalLossR,
    totalOrders,
    winningOrders,
    losingOrders,
    breakevenOrders,
    winRate,
  };
}

/**
 * Format số R để hiển thị
 * 
 * @param r Giá trị R (có thể âm hoặc dương)
 * @returns String format như "+1.5R" hoặc "-2.0R"
 */
export function formatRiskUnit(r: number): string {
  if (r > 0) {
    return `+${r.toFixed(2)}R`;
  } else if (r < 0) {
    return `${r.toFixed(2)}R`;
  }
  return '0R';
}
