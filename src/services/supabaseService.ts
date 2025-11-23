/**
 * Supabase service for order data persistence
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Env } from '../types/env';
import { OrderData, OrderDirection, TradingSymbol, MarketState, OrderResult } from '../types/orderTypes';
import { calculateOrderLoss } from '../utils/orderCalcUtils';
import { CandleDirection } from '../types/candleTypes';

// Supabase table and column enums
export enum SupabaseTables {
  ORDERS = 'orders',
  EVENT_CONFIGS = 'event_configs',
  TREND = 'trend',
  ORDER_ANALYSIS = 'order_analysis',
}

export enum OrderColumns {
  ORDER_ID = 'order_id',
  USER_ID = 'user_id',
  CREATED_AT = 'created_at',
  UPDATED_AT = 'updated_at',
  ID = 'id',
  ORDER_RESULT = 'order_result',
}

export interface OrderRecord {
  id?: string;
  order_id: string;
  user_id: number;
  symbol?: string;
  direction?: string; // Stored as lowercase in DB: 'long' | 'short'
  harsi1w?: string;
  harsi3d?: string;
  harsi2d?: string;
  harsi1d?: string;
  harsi8h?: string;
  harsi4h?: string;
  entry?: number;
  stop_loss?: number;
  take_profit?: number;
  quantity?: number;
  notes?: string;
  potential_stop_loss?: number;
  potential_stop_loss_usd?: number;
  potential_stop_loss_percent?: number;
  potential_profit?: number;
  potential_profit_usd?: number;
  potential_profit_percent?: number;
  potential_risk_reward_ratio?: number;
  actual_close_price?: number;
  order_result?: string; // 'win' | 'loss' | 'breakeven'
  actual_realized_pnl?: number;
  actual_realized_pnl_usd?: number;
  actual_realized_pnl_percent?: number;
  actual_risk_reward_ratio?: number;
  created_at: string;
  updated_at?: string;
}

let supabaseClient: SupabaseClient | null = null;

/**
 * Get or create Supabase client
 */
function getSupabaseClient(env: Env): SupabaseClient {
  if (!supabaseClient) {
    supabaseClient = createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY);
  }
  return supabaseClient;
}

/**
 * Convert OrderRecord from Supabase to OrderData with metadata
 */
export function convertOrderRecordToOrderData(record: OrderRecord): OrderData & {
  orderId: string;
  userId: number;
  timestamp: number;
  updatedAt?: number;
} {
  return {
    symbol: record.symbol as TradingSymbol | undefined,
    direction: record.direction as OrderDirection | undefined,
    harsi1w: record.harsi1w as MarketState | undefined,
    harsi3d: record.harsi3d as MarketState | undefined,
    harsi2d: record.harsi2d as MarketState | undefined,
    harsi1d: record.harsi1d as MarketState | undefined,
    harsi8h: record.harsi8h as MarketState | undefined,
    harsi4h: record.harsi4h as MarketState | undefined,
    entry: record.entry,
    stopLoss: record.stop_loss,
    takeProfit: record.take_profit,
    quantity: record.quantity,
    notes: record.notes,
    potentialStopLoss: record.potential_stop_loss,
    potentialStopLossUsd: record.potential_stop_loss_usd,
    potentialStopLossPercent: record.potential_stop_loss_percent,
    potentialProfit: record.potential_profit,
    potentialProfitUsd: record.potential_profit_usd,
    potentialProfitPercent: record.potential_profit_percent,
    potentialRiskRewardRatio: record.potential_risk_reward_ratio,
    actualClosePrice: record.actual_close_price,
    orderResult: (record.order_result as OrderResult | undefined) ?? OrderResult.IN_PROGRESS,
    actualRealizedPnL: record.actual_realized_pnl,
    actualRealizedPnLUsd: record.actual_realized_pnl_usd,
    actualRealizedPnLPercent: record.actual_realized_pnl_percent,
    actualRiskRewardRatio: record.actual_risk_reward_ratio,
    orderId: record.order_id,
    userId: record.user_id,
    timestamp: new Date(record.created_at).getTime(),
    updatedAt: record.updated_at ? new Date(record.updated_at).getTime() : undefined,
  };
}

