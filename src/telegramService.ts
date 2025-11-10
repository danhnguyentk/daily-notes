import { Env } from './types';

type TelegramImageRequest = {
  chat_id: string;
  caption: string;
  photo: ArrayBuffer;
};

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

export async function sendImageToTelegram(request: TelegramImageRequest, env: Env): Promise<void> {
  console.log(`Sending image to Telegram with caption: ${request.caption}`);
  const url = `https://api.telegram.org/bot${env.TELEGRAM_KEY}/sendPhoto`;
  const formData = new FormData();
  formData.append('chat_id', request.chat_id);
  formData.append('caption', request.caption);
  const photoBlob = new Blob([request.photo], { type: 'image/png' });
  formData.append('photo', photoBlob, 'chart.png');

  const response = await fetch(url, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errorLogs = {
      status: response.status,
      statusText: response.statusText,
      chatId: request.chat_id,
      caption: request.caption,
    };
    throw new Error(`Telegram API failed when send photo. ${JSON.stringify(errorLogs, null, 2)}`);
  }

  console.log('Image sent to Telegram successfully');
}