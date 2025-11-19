/**
 * Telegram command handlers
 */

import { KuCoinSymbol, KuCoinInterval } from '../services/kucoinService';
import { TelegramCommands, TelegramInlineKeyboardMarkup, sendMessageToTelegram } from '../services/telegramService';
import {
  buildScheduleConfigs,
  buildCandleCheckConfigs,
  updateEventConfigStatus,
  getEventConfigsFromSupabase,
  getEventConfigByEventKey,
  generateEventMessage,
  EventStatus,
  CandleCheckConfig,
} from '../services/supabaseService';
import { Env } from '../types/env';
import { CallbackDataPrefix } from '../types/orderTypes';
import { buildSendMessageToTelegram } from '../utils/telegramUtils';
import { notifyNumberClosedCandlesBullish, notifyNumberClosedCandlesBearish } from './candleHandlers';
import { CandleDirection } from '../types/candleTypes';


// Helper function to handle candle check commands
async function handleCandleCheck(config: CandleCheckConfig, env: Env): Promise<void> {
  if (!config || typeof config.interval !== 'string' || typeof config.limit !== 'number') {
    throw new Error('Invalid candle check config');
  }
  
  const direction = config.direction || CandleDirection.BULLISH;
  const message = direction === CandleDirection.BULLISH ? '📊 Verify bullish... Please wait.' : '📊 Verify bearish... Please wait.';
  await buildSendMessageToTelegram(message, env);
  
  // Map string interval to KuCoinInterval enum
  let kucoinInterval: KuCoinInterval;
  switch (config.interval) {
    case '15m':
      kucoinInterval = KuCoinInterval.FIFTEEN_MINUTES;
      break;
    case '1h':
      kucoinInterval = KuCoinInterval.ONE_HOUR;
      break;
    case '4h':
      kucoinInterval = KuCoinInterval.FOUR_HOURS;
      break;
    case '1d':
      kucoinInterval = KuCoinInterval.ONE_DAY;
      break;
    default:
      kucoinInterval = KuCoinInterval.FIFTEEN_MINUTES;
  }
  
  const request = {
    symbol: KuCoinSymbol.BTCUSDT,
    interval: kucoinInterval,
    limit: config.limit,
  };
  
  if (direction === CandleDirection.BULLISH) {
    await notifyNumberClosedCandlesBullish(request, env);
  } else {
    await notifyNumberClosedCandlesBearish(request, env);
  }
}

// Helper function to handle schedule enable/disable commands (using event_key)
async function handleScheduleCommand(eventKey: string, isEnable: boolean, env: Env): Promise<void> {
  const eventConfig = await getEventConfigByEventKey(eventKey, env);
  if (!eventConfig) {
    throw new Error(`No configuration found for event_key: ${eventKey}`);
  }

  const newStatus = isEnable ? EventStatus.ENABLED : EventStatus.DISABLED;
  
  // Update status in Supabase
  await updateEventConfigStatus(eventKey, newStatus, env);
  
  // Generate message dynamically
  const message = generateEventMessage(eventConfig, isEnable);
  await buildSendMessageToTelegram(message, env);
}

// Helper function to format event name from event key
function formatEventName(key: string): string {
  // Remove "EnableNotify" prefix
  let name = key.replace(/^EnableNotify/, '');
  // Add spaces before capital letters
  name = name.replace(/([A-Z])/g, ' $1').trim();
  // Capitalize first letter
  return name.charAt(0).toUpperCase() + name.slice(1);
}


// Helper function to handle all events listing with inline keyboard buttons
export async function handleAllEvents(chatId: string, env: Env): Promise<void> {
  // Get all event configs from Supabase (includes status)
  const allEventConfigs = await getEventConfigsFromSupabase(env);
  if (!Array.isArray(allEventConfigs)) {
    throw new Error('Failed to load event configs from Supabase');
  }
  
  // Build inline keyboard buttons
  const keyboardButtons: Array<Array<{ text: string; callback_data: string }>> = [];
  
  // Check each event config and create buttons
  for (const eventConfig of allEventConfigs) {
    if (!eventConfig || typeof eventConfig.event_key !== 'string') continue;
    
    const isEnabled = eventConfig.status === EventStatus.ENABLED;
    const eventName = formatEventName(eventConfig.event_key);
    
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
    
    // First button: Enable/Disable (using event_key)
    if (isEnabled) {
      rowButtons.push({
        text: buttonText,
        callback_data: `${CallbackDataPrefix.EVENT_DISABLE}${eventConfig.event_key}`,
      });
    } else {
      rowButtons.push({
        text: buttonText,
        callback_data: `${CallbackDataPrefix.EVENT_ENABLE}${eventConfig.event_key}`,
      });
    }
    
    // Second button: Verify (using event_key)
    rowButtons.push({
      text: '🔍 Verify',
      callback_data: `${CallbackDataPrefix.EVENT_VERIFY}${eventConfig.event_key}`,
    });
    
    keyboardButtons.push(rowButtons);
  }
  
  // Build message
  const enabledCount = allEventConfigs.filter(config => config.status === EventStatus.ENABLED).length;
  const disabledCount = allEventConfigs.length - enabledCount;
  
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

export async function takeTelegramAction(action: string, env: Env, isEnable?: boolean): Promise<object> {
  // Build configs from Supabase
  const scheduleConfigs = await buildScheduleConfigs(env);
  const candleCheckConfigs = await buildCandleCheckConfigs(env);

  if (!scheduleConfigs || !candleCheckConfigs) {
    throw new Error('Failed to load configs from Supabase');
  }

  // Handle schedule enable/disable commands (action is now event_key)
  const scheduleConfig = scheduleConfigs[action];
  if (scheduleConfig && isEnable !== undefined) {
    // isEnable is explicitly passed from callback handler
    await handleScheduleCommand(action, isEnable, env);
    return { message: `Action ${action} completed successfully` };
  }

  // Handle candle check commands (action is now event_key, for verify)
  const candleCheckConfig = candleCheckConfigs[action];
  if (candleCheckConfig) {
    await handleCandleCheck(candleCheckConfig, env);
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

    case TelegramCommands.STATISTICS:
      // This will be handled in httpHandlers with user context
      return { message: 'Statistics menu shown' };

    default:
      console.log(`No action taken for command: ${action}`);
      return { message: `No support this command ${action} now` };
  }

  return {
    message: `Action ${action} completed successfully`,
  };
}