/**
 * Save order to Supabase
 */
export async function saveOrderToSupabase(
  userId: number,
  orderData: OrderData,
  env: Env
): Promise<string> {
  const supabase = getSupabaseClient(env);
  const orderId = `${Date.now()}_${userId}`;
  
  const orderRecord: OrderRecord = {
    order_id: orderId,
    user_id: userId,
    symbol: orderData.symbol,
    direction: orderData.direction,
    harsi1w: orderData.harsi1w,
    harsi3d: orderData.harsi3d,
    harsi2d: orderData.harsi2d,
    harsi1d: orderData.harsi1d,
    harsi8h: orderData.harsi8h,
    harsi4h: orderData.harsi4h,
    entry: orderData.entry,
    stop_loss: orderData.stopLoss,
    take_profit: orderData.takeProfit,
    quantity: orderData.quantity,
    notes: orderData.notes,
    potential_stop_loss: orderData.potentialStopLoss,
    potential_stop_loss_usd: orderData.potentialStopLossUsd,
    potential_stop_loss_percent: orderData.potentialStopLossPercent,
    potential_profit: orderData.potentialProfit,
    potential_profit_usd: orderData.potentialProfitUsd,
    potential_profit_percent: orderData.potentialProfitPercent,
    potential_risk_reward_ratio: orderData.potentialRiskRewardRatio,
    actual_close_price: orderData.actualClosePrice,
    order_result: orderData.orderResult ?? OrderResult.IN_PROGRESS,
    actual_realized_pnl: orderData.actualRealizedPnL,
    actual_realized_pnl_usd: orderData.actualRealizedPnLUsd,
    actual_realized_pnl_percent: orderData.actualRealizedPnLPercent,
    actual_risk_reward_ratio: orderData.actualRiskRewardRatio,
    created_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from(SupabaseTables.ORDERS)
    .insert(orderRecord)
    .select(OrderColumns.ID)
    .single();

  if (error) {
    console.error('Error saving order to Supabase:', error);
    throw new Error(`Failed to save order: ${error.message}`);
  }

  return orderId;
}

/**
 * Get all orders from Supabase (no user filter)
 */
export async function getAllOrdersFromSupabase(
  env: Env
): Promise<OrderRecord[]> {
  const supabase = getSupabaseClient(env);

  const { data, error } = await supabase
    .from(SupabaseTables.ORDERS)
    .select('*')
    .order(OrderColumns.CREATED_AT, { ascending: false });

  if (error) {
    console.error('Error fetching all orders from Supabase:', error);
    throw new Error(`Failed to fetch orders: ${error.message}`);
  }

  return data || [];
}

/**
 * Get all orders for a user from Supabase
 */
export async function getUserOrdersFromSupabase(
  userId: number,
  env: Env
): Promise<OrderRecord[]> {
  const supabase = getSupabaseClient(env);

  const { data, error } = await supabase
    .from(SupabaseTables.ORDERS)
    .select('*')
    .eq(OrderColumns.USER_ID, userId)
    .order(OrderColumns.CREATED_AT, { ascending: false });

  if (error) {
    console.error('Error fetching user orders from Supabase:', error);
    throw new Error(`Failed to fetch orders: ${error.message}`);
  }

  return data || [];
}

/**
 * Get orders by date range from Supabase
 */
export async function getUserOrdersByDateRangeFromSupabase(
  userId: number,
  startDate: Date,
  endDate: Date,
  env: Env
): Promise<OrderRecord[]> {
  const supabase = getSupabaseClient(env);

  const { data, error } = await supabase
    .from(SupabaseTables.ORDERS)
    .select('*')
    .eq(OrderColumns.USER_ID, userId)
    .gte(OrderColumns.CREATED_AT, startDate.toISOString())
    .lte(OrderColumns.CREATED_AT, endDate.toISOString())
    .order(OrderColumns.CREATED_AT, { ascending: false });

  if (error) {
    console.error('Error fetching orders by date range from Supabase:', error);
    throw new Error(`Failed to fetch orders: ${error.message}`);
  }

  return data || [];
}

/**
 * Get order by ID from Supabase
 */
export async function getOrderByIdFromSupabase(
  orderId: string,
  env: Env
): Promise<OrderRecord | null> {
  const supabase = getSupabaseClient(env);

  const { data, error } = await supabase
    .from(SupabaseTables.ORDERS)
    .select('*')
    .eq(OrderColumns.ORDER_ID, orderId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      // No rows returned
      return null;
    }
    console.error('Error fetching order from Supabase:', error);
    throw new Error(`Failed to fetch order: ${error.message}`);
  }

  return data;
}

