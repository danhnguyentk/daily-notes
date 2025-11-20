/**
 * Scheduled job handlers
 */

import { KuCoinSymbol, KuCoinInterval, KuCoinCandlesRequest } from '../services/kucoinService';
import { getEventConfigsForScheduled, EventConfigRecord, generateEventDescription, EventStatus, getTrends, TrendRecord } from '../services/supabaseService';
import { Env } from '../types/env';
import { buildSendMessageToTelegram } from '../utils/telegramUtils';
import { sendMessageToTelegram, TelegramInlineKeyboardMarkup } from '../services/telegramService';
import { snapshotChart } from './chartHandlers';
import { notifyNumberClosedCandlesBullish, notifyNumberClosedCandlesBearish } from './candleHandlers';
import { CandleDirection } from '../types/candleTypes';
import { CallbackDataPrefix } from '../types/orderTypes';
import { formatVietnamTime } from '../utils/timeUtils';

/**
 * Cron schedule expressions enum for easy management
 */
export enum CronSchedule {
  DAILY_00_05 = "5 0 * * *",
  EVERY_15_MINUTES = "*/15 * * * *",
  EVERY_HOUR = "0 */1 * * *",
  EVERY_4_HOURS = "0 */4 * * *",
}

// Helper function to map interval string to KuCoinInterval enum
function mapIntervalToKuCoinInterval(interval: string): KuCoinInterval {
  switch (interval) {
    case '15m':
      return KuCoinInterval.FIFTEEN_MINUTES;
    case '1h':
      return KuCoinInterval.ONE_HOUR;
    case '4h':
      return KuCoinInterval.FOUR_HOURS;
    case '1d':
      return KuCoinInterval.ONE_DAY;
    default:
      return KuCoinInterval.FIFTEEN_MINUTES;
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
  
  const kucoinInterval = mapIntervalToKuCoinInterval(config.interval);
  
  const request: KuCoinCandlesRequest = {
    symbol: KuCoinSymbol.BTCUSDT,
    interval: kucoinInterval,
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
 * Format trend record for display
 */
function formatTrendRecordForScheduled(trend: TrendRecord): string {
  const formatValue = (value?: string): string => {
    if (!value) return 'N/A';
    switch (value) {
      case 'bullish':
        return '🟢 Bullish';
      case 'bearish':
        return '🔴 Bearish';
      case 'neutral':
        return '⚪ Neutral';
      default:
        return value;
    }
  };

  const surveyedDate = trend.surveyed_at 
    ? formatVietnamTime(new Date(trend.surveyed_at))
    : 'N/A';

  const symbolText = trend.symbol ? `\n• Symbol: ${trend.symbol}` : '';
  return `
📊 Kết quả kiểm tra HARSI:${symbolText}
📅 Thời gian: ${surveyedDate}

• HARSI 1W: ${formatValue(trend.harsi1w)}
• HARSI 3D: ${formatValue(trend.harsi3d)}
• HARSI 2D: ${formatValue(trend.harsi2d)}
• HARSI 1D: ${formatValue(trend.harsi1d)}
• HARSI 8H: ${formatValue(trend.harsi8h)}
• HARSI 4H: ${formatValue(trend.harsi4h)}
• Xu hướng: ${trend.trend ? formatValue(trend.trend) : 'Không rõ ràng'}

${trend.recommendation || ''}
  `.trim();
}

/**
 * Send trend recommendation with Survey buttons
 */
async function sendTrendRecommendationWithButton(env: Env): Promise<void> {
  const trends = await getTrends(1, env);
  
  if (trends.length === 0) {
    console.log("No trends found, skipping recommendation");
    return;
  }

  const latestTrend = trends[0];
  const message = formatTrendRecordForScheduled(latestTrend);

  // Determine callback data and symbol name based on symbol
  let surveyCallbackData = CallbackDataPrefix.TREND_SURVEY;
  let symbolName = '';
  const symbolStr = latestTrend.symbol?.toString() || '';
  
  if (symbolStr === 'BTCUSDT') {
    surveyCallbackData = CallbackDataPrefix.TREND_SURVEY_BTC;
    symbolName = 'BTC';
  } else if (symbolStr === 'ETHUSDT') {
    surveyCallbackData = CallbackDataPrefix.TREND_SURVEY_ETH;
    symbolName = 'ETH';
  } else if (symbolStr === 'XAUUSD') {
    surveyCallbackData = CallbackDataPrefix.TREND_SURVEY_XAU;
    symbolName = 'XAU';
  }

  const buttonText = symbolName ? `🔄 Khảo Sát Mới ${symbolName}` : '🔄 Khảo Sát Mới';

  const keyboard: TelegramInlineKeyboardMarkup = {
    inline_keyboard: [
      [
        { text: buttonText, callback_data: surveyCallbackData },
      ],
    ],
  };

  await sendMessageToTelegram({
    chat_id: env.TELEGRAM_CHAT_ID,
    text: message,
    reply_markup: keyboard,
  }, env);
}

/**
 * Handle daily tasks (ETF analysis, chart snapshot, and trend recommendation)
 */
async function handleDailyTasks(env: Env): Promise<void> {
  await safeExecute(async () => {
    console.log("📊 Sending BTC ETF dashboard link for 00:05 schedule");
    await sendMessageToTelegram({
      chat_id: env.TELEGRAM_CHAT_ID,
      text: "📊 BTC ETF dashboard:\nhttps://farside.co.uk/btc/",
    }, env);
  }, "btcEtfLink", env);

  await safeExecute(async () => {
    console.log("📸 Taking chart snapshot for 00:05 schedule");
    await snapshotChart(env);
  }, "snapshotChart", env);

  await safeExecute(async () => {
    console.log("📊 Sending trend recommendation for 00:05 schedule");
    await sendTrendRecommendationWithButton(env);
  }, "trendRecommendation", env);
}

/**
 * Send trend recommendation every 4 hours
 */
async function handleTrendRecommendation(env: Env): Promise<void> {
  await safeExecute(async () => {
    console.log("📊 Sending trend recommendation for 4h schedule");
    const trends = await getTrends(1, env);
    
    if (trends.length === 0) {
      console.log("No trends found, skipping recommendation");
      return;
    }

    const latestTrend = trends[0];
    
    if (!latestTrend.recommendation) {
      console.log("Latest trend has no recommendation, skipping");
      return;
    }

    const message = `📊 Khuyến nghị mới nhất:\n\n${latestTrend.recommendation}`;
    
    await sendMessageToTelegram({
      chat_id: env.TELEGRAM_CHAT_ID,
      text: message,
    }, env);
  }, "trendRecommendation", env);
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
    
    case CronSchedule.EVERY_4_HOURS:
      await handleTrendRecommendation(env);
      break;
    
    default:
      console.log(`Skipping scheduled tasks for this cron (${controller.cron})`);
  }
}

