/**
 * HTTP request handlers
 */

import { EventKey } from '../services/supabaseService';
import { fetchAndNotifyEtf } from '../services/fetchBtcEtf';
import { TelegramCommands, TelegramMessageTitle, TelegramWebhookRequest, sendMessageToTelegram, answerCallbackQuery, setWebhookTelegram, TelegramParseMode, TelegramInlineKeyboardMarkup, sendImageGroupToTelegram, TelegramImageRequest } from '../services/telegramService';
import { Env } from '../types/env';
import { getCurrentPriceAndNotify, KuCoinSymbol, KuCoinInterval } from '../services/kucoinService';
import { getXAUPriceAndNotify } from '../services/goldService';
import { snapshotChart, snapshotChartWithSpecificInterval } from './chartHandlers';
import { TradingviewInterval, getTradingViewImage } from '../services/tradingviewService';
import { formatVietnamTime } from '../utils/timeUtils';
import { notifyNumberClosedCandlesBullish } from './candleHandlers';
import { takeTelegramAction } from './telegramHandlers';
import {
  startOrderConversation,
  cancelOrderConversation,
  showOrderPreview,
  processOrderInput,
  getConversationState,
  addNoteToOrder,
  clearNotes,
  finishNotesSelection,
  clearConversationState,
  saveConversationState,
} from '../services/orderConversationService';
import { processOrderData } from './orderHandlers';
import { OrderConversationStep, MarketState, CallbackDataPrefix, TradingSymbol } from '../types/orderTypes';
import {
  showRiskUnitStatistics,
  showMonthlyStatistics,
  showOrderSelectionForUpdate,
  getOrderById,
  showOrderListForView,
  showOrderDetails,
  deleteOrder,
  showDeleteOrderConfirmation,
  showOrderMenu,
  showStatisticsMenu,
  showAllStatistics,
  showCurrentMonthStatistics,
  showPreviousMonthStatistics,
  showCurrentWeekStatistics,
  showPreviousWeekStatistics,
  showExperienceMenu,
  showExitGuide,
} from './orderStatisticsHandler';
import { showChartMenu } from './chartMenuHandler';
import { handleAllEvents } from './telegramHandlers';
import { startHarsiCheck, handleHarsiCheckSelection, showLatestTrend } from './harsiCheckHandler';
import { analyzeOrdersForAPI } from './orderAnalysisHandler';
import { saveOrderAnalysis, getLatestOrderAnalysis } from '../services/supabaseService';
import { sendPushoverAlert } from '../services/pushoverService';

// Route constants
const ROUTES = {
  ORDER_ANALYSIS: '/analyze',
  SET_WEBHOOK_TELEGRAM: '/setWebhookTelegram',
  ETF: '/etf',
  SNAPSHOT_CHART: '/snapshotChart',
  WEBHOOK: '/webhook',
  TRADINGVIEW_WEBHOOK: '/tradingview-webhook',
  NOTIFY_ONE_CLOSED_15M_CANDLES_BULLISH: '/notifyOneClosed15mCandlesBullish',
  NOTIFY_TWO_CLOSED_15M_CANDLES_BULLISH: '/notifyTwoClosed15mCandlesBullish',
  ENABLE_NOTIFY_TWO_CLOSED_15M_CANDLES_BULLISH: '/enableNotifyTwoClosed15mCandlesBullish',
  ENABLE_NOTIFY_ONE_CLOSED_15M_CANDLES_BULLISH: '/enableNotifyOneClosed15mCandlesBullish',
  DISABLE_NOTIFY_TWO_CLOSED_15M_CANDLES_BULLISH: '/disableNotifyTwoClosed15mCandlesBullish',
  DISABLE_NOTIFY_ONE_CLOSED_15M_CANDLES_BULLISH: '/disableNotifyOneClosed15mCandlesBullish',
} as const;

