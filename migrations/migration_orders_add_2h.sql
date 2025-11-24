-- Migration to add HARSI 2H field to existing orders table
-- Run this if the orders table already exists

-- Add new HARSI 2H column
ALTER TABLE orders 
  ADD COLUMN IF NOT EXISTS hasri2h TEXT CHECK (hasri2h IN ('bullish', 'bearish', 'neutral'));

-- Note: The column is added at the end. If you want it in a specific order,
-- you would need to recreate the table or use a more complex migration strategy.