/**
 * Update order with close price in Supabase
 */
export async function updateOrderWithClosePriceInSupabase(
  orderId: string,
  closePrice: number,
  env: Env
): Promise<OrderRecord | null> {
  const supabase = getSupabaseClient(env);

  // First get the order to calculate the actual values
  const record = await getOrderByIdFromSupabase(orderId, env);
  if (!record) {
    return null;
  }

  // Convert to OrderData format for calculation
  const orderData = convertOrderRecordToOrderData(record);
  
  // Calculate actual PnL using the utility function
  const updatedOrder = calculateOrderLoss(orderData, closePrice);

  const { data, error } = await supabase
    .from(SupabaseTables.ORDERS)
    .update({
      actual_close_price: closePrice,
      order_result: updatedOrder.orderResult,
      actual_realized_pnl: updatedOrder.actualRealizedPnL,
      actual_realized_pnl_usd: updatedOrder.actualRealizedPnLUsd,
      actual_realized_pnl_percent: updatedOrder.actualRealizedPnLPercent,
      actual_risk_reward_ratio: updatedOrder.actualRiskRewardRatio,
      updated_at: new Date().toISOString(),
    })
    .eq(OrderColumns.ORDER_ID, orderId)
    .select()
    .single();

  if (error) {
    console.error('Error updating order in Supabase:', error);
    throw new Error(`Failed to update order: ${error.message}`);
  }

  return data;
}

/**
 * Delete order from Supabase
 */
export async function deleteOrderFromSupabase(
  orderId: string,
  env: Env
): Promise<boolean> {
  const supabase = getSupabaseClient(env);

  const { error } = await supabase
    .from(SupabaseTables.ORDERS)
    .delete()
    .eq(OrderColumns.ORDER_ID, orderId);

  if (error) {
    console.error('Error deleting order from Supabase:', error);
    throw new Error(`Failed to delete order: ${error.message}`);
  }

  return true;
}

/**
 * Event Config Types and Functions
 */

export enum EventStatus {
  ENABLED = 'enabled',
  DISABLED = 'disabled',
}

export enum EventKey {
  // Bullish
  EnableNotifyTwoClosed15mCandlesBullish = 'EnableNotifyTwoClosed15mCandlesBullish',
  EnableNotifyOneClosed15mCandlesBullish = 'EnableNotifyOneClosed15mCandlesBullish',
  EnableNotifyTwoClosed1hCandlesBullish = 'EnableNotifyTwoClosed1hCandlesBullish',
  EnableNotifyOneClosed1hCandlesBullish = 'EnableNotifyOneClosed1hCandlesBullish',
  // Bearish
  EnableNotifyTwoClosed15mCandlesBearish = 'EnableNotifyTwoClosed15mCandlesBearish',
  EnableNotifyOneClosed15mCandlesBearish = 'EnableNotifyOneClosed15mCandlesBearish',
  EnableNotifyTwoClosed1hCandlesBearish = 'EnableNotifyTwoClosed1hCandlesBearish',
  EnableNotifyOneClosed1hCandlesBearish = 'EnableNotifyOneClosed1hCandlesBearish',
}

