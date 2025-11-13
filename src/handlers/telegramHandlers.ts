/**
 * Telegram command handlers
 */

import { BinanceSymbol, BinanceInterval } from '../binanceService';
import { KVKeys } from '../cloudflareService';
import { fetchAndNotifyEtf } from '../fetchBtcEtf';
import { TelegramCommandIntervals, TelegramCommands } from '../telegramService';
import { Env } from '../types';
import { getCurrentPriceAndNotify } from '../binanceService';
import { buildSendMessageToTelegram } from '../utils/telegramUtils';
import { snapshotChart, snapshotChartWithSpecificInterval } from './chartHandlers';
import { notifyNumberClosedCandlesBullish } from './candleHandlers';

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
    // Enable/disable schedule notify 15m bullish
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
    // Enable/disable schedule notify 15m bearish
    case TelegramCommands.SCHEDULE_TWO_15M_BEARISH:
      await env.DAILY_NOTES_KV.put(KVKeys.EnableNotifyTwoClosed15mCandlesBearish, 'true');
      await buildSendMessageToTelegram('✅ Enabled scheduled check for 2 closed 15m bearish candles.', env);
      break;
    case TelegramCommands.SCHEDULE_ONE_15M_BEARISH:
      await env.DAILY_NOTES_KV.put(KVKeys.EnableNotifyOneClosed15mCandlesBearish, 'true');
      await buildSendMessageToTelegram('✅ Enabled scheduled check for 1 closed 15m bearish candle.', env);
      break;
    case TelegramCommands.DISABLE_TWO_15M_BEARISH:
      await env.DAILY_NOTES_KV.delete(KVKeys.EnableNotifyTwoClosed15mCandlesBearish);
      await buildSendMessageToTelegram('✅ Disabled scheduled check for 2 closed 15m bearish candles.', env);
      break;
    case TelegramCommands.DISABLE_ONE_15M_BEARISH:
      await env.DAILY_NOTES_KV.delete(KVKeys.EnableNotifyOneClosed15mCandlesBearish);
      await buildSendMessageToTelegram('✅ Disabled scheduled check for 1 closed 15m bearish candle.', env);
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
    // Enable/disable schedule notify 1h bullish
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
    // Enable/disable schedule notify 1h bearish
    case TelegramCommands.SCHEDULE_TWO_1H_BEARISH:
      await env.DAILY_NOTES_KV.put(KVKeys.EnableNotifyTwoClosed1hCandlesBearish, 'true');
      await buildSendMessageToTelegram('✅ Enabled scheduled check for 2 closed 1h bearish candles.', env);
      break;
    case TelegramCommands.SCHEDULE_ONE_1H_BEARISH:
      await env.DAILY_NOTES_KV.put(KVKeys.EnableNotifyOneClosed1hCandlesBearish, 'true');
      await buildSendMessageToTelegram('✅ Enabled scheduled check for 1 closed 1h bearish candle.', env);
      break;
    case TelegramCommands.DISABLE_TWO_1H_BEARISH:
      await env.DAILY_NOTES_KV.delete(KVKeys.EnableNotifyTwoClosed1hCandlesBearish);
      await buildSendMessageToTelegram('✅ Disabled scheduled check for 2 closed 1h bearish candles.', env);
      break;
    case TelegramCommands.ENABLED_EVENTS:
      const result = await env.DAILY_NOTES_KV.list();
      const enabledEvents: string[] = result.keys.map(kv => kv.name);
      const message = enabledEvents.length > 0
        ? `✅ Enabled scheduled events:\n${enabledEvents.join('\n')}`
        : 'ℹ️ No scheduled events are currently enabled.';
      await buildSendMessageToTelegram(message, env);
      break;
    default:
      console.log(`No action taken for command: ${action}`);
      return { message: `No support this command ${action} now` };
  }

  return {
    message: `Action ${action} completed successfully`,
  };
}

