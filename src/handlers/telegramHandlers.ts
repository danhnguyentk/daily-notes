/**
 * Telegram command handlers
 */

import { BinanceSymbol, BinanceInterval } from '../services/binanceService';
import { KVKeys } from '../services/cloudflareService';
import { TelegramCommands } from '../services/telegramService';
import { Env } from '../types/env';
import { buildSendMessageToTelegram } from '../utils/telegramUtils';
import { notifyNumberClosedCandlesBullish } from './candleHandlers';

// Configuration for schedule enable/disable commands
interface ScheduleConfig {
  kvKey: KVKeys;
  message: string;
}

// Configuration for candle check commands
interface CandleCheckConfig {
  interval: BinanceInterval;
  limit: number;
}

// Map of schedule commands to their configurations
const SCHEDULE_CONFIGS: Record<string, ScheduleConfig> = {
  [TelegramCommands.SCHEDULE_TWO_15M_BULLISH]: {
    kvKey: KVKeys.EnableNotifyTwoClosed15mCandlesBullish,
    message: '✅ Enabled scheduled check for 2 closed 15m bullish candles.',
  },
  [TelegramCommands.SCHEDULE_ONE_15M_BULLISH]: {
    kvKey: KVKeys.EnableNotifyOneClosed15mCandlesBullish,
    message: '✅ Enabled scheduled check for 1 closed 15m bullish candle.',
  },
  [TelegramCommands.DISABLE_TWO_15M_BULLISH]: {
    kvKey: KVKeys.EnableNotifyTwoClosed15mCandlesBullish,
    message: '✅ Disabled scheduled check for 2 closed 15m bullish candles.',
  },
  [TelegramCommands.DISABLE_ONE_15M_BULLISH]: {
    kvKey: KVKeys.EnableNotifyOneClosed15mCandlesBullish,
    message: '✅ Disabled scheduled check for 1 closed 15m bullish candle.',
  },
  [TelegramCommands.SCHEDULE_TWO_15M_BEARISH]: {
    kvKey: KVKeys.EnableNotifyTwoClosed15mCandlesBearish,
    message: '✅ Enabled scheduled check for 2 closed 15m bearish candles.',
  },
  [TelegramCommands.SCHEDULE_ONE_15M_BEARISH]: {
    kvKey: KVKeys.EnableNotifyOneClosed15mCandlesBearish,
    message: '✅ Enabled scheduled check for 1 closed 15m bearish candle.',
  },
  [TelegramCommands.DISABLE_TWO_15M_BEARISH]: {
    kvKey: KVKeys.EnableNotifyTwoClosed15mCandlesBearish,
    message: '✅ Disabled scheduled check for 2 closed 15m bearish candles.',
  },
  [TelegramCommands.DISABLE_ONE_15M_BEARISH]: {
    kvKey: KVKeys.EnableNotifyOneClosed15mCandlesBearish,
    message: '✅ Disabled scheduled check for 1 closed 15m bearish candle.',
  },
  [TelegramCommands.SCHEDULE_TWO_1H_BULLISH]: {
    kvKey: KVKeys.EnableNotifyTwoClosed1hCandlesBullish,
    message: '✅ Enabled scheduled check for 2 closed 1h bullish candles.',
  },
  [TelegramCommands.SCHEDULE_ONE_1H_BULLISH]: {
    kvKey: KVKeys.EnableNotifyOneClosed1hCandlesBullish,
    message: '✅ Enabled scheduled check for 1 closed 1h bullish candle.',
  },
  [TelegramCommands.DISABLE_TWO_1H_BULLISH]: {
    kvKey: KVKeys.EnableNotifyTwoClosed1hCandlesBullish,
    message: '✅ Disabled scheduled check for 2 closed 1h bullish candles.',
  },
  [TelegramCommands.DISABLE_ONE_1H_BULLISH]: {
    kvKey: KVKeys.EnableNotifyOneClosed1hCandlesBullish,
    message: '✅ Disabled scheduled check for 1 closed 1h bullish candle.',
  },
  [TelegramCommands.SCHEDULE_TWO_1H_BEARISH]: {
    kvKey: KVKeys.EnableNotifyTwoClosed1hCandlesBearish,
    message: '✅ Enabled scheduled check for 2 closed 1h bearish candles.',
  },
  [TelegramCommands.SCHEDULE_ONE_1H_BEARISH]: {
    kvKey: KVKeys.EnableNotifyOneClosed1hCandlesBearish,
    message: '✅ Enabled scheduled check for 1 closed 1h bearish candle.',
  },
  [TelegramCommands.DISABLE_TWO_1H_BEARISH]: {
    kvKey: KVKeys.EnableNotifyTwoClosed1hCandlesBearish,
    message: '✅ Disabled scheduled check for 2 closed 1h bearish candles.',
  },
};