export interface EventConfigRecord {
  id?: number;
  event_key: string;
  interval: string; // '15m' | '1h' | '4h' | '1d'
  candle_count: number;
  direction: CandleDirection;
  is_active: boolean;
  status: EventStatus;
  created_at?: string;
  updated_at?: string;
}

export interface ScheduleConfig {
  eventKey: string;
}

export interface CandleCheckConfig {
  interval: string; // KuCoinInterval
  limit: number;
  direction: CandleDirection;
  eventKey: string;
}

/**
 * Get all active event configs from Supabase
 */
export async function getEventConfigsFromSupabase(
  env: Env
): Promise<EventConfigRecord[]> {
  const supabase = getSupabaseClient(env);

  const { data, error } = await supabase
    .from(SupabaseTables.EVENT_CONFIGS)
    .select('*')
    .eq('is_active', true)
    .order('event_key', { ascending: true });

  if (error) {
    console.error('Error fetching event configs from Supabase:', error);
    throw new Error(`Failed to fetch event configs: ${error.message}`);
  }

  return data || [];
}

/**
 * Generate description dynamically from config fields
 */
export function generateEventDescription(config: { candle_count: number; interval: string; direction: CandleDirection }): string {
  const candleText = config.candle_count === 1 ? 'candle' : 'candles';
  const consecutiveText = config.candle_count > 1 ? 'consecutive ' : '';
  const directionText = config.direction === CandleDirection.BULLISH ? 'bullish' : 'bearish';
  return `${config.candle_count} ${consecutiveText}closed ${config.interval} ${directionText} ${candleText}`;
}

/**
 * Generate enable/disable message dynamically from config
 */
export function generateEventMessage(config: EventConfigRecord, isEnable: boolean): string {
  const action = isEnable ? 'Enabled' : 'Disabled';
  const description = generateEventDescription(config);
  return `✅ ${action} scheduled check for ${description}.`;
}

/**
 * Build SCHEDULE_CONFIGS map from Supabase data (using event_key as key)
 * Returns map of event_key -> ScheduleConfig
 */
export async function buildScheduleConfigs(
  env: Env
): Promise<Record<string, ScheduleConfig>> {
  const configs = await getEventConfigsFromSupabase(env);
  const scheduleConfigs: Record<string, ScheduleConfig> = {};

  for (const config of configs) {
    scheduleConfigs[config.event_key] = {
      eventKey: config.event_key,
    };
  }

  return scheduleConfigs;
}

/**
 * Get event configs for scheduled handlers (by interval, only enabled)
 */
export async function getEventConfigsForScheduled(
  interval: string,
  env: Env
): Promise<EventConfigRecord[]> {
  return await getEventConfigsByInterval(interval, env);
}

/**
 * Build CANDLE_CHECK_CONFIGS map from Supabase data (using event_key as key)
 */
export async function buildCandleCheckConfigs(
  env: Env
): Promise<Record<string, CandleCheckConfig>> {
  const configs = await getEventConfigsFromSupabase(env);
  const candleCheckConfigs: Record<string, CandleCheckConfig> = {};

  for (const config of configs) {
    // Map interval from DB format to KuCoinInterval format
    let kucoinInterval: string;
    switch (config.interval) {
      case '15m':
        kucoinInterval = '15m';
        break;
      case '1h':
        kucoinInterval = '1h';
        break;
      case '4h':
        kucoinInterval = '4h';
        break;
      case '1d':
        kucoinInterval = '1d';
        break;
      default:
        kucoinInterval = config.interval;
    }

    candleCheckConfigs[config.event_key] = {
      interval: kucoinInterval,
      limit: config.candle_count,
      direction: config.direction,
      eventKey: config.event_key,
    };
  }

  return candleCheckConfigs;
}

/**
 * Get all unique event keys from event configs
 */
export async function getAllEventKeysFromSupabase(
  env: Env
): Promise<string[]> {
  const configs = await getEventConfigsFromSupabase(env);
  return configs.map(config => config.event_key);
}

