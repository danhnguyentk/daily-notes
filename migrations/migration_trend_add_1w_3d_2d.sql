-- Migration to add new HARSI fields (1W, 3D, 2D) to existing trend table
-- Run this if the trend table already exists

-- Add new HARSI columns
ALTER TABLE trend 
  ADD COLUMN IF NOT EXISTS harsi1w TEXT CHECK (harsi1w IN ('bullish', 'bearish', 'neutral')),
  ADD COLUMN IF NOT EXISTS harsi3d TEXT CHECK (harsi3d IN ('bullish', 'bearish', 'neutral')),
  ADD COLUMN IF NOT EXISTS harsi2d TEXT CHECK (harsi2d IN ('bullish', 'bearish', 'neutral'));

-- Note: The columns are added at the end. If you want them in a specific order,
-- you would need to recreate the table or use a more complex migration strategy.

