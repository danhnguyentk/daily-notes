-- Migration to update HARSI fields in orders table
-- Removes harsi12h and harsi6h, adds harsi1w, harsi3d, harsi2d
-- Run this if the orders table already exists

-- Add new HARSI columns
ALTER TABLE orders 
  ADD COLUMN IF NOT EXISTS harsi1w TEXT CHECK (harsi1w IN ('bullish', 'bearish', 'neutral')),
  ADD COLUMN IF NOT EXISTS harsi3d TEXT CHECK (harsi3d IN ('bullish', 'bearish', 'neutral')),
  ADD COLUMN IF NOT EXISTS harsi2d TEXT CHECK (harsi2d IN ('bullish', 'bearish', 'neutral'));

-- Remove old HARSI columns
-- Note: Dropping columns will permanently delete data in those columns
-- Make sure to backup data if needed before running this migration
ALTER TABLE orders 
  DROP COLUMN IF EXISTS harsi12h,
  DROP COLUMN IF EXISTS harsi6h;

