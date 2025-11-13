/**
 * Scheduled job handlers
 */

import { BinanceSymbol, BinanceInterval } from '../binanceService';
import { KVKeys } from '../cloudflareService';
import { fetchAndNotifyEtf } from '../fetchBtcEtf';
import { Env } from '../types';
import { buildSendMessageToTelegram } from '../utils/telegramUtils';
import { snapshotChart } from './chartHandlers';
import { notifyNumberClosedCandlesBullish, notifyNumberClosedCandlesBearish } from './candleHandlers';

export async function handleScheduled(controller: ScheduledController, env: Env): Promise<void> {
  console.log(`⏰ Starting scheduled job at cron: ${controller.cron}, time: ${controller.scheduledTime}`);
  const cron = controller.cron;
  
  switch (cron) {
    // Every day at 00:05
    case "5 0 * * *": {
      // ETF data analysis
      try {
        console.log("📊 Running ETF data analysis for 00:05 schedule");
        await fetchAndNotifyEtf(env);
      } catch (error) {
        console.error(`Error during analyzeEtfData: ${(error as any).message}`);
        await buildSendMessageToTelegram(`Error during analyzeEtfData: ${(error as any).message}`, env);
      }

      // Snapshot chart
      try {
        console.log("📸 Taking chart snapshot for 00:05 schedule");
        await snapshotChart(env);
      } catch (error) {
        console.error(`Error during snapshotChart: ${(error as any).message}`);
        await buildSendMessageToTelegram(`Error during snapshotChart: ${(error as any).message}`, env);
      }
      break;
    }
    
    // Every 15 minutes
    case "*/15 * * * *": {
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

        const enabledOneCandleBearish = await env.DAILY_NOTES_KV.get(KVKeys.EnableNotifyOneClosed15mCandlesBearish);
        if (enabledOneCandleBearish) {
          console.log("🔔 Checking for 1 closed 15m bearish candle");
          await notifyNumberClosedCandlesBearish({
            symbol: BinanceSymbol.BTCUSDT,
            interval: BinanceInterval.FIFTEEN_MINUTES,
            limit: 1,
          }, env);
        }

        const enabledTwoCandlesBearish = await env.DAILY_NOTES_KV.get(KVKeys.EnableNotifyTwoClosed15mCandlesBearish);
        if (enabledTwoCandlesBearish) {
          console.log("🔔 Checking for 2 consecutive closed 15m bearish candles");
          await notifyNumberClosedCandlesBearish({
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
    
    // Every hour
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

      const enabledOne1HCandleBearish = await env.DAILY_NOTES_KV.get(KVKeys.EnableNotifyOneClosed1hCandlesBearish);
      if (enabledOne1HCandleBearish) {
        try {
          console.log("🔔 Checking for 1 closed 1h bearish candle");
          await notifyNumberClosedCandlesBearish({
            symbol: BinanceSymbol.BTCUSDT,
            interval: BinanceInterval.ONE_HOUR,
            limit: 1,
          }, env);
        } catch (error) {
          console.error(`Error during checkNumberClosedCandlesBearish: ${(error as any).message}`);
          await buildSendMessageToTelegram(`Error during checkNumberClosedCandlesBearish: ${(error as any).message}`, env);
        }
      }

      const enabledTwo1HCandlesBearish = await env.DAILY_NOTES_KV.get(KVKeys.EnableNotifyTwoClosed1hCandlesBearish);
      if (enabledTwo1HCandlesBearish) {
        try {
          console.log("🔔 Checking for 2 consecutive closed 1h bearish candles");
          await notifyNumberClosedCandlesBearish({
            symbol: BinanceSymbol.BTCUSDT,
            interval: BinanceInterval.ONE_HOUR,
            limit: 2,
          }, env);
        } catch (error) {
          console.error(`Error during checkNumberClosedCandlesBearish: ${(error as any).message}`);
          await buildSendMessageToTelegram(`Error during checkNumberClosedCandlesBearish: ${(error as any).message}`, env);
        }
      }
      break;
    }
    
    default: {
      console.log(`Skipping ETF analysis for this cron (${controller.cron})`);
    }
  }
}

