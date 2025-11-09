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
import { sendMessage } from './telegramService';
import { Env } from './types';

async function analyzeDataAndSendMessage(env: Env) {
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

export default {
	async fetch(req, env: Env, ctx: ExecutionContext): Promise<Response> {
		const message = analyzeDataAndSendMessage(env);
		return new Response(JSON.stringify(message, null, 2), { status: 200 });
	},

	// The scheduled handler is invoked at the interval set in our wrangler.jsonc's
	// [[triggers]] configuration.
	async scheduled(event, env: Env, ctx: ExecutionContext): Promise<void> {
    console.log(`Starting scheduled at ${event.cron}, ${event.scheduledTime}`);
    const message = analyzeDataAndSendMessage(env);
	},
} satisfies ExportedHandler<Env>;
