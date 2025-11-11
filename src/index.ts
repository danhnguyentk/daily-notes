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

import { fetchBtcEtf, EtfRow } from './fetchBtcEtf';
import { TelegramCommandIntervals, TelegramCommands, TelegramImageRequest, TelegramWebhookRequest, sendImageGroupToTelegram, sendImageToTelegram, sendMessageToTelegram, setWebhookTelegram } from './telegramService';
import { TradingviewInterval, TradingviewSymbol, getTradingViewImage } from './tradingviewService';
import { Env } from './types';

async function analyzeEtfData(env: Env) {
  const rows: EtfRow[] = await fetchBtcEtf(env);
    
  // Get the latest row based on date
  const latestRow = rows.reduce((latest, current) => {
    return new Date(current.data) > new Date(latest.data) ? current : latest;
  }, rows[0]);
  console.log('Latest Row:', latestRow);

  // Send message to Telegram
  const fbtcValue = latestRow.funds[`FBTC-Fidelity`] as number;
  let recommendation = `Thị trường chưa rõ ràng. Quan sát thêm.`;
  if (fbtcValue < 0) {
    recommendation = `Hạn chế  mua BTC vì dòng tiền từ quỹ đang âm. Chờ đợi.`;
  } else if (fbtcValue >= 100) {
    recommendation = `Cân nhắc BTC vì dòng tiền từ quỹ đang dương.` ;
  } else if (fbtcValue >= 200) {
    recommendation = `Mạnh dạn mua BTC vì dòng tiền từ quỹ đang rất dương.`;
  }
  const message = {
    ...latestRow,
    recommendation
  }
  await sendMessageToTelegram(JSON.stringify(message, null, 2), env);
}

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

export async function takeTelegramAction(action: string, env: Env): Promise<void> {
  switch (action) {
    case TelegramCommands.BTCDaily:
    case TelegramCommands.BTC4h:
    case TelegramCommands.BTC1h:
    case TelegramCommands.BTC15m:
      await snapshotChartWithSpecificInterval(TelegramCommandIntervals[action], env);
    case TelegramCommands.BTC:
    case TelegramCommands.SnapshotChart:
      await snapshotChart(env);
      break;  
    case TelegramCommands.AnalyzeEtfData:
      await analyzeEtfData(env);
      break;
    default:
      console.log(`No action taken for command: ${action}`);
      break;
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
      case '/analyzeEtfData': {
        const message = await analyzeEtfData(env);
        return new Response(JSON.stringify(message, null, 2), { status: 200 });
      }
      case '/snapshotChart': {
        await snapshotChart(env);
        return new Response('Snapshot chart successfully', { status: 200 });
      }
      case '/webhook': {
        const body = await req.json() as TelegramWebhookRequest;
        const text = body.message?.text || '';
        console.log(`Received webhook message: ${text}`);
        await takeTelegramAction(text, env);
        return new Response('Webhook handled successfully', { status: 200 });
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
      await sendMessageToTelegram(`Error during snapshotChart: ${(error as any).message}`, env);
    }
    

    // Only run analyzeEtfData if cron == "5 0 * * *" (which means 00:05 UTC)
    if (event.cron === "5 0 * * *") {
      console.log("📊 Running ETF data analysis for 00:05 schedule");
      try {
        await analyzeEtfData(env);
      } catch (error) {
        console.error(`Error during analyzeEtfData: ${(error as any).message}`);
        await sendMessageToTelegram(`Error during analyzeEtfData: ${(error as any).message}`, env);
      }
    } else {
      console.log(`Skipping ETF analysis for this cron (${event.cron})`);
    }
	},
} satisfies ExportedHandler<Env>;
