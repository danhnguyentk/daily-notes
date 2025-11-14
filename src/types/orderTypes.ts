/**
 * Types for order conversation flow
 */
export interface OrderData {
  symbol?: string;
  direction?: 'LONG' | 'SHORT';
  entry?: number;
  stopLoss?: number;
  takeProfit?: number;
  quantity?: number;
  notes?: string;

  /**
   * Potential loss if stopLoss is hit (entry - stopLoss for LONG, stopLoss - entry for SHORT)
   */
  potentialStopLoss?: number;
  /**
   * Potential USD loss if stopLoss is hit (potentialStopLoss * quantity)
   */
  potentialStopLossUsd?: number;
  /**
   * Potential loss percentage if stopLoss is hit ((potentialStopLoss / entry) * 100)
   */
  potentialStopLossPercent?: number;

  /**
   * Potential profit if takeProfit is hit (takeProfit - entry)
   */  
  potentialProfit?: number;
  /**
   * Potential USD profit if takeProfit is hit (potentialProfit * quantity)
   */
  potentialProfitUsd?: number;
  /**
   * Potential profit percentage ((potentialProfit / entry) * 100)
   */
  potentialProfitPercent?: number;

  /**
   * Potential Risk/Reward ratio (potentialProfit / potentialStopLoss)
   * Shows potential reward relative to potential risk
   */
  potentialRiskRewardRatio?: number;

  /**
   * Actual realized PnL (closePrice - entry for LONG, entry - closePrice for SHORT)
   * Positive = profit, Negative = loss
   */
  actualRealizedPnL?: number;
  /**
   * Actual realized USD PnL (actualRealizedPnL * quantity)
   * Positive = profit, Negative = loss
   */
  actualRealizedPnLUsd?: number;
  /**
   * Actual realized PnL percentage ((actualRealizedPnL / entry) * 100)
   * Positive = profit, Negative = loss
   */
  actualRealizedPnLPercent?: number;

  /**
   * Kết quả thực tế tính theo đơn vị R (Risk unit)
   * 
   * Công thức: actualRiskRewardRatio = actualRealizedPnL / potentialStopLoss
   * 
   * Trong đó: 1R = 1 đơn vị rủi ro = potentialStopLoss
   * 
   * Ý nghĩa theo đơn vị R:
   * - Giá trị DƯƠNG (+): Lợi nhuận
   *   • +0.5 = +0.5R (lợi nhuận bằng 50% rủi ro)
   *   • +1.0 = +1R (lợi nhuận bằng 100% rủi ro, tức là lời bằng stop loss)
   *   • +2.0 = +2R (lợi nhuận gấp đôi rủi ro)
   * 
   * - Giá trị ÂM (-): Thua lỗ
   *   • -0.5 = -0.5R (thua lỗ bằng 50% rủi ro)
   *   • -1.0 = -1R (thua lỗ bằng 100% rủi ro, tức là thua đúng bằng stop loss)
   *   • -1.5 = -1.5R (thua lỗ gấp 1.5 lần rủi ro)
   * 
   * Ví dụ cụ thể:
   * - Entry: $100, Stop Loss: $90 → potentialStopLoss = $10 (1R = $10)
   * - Đóng lệnh ở $95 (thua $5) → actualRiskRewardRatio = -5/10 = -0.5 → -0.5R (thua lỗ)
   * - Đóng lệnh ở $90 (thua $10) → actualRiskRewardRatio = -10/10 = -1.0 → -1R (thua đúng stop loss)
   * - Đóng lệnh ở $105 (lời $5) → actualRiskRewardRatio = 5/10 = +0.5 → +0.5R (lợi nhuận)
   * - Đóng lệnh ở $110 (lời $10) → actualRiskRewardRatio = 10/10 = +1.0 → +1R (lời bằng stop loss)
   * - Đóng lệnh ở $120 (lời $20) → actualRiskRewardRatio = 20/10 = +2.0 → +2R (lời gấp đôi rủi ro)
   */
  actualRiskRewardRatio?: number;
}

export enum OrderConversationStep {
  IDLE = 'idle',
  WAITING_SYMBOL = 'waiting_symbol',
  WAITING_DIRECTION = 'waiting_direction',
  WAITING_ENTRY = 'waiting_entry',
  WAITING_STOP_LOSS = 'waiting_stop_loss',
  WAITING_TAKE_PROFIT = 'waiting_take_profit',
  WAITING_QUANTITY = 'waiting_quantity',
  WAITING_NOTES = 'waiting_notes',
  COMPLETED = 'completed',
  // Update order flow
  WAITING_ORDER_SELECTION = 'waiting_order_selection',
  WAITING_ACTUAL_CLOSE_PRICE = 'waiting_actual_close_price',
}

export interface OrderConversationState {
  userId: number;
  step: OrderConversationStep;
  data: OrderData;
  createdAt: number;
  // For update order flow
  selectedOrderId?: string;
}