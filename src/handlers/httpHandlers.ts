/**
 * HTTP request handlers
 */

import { BinanceSymbol, BinanceInterval } from '../binanceService';
import { KVKeys } from '../cloudflareService';
import { fetchAndNotifyEtf } from '../fetchBtcEtf';
import { TelegramCommands, TelegramMessageTitle, TelegramWebhookRequest, sendMessageToTelegram } from '../telegramService';
import { Env } from '../types';
import { getCurrentPriceAndNotify } from '../binanceService';
import { snapshotChart } from './chartHandlers';
import { notifyNumberClosedCandlesBullish } from './candleHandlers';
import { takeTelegramAction } from './telegramHandlers';

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
  // Extract command text before the "@" symbol (e.g., "/btc15m@daily_analytic_btc_bot")
  const text = (body.message?.text || '').split("@")[0];
  
  try {
    console.log(`Received webhook message: ${text}`);
    await takeTelegramAction(text, env);
    return textResponse('Webhook handled successfully');
  } catch (error) {
    const errorMessage = (error as Error).message;
    console.error(`Error handling webhook: ${errorMessage}`);
    
    const logInfo = {
      method: req.method,
      pathName: new URL(req.url).pathname,
      errorMessage,
      text
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

