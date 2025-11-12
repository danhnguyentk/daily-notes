/**
 * Welcome to Cloudflare Workers!
 *
 * This is a template for a Scheduled Worker: a Worker that can run on a
 * configurable interval:
 * https://developers.cloudflare.com/workers/platform/triggers/cron-triggers/
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Run `curl "http://localhost:8787/__scheduled?cron=*+*+*+*+*"` to see your Worker in action
 * - Run `npm run deploy` to publish your Worker
 *
 * Bind resources to your Worker in `wrangler.jsonc`. After adding bindings, a type definition for the
 * `Env` object can be regenerated with `npm run cf-typegen`.
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

import { BinanceCandlesRequest, BinanceInterval, BinanceSymbol, BinanceToTradingviewInterval, checkNumberClosedCandlesBullish, getCurrentPrice, getCurrentPriceAndNotify } from './binanceService';
import { KVKeys } from './cloudflareService';
import { fetchBtcEtf, EtfRow, fetchAndNotifyEtf } from './fetchBtcEtf';
import { TelegramCommandIntervals, TelegramCommands, TelegramImageRequest, TelegramMessageTitle, TelegramParseMode, TelegramWebhookRequest, formatMarkdownLog, sendImageGroupToTelegram, sendImageToTelegram, sendMessageToTelegram, setWebhookTelegram } from './telegramService';
import { TradingviewInterval, TradingviewSymbol, getTradingViewImage } from './tradingviewService';
import { Env } from './types';

export async function snapshotChart(env: Env) {
  console.log('📸 Snapshot TradingView chart and send to Telegram');

  // Define the list of timeframes you want to capture
  const intervals = [
    { key: '1D', value: TradingviewInterval.Daily },
    { key: '4h', value: TradingviewInterval.H4 },
    { key: '1h', value: TradingviewInterval.H1 },
    { key: '15m', value: TradingviewInterval.Min15 },
  ];

  const images: TelegramImageRequest[] = [];
  for (const tf of intervals) {
    console.log(`Generating snapshot for ${tf.key}...`);

    const arrayBufferImage = await getTradingViewImage(
      {
        symbol: TradingviewSymbol.BitgetBtcUsdtPerp,
        interval: tf.value,
      },
      env,
    );

    images.push({
      chat_id: env.TELEGRAM_CHAT_ID,
      caption: `${tf.key} ${formatVietnamTime()}`,
      photo: arrayBufferImage,
    })
  }

  await sendImageGroupToTelegram({
    chat_id: env.TELEGRAM_CHAT_ID,
    images: images,
  }, env);
  console.log('📸 Snapshot chart sent to Telegram successfully');
}

// Send snapshot for a specific interval only
export async function snapshotChartWithSpecificInterval(
  interval: {key: string, value: TradingviewInterval},
  env: Env,
  ) {

  console.log(`📸 Snapshot TradingView chart for ${interval.key} and send to Telegram`);

  const arrayBufferImage = await getTradingViewImage(
    {
      symbol: TradingviewSymbol.BitgetBtcUsdtPerp,
      interval: interval.value,
    },
    env,
  );

  await sendImageToTelegram({
    chat_id: env.TELEGRAM_CHAT_ID,
    caption: `${interval.key} ${formatVietnamTime()}`,
    photo: arrayBufferImage,
  }, env);

  console.log(`📸 Snapshot chart for ${interval.key} sent to Telegram successfully`);
}

function formatVietnamTime(date: Date = new Date()): string {
  return date.toLocaleString('en-GB', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

const buildSendMessageToTelegram = async (message: string, env: Env) => {
  await sendMessageToTelegram({
    chat_id: env.TELEGRAM_CHAT_ID,
    text: message,
  }, env);
}

export async function takeTelegramAction(action: string, env: Env): Promise<object> {
  switch (action) {
    case TelegramCommands.BTC:
      await getCurrentPriceAndNotify(BinanceSymbol.BTCUSDT, env);
      break;
    case TelegramCommands.BTC1w3d1d:
      await buildSendMessageToTelegram(('📊 Generating chart BTC1w3d1d... Please wait.'), env);
      await snapshotChartWithSpecificInterval(TelegramCommandIntervals[TelegramCommands.BTC1w], env);
      await snapshotChartWithSpecificInterval(TelegramCommandIntervals[TelegramCommands.BTC3d], env);
      await snapshotChartWithSpecificInterval(TelegramCommandIntervals[TelegramCommands.BTC1d], env);
      break;
    case TelegramCommands.BTC4h1h15m:
      await buildSendMessageToTelegram(('📊 Generating chart BTC4h1h15m... Please wait.'), env);
      await snapshotChartWithSpecificInterval(TelegramCommandIntervals[TelegramCommands.BTC4h], env);
      await snapshotChartWithSpecificInterval(TelegramCommandIntervals[TelegramCommands.BTC1h], env);
      await snapshotChartWithSpecificInterval(TelegramCommandIntervals[TelegramCommands.BTC15m], env);
      break;
    case TelegramCommands.BTC1d:
    case TelegramCommands.BTC4h:
    case TelegramCommands.BTC1h:
    case TelegramCommands.BTC15m:
      await buildSendMessageToTelegram(('📊 Generating chart... Please wait.'), env);
      await snapshotChartWithSpecificInterval(TelegramCommandIntervals[action], env);
      break;
    case TelegramCommands.SnapshotChart:
      await buildSendMessageToTelegram('📊 Generating chart... Please wait.', env);
      await snapshotChart(env);
      break;  
    case TelegramCommands.AnalyzeEtfData:
      await buildSendMessageToTelegram('📊 Analyzing ETF data... Please wait.', env);
      await fetchAndNotifyEtf(env);
      break;
    case TelegramCommands.TWO_15M_BULLISH:
      await buildSendMessageToTelegram('📊 Verify bullish... Please wait.', env);
      await notifyNumberClosedCandlesBullish({
        symbol: BinanceSymbol.BTCUSDT,
        interval: BinanceInterval.FIFTEEN_MINUTES,
        limit: 2,
      }, env);
      break;
    
    case TelegramCommands.ONE_15M_BULLISH:
      await buildSendMessageToTelegram('📊 Verify bullish... Please wait.', env);
      await notifyNumberClosedCandlesBullish({
        symbol: BinanceSymbol.BTCUSDT,
        interval: BinanceInterval.FIFTEEN_MINUTES,
        limit: 1,
      }, env);
      break;
    case TelegramCommands.SCHEDULE_TWO_15M_BULLISH:
      await env.DAILY_NOTES_KV.put(KVKeys.EnableNotifyTwoClosed15mCandlesBullish, 'true');
      await buildSendMessageToTelegram('✅ Enabled scheduled check for 2 closed 15m bullish candles.', env);
      break;
    case TelegramCommands.SCHEDULE_ONE_15M_BULLISH:
      await env.DAILY_NOTES_KV.put(KVKeys.EnableNotifyOneClosed15mCandlesBullish, 'true');
      await buildSendMessageToTelegram('✅ Enabled scheduled check for 1 closed 15m bullish candle.', env);
      break;
    case TelegramCommands.DISABLE_TWO_15M_BULLISH:
      await env.DAILY_NOTES_KV.delete(KVKeys.EnableNotifyTwoClosed15mCandlesBullish);
      await buildSendMessageToTelegram('✅ Disabled scheduled check for 2 closed 15m bullish candles.', env);
      break;
    case TelegramCommands.DISABLE_ONE_15M_BULLISH:
      await env.DAILY_NOTES_KV.delete(KVKeys.EnableNotifyOneClosed15mCandlesBullish);
      await buildSendMessageToTelegram('✅ Disabled scheduled check for 1 closed 15m bullish candle.', env);
      break;

    case TelegramCommands.TWO_1H_BULLISH:
      await buildSendMessageToTelegram('📊 Verify bullish... Please wait.', env);
      await notifyNumberClosedCandlesBullish({
        symbol: BinanceSymbol.BTCUSDT,
        interval: BinanceInterval.ONE_HOUR,
        limit: 2,
      }, env);
      break;
    case TelegramCommands.ONE_1H_BULLISH:
      await buildSendMessageToTelegram('📊 Verify bullish... Please wait.', env);
      await notifyNumberClosedCandlesBullish({
        symbol: BinanceSymbol.BTCUSDT,
        interval: BinanceInterval.ONE_HOUR,
        limit: 1,
      }, env);
      break;
    case TelegramCommands.SCHEDULE_TWO_1H_BULLISH:
      await env.DAILY_NOTES_KV.put(KVKeys.EnableNotifyTwoClosed1hCandlesBullish, 'true');
      await buildSendMessageToTelegram('✅ Enabled scheduled check for 2 closed 1h bullish candles.', env);
      break;
    case TelegramCommands.SCHEDULE_ONE_1H_BULLISH:
      await env.DAILY_NOTES_KV.put(KVKeys.EnableNotifyOneClosed1hCandlesBullish, 'true');
      await buildSendMessageToTelegram('✅ Enabled scheduled check for 1 closed 1h bullish candle.', env);
      break;
    case TelegramCommands.DISABLE_TWO_1H_BULLISH:
      await env.DAILY_NOTES_KV.delete(KVKeys.EnableNotifyTwoClosed1hCandlesBullish);
      await buildSendMessageToTelegram('✅ Disabled scheduled check for 2 closed 1h bullish candles.', env);
      break;
    case TelegramCommands.DISABLE_ONE_1H_BULLISH:
      await env.DAILY_NOTES_KV.delete(KVKeys.EnableNotifyOneClosed1hCandlesBullish);
      await buildSendMessageToTelegram('✅ Disabled scheduled check for 1 closed 1h bullish candle.', env);
      break;
    default:
      console.log(`No action taken for command: ${action}`);
      return { message: `No support this command ${action} now` };
  }

  return {
    message: `Action ${action} completed successfully`,
  }
}

export async function notifyNumberClosedCandlesBullish(
  request: BinanceCandlesRequest,
  env: Env
): Promise<object> {
  console.log(`Checking for ${request.limit} consecutive closed ${request.interval} bullish candles for ${request.symbol}...`);
  await buildSendMessageToTelegram(`Checking for ${request.limit} consecutive closed ${request.interval} bullish candles for ${request.symbol}...`, env);
  const isBullish = await checkNumberClosedCandlesBullish(request, env);

  if (isBullish) {
    const message = `🔥 Alert: ${request.limit} Consecutive closed ${request.interval} candles are bullish for ${request.symbol}! Time: ${formatVietnamTime()}`;
    console.log(message);
    await buildSendMessageToTelegram(message, env);

    // Optionally, send a chart snapshot for this interval
    await snapshotChartWithSpecificInterval(
      { key: request.interval, value: BinanceToTradingviewInterval[request.interval] },
      env,
    );

    return { message: `${request.limit} Consecutive closed ${request.interval} candles are bullish for ${request.symbol}.` };
  } else {
    const message = `No bullish pattern detected for the last consecutive ${request.interval} candles. Time: ${formatVietnamTime()}`;
    await buildSendMessageToTelegram(message, env);
    return { message };
  }
}

async function handleFetch(req: Request, env: Env): Promise<Response> {
  const url = new URL(req.url);
  const pathname = url.pathname;

  switch (pathname) {
    case '/setWebhookTelegram': {
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
        }
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

export default {
	async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    try {
      return await handleFetch(req, env);
    } catch (error) {
      const logInfo = {
        method: req.method,
        pathName: (new URL(req.url)).pathname,
        message: (error as Error)?.message,
        stack: (error as Error)?.stack,
      }
      await sendMessageToTelegram({
        chat_id: env.TELEGRAM_CHAT_ID,
        text: `${TelegramMessageTitle.ErrorDetected} \n${JSON.stringify(logInfo, null, 2)}`
      }, env);
      return new Response(`Error: ${logInfo.message}`, { status: 500 });
    }
  },

	// The scheduled handler is invoked at the interval set in our wrangler.jsonc's
	// [[triggers]] configuration.
	async scheduled(event, env: Env, ctx: ExecutionContext): Promise<void> {
    console.log(`⏰ Starting scheduled job at cron: ${event.cron}, time: ${event.scheduledTime}`);
    const cron = event.cron;
    switch (cron) {
      // Every day at 00:05
      case "5 0 * * *": {
        // ETF data analysis already done below
        try {
          console.log("📊 Running ETF data analysis for 00:05 schedule");
          await fetchAndNotifyEtf(env);
        } catch (error) {
          console.error(`Error during analyzeEtfData: ${(error as any).message}`);
          await buildSendMessageToTelegram(`Error during analyzeEtfData: ${(error as any).message}`, env);
        }

        // Snapshot chart already done above
        try {
          console.log("📸 Taking chart snapshot for 00:05 schedule");
          await snapshotChart(env);
        } catch (error) {
          console.error(`Error during snapshotChart: ${(error as any).message}`);
          await buildSendMessageToTelegram(`Error during snapshotChart: ${(error as any).message}`, env);
        }
        break;
      }
      case "*/15 * * * *": {
        // Every 15 minutes, check for 2 consecutive closed 15m bullish candles
        try {
          const enabledOneCandle = await env.DAILY_NOTES_KV.get(KVKeys.EnableNotifyOneClosed15mCandlesBullish);
          if (enabledOneCandle) {
            console.log("🔔 Checking for 1 closed 15m bullish candle");
            await notifyNumberClosedCandlesBullish({
              symbol: BinanceSymbol.BTCUSDT,
              interval: BinanceInterval.FIFTEEN_MINUTES,
              limit: 1,
            }, env);
          }

          const enabledTwoCandles = await env.DAILY_NOTES_KV.get(KVKeys.EnableNotifyTwoClosed15mCandlesBullish);
          if (enabledTwoCandles) {
            console.log("🔔 Checking for 2 consecutive closed 15m bullish candles");
            await notifyNumberClosedCandlesBullish({
              symbol: BinanceSymbol.BTCUSDT,
              interval: BinanceInterval.FIFTEEN_MINUTES,
              limit: 2,
            }, env);
          }
        } catch (error) {
          console.error(`Error during notifyNumberClosedCandlesBullish: ${(error as any).message}`);
          await buildSendMessageToTelegram(`Error during notifyNumberClosedCandlesBullish: ${(error as any).message}`, env);
        }
        break;
      }
      case "0 */1 * * *": {
        const enabledOne1HCandle = await env.DAILY_NOTES_KV.get(KVKeys.EnableNotifyOneClosed1hCandlesBullish);
        if (enabledOne1HCandle) {
          try {
            console.log("🔔 Checking for 1 closed 1h bullish candle");
            await notifyNumberClosedCandlesBullish({
              symbol: BinanceSymbol.BTCUSDT,
              interval: BinanceInterval.ONE_HOUR,
              limit: 1,
            }, env);
          } catch (error) {
            console.error(`Error during notifyNumberClosedCandlesBullish: ${(error as any).message}`);
            await buildSendMessageToTelegram(`Error during notifyNumberClosedCandlesBullish: ${(error as any).message}`, env);
          }
        }

        const enabledTwo1HCandles = await env.DAILY_NOTES_KV.get(KVKeys.EnableNotifyTwoClosed1hCandlesBullish);
        if (enabledTwo1HCandles) {
          try {
            console.log("🔔 Checking for 2 consecutive closed 1h bullish candles");
            await notifyNumberClosedCandlesBullish({
              symbol: BinanceSymbol.BTCUSDT,
              interval: BinanceInterval.ONE_HOUR,
              limit: 2,
            }, env);
          } catch (error) {
            console.error(`Error during notifyNumberClosedCandlesBullish: ${(error as any).message}`);
            await buildSendMessageToTelegram(`Error during notifyNumberClosedCandlesBullish: ${(error as any).message}`, env);
          }
        }
        break;
      }
      default: {
        console.log(`Skipping ETF analysis for this cron (${event.cron})`);
      }
    }
	},
} satisfies ExportedHandler<Env>;