// Map of candle check commands to their configurations
const CANDLE_CHECK_CONFIGS: Record<string, CandleCheckConfig> = {
  [TelegramCommands.TWO_15M_BULLISH]: {
    interval: BinanceInterval.FIFTEEN_MINUTES,
    limit: 2,
  },
  [TelegramCommands.ONE_15M_BULLISH]: {
    interval: BinanceInterval.FIFTEEN_MINUTES,
    limit: 1,
  },
  [TelegramCommands.TWO_1H_BULLISH]: {
    interval: BinanceInterval.ONE_HOUR,
    limit: 2,
  },
  [TelegramCommands.ONE_1H_BULLISH]: {
    interval: BinanceInterval.ONE_HOUR,
    limit: 1,
  },
};


// Helper function to handle candle check commands
async function handleCandleCheck(config: CandleCheckConfig, env: Env): Promise<void> {
  await buildSendMessageToTelegram('📊 Verify bullish... Please wait.', env);
  await notifyNumberClosedCandlesBullish({
    symbol: BinanceSymbol.BTCUSDT,
    interval: config.interval,
    limit: config.limit,
  }, env);
}

// Helper function to handle schedule enable/disable commands
async function handleScheduleCommand(command: string, env: Env): Promise<void> {
  const config = SCHEDULE_CONFIGS[command];
  if (!config) {
    throw new Error(`No configuration found for schedule command: ${command}`);
  }

  const isDisable = command.startsWith('/disable');
  if (isDisable) {
    await env.DAILY_NOTES_KV.delete(config.kvKey);
  } else {
    await env.DAILY_NOTES_KV.put(config.kvKey, 'true');
  }
  await buildSendMessageToTelegram(config.message, env);
}

// Helper function to handle enabled events listing
async function handleEnabledEvents(env: Env): Promise<void> {
  const result = await env.DAILY_NOTES_KV.list();
  const enabledEvents: string[] = result.keys.map(kv => kv.name);
  const message = enabledEvents.length > 0
    ? `✅ Enabled scheduled events:\n${enabledEvents.join('\n')}`
    : 'ℹ️ No scheduled events are currently enabled.';
  await buildSendMessageToTelegram(message, env);
}

export async function takeTelegramAction(action: string, env: Env): Promise<object> {
  // Handle schedule enable/disable commands
  if (SCHEDULE_CONFIGS[action]) {
    await handleScheduleCommand(action, env);
    return { message: `Action ${action} completed successfully` };
  }

  // Handle candle check commands
  if (CANDLE_CHECK_CONFIGS[action]) {
    await handleCandleCheck(CANDLE_CHECK_CONFIGS[action], env);
    return { message: `Action ${action} completed successfully` };
  }

  // Handle other commands
  switch (action) {
    case TelegramCommands.CHARTS:
      // Chart menu is handled via callback in httpHandlers.ts
      break;

    case TelegramCommands.ENABLED_EVENTS:
      await handleEnabledEvents(env);
      break;

    case TelegramCommands.ORDERS:
      // This will be handled in httpHandlers with user context
      return { message: 'Order menu shown' };

    case TelegramCommands.ORDER_STATS:
    case TelegramCommands.ORDER_STATS_MONTH:
      // This will be handled in httpHandlers with user context
      return { message: 'Order statistics shown' };

    default:
      console.log(`No action taken for command: ${action}`);
      return { message: `No support this command ${action} now` };
  }

  return {
    message: `Action ${action} completed successfully`,
  };
}

