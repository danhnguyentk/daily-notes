/**
 * Handler for HARSI check command
 * Allows users to record HARSI values (1D, 8h, 4h) and get recommendations
 */

import { Env } from '../types/env';
import { MarketState, OrderConversationStep, CallbackDataPrefix, TradingSymbol } from '../types/orderTypes';
import { sendMessageToTelegram, TelegramInlineKeyboardMarkup } from '../services/telegramService';
import { formatHarsiValue } from '../utils/formatUtils';
import { formatVietnamTime } from '../utils/timeUtils';
import { saveHarsiCheck, TrendData, getTrends, TrendRecord } from '../services/supabaseService';
import { getConversationState, saveConversationState, clearConversationState } from '../services/orderConversationService';

interface HarsiValues {
  harsi1w?: MarketState;
  harsi3d?: MarketState;
  harsi2d?: MarketState;
  harsi1d?: MarketState;
  harsi8h?: MarketState;
  harsi4h?: MarketState;
}

/**
 * Create inline keyboard for HARSI check market state selection
 */
function createHarsiCheckMarketStateKeyboard(): TelegramInlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [
        { text: '📈 Bullish', callback_data: `${CallbackDataPrefix.HARSI_CHECK}${MarketState.Bullish}` },
        { text: '📉 Bearish', callback_data: `${CallbackDataPrefix.HARSI_CHECK}${MarketState.Bearish}` },
      ],
      [
        { text: '⚪ Neutral', callback_data: `${CallbackDataPrefix.HARSI_CHECK}${MarketState.Neutral}` },
        { text: '⏭️ Skip', callback_data: CallbackDataPrefix.HARSI_CHECK_SKIP },
      ],
    ],
  };
}

/**
 * Calculate trend from HARSI values
 * Returns 'bullish' if majority bullish, 'bearish' if majority bearish, undefined if unclear
 */
function calculateTrendFromHarsi(harsiValues: HarsiValues): MarketState | undefined {
  const values = [
    harsiValues.harsi1w,
    harsiValues.harsi3d,
    harsiValues.harsi2d,
    harsiValues.harsi1d,
    harsiValues.harsi8h,
    harsiValues.harsi4h,
  ].filter(v => v !== undefined) as MarketState[];
  if (values.length === 0) return undefined;
  
  const bullishCount = values.filter(v => v === MarketState.Bullish).length;
  const bearishCount = values.filter(v => v === MarketState.Bearish).length;
  
  if (bullishCount > bearishCount) {
    return MarketState.Bullish;
  } else if (bearishCount > bullishCount) {
    return MarketState.Bearish;
  }
  
  // If equal or unclear, return undefined (no clear trend)
  return undefined;
}

/**
 * Generate recommendation based on HARSI values
 */
