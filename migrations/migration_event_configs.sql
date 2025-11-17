-- Complete migration for event_configs table
-- This replaces hardcoded SCHEDULE_CONFIGS and CANDLE_CHECK_CONFIGS
-- Combines: create table, remove unused fields, rename columns, and seed data

-- Create event_configs table with final schema
CREATE TABLE IF NOT EXISTS event_configs (
  id BIGSERIAL PRIMARY KEY,
  event_key TEXT UNIQUE NOT NULL,
  interval TEXT NOT NULL CHECK (interval IN ('15m', '1h', '2h', '4h', '8h', '12h', '1d')),
  candle_count INTEGER NOT NULL CHECK (candle_count > 0),
  direction TEXT NOT NULL CHECK (direction IN ('bullish', 'bearish')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  status TEXT NOT NULL DEFAULT 'disabled' CHECK (status IN ('enabled', 'disabled')),
  -- Note: Using EventStatus enum values in code: EventStatus.ENABLED = 'enabled', EventStatus.DISABLED = 'disabled'
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_event_configs_event_key ON event_configs(event_key);
CREATE INDEX IF NOT EXISTS idx_event_configs_is_active ON event_configs(is_active);
CREATE INDEX IF NOT EXISTS idx_event_configs_status ON event_configs(status);
CREATE INDEX IF NOT EXISTS idx_event_configs_interval ON event_configs(interval);
CREATE INDEX IF NOT EXISTS idx_event_configs_direction ON event_configs(direction);

-- Enable Row Level Security (RLS) - can be adjusted based on access needs
ALTER TABLE event_configs ENABLE ROW LEVEL SECURITY;

-- Seed initial event configurations
INSERT INTO event_configs (
  event_key,
  interval,
  candle_count,
  direction,
  is_active,
  status
) VALUES
-- 15m Bullish
(
  'EnableNotifyTwoClosed15mCandlesBullish',
  '15m',
  2,
  'bullish',
  true,
  'disabled'
),
(
  'EnableNotifyOneClosed15mCandlesBullish',
  '15m',
  1,
  'bullish',
  true,
  'disabled'
),
-- 15m Bearish
(
  'EnableNotifyTwoClosed15mCandlesBearish',
  '15m',
  2,
  'bearish',
  true,
  'disabled'
),
(
  'EnableNotifyOneClosed15mCandlesBearish',
  '15m',
  1,
  'bearish',
  true,
  'disabled'
),
-- 1h Bullish
(
  'EnableNotifyTwoClosed1hCandlesBullish',
  '1h',
  2,
  'bullish',
  true,
  'disabled'
),
(
  'EnableNotifyOneClosed1hCandlesBullish',
  '1h',
  1,
  'bullish',
  true,
  'disabled'
),
-- 1h Bearish
(
  'EnableNotifyTwoClosed1hCandlesBearish',
  '1h',
  2,
  'bearish',
  true,
  'disabled'
),
(
  'EnableNotifyOneClosed1hCandlesBearish',
  '1h',
  1,
  'bearish',
  true,
  'disabled'
)
ON CONFLICT (event_key) DO NOTHING;

