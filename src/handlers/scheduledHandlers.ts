/**
 * Scheduled job handlers
 */

import { BinanceSymbol, BinanceInterval, BinanceCandlesRequest } from '../services/binanceService';
import { fetchAndNotifyEtf } from '../services/fetchBtcEtf';
import { getEventConfigsForScheduled, EventConfigRecord, generateEventDescription, EventStatus } from '../services/supabaseService';
import { Env } from '../types/env';
import { buildSendMessageToTelegram } from '../utils/telegramUtils';
import { snapshotChart } from './chartHandlers';
import { notifyNumberClosedCandlesBullish, notifyNumberClosedCandlesBearish, CandleDirection } from './candleHandlers';

/**
 * Cron schedule expressions enum for easy management
 */
export enum CronSchedule {
  DAILY_00_05 = "5 0 * * *",
  EVERY_15_MINUTES = "*/15 * * * *",
  EVERY_HOUR = "0 */1 * * *",
}

// Helper function to map interval string to BinanceInterval enum
function mapIntervalToBinanceInterval(interval: string): BinanceInterval {
  switch (interval) {
    case '15m':
      return BinanceInterval.FIFTEEN_MINUTES;
    case '1h':
      return BinanceInterval.ONE_HOUR;
    case '4h':
      return BinanceInterval.FOUR_HOURS;
    case '1d':
      return BinanceInterval.ONE_DAY;
    default:
      return BinanceInterval.FIFTEEN_MINUTES;
  }
}

/**
 * Safely execute a task with error handling and notification
 */
async function safeExecute(
  task: () => Promise<void>,
  taskName: string,
  env: Env
): Promise<void> {
  try {
    await task();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Error during ${taskName}: ${errorMessage}`);
    await buildSendMessageToTelegram(`Error during ${taskName}: ${errorMessage}`, env);
  }
}

/**
 * Process a single candle check configuration from Supabase
 */
async function processCandleCheck(
  config: EventConfigRecord,
  env: Env
): Promise<void> {
  // Status is already checked in getEventConfigsForScheduled (only enabled)
  // But double-check here for safety
  if (config.status !== EventStatus.ENABLED) {
    return;
  }

  const description = generateEventDescription(config);
  console.log(`🔔 Checking for ${description}`);
  
  const binanceInterval = mapIntervalToBinanceInterval(config.interval);
  
  const request: BinanceCandlesRequest = {
    symbol: BinanceSymbol.BTCUSDT,
    interval: binanceInterval,
    limit: config.candle_count,
  };

  if (config.direction === CandleDirection.BULLISH) {
    await notifyNumberClosedCandlesBullish(request, env);
  } else if (config.direction === CandleDirection.BEARISH) {
    await notifyNumberClosedCandlesBearish(request, env);
  }
}

/**
 * Process multiple candle checks with error handling (from Supabase)
 */
async function processCandleChecks(
  interval: string,
  env: Env
): Promise<void> {
  await safeExecute(async () => {
    // Fetch configs from Supabase based on interval (only enabled ones)
    const configs = await getEventConfigsForScheduled(interval, env);
    for (const config of configs) {
      await processCandleCheck(config, env);
    }
  }, "candle checks", env);
}

/**
 * Handle daily tasks (ETF analysis and chart snapshot)
 */
async function handleDailyTasks(env: Env): Promise<void> {
  await safeExecute(async () => {
    console.log("📊 Running ETF data analysis for 00:05 schedule");
    await fetchAndNotifyEtf(env);
  }, "analyzeEtfData", env);

  await safeExecute(async () => {
    console.log("📸 Taking chart snapshot for 00:05 schedule");
    await snapshotChart(env);
  }, "snapshotChart", env);
}

/**
 * Main scheduled handler
 */
export async function handleScheduled(controller: ScheduledController, env: Env): Promise<void> {
  console.log(`⏰ Starting scheduled job at cron: ${controller.cron}, time: ${controller.scheduledTime}`);
  const cron = controller.cron;
  
  switch (cron) {
    case CronSchedule.DAILY_00_05:
      await handleDailyTasks(env);
      break;
    
    case CronSchedule.EVERY_15_MINUTES:
      await processCandleChecks('15m', env);
      break;
    
    case CronSchedule.EVERY_HOUR:
      await processCandleChecks('1h', env);
      break;
    
    default:
      console.log(`Skipping scheduled tasks for this cron (${controller.cron})`);
  }
}

