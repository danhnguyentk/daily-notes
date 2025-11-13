/**
 * Scheduled job handlers
 */

import { BinanceSymbol, BinanceInterval, BinanceCandlesRequest } from '../binanceService';
import { KVKeys } from '../cloudflareService';
import { fetchAndNotifyEtf } from '../fetchBtcEtf';
import { Env } from '../types';
import { buildSendMessageToTelegram } from '../utils/telegramUtils';
import { snapshotChart } from './chartHandlers';
import { notifyNumberClosedCandlesBullish, notifyNumberClosedCandlesBearish, CandleDirection } from './candleHandlers';

// Cron expression constants
const CRON_DAILY_00_05 = "5 0 * * *";
const CRON_EVERY_15_MINUTES = "*/15 * * * *";
const CRON_EVERY_HOUR = "0 */1 * * *";

// Candle check configuration type
type CandleCheckConfig = {
  kvKey: KVKeys;
  interval: BinanceInterval;
  limit: number;
  direction: CandleDirection;
  description: string;
};

// Configuration for candle checks by cron schedule
const CANDLE_CHECKS_15M: CandleCheckConfig[] = [
  {
    kvKey: KVKeys.EnableNotifyOneClosed15mCandlesBullish,
    interval: BinanceInterval.FIFTEEN_MINUTES,
    limit: 1,
    direction: CandleDirection.BULLISH,
    description: "1 closed 15m bullish candle",
  },
  {
    kvKey: KVKeys.EnableNotifyTwoClosed15mCandlesBullish,
    interval: BinanceInterval.FIFTEEN_MINUTES,
    limit: 2,
    direction: CandleDirection.BULLISH,
    description: "2 consecutive closed 15m bullish candles",
  },
  {
    kvKey: KVKeys.EnableNotifyOneClosed15mCandlesBearish,
    interval: BinanceInterval.FIFTEEN_MINUTES,
    limit: 1,
    direction: CandleDirection.BEARISH,
    description: "1 closed 15m bearish candle",
  },
  {
    kvKey: KVKeys.EnableNotifyTwoClosed15mCandlesBearish,
    interval: BinanceInterval.FIFTEEN_MINUTES,
    limit: 2,
    direction: CandleDirection.BEARISH,
    description: "2 consecutive closed 15m bearish candles",
  },
];

const CANDLE_CHECKS_1H: CandleCheckConfig[] = [
  {
    kvKey: KVKeys.EnableNotifyOneClosed1hCandlesBullish,
    interval: BinanceInterval.ONE_HOUR,
    limit: 1,
    direction: CandleDirection.BULLISH,
    description: "1 closed 1h bullish candle",
  },
  {
    kvKey: KVKeys.EnableNotifyTwoClosed1hCandlesBullish,
    interval: BinanceInterval.ONE_HOUR,
    limit: 2,
    direction: CandleDirection.BULLISH,
    description: "2 consecutive closed 1h bullish candles",
  },
  {
    kvKey: KVKeys.EnableNotifyOneClosed1hCandlesBearish,
    interval: BinanceInterval.ONE_HOUR,
    limit: 1,
    direction: CandleDirection.BEARISH,
    description: "1 closed 1h bearish candle",
  },
  {
    kvKey: KVKeys.EnableNotifyTwoClosed1hCandlesBearish,
    interval: BinanceInterval.ONE_HOUR,
    limit: 2,
    direction: CandleDirection.BEARISH,
    description: "2 consecutive closed 1h bearish candles",
  },
];

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
 * Process a single candle check configuration
 */
async function processCandleCheck(
  config: CandleCheckConfig,
  env: Env
): Promise<void> {
  const isEnabled = await env.DAILY_NOTES_KV.get(config.kvKey);
  if (!isEnabled) {
    return;
  }

  console.log(`🔔 Checking for ${config.description}`);
  
  const request: BinanceCandlesRequest = {
    symbol: BinanceSymbol.BTCUSDT,
    interval: config.interval,
    limit: config.limit,
  };

  if (config.direction === CandleDirection.BULLISH) {
    await notifyNumberClosedCandlesBullish(request, env);
  } else {
    await notifyNumberClosedCandlesBearish(request, env);
  }
}

/**
 * Process multiple candle checks with error handling
 */
async function processCandleChecks(
  configs: CandleCheckConfig[],
  env: Env
): Promise<void> {
  await safeExecute(async () => {
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
    case CRON_DAILY_00_05:
      await handleDailyTasks(env);
      break;
    
    case CRON_EVERY_15_MINUTES:
      await processCandleChecks(CANDLE_CHECKS_15M, env);
      break;
    
    case CRON_EVERY_HOUR:
      await processCandleChecks(CANDLE_CHECKS_1H, env);
      break;
    
    default:
      console.log(`Skipping scheduled tasks for this cron (${controller.cron})`);
  }
}

