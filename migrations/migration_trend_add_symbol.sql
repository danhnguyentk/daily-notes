-- Migration to add symbol column to trend table
-- This allows tracking which symbol (BTCUSDT, ETHUSDT, XAUUSD) each trend survey is for

-- Add symbol column with default value
ALTER TABLE trend 
  ADD COLUMN IF NOT EXISTS symbol TEXT CHECK (symbol IN ('BTCUSDT', 'ETHUSDT', 'XAUUSD')) DEFAULT 'BTCUSDT';

-- Update existing records to set symbol to BTCUSDT (if NULL)
UPDATE trend 
SET symbol = 'BTCUSDT' 
WHERE symbol IS NULL;

-- Create index for better query performance when filtering by symbol
CREATE INDEX IF NOT EXISTS idx_trend_symbol ON trend(symbol);

-- Create composite index for common queries (symbol + surveyed_at)
CREATE INDEX IF NOT EXISTS idx_trend_symbol_surveyed_at ON trend(symbol, surveyed_at DESC);

