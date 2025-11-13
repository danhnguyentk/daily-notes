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

export async function handleFetch(req: Request, env: Env): Promise<Response> {
  const url = new URL(req.url);
  const pathname = url.pathname;

  switch (pathname) {
    case '/setWebhookTelegram': {
      const { setWebhookTelegram } = await import('../telegramService');
      const result = await setWebhookTelegram(env);
      return new Response(JSON.stringify(result), { status: 200 });
    }
    case TelegramCommands.BTC: {
      const price = await getCurrentPriceAndNotify(BinanceSymbol.BTCUSDT, env);
      return new Response(JSON.stringify({ price }, null, 2), { status: 200 });
    }
    case '/etf': {
      const message = await fetchAndNotifyEtf(env);
      return new Response(JSON.stringify(message, null, 2), { status: 200 });
    }
    case '/snapshotChart': {
      await snapshotChart(env);
      return new Response('Snapshot chart successfully', { status: 200 });
    }
    case '/notifyOneClosed15mCandlesBullish': {
      const result = await notifyNumberClosedCandlesBullish({
        symbol: BinanceSymbol.BTCUSDT,
        interval: BinanceInterval.FIFTEEN_MINUTES,
        limit: 1,
      }, env);
      return new Response(JSON.stringify(result, null, 2), { status: 200 });
    }
    case '/notifyTwoClosed15mCandlesBullish': {
      const result = await notifyNumberClosedCandlesBullish({
        symbol: BinanceSymbol.BTCUSDT,
        interval: BinanceInterval.FIFTEEN_MINUTES,
        limit: 2,
      }, env);
      return new Response(JSON.stringify(result, null, 2), { status: 200 });
    }
    case '/enableNotifyTwoClosed15mCandlesBullish': {
      await env.DAILY_NOTES_KV.put(KVKeys.EnableNotifyTwoClosed15mCandlesBullish, 'true');
      return new Response('Enabled notify two closed 15m candles bullish', { status: 200 });
    }
    case '/enableNotifyOneClosed15mCandlesBullish': {
      await env.DAILY_NOTES_KV.put(KVKeys.EnableNotifyOneClosed15mCandlesBullish, 'true');
      return new Response('Enabled notify one closed 15m candles bullish', { status: 200 });
    }
    case '/disableNotifyTwoClosed15mCandlesBullish': {
      await env.DAILY_NOTES_KV.delete(KVKeys.EnableNotifyTwoClosed15mCandlesBullish);
      return new Response('Disabled notify two closed 15m candles bullish', { status: 200 });
    }
    case '/disableNotifyOneClosed15mCandlesBullish': {
      await env.DAILY_NOTES_KV.delete(KVKeys.EnableNotifyOneClosed15mCandlesBullish);
      return new Response('Disabled notify one closed 15m candles bullish', { status: 200 });
    }
    case '/webhook': {
      const body = await req.json() as TelegramWebhookRequest;
      // "/btc15m@daily_analytic_btc_bot";
      // Extract command text before the "@" symbol
      const text = (body.message?.text || '').split("@")[0];
      try {
        console.log(`Received webhook message: ${text}`);
        await takeTelegramAction(text, env);
        return new Response('Webhook handled successfully', { status: 200 });
      } catch (error) {
        console.error(`Error handling webhook: ${(error as any).message}`);
        const logInfo = {
          method: req.method,
          pathName: (new URL(req.url)).pathname,
          errorMessage: (error as any)?.message,
          text
        };
        await sendMessageToTelegram({
          chat_id: env.TELEGRAM_CHAT_ID,
          text: `${TelegramMessageTitle.ErrorDetected} \n${JSON.stringify(logInfo, null, 2)}`
        }, env);
        return new Response(`Error handling webhook: ${(error as any).message}`, { status: 200 });
      }
    }
    default:
      return new Response('OK. No do anything.', { status: 200 });
  }
}