function generateRecommendation(harsiValues: HarsiValues): string {
  const recommendations: string[] = [];
  
  // Check for bearish signals
  const allValues = [
    harsiValues.harsi1w,
    harsiValues.harsi3d,
    harsiValues.harsi2d,
    harsiValues.harsi1d,
    harsiValues.harsi8h,
    harsiValues.harsi4h,
  ];
  const bearishCount = allValues.filter(h => h === MarketState.Bearish).length;
  const bullishCount = allValues.filter(h => h === MarketState.Bullish).length;
  const neutralCount = allValues.filter(h => h === MarketState.Neutral).length;
  
  // Warning for multiple bearish signals
  if (bearishCount >= 2) {
    recommendations.push(`⚠️ CẢNH BÁO RỦI RO`);
    recommendations.push(``);
    recommendations.push(`Có ${bearishCount} khung thời gian đang ở trạng thái Bearish (Giảm).`);
    recommendations.push(``);
    recommendations.push(`📌 Lưu ý:`);
    recommendations.push(`   • Thị trường có xu hướng giảm trên nhiều khung thời gian`);
    recommendations.push(`   • Dễ dàng chạm Stop Loss nếu xu hướng giảm tiếp tục`);
    recommendations.push(`   • Nên cân nhắc kỹ trước khi vào lệnh`);
    recommendations.push(`   • Đảm bảo Stop Loss được đặt hợp lý và quản lý rủi ro tốt`);
    recommendations.push(``);
    recommendations.push(`💡 Gợi ý:`);
    recommendations.push(`   • Xem xét các tín hiệu phân tích kỹ thuật khác`);
    recommendations.push(`   • Quản lý vốn cẩn thận, không nên risk quá nhiều`);
    recommendations.push(`   • Có thể chờ đợi tín hiệu tốt hơn trước khi vào lệnh`);
  } else if (harsiValues.harsi8h === MarketState.Bearish) {
    // Specific warning for 8H bearish (similar to order flow)
    recommendations.push(`⚠️ CẢNH BÁO RỦI RO`);
    recommendations.push(``);
    recommendations.push(`HARSI 8H đang ở trạng thái Bearish (Giảm).`);
    recommendations.push(``);
    recommendations.push(`📌 Lưu ý:`);
    recommendations.push(`   • Thị trường có xu hướng giảm trên khung thời gian 8 giờ`);
    recommendations.push(`   • Dễ dàng chạm Stop Loss nếu xu hướng giảm tiếp tục`);
    recommendations.push(`   • Nên cân nhắc kỹ trước khi vào lệnh`);
    recommendations.push(`   • Đảm bảo Stop Loss được đặt hợp lý và quản lý rủi ro tốt`);
    recommendations.push(``);
    recommendations.push(`💡 Gợi ý:`);
    recommendations.push(`   • Kiểm tra lại các khung thời gian khác (1D, 4H)`);
    recommendations.push(`   • Xem xét các tín hiệu phân tích kỹ thuật khác`);
    recommendations.push(`   • Quản lý vốn cẩn thận, không nên risk quá nhiều`);
  } else if (bullishCount >= 2) {
    // Positive signal for multiple bullish
    recommendations.push(`✅ TÍN HIỆU TÍCH CỰC`);
    recommendations.push(``);
    recommendations.push(`Có ${bullishCount} khung thời gian đang ở trạng thái Bullish (Tăng).`);
    recommendations.push(``);
    recommendations.push(`📌 Lưu ý:`);
    recommendations.push(`   • Thị trường có xu hướng tăng trên nhiều khung thời gian`);
    recommendations.push(`   • Có thể cân nhắc vào lệnh LONG nếu có tín hiệu xác nhận`);
    recommendations.push(`   • Vẫn cần quản lý rủi ro và đặt Stop Loss hợp lý`);
    recommendations.push(``);
    recommendations.push(`💡 Gợi ý:`);
    recommendations.push(`   • Tìm điểm vào lệnh tốt với Risk/Reward ratio hợp lý`);
    recommendations.push(`   • Xem xét các tín hiệu phân tích kỹ thuật khác để xác nhận`);
    recommendations.push(`   • Quản lý vốn cẩn thận`);
  } else if (neutralCount >= 2) {
    // Neutral/mixed signals
    recommendations.push(`⚪ TÍN HIỆU HỖN HỢP`);
    recommendations.push(``);
    recommendations.push(`Có ${neutralCount} khung thời gian ở trạng thái Neutral.`);
    recommendations.push(``);
    recommendations.push(`📌 Lưu ý:`);
    recommendations.push(`   • Thị trường đang trong trạng thái không rõ ràng`);
    recommendations.push(`   • Cần thêm tín hiệu xác nhận trước khi vào lệnh`);
    recommendations.push(``);
    recommendations.push(`💡 Gợi ý:`);
    recommendations.push(`   • Chờ đợi tín hiệu rõ ràng hơn`);
    recommendations.push(`   • Xem xét các khung thời gian khác và các chỉ báo kỹ thuật`);
    recommendations.push(`   • Quản lý rủi ro cẩn thận`);
  } else {
    // Default neutral recommendation
    recommendations.push(`📊 PHÂN TÍCH HARSI`);
    recommendations.push(``);
    recommendations.push(`Đã ghi nhận các giá trị HARSI.`);
    recommendations.push(``);
    recommendations.push(`💡 Gợi ý:`);
    recommendations.push(`   • Xem xét các tín hiệu phân tích kỹ thuật khác`);
    recommendations.push(`   • Quản lý rủi ro cẩn thận`);
    recommendations.push(`   • Đảm bảo Stop Loss được đặt hợp lý`);
  }
  
  return recommendations.join('\n');
}

/**
 * Format trend record for display
 */
function formatTrendRecord(trend: TrendRecord): string {
  const formatValue = (value?: string): string => {
    if (!value) return 'N/A';
    switch (value) {
      case 'bullish':
        return '🟢 Bullish';
      case 'bearish':
        return '🔴 Bearish';
      case 'neutral':
        return '⚪ Neutral';
      default:
        return value;
    }
  };

  const surveyedDate = trend.surveyed_at 
    ? formatVietnamTime(new Date(trend.surveyed_at))
    : 'N/A';

  const symbolText = trend.symbol ? `\n• Symbol: ${trend.symbol}` : '';
  return `
📊 Kết quả kiểm tra HARSI:${symbolText}
📅 Thời gian: ${surveyedDate}

• HARSI 1W: ${formatValue(trend.harsi1w)}
• HARSI 3D: ${formatValue(trend.harsi3d)}
• HARSI 2D: ${formatValue(trend.harsi2d)}
• HARSI 1D: ${formatValue(trend.harsi1d)}
• HARSI 8H: ${formatValue(trend.harsi8h)}
• HARSI 4H: ${formatValue(trend.harsi4h)}
• Xu hướng: ${trend.trend ? formatValue(trend.trend) : 'Không rõ ràng'}

${trend.recommendation || ''}
  `.trim();
}