/**
 * Get event configs by interval (for scheduled handlers)
 */
export async function getEventConfigsByInterval(
  interval: string,
  env: Env
): Promise<EventConfigRecord[]> {
  const supabase = getSupabaseClient(env);

  const { data, error } = await supabase
    .from(SupabaseTables.EVENT_CONFIGS)
    .select('*')
    .eq('is_active', true)
    .eq('interval', interval)
    .eq('status', EventStatus.ENABLED)
    .order('event_key', { ascending: true });

  if (error) {
    console.error('Error fetching event configs by interval from Supabase:', error);
    throw new Error(`Failed to fetch event configs: ${error.message}`);
  }

  return data || [];
}

/**
 * Update event config status (enable/disable)
 */
export async function updateEventConfigStatus(
  eventKey: string,
  status: EventStatus,
  env: Env
): Promise<EventConfigRecord | null> {
  const supabase = getSupabaseClient(env);

  const { data, error } = await supabase
    .from(SupabaseTables.EVENT_CONFIGS)
    .update({
      status,
      updated_at: new Date().toISOString(),
    })
    .eq('event_key', eventKey)
    .select()
    .single();

  if (error) {
    console.error('Error updating event config status in Supabase:', error);
    throw new Error(`Failed to update event config status: ${error.message}`);
  }

  return data;
}

/**
 * Get event config by event key
 */
export async function getEventConfigByEventKey(
  eventKey: string,
  env: Env
): Promise<EventConfigRecord | null> {
  const supabase = getSupabaseClient(env);

  const { data, error } = await supabase
    .from(SupabaseTables.EVENT_CONFIGS)
    .select('*')
    .eq('event_key', eventKey)
    .eq('is_active', true)
    .maybeSingle();

  if (error) {
    console.error('Error fetching event config by event key from Supabase:', error);
    throw new Error(`Failed to fetch event config: ${error.message}`);
  }

  return data;
}

export interface TrendRecord {
  id?: number;
  symbol?: string; // 'BTCUSDT' | 'ETHUSDT' | 'XAUUSD'
  harsi1w?: string; // 'bullish' | 'bearish' | 'neutral'
  harsi3d?: string; // 'bullish' | 'bearish' | 'neutral'
  harsi2d?: string; // 'bullish' | 'bearish' | 'neutral'
  harsi1d?: string; // 'bullish' | 'bearish' | 'neutral'
  harsi8h?: string; // 'bullish' | 'bearish' | 'neutral'
  harsi4h?: string; // 'bullish' | 'bearish' | 'neutral'
  trend?: string; // 'bullish' | 'bearish'
  recommendation?: string;
  surveyed_at?: string; // Timestamp when the survey/trend check was completed
}

export interface TrendData {
  symbol?: TradingSymbol; // 'BTCUSDT' | 'ETHUSDT' | 'XAUUSD'
  harsi1w?: MarketState;
  harsi3d?: MarketState;
  harsi2d?: MarketState;
  harsi1d?: MarketState;
  harsi8h?: MarketState;
  harsi4h?: MarketState;
  trend?: MarketState; // 'bullish' | 'bearish' (no neutral for trend)
}

/**
 * Save trend record to database
 */
