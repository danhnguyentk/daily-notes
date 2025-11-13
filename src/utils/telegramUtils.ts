/**
 * Telegram utility functions
 */

import { sendMessageToTelegram } from '../telegramService';
import { Env } from '../types';

/**
 * Helper function to send messages to Telegram
 */
export async function buildSendMessageToTelegram(message: string, env: Env): Promise<void> {
  await sendMessageToTelegram({
    chat_id: env.TELEGRAM_CHAT_ID,
    text: message,
  }, env);
}

