# Daily Notes

### Start and run local 
npm run dev

### Debug with Scheduled in local
Access to
http://localhost:8787/__scheduled

### Scraper
- https://dashboard.scraperapi.com/home
- Register with google account danhnguyentk

### Snapshot Chart
- https://chart-img.com/account/api
- https://chart-img.medium.com/tradingview-snapshot-with-rest-api-part1-74f4d8403015

### Telegram
- https://core.telegram.org/bots/api#available-methods
- Bot Commands Telegram

```
trend - Trend Check
charts - Chart Menu
orders - Order Menu
events - All Events (Enabled, Disabled) 
orderstats - Order Statistics
orderstatsmonth - Monthly Order Statistics
```

### OpenAI
- https://platform.openai.com/docs/models/gpt-5.1

### ZAI
- https://z.ai/manage-apikey/rate-limits

### ACTION TODO 
- Open question xac dinh xu huong

Example markdown logs
### Phân tích giao dịch\n\n#### 1. Phân tích thắng/thua theo các yếu tố:\n- **Hướng giao dịch**: \n  - Cả 2 lệnh đều là LONG và đều thua\n  - Không có dữ liệu SHORT để so sánh\n\n- **Symbol**: \n  - Cả 2 lệnh đều trên ETHUSDT và đều thua\n  - Không có dữ liệu BTCUSDT/XAUUSD để so sánh\n\n- **HARSI values**: \n  - Cả 2 lệnh đều có cùng mẫu: harsi1d, harsi8h, harsi4h đều là \"bearish\"\n  - Các khung thời gian dài hơn (1W, 3D, 2D) đều null\n  - Mẫu này dẫn đến 0 thắng, 2 thua\n\n- **Risk/Reward ratio**: \n  - Cả 2 lệnh đều không có takeProfit (chỉ có stopLoss)\n  - Tỷ lệ R:R không xác định do không có TP\n\n#### 2. Patterns phát hiện:\n- **Điều kiện WIN**: Không có lệnh thắng nào\n- **Điều kiện LOSS**: \n  - Giao dịch LONG khi tất cả chỉ số ngắn hạn (1D, 8H, 4H) đều bearish\n  - Không đặt takeProfit, chỉ có stopLoss\n- **Pattern đáng chú ý**: \n  - Đi ngược xu hướng rõ rệt (LONG trong thị trường giảm điểm)\n  - Không có quản lý rủi ro đầy đủ (không có TP)\n\n#### 3. Khuyến nghị:\n- **Nên tập trung**: \n  - Giao dịch theo xu hướng thị trường\n  - Xem xét cả khung thời gian dài hơn (1W, 3D, 2D)\n  \n- **Nên tránh**: \n  - Giao dịch LONG khi tất cả chỉ số ngắn hạn đều bearish\n  - Giao dịch không có takeProfit\n  \n- **Điều chỉnh chiến lược**:\n  - Bắt buộc phải đặt cả stopLoss và takeProfit\n  - Chỉ giao dịch khi xu hướng trên các khung thời gian ngắn nhất phù hợp với hướng giao dịch\n  - Cần thêm dữ liệu mẫu để đánh giá chính xác hơn