// Helper functions
function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data, null, 2), { 
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

function textResponse(text: string, status = 200): Response {
  return new Response(text, { status });
}

interface CandleNotificationConfig {
  limit: number;
  eventKey: EventKey;
}

async function handleCandleNotification(
  config: CandleNotificationConfig,
  env: Env
): Promise<Response> {
  const result = await notifyNumberClosedCandlesBullish({
    symbol: KuCoinSymbol.BTCUSDT,
    interval: KuCoinInterval.FIFTEEN_MINUTES,
    limit: config.limit,
  }, env);
  return jsonResponse(result);
}

async function handleEnableNotification(
  eventKey: EventKey,
  message: string,
  env: Env
): Promise<Response> {
  await env.DAILY_NOTES_KV.put(eventKey, 'true');
  return textResponse(message);
}

async function handleDisableNotification(
  eventKey: EventKey,
  message: string,
  env: Env
): Promise<Response> {
  await env.DAILY_NOTES_KV.delete(eventKey);
  return textResponse(message);
}

async function handleWebhook(req: Request, env: Env): Promise<Response> {
  const body: TelegramWebhookRequest = await req.json();
  
  try {
    // Handle callback_query (button clicks)
    if (body.callback_query) {
      const callbackQuery = body.callback_query;
      const userId = callbackQuery.from.id;
      const chatId = callbackQuery.message?.chat.id.toString() || '';
      const callbackData = callbackQuery.data;
      
      console.log(`Received callback query from user ${userId}. Chat ID: ${chatId}. Callback Data: ${callbackData}`);
      
      // Track if callback query has been answered
      let callbackAnswered = false;
      
      // Handle view order selection
      if (callbackData.startsWith(CallbackDataPrefix.VIEW_ORDER)) {
        callbackAnswered = true;
        const orderId = callbackData.substring(CallbackDataPrefix.VIEW_ORDER.length);
        await showOrderDetails(orderId, chatId, env);
        return textResponse('Order details shown');
      }

      // Handle delete order confirmation request
      if (callbackData.startsWith(CallbackDataPrefix.DELETE_ORDER) && 
          !callbackData.startsWith(CallbackDataPrefix.DELETE_ORDER_CONFIRM) &&
          callbackData !== CallbackDataPrefix.DELETE_ORDER_CANCEL) {
        callbackAnswered = true;
        const orderId = callbackData.substring(CallbackDataPrefix.DELETE_ORDER.length);
        await showDeleteOrderConfirmation(orderId, userId, chatId, env);
        return textResponse('Delete confirmation shown');
      }

      // Handle delete order confirmation
      if (callbackData.startsWith(CallbackDataPrefix.DELETE_ORDER_CONFIRM)) {
        callbackAnswered = true;
        const orderId = callbackData.substring(CallbackDataPrefix.DELETE_ORDER_CONFIRM.length);
        await deleteOrder(orderId, userId, chatId, env);
        return textResponse('Order deletion processed');
      }

      // Handle delete order cancellation
      if (callbackData === CallbackDataPrefix.DELETE_ORDER_CANCEL) {
        callbackAnswered = true;
        await sendMessageToTelegram({
          chat_id: chatId,
          text: '✅ Đã hủy thao tác xóa lệnh.',
        }, env);
        return textResponse('Delete cancelled');
      }

      // Handle close order (update close price)
      if (callbackData.startsWith(CallbackDataPrefix.CLOSE_ORDER)) {
        callbackAnswered = true;
        const orderId = callbackData.substring(CallbackDataPrefix.CLOSE_ORDER.length);
        const order = await getOrderById(orderId, env);
        
        if (!order) {
          await sendMessageToTelegram({
            chat_id: chatId,
            text: '❌ Không tìm thấy lệnh này.',
          }, env);
          return textResponse('Order not found');
        }

        // Tạo conversation state để nhập actual close price
        await saveConversationState({
          userId,
          step: OrderConversationStep.WAITING_CLOSE_PRICE,
          data: order,
          createdAt: Date.now(),
          selectedOrderId: orderId,
        }, env);

        await sendMessageToTelegram({
          chat_id: chatId,
          text: `✅ Đã chọn lệnh:\n\nSymbol: ${order.symbol}\nDirection: ${order.direction}\nEntry: ${order.entry}\nStop Loss: ${order.stopLoss}\n\nVui lòng nhập Close Price:\n(Stop Loss: /${order.stopLoss})`,
        }, env);
        return textResponse('Order selected for update');
      }

      // Handle update close price (for already closed orders)
      if (callbackData.startsWith(CallbackDataPrefix.UPDATE_CLOSE_PRICE)) {
        callbackAnswered = true;
        const orderId = callbackData.substring(CallbackDataPrefix.UPDATE_CLOSE_PRICE.length);
        const order = await getOrderById(orderId, env);
        
        if (!order) {
          await sendMessageToTelegram({
            chat_id: chatId,
            text: '❌ Không tìm thấy lệnh này.',
          }, env);
          return textResponse('Order not found');
        }

        // Tạo conversation state để nhập lại actual close price
        await saveConversationState({
          userId,
          step: OrderConversationStep.WAITING_CLOSE_PRICE,
          data: order,
          createdAt: Date.now(),
          selectedOrderId: orderId,
        }, env);

        const currentClosePrice = order.actualClosePrice ? `\nClose Price hiện tại: ${order.actualClosePrice}` : '';
        await sendMessageToTelegram({
          chat_id: chatId,
          text: `✅ Đã chọn lệnh để cập nhật Close Price:\n\nSymbol: ${order.symbol}\nDirection: ${order.direction}\nEntry: ${order.entry}\nStop Loss: ${order.stopLoss}${currentClosePrice}\n\nVui lòng nhập Close Price mới:\n(Stop Loss: /${order.stopLoss})`,
        }, env);
        return textResponse('Order selected for close price update');
      }

      // Handle order menu actions
      if (callbackData === CallbackDataPrefix.ORDER_NEW) {
        await answerCallbackQuery(callbackQuery.id, env, 'Đang tạo lệnh mới...');
        callbackAnswered = true;
        await startOrderConversation(userId, chatId, env);
        return textResponse('Order conversation started');
      }

      if (callbackData === CallbackDataPrefix.ORDER_CANCEL) {
        await answerCallbackQuery(callbackQuery.id, env, 'Đã hủy lệnh');
        callbackAnswered = true;
        await cancelOrderConversation(userId, chatId, env);
        return textResponse('Order conversation cancelled');
      }


      if (callbackData === CallbackDataPrefix.ORDER_PREVIEW) {
        await answerCallbackQuery(callbackQuery.id, env, 'Đang hiển thị preview...');
        callbackAnswered = true;
        await showOrderPreview(userId, chatId, env);
        return textResponse('Order preview shown');
      }

      if (callbackData === CallbackDataPrefix.ORDER_UPDATE) {
        await answerCallbackQuery(callbackQuery.id, env, 'Đang tải danh sách lệnh...');
        callbackAnswered = true;
        await showOrderSelectionForUpdate(userId, chatId, env);
        return textResponse('Order selection shown');
      }

      if (callbackData === CallbackDataPrefix.ORDER_VIEW) {
        await answerCallbackQuery(callbackQuery.id, env, 'Đang tải danh sách lệnh...');
        callbackAnswered = true;
        await showOrderListForView(userId, chatId, env);
        return textResponse('Order list shown');
      }

      // Handle order analysis button - show latest analysis from database
      if (callbackData === CallbackDataPrefix.ORDER_ANALYZE) {
        await answerCallbackQuery(callbackQuery.id, env, 'Đang tải phân tích...');
        callbackAnswered = true;
        
        try {
          const latestAnalysis = await getLatestOrderAnalysis(env);
          
          if (!latestAnalysis) {
            await sendMessageToTelegram({
              chat_id: chatId,
              text: '❌ Chưa có phân tích nào. Vui lòng chạy phân tích trước qua API /analyze.',
            }, env);
            return textResponse('No analysis found');
          }
          
          // Format and send the latest analysis
          const analyzedDate = latestAnalysis.analyzed_at 
            ? new Date(latestAnalysis.analyzed_at).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })
            : 'N/A';
          
          const statsMessage = `📊 **Phân tích lệnh giao dịch**\n\n` +
            `📅 Thời gian phân tích: ${analyzedDate}\n\n` +
            `**Thống kê:**\n` +
            `• Tổng số lệnh: ${latestAnalysis.total_orders}\n` +
            `• Thắng: ${latestAnalysis.win_count}\n` +
            `• Thua: ${latestAnalysis.loss_count}\n` +
            `• Hòa: ${latestAnalysis.breakeven_count}\n` +
            `• Tỷ lệ thắng: ${latestAnalysis.win_rate}%\n` +
            `• Tổng P&L: $${latestAnalysis.total_pnl}\n` +
            `• P&L trung bình: $${latestAnalysis.avg_pnl}\n\n` +
            `**Phân tích:**\n${latestAnalysis.analysis}`;
          
          await sendMessageToTelegram({
            chat_id: chatId,
            text: statsMessage,
            parse_mode: TelegramParseMode.Markdown,
          }, env);
          
          return textResponse('Latest analysis shown');
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          await sendMessageToTelegram({
            chat_id: chatId,
            text: `❌ Lỗi khi tải phân tích: ${errorMessage}`,
          }, env);
          return textResponse('Error loading analysis');
        }
      }

      // Handle separator (do nothing, just answer the callback)
      if (callbackData === 'order_separator') {
        await answerCallbackQuery(callbackQuery.id, env);
        callbackAnswered = true;
        return textResponse('Separator clicked');
      }

      // Handle chart menu actions
      if (callbackData === CallbackDataPrefix.CHART_BTC_PRICE) {
        await answerCallbackQuery(callbackQuery.id, env, 'Đang lấy giá BTC...');
        callbackAnswered = true;
        try {
          await getCurrentPriceAndNotify(KuCoinSymbol.BTCUSDT, chatId, env);
        } catch (error) {
          await sendMessageToTelegram({
            chat_id: chatId,
            text: `❌ Lỗi khi lấy giá BTC: ${error instanceof Error ? error.message : 'Unknown error'}`,
          }, env);
        }
        return textResponse('BTC price fetched');
      }

      if (callbackData === CallbackDataPrefix.CHART_XAU_PRICE) {
        await answerCallbackQuery(callbackQuery.id, env, 'Đang lấy giá XAU...');
        callbackAnswered = true;
        try {
          await getXAUPriceAndNotify(chatId, env);
        } catch (error) {
          await sendMessageToTelegram({
            chat_id: chatId,
            text: `❌ Lỗi khi lấy giá XAU: ${error instanceof Error ? error.message : 'Unknown error'}`,
          }, env);
        }
        return textResponse('XAU price fetched');
      }

      if (callbackData === CallbackDataPrefix.CHART_BTC_1W3D1D) {
        await answerCallbackQuery(callbackQuery.id, env, 'Đang tạo biểu đồ...');
        callbackAnswered = true;
        await sendMessageToTelegram({
          chat_id: chatId,
          text: '📊 Generating chart BTC1w3d1d... Please wait.',
        }, env);
        await snapshotChartWithSpecificInterval({ key: '1W', value: TradingviewInterval.Weekly }, env);
        await snapshotChartWithSpecificInterval({ key: '3D', value: TradingviewInterval.ThreeDay }, env);
        await snapshotChartWithSpecificInterval({ key: '1D', value: TradingviewInterval.Daily }, env);
        return textResponse('Chart generated');
      }

      if (callbackData === CallbackDataPrefix.CHART_BTC_4H1H15M) {
        await answerCallbackQuery(callbackQuery.id, env, 'Đang tạo biểu đồ...');
        callbackAnswered = true;
        await sendMessageToTelegram({
          chat_id: chatId,
          text: '📊 Generating chart BTC4h1h15m... Please wait.',
        }, env);
        await snapshotChartWithSpecificInterval({ key: '4h', value: TradingviewInterval.H4 }, env);
        await snapshotChartWithSpecificInterval({ key: '1h', value: TradingviewInterval.H1 }, env);
        await snapshotChartWithSpecificInterval({ key: '15m', value: TradingviewInterval.Min15 }, env);
        return textResponse('Chart generated');
      }

      if (callbackData === CallbackDataPrefix.CHART_BTC_1D) {
        await answerCallbackQuery(callbackQuery.id, env, 'Đang tạo biểu đồ...');
        callbackAnswered = true;
        await sendMessageToTelegram({
          chat_id: chatId,
          text: '📊 Generating chart... Please wait.',
        }, env);
        await snapshotChartWithSpecificInterval({ key: '1D', value: TradingviewInterval.Daily }, env);
        return textResponse('Chart generated');
      }

      if (callbackData === CallbackDataPrefix.CHART_BTC_8H) {
        await answerCallbackQuery(callbackQuery.id, env, 'Đang tạo biểu đồ...');
        callbackAnswered = true;
        await sendMessageToTelegram({
          chat_id: chatId,
          text: '📊 Generating chart... Please wait.',
        }, env);
        await snapshotChartWithSpecificInterval({ key: '8h', value: TradingviewInterval.H8 }, env);
        return textResponse('Chart generated');
      }

      if (callbackData === CallbackDataPrefix.CHART_BTC_4H) {
        await answerCallbackQuery(callbackQuery.id, env, 'Đang tạo biểu đồ...');
        callbackAnswered = true;
        await sendMessageToTelegram({
          chat_id: chatId,
          text: '📊 Generating chart... Please wait.',
        }, env);
        await snapshotChartWithSpecificInterval({ key: '4h', value: TradingviewInterval.H4 }, env);
        return textResponse('Chart generated');
      }

      if (callbackData === CallbackDataPrefix.CHART_BTC_1H) {
        await answerCallbackQuery(callbackQuery.id, env, 'Đang tạo biểu đồ...');
        callbackAnswered = true;
        await sendMessageToTelegram({
          chat_id: chatId,
          text: '📊 Generating chart... Please wait.',
        }, env);
        await snapshotChartWithSpecificInterval({ key: '1h', value: TradingviewInterval.H1 }, env);
        return textResponse('Chart generated');
      }

      if (callbackData === CallbackDataPrefix.CHART_BTC_15M) {
        await answerCallbackQuery(callbackQuery.id, env, 'Đang tạo biểu đồ...');
        callbackAnswered = true;
        await sendMessageToTelegram({
          chat_id: chatId,
          text: '📊 Generating chart... Please wait.',
        }, env);
        await snapshotChartWithSpecificInterval({ key: '15m', value: TradingviewInterval.Min15 }, env);
        return textResponse('Chart generated');
      }

      if (callbackData === CallbackDataPrefix.CHART_SNAPSHOT) {
        await answerCallbackQuery(callbackQuery.id, env, 'Đang tạo snapshot...');
        callbackAnswered = true;
        await sendMessageToTelegram({
          chat_id: chatId,
          text: '📊 Generating chart... Please wait.',
        }, env);
        await snapshotChart(env);
        return textResponse('Snapshot generated');
      }

      if (callbackData === CallbackDataPrefix.CHART_ETF) {
        await answerCallbackQuery(callbackQuery.id, env, 'Đang phân tích ETF...');
        callbackAnswered = true;
        await sendMessageToTelegram({
          chat_id: chatId,
          text: '📊 Analyzing ETF data... Please wait.',
        }, env);
        await fetchAndNotifyEtf(env);
        return textResponse('ETF data analyzed');
      }

      // Handle event enable/disable actions (callback_data now contains event_key)
      if (callbackData.startsWith(CallbackDataPrefix.EVENT_ENABLE)) {
        await answerCallbackQuery(callbackQuery.id, env, 'Đang bật event...');
        callbackAnswered = true;
        const eventKey = callbackData.substring(CallbackDataPrefix.EVENT_ENABLE.length);
        await takeTelegramAction(eventKey, env, true); // true = enable
        // Refresh events list
        await handleAllEvents(chatId, env);
        return textResponse('Event enabled');
      }

      if (callbackData.startsWith(CallbackDataPrefix.EVENT_DISABLE)) {
        await answerCallbackQuery(callbackQuery.id, env, 'Đang tắt event...');
        callbackAnswered = true;
        const eventKey = callbackData.substring(CallbackDataPrefix.EVENT_DISABLE.length);
        await takeTelegramAction(eventKey, env, false); // false = disable
        // Refresh events list
        await handleAllEvents(chatId, env);
        return textResponse('Event disabled');
      }

      // Handle event verify action (immediate execution, callback_data contains event_key)
      if (callbackData.startsWith(CallbackDataPrefix.EVENT_VERIFY)) {
        await answerCallbackQuery(callbackQuery.id, env, 'Đang verify event...');
        callbackAnswered = true;
        const eventKey = callbackData.substring(CallbackDataPrefix.EVENT_VERIFY.length);
        await takeTelegramAction(eventKey, env);
        return textResponse('Event verified');
      }

      // Handle trend survey again button - show symbol selection
      if (callbackData === CallbackDataPrefix.TREND_SURVEY) {
        await answerCallbackQuery(callbackQuery.id, env, 'Đang tải menu...');
        callbackAnswered = true;
        const symbolKeyboard: TelegramInlineKeyboardMarkup = {
          inline_keyboard: [
            [
              { text: '🟡 BTC', callback_data: CallbackDataPrefix.TREND_SURVEY_BTC },
              { text: 'Ξ ETH', callback_data: CallbackDataPrefix.TREND_SURVEY_ETH },
            ],
            [
              { text: '🥇 XAU', callback_data: CallbackDataPrefix.TREND_SURVEY_XAU },
            ],
          ],
        };
        await sendMessageToTelegram({
          chat_id: chatId,
          text: '📊 Chọn symbol để khảo sát:',
          reply_markup: symbolKeyboard,
        }, env);
        return textResponse('Trend survey symbol selection shown');
      }

      // Handle BTC survey
      if (callbackData === CallbackDataPrefix.TREND_SURVEY_BTC) {
        await answerCallbackQuery(callbackQuery.id, env, 'Đang bắt đầu survey BTC...');
        callbackAnswered = true;
        await startHarsiCheck(userId, chatId, env, TradingSymbol.BTCUSDT);
        return textResponse('BTC trend survey started');
      }

      // Handle ETH survey
      if (callbackData === CallbackDataPrefix.TREND_SURVEY_ETH) {
        await answerCallbackQuery(callbackQuery.id, env, 'Đang bắt đầu survey ETH...');
        callbackAnswered = true;
        await startHarsiCheck(userId, chatId, env, TradingSymbol.ETHUSDT);
        return textResponse('ETH trend survey started');
      }

      // Handle XAU survey
      if (callbackData === CallbackDataPrefix.TREND_SURVEY_XAU) {
        await answerCallbackQuery(callbackQuery.id, env, 'Đang bắt đầu survey XAU...');
        callbackAnswered = true;
        await startHarsiCheck(userId, chatId, env, TradingSymbol.XAUUSD);
        return textResponse('XAU trend survey started');
      }

      // Handle BTC trend view
      if (callbackData === CallbackDataPrefix.TREND_VIEW_BTC) {
        await answerCallbackQuery(callbackQuery.id, env, 'Đang tải trend BTC...');
        callbackAnswered = true;
        await showLatestTrend(chatId, env, TradingSymbol.BTCUSDT);
        return textResponse('BTC trend shown');
      }

      // Handle ETH trend view
      if (callbackData === CallbackDataPrefix.TREND_VIEW_ETH) {
        await answerCallbackQuery(callbackQuery.id, env, 'Đang tải trend ETH...');
        callbackAnswered = true;
        await showLatestTrend(chatId, env, TradingSymbol.ETHUSDT);
        return textResponse('ETH trend shown');
      }

      // Handle XAU trend view
      if (callbackData === CallbackDataPrefix.TREND_VIEW_XAU) {
        await answerCallbackQuery(callbackQuery.id, env, 'Đang tải trend XAU...');
        callbackAnswered = true;
        await showLatestTrend(chatId, env, TradingSymbol.XAUUSD);
        return textResponse('XAU trend shown');
      }

      // Handle experience menu
      if (callbackData === CallbackDataPrefix.EXPERIENCE_MENU) {
        await answerCallbackQuery(callbackQuery.id, env, 'Đang tải menu...');
        callbackAnswered = true;
        await showExperienceMenu(chatId, env);
        return textResponse('Experience menu shown');
      }

      // Handle exit guide
      if (callbackData === CallbackDataPrefix.EXIT_GUIDE) {
        await answerCallbackQuery(callbackQuery.id, env, 'Đang tải hướng dẫn...');
        callbackAnswered = true;
        await showExitGuide(chatId, env);
        return textResponse('Exit guide shown');
      }

      // Handle statistics menu callbacks
      if (callbackData === CallbackDataPrefix.STATS_ALL) {
        await answerCallbackQuery(callbackQuery.id, env, 'Đang tải thống kê...');
        callbackAnswered = true;
        await showAllStatistics(userId, chatId, env);
        return textResponse('All statistics shown');
      }

      if (callbackData === CallbackDataPrefix.STATS_CURRENT_MONTH) {
        await answerCallbackQuery(callbackQuery.id, env, 'Đang tải thống kê...');
        callbackAnswered = true;
        await showCurrentMonthStatistics(userId, chatId, env);
        return textResponse('Current month statistics shown');
      }

      if (callbackData === CallbackDataPrefix.STATS_PREVIOUS_MONTH) {
        await answerCallbackQuery(callbackQuery.id, env, 'Đang tải thống kê...');
        callbackAnswered = true;
        await showPreviousMonthStatistics(userId, chatId, env);
        return textResponse('Previous month statistics shown');
      }

      if (callbackData === CallbackDataPrefix.STATS_CURRENT_WEEK) {
        await answerCallbackQuery(callbackQuery.id, env, 'Đang tải thống kê...');
        callbackAnswered = true;
        await showCurrentWeekStatistics(userId, chatId, env);
        return textResponse('Current week statistics shown');
      }

      if (callbackData === CallbackDataPrefix.STATS_PREVIOUS_WEEK) {
        await answerCallbackQuery(callbackQuery.id, env, 'Đang tải thống kê...');
        callbackAnswered = true;
        await showPreviousWeekStatistics(userId, chatId, env);
        return textResponse('Previous week statistics shown');
      }

      // Handle HARSI check selection (for /trend command)
      if (callbackData && typeof callbackData === 'string') {
        const harsiCheckPrefix = 'harsi_check_';
        const harsiCheckSkip = 'harsi_check_skip';
        
        if (callbackData.startsWith(harsiCheckPrefix)) {
          const conversationState = await getConversationState(userId, env);
          const isHarsiCheckFlow = conversationState && (
            conversationState.step === OrderConversationStep.WAITING_HARSI_CHECK_1W ||
            conversationState.step === OrderConversationStep.WAITING_HARSI_CHECK_3D ||
            conversationState.step === OrderConversationStep.WAITING_HARSI_CHECK_2D ||
            conversationState.step === OrderConversationStep.WAITING_HARSI_CHECK_1D ||
            conversationState.step === OrderConversationStep.WAITING_HARSI_CHECK_8H ||
            conversationState.step === OrderConversationStep.WAITING_HARSI_CHECK_4H ||
            conversationState.step === OrderConversationStep.WAITING_HARSI_CHECK_2H
          );
          
          if (isHarsiCheckFlow) {
            if (callbackData === harsiCheckSkip) {
              await handleHarsiCheckSelection(userId, chatId, 'skip', env);
            } else {
              const prefixLength = harsiCheckPrefix.length;
              const marketStateValue = callbackData.substring(prefixLength);
              const marketState = Object.values(MarketState).find(c => c === marketStateValue);
              if (marketState) {
                await handleHarsiCheckSelection(userId, chatId, marketState, env);
              }
            }
            return textResponse('HARSI check selection handled');
          }
        }
      }

      // Handle note selection from inline keyboard
      if (callbackData.startsWith('note_')) {
        // Check if user is in conversation and waiting for notes
        const conversationState = await getConversationState(userId, env);
        if (!conversationState || conversationState.step !== OrderConversationStep.WAITING_NOTES) {
          return textResponse('Callback query handled - not in notes step');
        }

        // Handle different note actions
        if (callbackData.startsWith(CallbackDataPrefix.NOTE_ADD)) {
          // Add a note to the list
          const noteValue = callbackData.substring(CallbackDataPrefix.NOTE_ADD.length);
          await addNoteToOrder(userId, chatId, noteValue, env);
        } else if (callbackData === CallbackDataPrefix.NOTE_CLEAR) {
          // Clear all notes
          await clearNotes(userId, chatId, env);
        } else if (callbackData === CallbackDataPrefix.NOTE_DONE) {
          // Finish notes selection
          const result = await finishNotesSelection(userId, chatId, env);
          
          // If order is completed, process it
          if (result.completed && result.orderData) {
            await processOrderData(result.orderData, userId, chatId, env);
            // Clear conversation state after processing
            await clearConversationState(userId, env);
          }
        } else if (callbackData === CallbackDataPrefix.NOTE_SKIP) {
          // Skip notes (set to undefined)
          const state = await getConversationState(userId, env);
          if (state) {
            state.data.notes = undefined;
            state.step = OrderConversationStep.COMPLETED;
            await saveConversationState(state, env);
            
            await sendMessageToTelegram({
              chat_id: chatId,
              text: '✅ Đã hoàn thành nhập lệnh!',
            }, env);
            
            // Process the order
            await processOrderData(state.data, userId, chatId, env);
            // Clear conversation state after processing
            await clearConversationState(userId, env);
          }
        }
        
        callbackAnswered = true;
        return textResponse('Callback query handled');
      }
      
      // Answer callback query if not already answered
      if (!callbackAnswered) {
        await answerCallbackQuery(callbackQuery.id, env);
      }
      
      return textResponse('Callback query received but not handled');
    }
  
    // Check if message exists
    if (!body.message) {
      return textResponse('No message in webhook');
    }

    const userId = body.message.from.id;
    const chatId = body.message.chat.id.toString();
    const text = (body.message.text || '').split("@")[0].trim();
    
    console.log(`Received webhook message from user ${userId}. Chat ID: ${chatId}. Text: ${text}`);

    // Check if user is in an active conversation
    const conversationState = await getConversationState(userId, env);
    
    // Handle order menu command
    if (text === TelegramCommands.ORDERS) {
      await showOrderMenu(userId, chatId, env);
      return textResponse('Order menu shown');
    }

    // Handle chart menu command
    if (text === TelegramCommands.CHARTS) {
      await showChartMenu(chatId, env);
      return textResponse('Chart menu shown');
    }

    // Handle events command
    if (text === TelegramCommands.EVENTS) {
      await handleAllEvents(chatId, env);
      return textResponse('Events menu shown');
    }

    // Handle trend command - show symbol selection menu
    if (text === TelegramCommands.TREND_CHECK) {
      const symbolKeyboard: TelegramInlineKeyboardMarkup = {
        inline_keyboard: [
          [
            { text: '🟡 BTC', callback_data: CallbackDataPrefix.TREND_VIEW_BTC },
            { text: 'Ξ ETH', callback_data: CallbackDataPrefix.TREND_VIEW_ETH },
            { text: '🥇 XAU', callback_data: CallbackDataPrefix.TREND_VIEW_XAU },
          ],
        ],
      };
      await sendMessageToTelegram({
        chat_id: chatId,
        text: '📊 Chọn symbol để xem trend:',
        reply_markup: symbolKeyboard,
      }, env);
      return textResponse('Trend symbol selection shown');
    }

    // Handle statistics command
    if (text === TelegramCommands.STATISTICS) {
      await showStatisticsMenu(userId, chatId, env);
      return textResponse('Statistics menu shown');
    }

    // Handle experience command
    if (text === TelegramCommands.EXPERIENCE) {
      try {
        await showExperienceMenu(chatId, env);
        return textResponse('Experience menu shown');
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('Error showing experience menu:', errorMessage);
        await sendMessageToTelegram({
          chat_id: chatId,
          text: `❌ Lỗi khi hiển thị menu kinh nghiệm: ${errorMessage}`,
        }, env);
        return textResponse('Error showing experience menu');
      }
    }

    // If user is in conversation, process input
    if (conversationState && conversationState.step !== OrderConversationStep.COMPLETED) {
      const result = await processOrderInput(userId, chatId, text, env);
      
      // If order is completed, process it
      if (result.completed && result.orderData) {
        await processOrderData(result.orderData, userId, chatId, env);
        // Clear conversation state after processing
        await clearConversationState(userId, env);
      }
      
      return textResponse('Conversation input processed');
    }

    // Otherwise, handle as normal command
    await takeTelegramAction(text, env);
    return textResponse('Webhook handled successfully');
  } catch (error) {
    const errorMessage = (error as Error).message;
    console.error(`Error handling webhook: ${errorMessage}`);
    
    const logInfo = {
      method: req.method,
      pathName: new URL(req.url).pathname,
      errorMessage,
    };
    
    await sendMessageToTelegram({
      chat_id: env.TELEGRAM_CHAT_ID,
      text: `${TelegramMessageTitle.ErrorDetected} \n${JSON.stringify(logInfo, null, 2)}`
    }, env);
    
    return textResponse(`Error handling webhook: ${errorMessage}`);
  }
}

