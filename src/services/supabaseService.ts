/**
 * Supabase service for order data persistence
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Env } from '../types/env';
import { OrderData, OrderDirection, TradingSymbol, MarketState } from '../types/orderTypes';
import { calculateOrderLoss } from '../utils/orderCalcUtils';

// Supabase table and column enums
export enum SupabaseTables {
  ORDERS = 'orders',
}

export enum OrderColumns {
  ORDER_ID = 'order_id',
  USER_ID = 'user_id',
  CREATED_AT = 'created_at',
  UPDATED_AT = 'updated_at',
  ID = 'id',
}

export interface OrderRecord {
  id?: string;
  order_id: string;
  user_id: number;
  symbol?: string;
  direction?: string; // Stored as lowercase in DB: 'long' | 'short'
  harsi1d?: string;
  harsi12h?: string;
  harsi8h?: string;
  harsi6h?: string;
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
    harsi1d: record.harsi1d as MarketState | undefined,
    harsi12h: record.harsi12h as MarketState | undefined,
    harsi8h: record.harsi8h as MarketState | undefined,
    harsi6h: record.harsi6h as MarketState | undefined,
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
    harsi1d: orderData.harsi1d,
    harsi12h: orderData.harsi12h,
    harsi8h: orderData.harsi8h,
    harsi6h: orderData.harsi6h,
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

