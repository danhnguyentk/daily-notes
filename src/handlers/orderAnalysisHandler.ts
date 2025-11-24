/**
 * Handler for order analysis using OpenAI
 */

import { Env } from '../types/env';
import { OrderResult } from '../types/orderTypes';
import { sendMessageToTelegram, TelegramParseMode } from '../services/telegramService';
import { getAllOrdersFromSupabase, getUserOrdersFromSupabase, convertOrderRecordToOrderData } from '../services/supabaseService';
import { analyzeWithAIProvider } from '../services/ai/aiService';

/**
 * Analyze orders and return analysis result as JSON (for API)
 */
export async function analyzeOrdersForAPI(
  env: Env
): Promise<{
  success: boolean;
  analysis?: string;
  statistics?: {
    totalOrders: number;
    winCount: number;
    lossCount: number;
    breakevenCount: number;
    winRate: string;
    totalPnL: string;
    avgPnL: string;
  };
  error?: string;
}> {
  try {
    // Fetch all orders
    const orderRecords = await getAllOrdersFromSupabase(env);
    
    // Filter only closed orders (with results)
    const closedOrders = orderRecords
      .map(record => convertOrderRecordToOrderData(record))
      .filter(order => order.orderResult && order.orderResult !== OrderResult.IN_PROGRESS);

    if (closedOrders.length === 0) {
      return {
        success: false,
        error: 'Không có lệnh đã đóng nào để phân tích. Vui lòng đóng một số lệnh trước.',
      };
    }

    // Prepare data for Zai analysis
    const analysisData = closedOrders.map(order => {
      const orderData: Record<string, unknown> = {
        result: order.orderResult,
        direction: order.direction,
        symbol: order.symbol,
        harsi1w: order.harsi1w,
        harsi3d: order.harsi3d,
        harsi2d: order.harsi2d,
        harsi1d: order.harsi1d,
        harsi8h: order.harsi8h,
        harsi4h: order.harsi4h,
        hasri2h: order.hasri2h,
        entry: order.entry,
        stopLoss: order.stopLoss,
        takeProfit: order.takeProfit,
        actualRealizedPnL: order.actualRealizedPnL,
        actualRealizedPnLUsd: order.actualRealizedPnLUsd,
        actualRealizedPnLPercent: order.actualRealizedPnLPercent,
        actualRiskRewardRatio: order.actualRiskRewardRatio,
        potentialRiskRewardRatio: order.potentialRiskRewardRatio,
      };
      return orderData;
    });

    // Calculate basic statistics
    const winCount = closedOrders.filter(o => o.orderResult === OrderResult.WIN).length;
    const lossCount = closedOrders.filter(o => o.orderResult === OrderResult.LOSS).length;
    const breakevenCount = closedOrders.filter(o => o.orderResult === OrderResult.BREAKEVEN).length;
    const winRate = closedOrders.length > 0 ? (winCount / closedOrders.length * 100).toFixed(1) : '0';
    
    const totalPnL = closedOrders.reduce((sum, o) => sum + (o.actualRealizedPnLUsd || 0), 0);
    const avgPnL = closedOrders.length > 0 ? (totalPnL / closedOrders.length).toFixed(2) : '0';

    // Create prompt for Zai
    const prompt = `Bạn là một chuyên gia phân tích giao dịch cryptocurrency. Hãy phân tích dữ liệu ${closedOrders.length} lệnh giao dịch đã đóng và đưa ra các insights sau:

1. **Phân tích thắng/thua theo các yếu tố:**
   - Hướng giao dịch (LONG vs SHORT): Trường hợp nào thắng nhiều hơn?
   - Symbol (BTCUSDT, ETHUSDT, XAUUSD): Symbol nào có tỷ lệ thắng cao hơn?
   - HARSI values (1W, 3D, 2D, 1D, 8H, 4H): Tổ hợp HARSI nào thường dẫn đến thắng/thua?
   - Risk/Reward ratio: Tỷ lệ R:R nào có kết quả tốt hơn?

2. **Patterns phát hiện:**
   - Những điều kiện nào thường dẫn đến WIN?
   - Những điều kiện nào thường dẫn đến LOSS?
   - Có pattern nào đáng chú ý không?

3. **Khuyến nghị:**
   - Nên tập trung vào loại giao dịch nào?
   - Nên tránh những điều kiện nào?
   - Có cần điều chỉnh chiến lược không?

**Dữ liệu lệnh:**
${JSON.stringify(analysisData, null, 2)}

**Thống kê tổng quan:**
- Tổng số lệnh: ${closedOrders.length}
- Thắng: ${winCount} (${winRate}%)
- Thua: ${lossCount}
- Hòa: ${breakevenCount}
- Tổng P&L: $${totalPnL.toFixed(2)}
- P&L trung bình: $${avgPnL}

Hãy trả lời bằng tiếng Việt, ngắn gọn và cụ thể.`;

    // System prompt for trading analysis
    const systemPrompt = 'Bạn là một chuyên gia phân tích giao dịch cryptocurrency với nhiều năm kinh nghiệm. Hãy phân tích dữ liệu và đưa ra insights thực tế, hữu ích.';

    // Call AI API using the unified service
    const analysisResult = await analyzeWithAIProvider(
      env,
      prompt,
      systemPrompt,
      0.7,
      2000
    );

    return {
      success: true,
      analysis: analysisResult,
      statistics: {
        totalOrders: closedOrders.length,
        winCount,
        lossCount,
        breakevenCount,
        winRate,
        totalPnL: totalPnL.toFixed(2),
        avgPnL,
      },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Error analyzing orders with AI:', errorMessage);
    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Analyze orders using Zai to find win/loss patterns and suggestions
 */
export async function analyzeOrdersWithAI(
  userId: number,
  chatId: string,
  env: Env
): Promise<void> {
  try {
    // Send typing indicator
    await sendMessageToTelegram({
      chat_id: chatId,
      text: '🤖 Đang phân tích dữ liệu lệnh...',
    }, env);

    // Fetch all orders for the user
    const orderRecords = await getUserOrdersFromSupabase(userId, env);
    
    // Filter only closed orders (with results)
    const closedOrders = orderRecords
      .map(record => convertOrderRecordToOrderData(record))
      .filter(order => order.orderResult && order.orderResult !== OrderResult.IN_PROGRESS);

    if (closedOrders.length === 0) {
      await sendMessageToTelegram({
        chat_id: chatId,
        text: '❌ Không có lệnh đã đóng nào để phân tích. Vui lòng đóng một số lệnh trước.',
      }, env);
      return;
    }

    // Prepare data for Zai analysis
    const analysisData = closedOrders.map(order => {
      const orderData: Record<string, unknown> = {
        result: order.orderResult,
        direction: order.direction,
        symbol: order.symbol,
        harsi1w: order.harsi1w,
        harsi3d: order.harsi3d,
        harsi2d: order.harsi2d,
        harsi1d: order.harsi1d,
        harsi8h: order.harsi8h,
        harsi4h: order.harsi4h,
        hasri2h: order.hasri2h,
        entry: order.entry,
        stopLoss: order.stopLoss,
        takeProfit: order.takeProfit,
        actualRealizedPnL: order.actualRealizedPnL,
        actualRealizedPnLUsd: order.actualRealizedPnLUsd,
        actualRealizedPnLPercent: order.actualRealizedPnLPercent,
        actualRiskRewardRatio: order.actualRiskRewardRatio,
        potentialRiskRewardRatio: order.potentialRiskRewardRatio,
      };
      return orderData;
    });

    // Calculate basic statistics
    const winCount = closedOrders.filter(o => o.orderResult === OrderResult.WIN).length;
    const lossCount = closedOrders.filter(o => o.orderResult === OrderResult.LOSS).length;
    const breakevenCount = closedOrders.filter(o => o.orderResult === OrderResult.BREAKEVEN).length;
    const winRate = closedOrders.length > 0 ? (winCount / closedOrders.length * 100).toFixed(1) : '0';
    
    const totalPnL = closedOrders.reduce((sum, o) => sum + (o.actualRealizedPnLUsd || 0), 0);
    const avgPnL = closedOrders.length > 0 ? (totalPnL / closedOrders.length).toFixed(2) : '0';

    // Create prompt for Zai
    const prompt = `Bạn là một chuyên gia phân tích giao dịch cryptocurrency. Hãy phân tích dữ liệu ${closedOrders.length} lệnh giao dịch đã đóng và đưa ra các insights sau:

1. **Phân tích thắng/thua theo các yếu tố:**
   - Hướng giao dịch (LONG vs SHORT): Trường hợp nào thắng nhiều hơn?
   - Symbol (BTCUSDT, ETHUSDT, XAUUSD): Symbol nào có tỷ lệ thắng cao hơn?
   - HARSI values (1W, 3D, 2D, 1D, 8H, 4H): Tổ hợp HARSI nào thường dẫn đến thắng/thua?
   - Risk/Reward ratio: Tỷ lệ R:R nào có kết quả tốt hơn?

2. **Patterns phát hiện:**
   - Những điều kiện nào thường dẫn đến WIN?
   - Những điều kiện nào thường dẫn đến LOSS?
   - Có pattern nào đáng chú ý không?

3. **Khuyến nghị:**
   - Nên tập trung vào loại giao dịch nào?
   - Nên tránh những điều kiện nào?
   - Có cần điều chỉnh chiến lược không?

**Dữ liệu lệnh:**
${JSON.stringify(analysisData, null, 2)}

**Thống kê tổng quan:**
- Tổng số lệnh: ${closedOrders.length}
- Thắng: ${winCount} (${winRate}%)
- Thua: ${lossCount}
- Hòa: ${breakevenCount}
- Tổng P&L: $${totalPnL.toFixed(2)}
- P&L trung bình: $${avgPnL}

Hãy trả lời bằng tiếng Việt, ngắn gọn và cụ thể.`;

    // System prompt for trading analysis
    const systemPrompt = 'Bạn là một chuyên gia phân tích giao dịch cryptocurrency với nhiều năm kinh nghiệm. Hãy phân tích dữ liệu và đưa ra insights thực tế, hữu ích.';

    // Call AI API using the unified service
    const analysisResult = await analyzeWithAIProvider(
      env,
      prompt,
      systemPrompt,
      0.7,
      2000
    );

    // Format and send the result
    const message = `📊 **Phân tích lệnh giao dịch**\n\n${analysisResult}\n\n---\n📈 Dựa trên ${closedOrders.length} lệnh đã đóng`;
    console.log('Analysis result:', message);

    await sendMessageToTelegram({
      chat_id: chatId,
      text: message,
      parse_mode: TelegramParseMode.Markdown,
    }, env);

  } catch (error) {
    const errorLogs = {
      error: error instanceof Error ? error.message : String(error),
    };
    console.error('Error analyzing orders with AI:', JSON.stringify(errorLogs, null, 2));
    await sendMessageToTelegram({
      chat_id: chatId,
      text: `❌ Lỗi khi phân tích: ${JSON.stringify(errorLogs, null, 2)}`,
    }, env);
  }
}

