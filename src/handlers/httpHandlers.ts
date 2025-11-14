/**
 * HTTP request handlers
 */

import { BinanceSymbol, BinanceInterval } from '../services/binanceService';
import { KVKeys } from '../services/cloudflareService';
import { fetchAndNotifyEtf } from '../services/fetchBtcEtf';
import { TelegramCommands, TelegramMessageTitle, TelegramWebhookRequest, sendMessageToTelegram, answerCallbackQuery, setWebhookTelegram } from '../services/telegramService';
import { Env } from '../types/env';
import { getCurrentPriceAndNotify } from '../services/binanceService';
import { snapshotChart } from './chartHandlers';
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
  createHarsiMarketStateKeyboard,
  handleHarsiSelection,
} from '../services/orderConversationService';
import { processOrderData } from './orderHandlers';
import { OrderConversationStep, MarketState, CallbackDataPrefix } from '../types/orderTypes';
import {
  showRiskUnitStatistics,
  showMonthlyStatistics,
  showOrderSelectionForUpdate,
  getOrderById,
  showOrderListForView,
  showOrderDetails,
  deleteOrder,
  showDeleteOrderConfirmation,
} from './orderStatisticsHandler';

// Route constants
const ROUTES = {
  SET_WEBHOOK_TELEGRAM: '/setWebhookTelegram',
  ETF: '/etf',
  SNAPSHOT_CHART: '/snapshotChart',
  WEBHOOK: '/webhook',
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
  kvKey: KVKeys;
  description: string;
}

async function handleCandleNotification(
  config: CandleNotificationConfig,
  env: Env
): Promise<Response> {
  const result = await notifyNumberClosedCandlesBullish({
    symbol: BinanceSymbol.BTCUSDT,
    interval: BinanceInterval.FIFTEEN_MINUTES,
    limit: config.limit,
  }, env);
  return jsonResponse(result);
}

async function handleEnableNotification(
  kvKey: KVKeys,
  message: string,
  env: Env
): Promise<Response> {
  await env.DAILY_NOTES_KV.put(kvKey, 'true');
  return textResponse(message);
}

