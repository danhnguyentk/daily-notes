/**
 * Telegram command handlers
 */

import { BinanceSymbol, BinanceInterval } from '../services/binanceService';
import { KVKeys } from '../services/cloudflareService';
import { TelegramCommands, TelegramInlineKeyboardMarkup, sendMessageToTelegram } from '../services/telegramService';
import { Env } from '../types/env';
import { CallbackDataPrefix } from '../types/orderTypes';
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
// Using command strings directly since TelegramCommands constants are commented out
const SCHEDULE_CONFIGS: Record<string, ScheduleConfig> = {
  '/schedule2candles15m': {
    kvKey: KVKeys.EnableNotifyTwoClosed15mCandlesBullish,
    message: '✅ Enabled scheduled check for 2 closed 15m bullish candles.',
  },
  '/schedule1candles15m': {
    kvKey: KVKeys.EnableNotifyOneClosed15mCandlesBullish,
    message: '✅ Enabled scheduled check for 1 closed 15m bullish candle.',
  },
  '/disable2candles15m': {
    kvKey: KVKeys.EnableNotifyTwoClosed15mCandlesBullish,
    message: '✅ Disabled scheduled check for 2 closed 15m bullish candles.',
  },
  '/disable1candles15m': {
    kvKey: KVKeys.EnableNotifyOneClosed15mCandlesBullish,
    message: '✅ Disabled scheduled check for 1 closed 15m bullish candle.',
  },
  '/schedule2candles15mbearish': {
    kvKey: KVKeys.EnableNotifyTwoClosed15mCandlesBearish,
    message: '✅ Enabled scheduled check for 2 closed 15m bearish candles.',
  },
  '/schedule1candles15mbearish': {
    kvKey: KVKeys.EnableNotifyOneClosed15mCandlesBearish,
    message: '✅ Enabled scheduled check for 1 closed 15m bearish candle.',
  },
  '/disable2candles15mbearish': {
    kvKey: KVKeys.EnableNotifyTwoClosed15mCandlesBearish,
    message: '✅ Disabled scheduled check for 2 closed 15m bearish candles.',
  },
  '/disable1candles15mbearish': {
    kvKey: KVKeys.EnableNotifyOneClosed15mCandlesBearish,
    message: '✅ Disabled scheduled check for 1 closed 15m bearish candle.',
  },
  '/schedule2candles1h': {
    kvKey: KVKeys.EnableNotifyTwoClosed1hCandlesBullish,
    message: '✅ Enabled scheduled check for 2 closed 1h bullish candles.',
  },
  '/schedule1candles1h': {
    kvKey: KVKeys.EnableNotifyOneClosed1hCandlesBullish,
    message: '✅ Enabled scheduled check for 1 closed 1h bullish candle.',
  },
  '/disable2candles1h': {
    kvKey: KVKeys.EnableNotifyTwoClosed1hCandlesBullish,
    message: '✅ Disabled scheduled check for 2 closed 1h bullish candles.',
  },
  '/disable1candles1h': {
    kvKey: KVKeys.EnableNotifyOneClosed1hCandlesBullish,
    message: '✅ Disabled scheduled check for 1 closed 1h bullish candle.',
  },
  '/schedule2candles1hbearish': {
    kvKey: KVKeys.EnableNotifyTwoClosed1hCandlesBearish,
    message: '✅ Enabled scheduled check for 2 closed 1h bearish candles.',
  },
  '/schedule1candles1hbearish': {
    kvKey: KVKeys.EnableNotifyOneClosed1hCandlesBearish,
    message: '✅ Enabled scheduled check for 1 closed 1h bearish candle.',
  },
  '/disable2candles1hbearish': {
    kvKey: KVKeys.EnableNotifyTwoClosed1hCandlesBearish,
    message: '✅ Disabled scheduled check for 2 closed 1h bearish candles.',
  },
};

