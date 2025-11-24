-- Supabase SQL Schema for Orders Table
-- Run this SQL in your Supabase SQL Editor to create the orders table

CREATE TABLE IF NOT EXISTS orders (
  id BIGSERIAL PRIMARY KEY,
  order_id TEXT UNIQUE NOT NULL,
  user_id BIGINT NOT NULL,
  
  -- Basic order fields
  symbol TEXT,
  direction TEXT CHECK (direction IN ('long', 'short')),
  
  -- HARSI fields
  harsi1w TEXT CHECK (harsi1w IN ('bullish', 'bearish', 'neutral')),
  harsi3d TEXT CHECK (harsi3d IN ('bullish', 'bearish', 'neutral')),
  harsi2d TEXT CHECK (harsi2d IN ('bullish', 'bearish', 'neutral')),
  harsi1d TEXT CHECK (harsi1d IN ('bullish', 'bearish', 'neutral')),
  harsi8h TEXT CHECK (harsi8h IN ('bullish', 'bearish', 'neutral')),
  harsi4h TEXT CHECK (harsi4h IN ('bullish', 'bearish', 'neutral')),
  hasri2h TEXT CHECK (hasri2h IN ('bullish', 'bearish', 'neutral')),
  
  -- Price fields
  entry NUMERIC,
  stop_loss NUMERIC,
  take_profit NUMERIC,
  quantity NUMERIC,
  notes TEXT,
  
  -- Potential loss fields
  potential_stop_loss NUMERIC,
  potential_stop_loss_usd NUMERIC,
  potential_stop_loss_percent NUMERIC,
  
  -- Potential profit fields
  potential_profit NUMERIC,
  potential_profit_usd NUMERIC,
  potential_profit_percent NUMERIC,
  
  -- Risk/Reward ratio
  potential_risk_reward_ratio NUMERIC,
  
  -- Actual realized PnL fields
  actual_close_price NUMERIC,
  order_result TEXT DEFAULT 'in_progress' CHECK (order_result IN ('win', 'loss', 'breakeven', 'in_progress')),
  actual_realized_pnl NUMERIC,
  actual_realized_pnl_usd NUMERIC,
  actual_realized_pnl_percent NUMERIC,
  actual_risk_reward_ratio NUMERIC,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_order_id ON orders(order_id);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_user_created ON orders(user_id, created_at DESC);

-- Create index for filtering open orders (orders without actual_risk_reward_ratio)
CREATE INDEX IF NOT EXISTS idx_orders_open ON orders(user_id, created_at DESC) 
WHERE actual_risk_reward_ratio IS NULL;

-- Enable Row Level Security (RLS) 
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;