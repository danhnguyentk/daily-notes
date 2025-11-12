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

import { BinanceCandlesRequest, BinanceInterval, BinanceSymbol, BinanceToTradingviewInterval, checkNumberClosedCandlesBullish } from './binanceService';
import { fetchBtcEtf, EtfRow, fetchAndNotifyEtf } from './fetchBtcEtf';
import { TelegramCommandIntervals, TelegramCommands, TelegramImageRequest, TelegramParseMode, TelegramWebhookRequest, sendImageGroupToTelegram, sendImageToTelegram, sendMessageToTelegram, setWebhookTelegram } from './telegramService';
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

const sendMarkdownMessageToTelegram = async (message: string, env: Env) => {
  await sendMessageToTelegram({
    chat_id: env.TELEGRAM_CHAT_ID,
    text: message,
    parse_mode: TelegramParseMode.MarkdownV2,
  }, env);
}

export async function takeTelegramAction(action: string, env: Env): Promise<object> {
  switch (action) {
    case TelegramCommands.BTCDaily:
    case TelegramCommands.BTC4h:
    case TelegramCommands.BTC1h:
    case TelegramCommands.BTC15m:
      await sendMarkdownMessageToTelegram(('📊 Generating chart... Please wait.'), env);
      await snapshotChartWithSpecificInterval(TelegramCommandIntervals[action], env);
      break;
    case TelegramCommands.BTC:
    case TelegramCommands.SnapshotChart:
      await sendMarkdownMessageToTelegram('📊 Generating chart... Please wait.', env);
      await snapshotChart(env);
      break;  
    case TelegramCommands.AnalyzeEtfData:
      await sendMarkdownMessageToTelegram('📊 Analyzing ETF data... Please wait.', env);
      await fetchAndNotifyEtf(env);
      break;
    case TelegramCommands.TWO_15M_BULLISH:
      await sendMarkdownMessageToTelegram('📊 Verify bullish... Please wait.', env);
      await notifyNumberClosedCandlesBullish({
        symbol: BinanceSymbol.BTCUSDT,
        interval: BinanceInterval.FIFTEEN_MINUTES,
        limit: 2,
      }, env);
      break;
    case TelegramCommands.ONE_15M_BULLISH:
      await sendMarkdownMessageToTelegram('📊 Verify bullish... Please wait.', env);
      await notifyNumberClosedCandlesBullish({
        symbol: BinanceSymbol.BTCUSDT,
        interval: BinanceInterval.FIFTEEN_MINUTES,
        limit: 1,
      }, env);
      break;
    case TelegramCommands.TWO_1H_BULLISH:
      await sendMarkdownMessageToTelegram('📊 Verify bullish... Please wait.', env);
      await notifyNumberClosedCandlesBullish({
        symbol: BinanceSymbol.BTCUSDT,
        interval: BinanceInterval.ONE_HOUR,
        limit: 2,
      }, env);
      break;
    case TelegramCommands.ONE_1H_BULLISH:
      await sendMarkdownMessageToTelegram('📊 Verify bullish... Please wait.', env);
      await notifyNumberClosedCandlesBullish({
        symbol: BinanceSymbol.BTCUSDT,
        interval: BinanceInterval.ONE_HOUR,
        limit: 1,
      }, env);
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
  const isBullish = await checkNumberClosedCandlesBullish(request, env);

  if (isBullish) {
    const message = `🔥 Alert: ${request.limit} Consecutive closed ${request.interval} candles are bullish for ${request.symbol}! Time: ${formatVietnamTime()}`;
    console.log(message);
    await sendMarkdownMessageToTelegram(message, env);

    // Optionally, send a chart snapshot for this interval
    await snapshotChartWithSpecificInterval(
      { key: request.interval, value: BinanceToTradingviewInterval[request.interval] },
      env,
    );

    return { message: `${request.limit} Consecutive closed ${request.interval} candles are bullish for ${request.symbol}.` };
  } else {
    const message = `No bullish pattern detected for the last consecutive ${request.interval} candles. Time: ${formatVietnamTime()}`;
    await sendMarkdownMessageToTelegram(message, env);
    return { message };
  }
}

export default {
	async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(req.url);
    const pathname = url.pathname;
  
    switch (pathname) {
      case '/setWebhookTelegram': {
        const result = await setWebhookTelegram(env);
        return new Response(JSON.stringify(result), { status: 200 });
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
      case '/webhook': {
        try {
          const body = await req.json() as TelegramWebhookRequest;
          // "/btc15m@daily_analytic_btc_bot";
          // Extract command text before the "@" symbol
          const text = (body.message?.text || '').split("@")[0];
          
          console.log(`Received webhook message: ${text}`);
          await takeTelegramAction(text, env);
          return new Response('Webhook handled successfully', { status: 200 });
        } catch (error) {
          console.error(`Error handling webhook: ${(error as any).message}`);
          await sendMarkdownMessageToTelegram(`Error handling webhook: ${(error as any).message}`, env);
          return new Response(`Error handling webhook: ${(error as any).message}`, { status: 200 });
        }
      }
  
      default:
        return new Response('OK. No do anything.', { status: 200 });
    }
  },

	// The scheduled handler is invoked at the interval set in our wrangler.jsonc's
	// [[triggers]] configuration.
	async scheduled(event, env: Env, ctx: ExecutionContext): Promise<void> {
    console.log(`⏰ Starting scheduled job at cron: ${event.cron}, time: ${event.scheduledTime}`);

    // Always snapshot the chart every 4h + 5m
    try {
      await snapshotChart(env);
    } catch (error) {
      console.error(`Error during snapshotChart: ${(error as any).message}`);
      await sendMarkdownMessageToTelegram(`Error during snapshotChart: ${(error as any).message}`, env);
    }
    

    // Only run analyzeEtfData if cron == "5 0 * * *" (which means 00:05 UTC)
    if (event.cron === "5 0 * * *") {
      console.log("📊 Running ETF data analysis for 00:05 schedule");
      try {
        await fetchAndNotifyEtf(env);
      } catch (error) {
        console.error(`Error during analyzeEtfData: ${(error as any).message}`);
        await sendMarkdownMessageToTelegram(`Error during analyzeEtfData: ${(error as any).message}`, env);
      }
    } else {
      console.log(`Skipping ETF analysis for this cron (${event.cron})`);
    }
	},
} satisfies ExportedHandler<Env>;
