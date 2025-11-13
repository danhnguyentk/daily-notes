/**
 * HTTP request handlers
 */

import { BinanceSymbol, BinanceInterval } from '../binanceService';
import { KVKeys } from '../cloudflareService';
import { fetchAndNotifyEtf } from '../fetchBtcEtf';
import { TelegramCommands, TelegramMessageTitle, TelegramWebhookRequest, sendMessageToTelegram, answerCallbackQuery } from '../telegramService';
import { Env } from '../types';
import { getCurrentPriceAndNotify } from '../binanceService';
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
} from '../services/orderConversationService';
import { processOrderData } from './orderHandlers';
import { OrderConversationStep } from '../types/orderTypes';

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
      
      // Handle note selection from inline keyboard
      if (callbackData.startsWith('note_')) {
        // Check if user is in conversation and waiting for notes
        const conversationState = await getConversationState(userId, env);
        if (!conversationState || conversationState.step !== OrderConversationStep.WAITING_NOTES) {
          return textResponse('Callback query handled - not in notes step');
        }

        // Handle different note actions
        if (callbackData.startsWith('note_add_')) {
          // Add a note to the list
          const noteValue = callbackData.substring(9); // Remove 'note_add_' prefix
          await addNoteToOrder(userId, chatId, noteValue, env);
        } else if (callbackData === 'note_clear') {
          // Clear all notes
          await clearNotes(userId, chatId, env);
        } else if (callbackData === 'note_done') {
          // Finish notes selection
          const result = await finishNotesSelection(userId, chatId, env);
          
          // If order is completed, process it
          if (result.completed && result.orderData) {
            await processOrderData(result.orderData, userId, chatId, env);
            // Clear conversation state after processing
            const { clearConversationState } = await import('../services/orderConversationService');
            await clearConversationState(userId, env);
          }
        } else if (callbackData === 'note_skip') {
          // Skip notes (set to undefined)
          const state = await getConversationState(userId, env);
          if (state) {
            state.data.notes = undefined;
            state.step = OrderConversationStep.COMPLETED;
            const { saveConversationState, clearConversationState } = await import('../services/orderConversationService');
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

    // If user is in conversation, process input
    if (conversationState && conversationState.step !== OrderConversationStep.COMPLETED) {
      const result = await processOrderInput(userId, chatId, text, env);
      
      // If order is completed, process it
      if (result.completed && result.orderData) {
        await processOrderData(result.orderData, userId, chatId, env);
        // Clear conversation state after processing
        const { clearConversationState } = await import('../services/orderConversationService');
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
  const { setWebhookTelegram } = await import('../telegramService');
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