// Route handlers
async function handleSetWebhookTelegram(env: Env): Promise<Response> {
  const result: unknown = await setWebhookTelegram(env);
  return jsonResponse(result);
}


async function handleEtf(env: Env): Promise<Response> {
  const message = await fetchAndNotifyEtf(env);
  return jsonResponse(message);
}

async function handleSnapshotChart(env: Env): Promise<Response> {
  await snapshotChart(env);
  return textResponse('Snapshot chart successfully');
}

/**
 * TradingView webhook JSON payload interface
 */
// {
//   "interval": "15m",
//   "exchange": "OANDA",
//   "symbol": "EURUSD",
//   "side": "BUY",
//   "level": "STRONG",
//   "price": 1.08350,
//   "daily": "===Daily UP",
//   "H8": "8H DOWN",
//   "H4": "4H UP",
//   "H2": "2H UP"
// }
interface TradingViewWebhookPayload {
  interval?: string;
  exchange?: string;
  symbol?: string;
  side?: string;
  level?: string;
  price?: number;
  daily?: string;
  H8?: string;
  H4?: string;
  H2?: string;
}

/**
 * Handle TradingView webhook alerts
 * Supports both JSON and plain text formats
 */
async function handleTradingViewWebhook(req: Request, env: Env): Promise<Response> {
  let rawBody = '';
  try {
    // Read raw body
    rawBody = await req.text();
    const trimmedBody = rawBody.trim();
    
    console.log('TradingView webhook received:', trimmedBody);
    
    let logMessage = '';
    let alertMessage = '';
    let jsonPayload: TradingViewWebhookPayload | null = null;
    
    // Try to parse as JSON first
    try {
      const parsed = JSON.parse(trimmedBody) as unknown;
      jsonPayload = parsed as TradingViewWebhookPayload;
      
      // Check if it's a valid TradingView JSON payload
      if (jsonPayload.symbol || jsonPayload.interval || jsonPayload.side) {
        // Format HARSI value as single emoji
        const formatHarsiEmoji = (value?: string): string => {
          if (!value) return '';
          if (value.includes('UP')) return '🟢';
          if (value.includes('DOWN')) return '🔴';
          return '';
        };
        
        // Determine emoji based on side
        const sideEmoji = jsonPayload.side?.toUpperCase() === 'BUY' ? '🚀' : '⚠️';
        
        // Build compact message
        const parts: string[] = [];
        
        // Emoji and [LEVEL SIDE INTERVAL]
        const bracketParts: string[] = [];
        if (jsonPayload.level) bracketParts.push(jsonPayload.level.toUpperCase());
        if (jsonPayload.side) bracketParts.push(jsonPayload.side.toUpperCase());
        if (jsonPayload.interval) bracketParts.push(jsonPayload.interval);
        
        // Always show bracket part if we have at least side or interval
        if (bracketParts.length > 0) {
          parts.push(`${sideEmoji} [${bracketParts.join(' ')}]`);
        } else if (jsonPayload.side) {
          // Fallback: show just side if no level/interval
          parts.push(`${sideEmoji} [${jsonPayload.side.toUpperCase()}]`);
        } else {
          // Fallback: show just emoji if no side
          parts.push(sideEmoji);
        }
        
        // Symbol @Price
        const symbolParts: string[] = [];
        if (jsonPayload.symbol) symbolParts.push(jsonPayload.symbol);
        if (jsonPayload.price) symbolParts.push(`@${jsonPayload.price}`);
        
        if (symbolParts.length > 0) {
          parts.push(symbolParts.join(' '));
        }
        
        // HARSI values
        const harsiParts: string[] = [];
        if (jsonPayload.daily) harsiParts.push(`D${formatHarsiEmoji(jsonPayload.daily)}`);
        if (jsonPayload.H8) harsiParts.push(`8H${formatHarsiEmoji(jsonPayload.H8)}`);
        if (jsonPayload.H4) harsiParts.push(`4H${formatHarsiEmoji(jsonPayload.H4)}`);
        if (jsonPayload.H2) harsiParts.push(`2H${formatHarsiEmoji(jsonPayload.H2)}`);
        
        if (harsiParts.length > 0) {
          parts.push('|');
          parts.push(harsiParts.join(' '));
        }
        
        logMessage = parts.join(' ');
        alertMessage = logMessage; // Use formatted message for Pushover too
      } else {
        // JSON but not the expected structure, treat as plain text
        logMessage = `📊 TradingView Alert\n\n${trimmedBody}`;
        alertMessage = trimmedBody;
      }
    } catch {
      // Not JSON, treat as plain text (original behavior)
      logMessage = `📊 TradingView Alert\n\n${trimmedBody}`;
      alertMessage = trimmedBody;
    }
    
    // Send notification to Telegram
    try {
      await sendMessageToTelegram({
        chat_id: env.TELEGRAM_CHAT_ID,
        text: logMessage,
        parse_mode: TelegramParseMode.Markdown,
      }, env);
    } catch (error) {
      console.error('Error sending Telegram notification:', error);
      // Continue even if Telegram fails
    }
    
    // Send Pushover alert for important notifications
    try {
      await sendPushoverAlert(
        'TradingView Alert',
        alertMessage,
        env
      );
    } catch (error) {
      console.error('Error sending Pushover alert:', error);
      // Continue even if Pushover fails
    }
    
    // Generate and send charts if JSON payload with symbol and interval
    if (jsonPayload && jsonPayload.symbol && jsonPayload.interval) {
      try {
        // Map interval string to TradingviewInterval
        const mapIntervalToTradingview = (interval: string): TradingviewInterval | null => {
          const intervalLower = interval.toLowerCase();
          if (intervalLower === '5m') return TradingviewInterval.Min5;
          if (intervalLower === '15m') return TradingviewInterval.Min15;
          if (intervalLower === '30m') return TradingviewInterval.Min30;
          if (intervalLower === '1h') return TradingviewInterval.H1;
          if (intervalLower === '2h') return TradingviewInterval.H2;
          if (intervalLower === '4h') return TradingviewInterval.H4;
          if (intervalLower === '8h') return TradingviewInterval.H8;
          return null;
        };
        
        // Format symbol using exchange field if provided
        const formatSymbol = (symbol: string, exchange?: string): string => {
          // If already has exchange prefix, use as is
          if (symbol.includes(':')) return symbol;
          // Use provided exchange, or default to OANDA for forex pairs
          const exchangePrefix = exchange || 'OANDA';
          return `${exchangePrefix}:${symbol}`;
        };
        
        const formattedSymbol = formatSymbol(jsonPayload.symbol, jsonPayload.exchange);
        const alertInterval = mapIntervalToTradingview(jsonPayload.interval);
        
        if (alertInterval) {
          // Determine which charts to show based on interval
          const chartIntervals: Array<{ key: string; value: TradingviewInterval }> = [
            { key: '8h', value: TradingviewInterval.H8 },
            { key: '4h', value: TradingviewInterval.H4 },
            { key: '2h', value: TradingviewInterval.H2 },
            { key: jsonPayload.interval.toLowerCase(), value: alertInterval }
          ];
          
          if (chartIntervals.length > 0) {
            console.log(`Generating charts for ${formattedSymbol}...`);
            const images: TelegramImageRequest[] = [];
            
            for (const chartInterval of chartIntervals) {
              try {
                const arrayBufferImage = await getTradingViewImage(
                  {
                    symbol: formattedSymbol,
                    interval: chartInterval.value,
                  },
                  env,
                );
                
                images.push({
                  chat_id: env.TELEGRAM_CHAT_ID,
                  caption: `${jsonPayload.symbol} ${chartInterval.key} ${formatVietnamTime()}`,
                  photo: arrayBufferImage,
                });
              } catch (error) {
                console.error(`Error generating chart for ${chartInterval.key}:`, error);
                // Continue with other charts even if one fails
              }
            }
            
            if (images.length > 0) {
              await sendImageGroupToTelegram({
                chat_id: env.TELEGRAM_CHAT_ID,
                images: images,
              }, env);
              console.log(`Charts sent to Telegram successfully for ${formattedSymbol}`);
            }
          }
        }
      } catch (error) {
        console.error('Error generating charts:', error);
        // Continue even if chart generation fails
      }
    }
    
    // Return success response
    return jsonResponse({
      success: true,
      message: 'TradingView alert received and processed',
      alert: {
        message: alertMessage,
        time: new Date().toISOString(),
      },
    }, 200);
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Error handling TradingView webhook:', errorMessage);
    
    // Log error to Telegram
    try {
      await sendMessageToTelegram({
        chat_id: env.TELEGRAM_CHAT_ID,
        text: `❌ TradingView Webhook Error\n\n${errorMessage}\n\nPayload: ${rawBody || 'Unable to read payload'}`,
      }, env);
    } catch (telegramError) {
      console.error('Error sending error notification to Telegram:', telegramError);
    }
    
    return jsonResponse({
      success: false,
      error: errorMessage,
    }, 400);
  }
}

