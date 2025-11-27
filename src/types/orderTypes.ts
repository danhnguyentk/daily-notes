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
  UPDATE_CLOSE_PRICE = 'update_close_price_',
  ORDER_NEW = 'order_new',
  ORDER_UPDATE = 'order_update',
  ORDER_VIEW = 'order_view',
  NOTE_ADD = 'note_add_',
  NOTE_CLEAR = 'note_clear',
  NOTE_DONE = 'note_done',
  NOTE_SKIP = 'note_skip',
  STOP_LOSS = 'stop_loss_',
  TAKE_PROFIT = 'take_profit_',
  CHART_BTC_PRICE = 'chart_btc_price',
  CHART_XAU_PRICE = 'chart_xau_price',
  CHART_BTC_1W3D1D = 'chart_btc_1w3d1d',
  CHART_BTC_4H1H15M = 'chart_btc_4h1h15m',
  CHART_BTC_1D = 'chart_btc_1d',
  CHART_BTC_8H = 'chart_btc_8h',
  CHART_BTC_4H = 'chart_btc_4h',
  CHART_BTC_1H = 'chart_btc_1h',
  CHART_BTC_15M = 'chart_btc_15m',
  CHART_SNAPSHOT = 'chart_snapshot',
  CHART_ETF = 'chart_etf',
  EVENT_ENABLE = 'event_enable_',
  EVENT_DISABLE = 'event_disable_',
  EVENT_VERIFY = 'event_verify_',
  HARSI_CHECK = 'harsi_check_',
  HARSI_CHECK_SKIP = 'harsi_check_skip',
  TREND_SURVEY = 'trend_survey',
  TREND_SURVEY_BTC = 'trend_survey_btc',
  TREND_SURVEY_ETH = 'trend_survey_eth',
  TREND_SURVEY_XAU = 'trend_survey_xau',
  TREND_VIEW_BTC = 'trend_view_btc',
  TREND_VIEW_ETH = 'trend_view_eth',
  TREND_VIEW_XAU = 'trend_view_xau',
  ORDER_ANALYZE = 'order_analyze',
  STATS_ALL = 'stats_all',
  STATS_CURRENT_MONTH = 'stats_current_month',
  STATS_PREVIOUS_MONTH = 'stats_previous_month',
  STATS_CURRENT_WEEK = 'stats_current_week',
  STATS_PREVIOUS_WEEK = 'stats_previous_week',
  EXPERIENCE_MENU = 'experience_menu',
  EXIT_GUIDE = 'exit_guide',
}

export interface OrderData {
  symbol?: TradingSymbol;
  direction?: OrderDirection;
  harsi1w?: MarketState;
  harsi3d?: MarketState;
  harsi2d?: MarketState;
  harsi1d?: MarketState;
  harsi8h?: MarketState;
  harsi4h?: MarketState;
  hasri2h?: MarketState;
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
  WAITING_ENTRY = 'waiting_entry',
  WAITING_STOP_LOSS = 'waiting_stop_loss',
  WAITING_TAKE_PROFIT = 'waiting_take_profit',
  WAITING_QUANTITY = 'waiting_quantity',
  WAITING_NOTES = 'waiting_notes',
  COMPLETED = 'completed',
  // Update order flow
  WAITING_ORDER_SELECTION = 'waiting_order_selection',
  WAITING_CLOSE_PRICE = 'waiting_close_price',
  // HARSI check flow (used by /trend command)
  WAITING_HARSI_CHECK_1W = 'waiting_harsi_check_1w',
  WAITING_HARSI_CHECK_3D = 'waiting_harsi_check_3d',
  WAITING_HARSI_CHECK_2D = 'waiting_harsi_check_2d',
  WAITING_HARSI_CHECK_1D = 'waiting_harsi_check_1d',
  WAITING_HARSI_CHECK_8H = 'waiting_harsi_check_8h',
  WAITING_HARSI_CHECK_4H = 'waiting_harsi_check_4h',
  WAITING_HARSI_CHECK_2H = 'waiting_harsi_check_2h',
}

export interface OrderConversationState {
  userId: number;
  step: OrderConversationStep;
  data: OrderData;
  createdAt: number;
  // For update order flow
  selectedOrderId?: string;
}