async function handleDisableNotification(
  kvKey: KVKeys,
  message: string,
  env: Env
): Promise<Response> {
  await env.DAILY_NOTES_KV.delete(kvKey);
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
      
      // Answer the callback query first (REQUIRED by Telegram API)
      // If this button is not called:
      // - Button will be "stuck" in loading state (spinner will show indefinitely)
      // - User will not know if the bot has processed the request or not 
      // - Telegram may rate-limit the bot if callback queries are not answered
      // - Must answer within 10 seconds, otherwise it will timeout
      await answerCallbackQuery(callbackQuery.id, env);
      
      // Handle view order selection
      if (callbackData.startsWith(CallbackDataPrefix.VIEW_ORDER)) {
        const orderId = callbackData.substring(CallbackDataPrefix.VIEW_ORDER.length);
        await showOrderDetails(orderId, chatId, env);
        return textResponse('Order details shown');
      }

      // Handle delete order confirmation request
      if (callbackData.startsWith(CallbackDataPrefix.DELETE_ORDER) && 
          !callbackData.startsWith(CallbackDataPrefix.DELETE_ORDER_CONFIRM) &&
          callbackData !== CallbackDataPrefix.DELETE_ORDER_CANCEL) {
        const orderId = callbackData.substring(CallbackDataPrefix.DELETE_ORDER.length);
        await showDeleteOrderConfirmation(orderId, userId, chatId, env);
        return textResponse('Delete confirmation shown');
      }

      // Handle delete order confirmation
      if (callbackData.startsWith(CallbackDataPrefix.DELETE_ORDER_CONFIRM)) {
        const orderId = callbackData.substring(CallbackDataPrefix.DELETE_ORDER_CONFIRM.length);
        await deleteOrder(orderId, userId, chatId, env);
        return textResponse('Order deletion processed');
      }

      // Handle delete order cancellation
      if (callbackData === CallbackDataPrefix.DELETE_ORDER_CANCEL) {
        await sendMessageToTelegram({
          chat_id: chatId,
          text: '✅ Đã hủy thao tác xóa lệnh.',
        }, env);
        return textResponse('Delete cancelled');
      }

      // Handle update order selection
      if (callbackData.startsWith(CallbackDataPrefix.UPDATE_ORDER)) {
        const orderId = callbackData.substring(CallbackDataPrefix.UPDATE_ORDER.length);
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
          text: `✅ Đã chọn lệnh:\n\nSymbol: ${order.symbol}\nDirection: ${order.direction}\nEntry: ${order.entry}\nStop Loss: ${order.stopLoss}\n\nVui lòng nhập Close Price:`,
        }, env);
        return textResponse('Order selected for update');
      }

      // Handle HARSI 8H Bearish confirmation
      if (callbackData === CallbackDataPrefix.HARSI_8H_CONTINUE) {
        const state = await getConversationState(userId, env);
        if (state && state.step === OrderConversationStep.WAITING_HARSI_8H_CONFIRMATION) {
          state.step = OrderConversationStep.WAITING_HARSI_6H;
          await saveConversationState(state, env);
          
          const message = `✅ HARSI 8H: ${state.data.harsi8h || 'N/A'}\n\nVui lòng chọn HARSI 6H:`;
          await sendMessageToTelegram({ 
            chat_id: chatId, 
            text: message,
            reply_markup: createHarsiMarketStateKeyboard(),
          }, env);
        }
        return textResponse('HARSI 8H confirmation handled');
      }

      if (callbackData === CallbackDataPrefix.HARSI_8H_CANCEL) {
        // Cancel the entire order immediately
        await clearConversationState(userId, env);
        
        // Remove any keyboards and send cancellation message
        await sendMessageToTelegram({ 
          chat_id: chatId, 
          text: '❌ Đã hủy nhập lệnh.',
          reply_markup: { remove_keyboard: true },
        }, env);
        
        return textResponse('Order cancelled');
      }

      // Handle HARSI market state selection
      if (callbackData.startsWith(CallbackDataPrefix.HARSI)) {
        if (callbackData === CallbackDataPrefix.HARSI_SKIP) {
          await handleHarsiSelection(userId, chatId, 'skip', env);
        } else {
          const marketStateValue = callbackData.substring(CallbackDataPrefix.HARSI.length);
          const marketState = Object.values(MarketState).find(c => c === marketStateValue);
          if (marketState) {
            await handleHarsiSelection(userId, chatId, marketState, env);
          }
        }
        return textResponse('HARSI selection handled');
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
        
        return textResponse('Callback query handled');
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
    
    // Handle order-related commands
    if (text === TelegramCommands.NEW_ORDER) {
      await startOrderConversation(userId, chatId, env);
      return textResponse('Order conversation started');
    }

    if (text === TelegramCommands.CANCEL_ORDER) {
      await cancelOrderConversation(userId, chatId, env);
      return textResponse('Order conversation cancelled');
    }

    if (text === TelegramCommands.ORDER_PREVIEW) {
      await showOrderPreview(userId, chatId, env);
      return textResponse('Order preview shown');
    }

    if (text === TelegramCommands.ORDER_STATS) {
      await showRiskUnitStatistics(userId, chatId, env);
      return textResponse('Order statistics shown');
    }

    if (text === TelegramCommands.ORDER_STATS_MONTH) {
      await showMonthlyStatistics(userId, chatId, env);
      return textResponse('Monthly order statistics shown');
    }

    if (text === TelegramCommands.UPDATE_ORDER) {
      await showOrderSelectionForUpdate(userId, chatId, env);
      return textResponse('Order selection shown');
    }

    if (text === TelegramCommands.VIEW_ORDERS) {
      await showOrderListForView(userId, chatId, env);
      return textResponse('Order list shown');
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

async function handleBtcPrice(env: Env): Promise<Response> {
  const price = await getCurrentPriceAndNotify(BinanceSymbol.BTCUSDT, env);
  return jsonResponse({ price });
}

async function handleEtf(env: Env): Promise<Response> {
  const message = await fetchAndNotifyEtf(env);
  return jsonResponse(message);
}

async function handleSnapshotChart(env: Env): Promise<Response> {
  await snapshotChart(env);
  return textResponse('Snapshot chart successfully');
}

export async function handleFetch(req: Request, env: Env): Promise<Response> {
  const url = new URL(req.url);
  const pathname = url.pathname;

  switch (pathname) {
    case ROUTES.SET_WEBHOOK_TELEGRAM:
      return handleSetWebhookTelegram(env);
    
    case TelegramCommands.BTC:
      return handleBtcPrice(env);
    
    case ROUTES.ETF:
      return handleEtf(env);
    
    case ROUTES.SNAPSHOT_CHART:
      return handleSnapshotChart(env);
    
    case ROUTES.NOTIFY_ONE_CLOSED_15M_CANDLES_BULLISH:
      return handleCandleNotification({
        limit: 1,
        kvKey: KVKeys.EnableNotifyOneClosed15mCandlesBullish,
        description: 'one closed 15m candles bullish'
      }, env);
    
    case ROUTES.NOTIFY_TWO_CLOSED_15M_CANDLES_BULLISH:
      return handleCandleNotification({
        limit: 2,
        kvKey: KVKeys.EnableNotifyTwoClosed15mCandlesBullish,
        description: 'two closed 15m candles bullish'
      }, env);
    
    case ROUTES.ENABLE_NOTIFY_TWO_CLOSED_15M_CANDLES_BULLISH:
      return handleEnableNotification(
        KVKeys.EnableNotifyTwoClosed15mCandlesBullish,
        'Enabled notify two closed 15m candles bullish',
        env
      );
    
    case ROUTES.ENABLE_NOTIFY_ONE_CLOSED_15M_CANDLES_BULLISH:
      return handleEnableNotification(
        KVKeys.EnableNotifyOneClosed15mCandlesBullish,
        'Enabled notify one closed 15m candles bullish',
        env
      );
    
    case ROUTES.DISABLE_NOTIFY_TWO_CLOSED_15M_CANDLES_BULLISH:
      return handleDisableNotification(
        KVKeys.EnableNotifyTwoClosed15mCandlesBullish,
        'Disabled notify two closed 15m candles bullish',
        env
      );
    
    case ROUTES.DISABLE_NOTIFY_ONE_CLOSED_15M_CANDLES_BULLISH:
      return handleDisableNotification(
        KVKeys.EnableNotifyOneClosed15mCandlesBullish,
        'Disabled notify one closed 15m candles bullish',
        env
      );
    
    case ROUTES.WEBHOOK:
      return handleWebhook(req, env);
    
    default:
      return textResponse('OK. No do anything.');
  }
}

