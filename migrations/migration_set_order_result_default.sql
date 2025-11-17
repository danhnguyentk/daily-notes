UPDATE orders 
SET order_result = 'in_progress' 
WHERE order_result IS NULL;

ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_order_result_check 
ALTER TABLE orders 
ADD CONSTRAINT orders_order_result_check 
CHECK (order_result IN ('win', 'loss', 'breakeven', 'in_progress'));