async function handleOrderAnalysis(req: Request, env: Env): Promise<Response> {
  try {
    // Log start of analysis to Telegram
    await sendMessageToTelegram({
      chat_id: env.TELEGRAM_CHAT_ID,
      text: `🔍 Starting Order Analysis...`,
    }, env);

    const result = await analyzeOrdersForAPI(env);
    
    // Log result to Telegram
    if (result.success) {
      const stats = result.statistics;
      
      // Save analysis result to database
      if (result.analysis && stats) {
        try {
          await saveOrderAnalysis({
            analysis: result.analysis,
            totalOrders: stats.totalOrders,
            winCount: stats.winCount,
            lossCount: stats.lossCount,
            breakevenCount: stats.breakevenCount,
            winRate: stats.winRate,
            totalPnL: stats.totalPnL,
            avgPnL: stats.avgPnL,
          }, env);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          console.error('Error saving order analysis to database:', errorMessage);
          // Continue even if save fails
        }
      }
      
      // Send statistics message
      const statsMessage = `✅ Order Analysis Completed\n\n` +
        `📊 Statistics:\n` +
        `  • Total Orders: ${stats?.totalOrders || 0}\n` +
        `  • Wins: ${stats?.winCount || 0}\n` +
        `  • Losses: ${stats?.lossCount || 0}\n` +
        `  • Breakeven: ${stats?.breakevenCount || 0}\n` +
        `  • Win Rate: ${stats?.winRate || '0'}%\n` +
        `  • Total P&L: $${stats?.totalPnL || '0'}\n` +
        `  • Avg P&L: $${stats?.avgPnL || '0'}`;
      
      await sendMessageToTelegram({
        chat_id: env.TELEGRAM_CHAT_ID,
        text: statsMessage,
      }, env);
      // Send analysis message separately
      if (result.analysis) {
        await sendMessageToTelegram({
          chat_id: env.TELEGRAM_CHAT_ID,
          text: `${TelegramMessageTitle.Analysis}\n\n${result.analysis}`,
          parse_mode: TelegramParseMode.Markdown,
        }, env);
      }
    } else {
      await sendMessageToTelegram({
        chat_id: env.TELEGRAM_CHAT_ID,
        text: `❌ Order Analysis Failed\n\n❌ Error: ${result.error || 'Unknown error'}`,
      }, env);
    }
    
    if (result.success) {
      return jsonResponse(result, 200);
    } else {
      return jsonResponse(result, 400);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    // Log exception
    await sendMessageToTelegram({
      chat_id: env.TELEGRAM_CHAT_ID,
      text: `🚨 Order Analysis Exception\n\n❌ Error: ${errorMessage}`,
    }, env);
    
    return jsonResponse(
      { success: false, error: errorMessage },
      500
    );
  }
}

export async function handleFetch(req: Request, env: Env): Promise<Response> {
  const url = new URL(req.url);
  const pathname = url.pathname;

  switch (pathname) {
    case ROUTES.ORDER_ANALYSIS:
      return handleOrderAnalysis(req, env);
    
    case ROUTES.SET_WEBHOOK_TELEGRAM:
      return handleSetWebhookTelegram(env);
    
    case ROUTES.ETF:
      return handleEtf(env);
    
    case ROUTES.SNAPSHOT_CHART:
      return handleSnapshotChart(env);
    
    case ROUTES.NOTIFY_ONE_CLOSED_15M_CANDLES_BULLISH:
      return handleCandleNotification({
        limit: 1,
        eventKey: EventKey.EnableNotifyOneClosed15mCandlesBullish,
      }, env);
    
    case ROUTES.NOTIFY_TWO_CLOSED_15M_CANDLES_BULLISH:
      return handleCandleNotification({
        limit: 2,
        eventKey: EventKey.EnableNotifyTwoClosed15mCandlesBullish,
      }, env);
    
    case ROUTES.ENABLE_NOTIFY_TWO_CLOSED_15M_CANDLES_BULLISH:
      return handleEnableNotification(
        EventKey.EnableNotifyTwoClosed15mCandlesBullish,
        'Enabled notify two closed 15m candles bullish',
        env
      );
    
    case ROUTES.ENABLE_NOTIFY_ONE_CLOSED_15M_CANDLES_BULLISH:
      return handleEnableNotification(
        EventKey.EnableNotifyOneClosed15mCandlesBullish,
        'Enabled notify one closed 15m candles bullish',
        env
      );
    
    case ROUTES.DISABLE_NOTIFY_TWO_CLOSED_15M_CANDLES_BULLISH:
      return handleDisableNotification(
        EventKey.EnableNotifyTwoClosed15mCandlesBullish,
        'Disabled notify two closed 15m candles bullish',
        env
      );
    
    case ROUTES.DISABLE_NOTIFY_ONE_CLOSED_15M_CANDLES_BULLISH:
      return handleDisableNotification(
        EventKey.EnableNotifyOneClosed15mCandlesBullish,
        'Disabled notify one closed 15m candles bullish',
        env
      );
    
    case ROUTES.WEBHOOK:
      return handleWebhook(req, env);
    
    case ROUTES.TRADINGVIEW_WEBHOOK:
      return handleTradingViewWebhook(req, env);
    
    default:
      return textResponse('OK. No do anything.');
  }
}