/**
 * Show latest trend survey
 */
export async function showLatestTrend(chatId: string, env: Env, symbol?: TradingSymbol): Promise<void> {
  const trends = await getTrends(1, env, symbol);
  const latestTrend = trends[0];
  const currentSymbol = symbol || latestTrend?.symbol;
  const symbolStr = currentSymbol?.toString() || '';

  // Determine callback data and symbol name based on symbol
  let surveyCallbackData = CallbackDataPrefix.TREND_SURVEY;
  let symbolName = '';
  if (symbolStr === TradingSymbol.BTCUSDT.toString()) {
    surveyCallbackData = CallbackDataPrefix.TREND_SURVEY_BTC;
    symbolName = 'BTC';
  } else if (symbolStr === TradingSymbol.ETHUSDT.toString()) {
    surveyCallbackData = CallbackDataPrefix.TREND_SURVEY_ETH;
    symbolName = 'ETH';
  } else if (symbolStr === TradingSymbol.XAUUSD.toString()) {
    surveyCallbackData = CallbackDataPrefix.TREND_SURVEY_XAU;
    symbolName = 'XAU';
  }

  let message: string;
  if (trends.length === 0) {
    const symbolLabel = symbolStr || 'symbol này';
    message = `📊 Not trends now for ${symbolLabel}.\n\nVui lòng bắt đầu khảo sát mới.`;
  } else {
    message = formatTrendRecord(latestTrend);
  }

  const buttonText = symbolName ? `🔄 Khảo Sát Mới ${symbolName}` : '🔄 Khảo Sát Mới';

  const keyboard: TelegramInlineKeyboardMarkup = {
    inline_keyboard: [
      [
        { text: buttonText, callback_data: surveyCallbackData },
      ],
    ],
  };

  await sendMessageToTelegram({
    chat_id: chatId,
    text: message,
    reply_markup: keyboard,
  }, env);
}

/**
 * Start HARSI check conversation
 */
export async function startHarsiCheck(userId: number, chatId: string, env: Env, symbol?: TradingSymbol): Promise<void> {
  // Initialize conversation state
  const state = {
    userId,
    step: OrderConversationStep.WAITING_HARSI_CHECK_1W,
    data: { symbol } as TrendData & { symbol?: TradingSymbol },
    createdAt: Date.now(),
  };
  
  await saveConversationState(state, env);
  
  const symbolText = symbol ? ` (${symbol})` : '';
  const message = `📊 Kiểm tra HARSI${symbolText}\n\nVui lòng chọn HARSI 1W:`;
  
  await sendMessageToTelegram({
    chat_id: chatId,
    text: message,
    reply_markup: createHarsiCheckMarketStateKeyboard(),
  }, env);
}

/**
 * Handle HARSI check selection
 */
