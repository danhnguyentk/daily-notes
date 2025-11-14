# Supabase Integration Setup

This project now uses Supabase for persistent order data storage, making it easier to query and retrieve data in the future.

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Create Supabase Project

1. Go to [Supabase](https://supabase.com) and create a new project
2. Note your project URL and API secret key (secret key)

### 3. Create Database Table

Run the SQL script in `supabase_schema.sql` in your Supabase SQL Editor:

```bash
# The SQL file contains:
# - Table creation with all order fields
# - Indexes for better query performance
# - Optional Row Level Security (RLS) policies
```

### 4. Set Environment Variables

Add these environment variables to your Cloudflare Workers environment:

- `SUPABASE_URL`: Your Supabase project URL (e.g., `https://xxxxx.supabase.co`)
- `SUPABASE_SECRET_KEY`: Your Supabase service role/secret API key (use service role key for server-side operations)

You can set them via:
- Wrangler CLI: `wrangler secret put SUPABASE_URL` and `wrangler secret put SUPABASE_SECRET_KEY`
- Cloudflare Dashboard: Workers & Pages → Your Worker → Settings → Environment Variables

### 5. How It Works

- **Primary Storage**: Orders are saved to Supabase
- **Automatic**: All existing functions (`saveOrder`, `getUserOrders`, `getOrderById`, etc.) now use Supabase automatically

## Benefits

✅ **Better Querying**: Use SQL queries to filter, sort, and aggregate data  
✅ **Scalability**: Handle large amounts of data efficiently  
✅ **Analytics**: Easy to create dashboards and reports  
✅ **Backup**: Data is persisted in a proper database  
✅ **Future-proof**: Easy to add new features and queries

## Database Schema

The `orders` table includes:
- All order fields (symbol, direction, entry, stopLoss, etc.)
- All HARSI fields (1D, 12H, 8H, 6H, 4H)
- Potential and actual PnL calculations
- Timestamps (created_at, updated_at)
- Indexes for fast queries

## Querying Examples

Once set up, you can query orders directly from Supabase:

```sql
-- Get all orders for a user
SELECT * FROM orders WHERE user_id = 123456 ORDER BY created_at DESC;

-- Get orders by date range
SELECT * FROM orders 
WHERE user_id = 123456 
  AND created_at >= '2024-01-01' 
  AND created_at <= '2024-01-31';

-- Get orders with Bearish HARSI 8H
SELECT * FROM orders WHERE harsi8h = 'Bearish';

-- Calculate total PnL
SELECT SUM(actual_realized_pnl_usd) as total_pnl FROM orders WHERE user_id = 123456;
```

