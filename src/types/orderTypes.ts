/**
 * Types for order conversation flow
 */

export enum MarketState {
  Bullish = 'bullish',
  Bearish = 'bearish',
  Neutral = 'neutral',
}

export enum OrderDirection {
  LONG = 'long',
  SHORT = 'short',
}

export enum TradingSymbol {
  BTCUSDT = 'BTCUSDT',
  ETHUSDT = 'ETHUSDT',
  XAUUSD = 'XAUUSD',
}

export enum OrderResult {
  WIN = 'win',
  LOSS = 'loss',
  BREAKEVEN = 'breakeven',
  IN_PROGRESS = 'in_progress',
}

export enum CallbackDataPrefix {
  DELETE_ORDER = 'delete_order_',
  DELETE_ORDER_CONFIRM = 'delete_order_confirm_',
  DELETE_ORDER_CANCEL = 'delete_order_cancel',
  VIEW_ORDER = 'view_order_',
  CLOSE_ORDER = 'close_order_',
  ORDER_NEW = 'order_new',
  ORDER_CANCEL = 'order_cancel',
  ORDER_PREVIEW = 'order_preview',
  ORDER_UPDATE = 'order_update',
  ORDER_VIEW = 'order_view',
  HARSI = 'harsi_',
  HARSI_8H_CONTINUE = 'harsi_8h_continue',
  HARSI_8H_CANCEL = 'harsi_8h_cancel',
  HARSI_SKIP = 'harsi_skip',
  NOTE_ADD = 'note_add_',
  NOTE_CLEAR = 'note_clear',
  NOTE_DONE = 'note_done',
  NOTE_SKIP = 'note_skip',
  CHART_BTC_PRICE = 'chart_btc_price',
  CHART_BTC_1W3D1D = 'chart_btc_1w3d1d',
  CHART_BTC_4H1H15M = 'chart_btc_4h1h15m',
  CHART_BTC_1D = 'chart_btc_1d',
  CHART_BTC_8H = 'chart_btc_8h',
  CHART_BTC_4H = 'chart_btc_4h',
  CHART_BTC_1H = 'chart_btc_1h',
  CHART_BTC_15M = 'chart_btc_15m',
  CHART_SNAPSHOT = 'chart_snapshot',
  CHART_ETF = 'chart_etf',
}

export interface OrderData {
  symbol?: TradingSymbol;
  direction?: OrderDirection;
  harsi1d?: MarketState;
  harsi12h?: MarketState;
  harsi8h?: MarketState;
  harsi6h?: MarketState;
  harsi4h?: MarketState;
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
   * Actual close price when order is closed
   */
  actualClosePrice?: number;
  /**
   * Order result when closed: WIN, LOSS, or BREAKEVEN
   */
  orderResult?: OrderResult;
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
  WAITING_HARSI_1D = 'waiting_harsi_1d',
  WAITING_HARSI_12H = 'waiting_harsi_12h',
  WAITING_HARSI_8H = 'waiting_harsi_8h',
  WAITING_HARSI_8H_CONFIRMATION = 'waiting_harsi_8h_confirmation',
  WAITING_HARSI_6H = 'waiting_harsi_6h',
  WAITING_HARSI_4H = 'waiting_harsi_4h',
  WAITING_ENTRY = 'waiting_entry',
  WAITING_STOP_LOSS = 'waiting_stop_loss',
  WAITING_TAKE_PROFIT = 'waiting_take_profit',
  WAITING_QUANTITY = 'waiting_quantity',
  WAITING_NOTES = 'waiting_notes',
  COMPLETED = 'completed',
  // Update order flow
  WAITING_ORDER_SELECTION = 'waiting_order_selection',
  WAITING_CLOSE_PRICE = 'waiting_close_price',
}

export interface OrderConversationState {
  userId: number;
  step: OrderConversationStep;
  data: OrderData;
  createdAt: number;
  // For update order flow
  selectedOrderId?: string;
}