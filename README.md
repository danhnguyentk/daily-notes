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
- Support alert when indiator splot -20 , later green 8h
- Format message log telegram


Example markdown logs
### content
### Phân tích giao dịch\n\n#### 1. Phân tích thắng/thua theo các yếu tố:\n- **Hướng giao dịch**: \n  - Cả 2 lệnh đều là LONG và đều thua\n  - Không có dữ liệu SHORT để so sánh\n\n- **Symbol**: \n  - Cả 2 lệnh đều trên ETHUSDT và đều thua\n  - Không có dữ liệu BTCUSDT/XAUUSD để so sánh\n\n- **HARSI values**: \n  - Cả 2 lệnh đều có cùng mẫu: harsi1d, harsi8h, harsi4h đều là \"bearish\"\n  - Các khung thời gian dài hơn (1W, 3D, 2D) đều null\n  - Mẫu này dẫn đến 0 thắng, 2 thua\n\n- **Risk/Reward ratio**: \n  - Cả 2 lệnh đều không có takeProfit (chỉ có stopLoss)\n  - Tỷ lệ R:R không xác định do không có TP\n\n#### 2. Patterns phát hiện:\n- **Điều kiện WIN**: Không có lệnh thắng nào\n- **Điều kiện LOSS**: \n  - Giao dịch LONG khi tất cả chỉ số ngắn hạn (1D, 8H, 4H) đều bearish\n  - Không đặt takeProfit, chỉ có stopLoss\n- **Pattern đáng chú ý**: \n  - Đi ngược xu hướng rõ rệt (LONG trong thị trường giảm điểm)\n  - Không có quản lý rủi ro đầy đủ (không có TP)\n\n#### 3. Khuyến nghị:\n- **Nên tập trung**: \n  - Giao dịch theo xu hướng thị trường\n  - Xem xét cả khung thời gian dài hơn (1W, 3D, 2D)\n  \n- **Nên tránh**: \n  - Giao dịch LONG khi tất cả chỉ số ngắn hạn đều bearish\n  - Giao dịch không có takeProfit\n  \n- **Điều chỉnh chiến lược**:\n  - Bắt buộc phải đặt cả stopLoss và takeProfit\n  - Chỉ giao dịch khi xu hướng trên các khung thời gian ngắn nhất phù hợp với hướng giao dịch\n  - Cần thêm dữ liệu mẫu để đánh giá chính xác hơn

### reasoning_content
\nTôi cần phân tích 2 lệnh giao dịch đã đóng để đưa ra insights về các yếu tố ảnh hưởng đến kết quả giao dịch. Dữ liệu cho thấy cả hai lệnh đều thua lỗ. Hãy phân tích chi tiết từng yếu tố:\n\n### 1. Phân tích thắng/thua theo các yếu tố\n\n**Hướng giao dịch (LONG vs SHORT)**:\n- Cả hai lệnh đều là LONG\n- Kết quả: 0 thắng, 2 thua\n- Không có đủ dữ liệu để so sánh với SHORT\n\n**Symbol (BTCUSDT, ETHUSDT, XAUUSD)**:\n- Cả hai lệnh đều là ETHUSDT\n- Kết quả: 0 thắng, 2 thua\n- Không có đủ dữ liệu để so sánh với các symbol khác\n\n**HARSI values (1W, 3D, 2D, 1D, 8H, 4H)**:\n- Cả hai lệnh đều có:\n  - harsi1d: \"bearish\"\n  - harsi8h: \"bearish\"\n  - harsi4h: \"bearish\"\n  - Các khung thời gian dài hơn (1W, 3D, 2D) đều là null\n- Kết quả: 0 thắng, 2 thua\n- Có vẻ như giao dịch ngược xu hướng (đi LONG khi tất cả các chỉ số đều là bearish) dẫn đến thua lỗ\n\n**Risk/Reward ratio**:\n- Lệnh 1: actualRiskRewardRatio = -1 (không có takeProfit)\n- Lệnh 2: actualRiskRewardRatio = -2.11 (không có takeProfit)\n- Cả hai lệnh đều không có takeProfit, chỉ có stopLoss\n- Kết quả: 0 thắng, 2 thua\n- Không có đủ dữ liệu để so sánh với các tỷ lệ R:R khác\n\n### 2. Patterns phát hiện\n\n**Điều kiện thường dẫn đến WIN**:\n- Không có lệnh thắng nào trong dữ liệu\n\n**Điều kiện thường dẫn đến LOSS**:\n- Giao dịch LONG trên ETHUSDT\n- Khi các chỉ số HARSIs trên khung 1D, 8H, 4H đều là \"bearish\"\n- Không có takeProfit, chỉ có stopLoss\n- Không có thông tin về các khung thời gian dài hơn (1W, 3D, 2D)\n\n**Pattern đáng chú ý**:\n- Cả hai lệnh đều đi ngược xu hướng (LONG khi tất cả các chỉ số ngắn hạn đều bearish)\n- Cả hai lệnh đều không đặt takeProfit, chỉ đặt stopLoss\n- Các lệnh đều thua khoảng 5-6% giá trị\n\n### 3. Khuyến nghị\n\n**Nên tập trung vào loại giao dịch nào**:\n- Không đủ dữ liệu để đưa ra khuyến nghị về loại giao dịch cụ thể\n\n**Nên tránh những điều kiện nào**:\n- Tránh giao dịch LONG khi tất cả các chỉ số HARSIs trên khung 1D, 8H, 4H đều là \"bearish\"\n- Tránh giao dịch không có takeProfit\n- Cần xem xét các chỉ số trên khung thời gian dài hơn (1W, 3D, 2D) để có cái nhìn tổng quan hơn\n\n**Có cần điều chỉnh chiến lược không**:\n- Có, cần điều chỉnh chiến lược theo hướng:\n  - Đặt cả stopLoss và takeProfit\n  - Chỉ giao dịch khi xu hướng trên các khung thời gian ngắn nhất phù hợp với hướng giao dịch\n  - Cần xem xét các chỉ số trên khung thời gian dài hơn để xác định xu hướng chính\n\nTuy nhiên, cần lưu ý rằng mẫu dữ liệu quá nhỏ (chỉ 2 lệnh) nên các insights này có thể không đại diện cho toàn bộ chiến lược giao dịch. Cần nhiều dữ liệu hơn để có kết luận chính xác.