export async function handleHarsiCheckSelection(
  userId: number,
  chatId: string,
  marketState: MarketState | 'skip',
  env: Env
): Promise<void> {
  const state = await getConversationState(userId, env);
  if (!state) {
    await sendMessageToTelegram({
      chat_id: chatId,
      text: '❌ Không tìm thấy phiên kiểm tra HARSI.',
    }, env);
    return;
  }

  if (state.step === OrderConversationStep.WAITING_HARSI_CHECK_1W) {
    if (marketState === 'skip') {
      state.data.harsi1w = undefined;
    } else {
      state.data.harsi1w = marketState;
    }
    state.step = OrderConversationStep.WAITING_HARSI_CHECK_3D;
    await saveConversationState(state, env);
    
    const message = `✅ HARSI 1W: ${formatHarsiValue(state.data.harsi1w)}\n\nVui lòng chọn HARSI 3D:`;
    await sendMessageToTelegram({ 
      chat_id: chatId, 
      text: message,
      reply_markup: createHarsiCheckMarketStateKeyboard(),
    }, env);
  } else if (state.step === OrderConversationStep.WAITING_HARSI_CHECK_3D) {
    if (marketState === 'skip') {
      state.data.harsi3d = undefined;
    } else {
      state.data.harsi3d = marketState;
    }
    state.step = OrderConversationStep.WAITING_HARSI_CHECK_2D;
    await saveConversationState(state, env);
    
    const message = `✅ HARSI 3D: ${formatHarsiValue(state.data.harsi3d)}\n\nVui lòng chọn HARSI 2D:`;
    await sendMessageToTelegram({ 
      chat_id: chatId, 
      text: message,
      reply_markup: createHarsiCheckMarketStateKeyboard(),
    }, env);
  } else if (state.step === OrderConversationStep.WAITING_HARSI_CHECK_2D) {
    if (marketState === 'skip') {
      state.data.harsi2d = undefined;
    } else {
      state.data.harsi2d = marketState;
    }
    state.step = OrderConversationStep.WAITING_HARSI_CHECK_1D;
    await saveConversationState(state, env);
    
    const message = `✅ HARSI 2D: ${formatHarsiValue(state.data.harsi2d)}\n\nVui lòng chọn HARSI 1D:`;
    await sendMessageToTelegram({ 
      chat_id: chatId, 
      text: message,
      reply_markup: createHarsiCheckMarketStateKeyboard(),
    }, env);
  } else if (state.step === OrderConversationStep.WAITING_HARSI_CHECK_1D) {
    if (marketState === 'skip') {
      state.data.harsi1d = undefined;
    } else {
      state.data.harsi1d = marketState;
    }
    state.step = OrderConversationStep.WAITING_HARSI_CHECK_8H;
    await saveConversationState(state, env);
    
    const message = `✅ HARSI 1D: ${formatHarsiValue(state.data.harsi1d)}\n\nVui lòng chọn HARSI 8H:`;
    await sendMessageToTelegram({ 
      chat_id: chatId, 
      text: message,
      reply_markup: createHarsiCheckMarketStateKeyboard(),
    }, env);
  } else if (state.step === OrderConversationStep.WAITING_HARSI_CHECK_8H) {
    if (marketState === 'skip') {
      state.data.harsi8h = undefined;
    } else {
      state.data.harsi8h = marketState;
    }
    state.step = OrderConversationStep.WAITING_HARSI_CHECK_4H;
    await saveConversationState(state, env);
    
    const message = `✅ HARSI 8H: ${formatHarsiValue(state.data.harsi8h)}\n\nVui lòng chọn HARSI 4H:`;
    await sendMessageToTelegram({ 
      chat_id: chatId, 
      text: message,
      reply_markup: createHarsiCheckMarketStateKeyboard(),
    }, env);
  } else if (state.step === OrderConversationStep.WAITING_HARSI_CHECK_4H) {
    if (marketState === 'skip') {
      state.data.harsi4h = undefined;
    } else {
      state.data.harsi4h = marketState;
    }
    
    // Calculate trend from HARSI values
    const harsiValues: HarsiValues = {
      harsi1w: state.data.harsi1w,
      harsi3d: state.data.harsi3d,
      harsi2d: state.data.harsi2d,
      harsi1d: state.data.harsi1d,
      harsi8h: state.data.harsi8h,
      harsi4h: state.data.harsi4h,
    };
    const calculatedTrend = calculateTrendFromHarsi(harsiValues);
    
    // Generate recommendation
    const recommendation = generateRecommendation(harsiValues);
    
    // Save to database with calculated trend
    const symbol = (state.data as TrendData & { symbol?: TradingSymbol }).symbol;
    const trendDataWithTrend: TrendData = {
      ...state.data,
      symbol,
      trend: calculatedTrend,
    };
    await saveHarsiCheck(userId, trendDataWithTrend, recommendation, env);
    
    // Clear conversation state
    await clearConversationState(userId, env);
    
    // Show summary and recommendation
    const symbolText = symbol ? `\n• Symbol: ${symbol}` : '';
    const summary = `
📊 Kết quả kiểm tra HARSI:${symbolText}

• HARSI 1W: ${formatHarsiValue(state.data.harsi1w)}
• HARSI 3D: ${formatHarsiValue(state.data.harsi3d)}
• HARSI 2D: ${formatHarsiValue(state.data.harsi2d)}
• HARSI 1D: ${formatHarsiValue(state.data.harsi1d)}
• HARSI 8H: ${formatHarsiValue(state.data.harsi8h)}
• HARSI 4H: ${formatHarsiValue(state.data.harsi4h)}
• Xu hướng: ${calculatedTrend ? formatHarsiValue(calculatedTrend) : 'Không rõ ràng'}

${recommendation}
    `.trim();
    
    await sendMessageToTelegram({
      chat_id: chatId,
      text: summary,
    }, env);
  } else {
    await sendMessageToTelegram({
      chat_id: chatId,
      text: '❌ Không ở bước kiểm tra HARSI.',
    }, env);
  }
}

