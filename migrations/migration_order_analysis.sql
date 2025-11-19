-- Create order_analysis table for storing AI analysis results
CREATE TABLE IF NOT EXISTS order_analysis (
  id BIGSERIAL PRIMARY KEY,
  analysis TEXT NOT NULL,
  total_orders INTEGER NOT NULL,
  win_count INTEGER NOT NULL,
  loss_count INTEGER NOT NULL,
  breakeven_count INTEGER NOT NULL,
  win_rate TEXT NOT NULL,
  total_pnl TEXT NOT NULL,
  avg_pnl TEXT NOT NULL,
  analyzed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_order_analysis_analyzed_at ON order_analysis(analyzed_at DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE order_analysis ENABLE ROW LEVEL SECURITY;

