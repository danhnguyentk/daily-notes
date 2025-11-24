-- Create trend table for storing trend analysis data
-- This table includes HARSI values and trend information

CREATE TABLE IF NOT EXISTS trend (
  id BIGSERIAL PRIMARY KEY, -- Auto-incrementing primary key for the trend record
  -- HARSI fields
  harsi1w TEXT CHECK (harsi1w IN ('bullish', 'bearish', 'neutral')),
  harsi3d TEXT CHECK (harsi3d IN ('bullish', 'bearish', 'neutral')),
  harsi2d TEXT CHECK (harsi2d IN ('bullish', 'bearish', 'neutral')),
  harsi1d TEXT CHECK (harsi1d IN ('bullish', 'bearish', 'neutral')),
  harsi8h TEXT CHECK (harsi8h IN ('bullish', 'bearish', 'neutral')),
  harsi4h TEXT CHECK (harsi4h IN ('bullish', 'bearish', 'neutral')),
  hasri2h TEXT CHECK (hasri2h IN ('bullish', 'bearish', 'neutral')),
  -- Trend field
  trend TEXT CHECK (trend IN ('bullish', 'bearish')),
  -- Recommendation
  recommendation TEXT,
  surveyed_at TIMESTAMPTZ NOT NULL DEFAULT NOW() -- Timestamp when the survey/trend check was completed
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_trend_surveyed_at ON trend(surveyed_at DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE trend ENABLE ROW LEVEL SECURITY;