export async function saveTrend(
  trendData: TrendData,
  recommendation: string,
  env: Env
): Promise<TrendRecord> {
  const supabase = getSupabaseClient(env);
  
  const record: Partial<TrendRecord> = {
    symbol: trendData.symbol,
    harsi1w: trendData.harsi1w,
    harsi3d: trendData.harsi3d,
    harsi2d: trendData.harsi2d,
    harsi1d: trendData.harsi1d,
    harsi8h: trendData.harsi8h,
    harsi4h: trendData.harsi4h,
    trend: trendData.trend,
    recommendation,
    surveyed_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from(SupabaseTables.TREND)
    .insert(record)
    .select()
    .single();

  if (error) {
    console.error('Error saving trend to Supabase:', error);
    throw new Error(`Failed to save trend: ${error.message}`);
  }

  return data;
}

/**
 * Get recent trend records
 */
export async function getTrends(
  limit: number = 10,
  env: Env,
  symbol?: TradingSymbol
): Promise<TrendRecord[]> {
  const supabase = getSupabaseClient(env);
  
  let query = supabase
    .from(SupabaseTables.TREND)
    .select('*')
    .order('surveyed_at', { ascending: false })
    .limit(limit);

  if (symbol) {
    query = query.eq('symbol', symbol);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching trends from Supabase:', error);
    throw new Error(`Failed to fetch trends: ${error.message}`);
  }

  return data || [];
}

/**
 * Save HARSI check to database (includes calculated trend)
 */
export async function saveHarsiCheck(
  userId: number,
  trendData: TrendData,
  recommendation: string,
  env: Env
): Promise<TrendRecord> {
  return saveTrend(trendData, recommendation, env);
}

/**
 * Save trend check to database (convenience wrapper)
 */
export async function saveTrendCheck(
  userId: number,
  trendData: { trend?: MarketState },
  recommendation: string,
  env: Env
): Promise<TrendRecord> {
  const data: TrendData = {
    trend: trendData.trend,
  };
  
  return saveTrend(data, recommendation, env);
}

export interface OrderAnalysisRecord {
  id?: number;
  analysis: string;
  total_orders: number;
  win_count: number;
  loss_count: number;
  breakeven_count: number;
  win_rate: string;
  total_pnl: string;
  avg_pnl: string;
  analyzed_at?: string;
}

export interface OrderAnalysisData {
  analysis: string;
  totalOrders: number;
  winCount: number;
  lossCount: number;
  breakevenCount: number;
  winRate: string;
  totalPnL: string;
  avgPnL: string;
}

/**
 * Save order analysis result to database
 */
export async function saveOrderAnalysis(
  analysisData: OrderAnalysisData,
  env: Env
): Promise<OrderAnalysisRecord> {
  const supabase = getSupabaseClient(env);
  
  const record: Partial<OrderAnalysisRecord> = {
    analysis: analysisData.analysis,
    total_orders: analysisData.totalOrders,
    win_count: analysisData.winCount,
    loss_count: analysisData.lossCount,
    breakeven_count: analysisData.breakevenCount,
    win_rate: analysisData.winRate,
    total_pnl: analysisData.totalPnL,
    avg_pnl: analysisData.avgPnL,
  };

  const { data, error } = await supabase
    .from(SupabaseTables.ORDER_ANALYSIS)
    .insert(record)
    .select()
    .single();

  if (error) {
    console.error('Error saving order analysis to Supabase:', error);
    throw new Error(`Failed to save order analysis: ${error.message}`);
  }

  return data;
}

/**
 * Get open (in-progress) orders for a user
 */
export async function getOpenOrdersForUser(
  userId: number,
  env: Env
): Promise<OrderRecord[]> {
  const supabase = getSupabaseClient(env);

  const { data, error } = await supabase
    .from(SupabaseTables.ORDERS)
    .select('*')
    .eq(OrderColumns.USER_ID, userId)
    .or(`${OrderColumns.ORDER_RESULT}.is.null,${OrderColumns.ORDER_RESULT}.eq.${OrderResult.IN_PROGRESS}`)
    .order(OrderColumns.CREATED_AT, { ascending: false });

  if (error) {
    console.error('Error fetching open orders from Supabase:', error);
    throw new Error(`Failed to fetch open orders: ${error.message}`);
  }

  return data || [];
}

/**
 * Get latest order analysis from database
 */
export async function getLatestOrderAnalysis(
  env: Env
): Promise<OrderAnalysisRecord | null> {
  const supabase = getSupabaseClient(env);
  
  const { data, error } = await supabase
    .from(SupabaseTables.ORDER_ANALYSIS)
    .select('*')
    .order('analyzed_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('Error fetching latest order analysis from Supabase:', error);
    throw new Error(`Failed to fetch latest order analysis: ${error.message}`);
  }

  return data;
}

