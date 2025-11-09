import { text } from 'cheerio/dist/commonjs/static';
import { Env } from './types';

export async function sendMessage(message: string, env: Env) {
  console.log(`Sending message to Telegram: ${message}`);
  const url = `https://api.telegram.org/bot${env.TELEGRAM_KEY}/sendMessage`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      chat_id: env.TELEGRAM_CHAT_ID,
      text: message,
    }),
  });

  if (!res.ok) {
    const errorLogs = {
      url: url,
      chatId: env.TELEGRAM_CHAT_ID,
      message: message,
      status: res.status,
      errorText: await res.text(),
    }
    console.error('Error sending message to Telegram:', errorLogs);
    throw new Error(`Failed to send message to Telegram. ${JSON.stringify(errorLogs, null, 2)}`);
  }
}