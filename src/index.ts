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
import { sendImageToTelegram, sendMessage } from './telegramService';
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
  await sendMessage(JSON.stringify(message, null, 2), env);
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

  for (const tf of intervals) {
    console.log(`Generating snapshot for ${tf.key}...`);

    const arrayBufferImage = await getTradingViewImage(
      {
        symbol: TradingviewSymbol.BitgetBtcUsdtPerp,
        interval: tf.value,
      },
      env,
    );

    await sendImageToTelegram(
      {
        chat_id: env.TELEGRAM_CHAT_ID,
        caption: `${tf.key}`,
        photo: arrayBufferImage,
      },
      env,
    );

    console.log(`✅ Sent ${tf.key} chart to Telegram`);
  }

  console.log('📤 All snapshots completed');
}

export default {
	async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(req.url);
    const pathname = url.pathname;
  
    switch (pathname) {
      case '/analyzeEtfData': {
        const message = await analyzeEtfData(env);
        return new Response(JSON.stringify(message, null, 2), { status: 200 });
      }
  
      case '/snapshotChart': {
        await snapshotChart(env);
        return new Response('Snapshot chart successfully', { status: 200 });
      }
  
      default:
        return new Response('OK', { status: 200 });
    }
  },

	// The scheduled handler is invoked at the interval set in our wrangler.jsonc's
	// [[triggers]] configuration.
	async scheduled(event, env: Env, ctx: ExecutionContext): Promise<void> {
    console.log(`Starting scheduled at ${event.cron}, ${event.scheduledTime}`);
    await analyzeEtfData(env);
	},
} satisfies ExportedHandler<Env>;