// Map of candle check commands to their configurations
// Using command strings directly since TelegramCommands constants are commented out
const CANDLE_CHECK_CONFIGS: Record<string, CandleCheckConfig> = {
  '/2candles15m': {
    interval: BinanceInterval.FIFTEEN_MINUTES,
    limit: 2,
  },
  '/1candles15m': {
    interval: BinanceInterval.FIFTEEN_MINUTES,
    limit: 1,
  },
  '/2candles1h': {
    interval: BinanceInterval.ONE_HOUR,
    limit: 2,
  },
  '/1candles1h': {
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

// Helper function to format event name from KV key
function formatEventName(key: string): string {
  // Remove "EnableNotify" prefix
  let name = key.replace(/^EnableNotify/, '');
  // Add spaces before capital letters
  name = name.replace(/([A-Z])/g, ' $1').trim();
  // Capitalize first letter
  return name.charAt(0).toUpperCase() + name.slice(1);
}

// Map KV keys to their verify commands (immediate execution)
// Using command strings directly since TelegramCommands constants are commented out
const KV_KEY_TO_VERIFY_COMMAND: Record<KVKeys, string> = {
  [KVKeys.EnableNotifyTwoClosed15mCandlesBullish]: '/2candles15m',
  [KVKeys.EnableNotifyOneClosed15mCandlesBullish]: '/1candles15m',
  [KVKeys.EnableNotifyTwoClosed1hCandlesBullish]: '/2candles1h',
  [KVKeys.EnableNotifyOneClosed1hCandlesBullish]: '/1candles1h',
  [KVKeys.EnableNotifyTwoClosed15mCandlesBearish]: '/2candles15m', // Note: bearish uses same verify command
  [KVKeys.EnableNotifyOneClosed15mCandlesBearish]: '/1candles15m',
  [KVKeys.EnableNotifyTwoClosed1hCandlesBearish]: '/2candles1h',
  [KVKeys.EnableNotifyOneClosed1hCandlesBearish]: '/1candles1h',
};

// Helper function to get schedule/disable command for a KV key
function getCommandsForKvKey(kvKey: KVKeys): { scheduleCommand: string; disableCommand: string; verifyCommand: string } | null {
  let scheduleCommand = '';
  let disableCommand = '';
  
  // Find both schedule and disable commands for this KV key
  for (const [command, config] of Object.entries(SCHEDULE_CONFIGS)) {
    if (config.kvKey === kvKey) {
      // command is the TelegramCommands constant value (e.g., '/schedule2candles15m')
      if (command.startsWith('/schedule')) {
        scheduleCommand = command;
      } else if (command.startsWith('/disable')) {
        disableCommand = command;
      }
    }
  }
  
  if (!scheduleCommand || !disableCommand) {
    return null;
  }
  
  const verifyCommand = KV_KEY_TO_VERIFY_COMMAND[kvKey] || '';
  
  return {
    scheduleCommand,
    disableCommand,
    verifyCommand,
  };
}

// Helper function to handle all events listing with inline keyboard buttons
export async function handleAllEvents(chatId: string, env: Env): Promise<void> {
  const result = await env.DAILY_NOTES_KV.list();
  const allKvKeys = result.keys.map(kv => kv.name);
  
  // Get all possible event keys from SCHEDULE_CONFIGS (get unique keys)
  const allEventKeys = [...new Set(Object.values(SCHEDULE_CONFIGS).map(config => config.kvKey))];
  
  // Build inline keyboard buttons
  const keyboardButtons: Array<Array<{ text: string; callback_data: string }>> = [];
  
  // Check each event key and create buttons
  for (const eventKey of allEventKeys) {
    const isEnabled = allKvKeys.includes(eventKey);
    const eventName = formatEventName(eventKey);
    const commands = getCommandsForKvKey(eventKey);
    
    if (!commands) continue;
    
    const statusIcon = isEnabled ? '✅' : '❌';
    // Shorten event name for button text (max ~15 chars to fit in Telegram button)
    // Extract key parts: e.g., "Two Closed 15m Candles Bullish" -> "2x15m Bull"
    let shortName = eventName
      .replace(/Two Closed/g, '2x')
      .replace(/One Closed/g, '1x')
      .replace(/Candles/g, '')
      .replace(/Bullish/g, 'Bull')
      .replace(/Bearish/g, 'Bear')
      .replace(/\s+/g, '')
      .trim();
    
    // Further shorten if still too long (Telegram button max ~20 chars)
    if (shortName.length > 15) {
      shortName = shortName.substring(0, 12) + '...';
    }
    
    const buttonText = `${statusIcon} ${shortName}`;
    
    // Create row with two buttons: Enable/Disable and Verify
    const rowButtons: Array<{ text: string; callback_data: string }> = [];
    
    // First button: Enable/Disable
    if (isEnabled) {
      rowButtons.push({
        text: buttonText,
        callback_data: `${CallbackDataPrefix.EVENT_DISABLE}${commands.disableCommand}`,
      });
    } else {
      rowButtons.push({
        text: buttonText,
        callback_data: `${CallbackDataPrefix.EVENT_ENABLE}${commands.scheduleCommand}`,
      });
    }
    
    // Second button: Verify (if verify command exists)
    if (commands.verifyCommand) {
      rowButtons.push({
        text: '🔍 Verify',
        callback_data: `${CallbackDataPrefix.EVENT_VERIFY}${commands.verifyCommand}`,
      });
    }
    
    keyboardButtons.push(rowButtons);
  }
  
  // Build message
  const enabledCount = allEventKeys.filter(key => allKvKeys.includes(key)).length;
  const disabledCount = allEventKeys.length - enabledCount;
  
  let message = '📋 Tất cả Events:\n\n';
  message += `✅ Enabled/Scheduled: ${enabledCount}\n`;
  message += `❌ Disabled/Not Scheduled: ${disabledCount}\n\n`;
  message += '👉 Chọn event bên dưới để bật/tắt:';
  
  const keyboard: TelegramInlineKeyboardMarkup = {
    inline_keyboard: keyboardButtons,
  };
  
  await sendMessageToTelegram({
    chat_id: chatId,
    text: message,
    reply_markup: keyboard,
  }, env);
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

    case TelegramCommands.EVENTS:
      // Events menu is handled via callback in httpHandlers.ts with user context
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

