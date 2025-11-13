import { TradingviewInterval } from './tradingviewService';
import { Env } from './types';

export type TelegramImageRequest = {
  chat_id: string;
  caption: string;
  photo: ArrayBuffer;
};

export enum TelegramMessageTitle {
  ErrorDetected = '🚨 Error detected',
  Warning = '⚠️ Warning',
  Info = 'ℹ️ Info',
  Debug = '🐞 Debug',
  Success = '✅ Success',
}

export type TelegramMessageRequest = {
  chat_id: string;
  text: string;
  parse_mode?: TelegramParseMode;
}

export enum TelegramChatAction {
  Typing = 'typing',
  UploadPhoto = 'upload_photo',
  RecordVideo = 'record_video',
  UploadVideo = 'upload_video',
  RecordVoice = 'record_voice',
  UploadVoice = 'upload_voice',
  UploadDocument = 'upload_document',
  FindLocation = 'find_location',
  RecordVideoNote = 'record_video_note',
  UploadVideoNote = 'upload_video_note',
}

export type TelegramChatActionRequest = {
  chat_id: string;
  action: TelegramChatAction;
}

export type TelegramImageGroupRequest = {
  chat_id: string;
  images: TelegramImageRequest[];
}

export type TelegramWebhookRequest = {
  update_id: number;
  message?: {
    message_id: number;
    from: {
      id: number;
      is_bot: boolean;
      first_name: string;
      username: string;
    };
    chat: {
      id: number;
      title: number;
      username: string;
      type: string;
    };
    date: number;
    text?: string;
  };
}

// Define the Telegram commands
export const TelegramCommands = {
  BTC: '/btc',
  BTC1w3d1d: '/btc1w3d1d',
  BTC4h1h15m: '/btc4h1h15m',
  BTC1w: '/btc1w',
  BTC3d: '/btc3d',
  BTC1d: '/btc1d',
  BTC8h: '/btc8h',
  BTC4h: '/btc4h',
  BTC1h: '/btc1h',
  BTC15m: '/btc15m',
  SnapshotChart: '/snapshot',
  AnalyzeEtfData: '/etf',
  TWO_15M_BULLISH: '/2candles15m',
  ONE_15M_BULLISH: '/1candles15m',

  SCHEDULE_TWO_15M_BULLISH: '/schedule2candles15m',
  SCHEDULE_ONE_15M_BULLISH: '/schedule1candles15m',
  DISABLE_TWO_15M_BULLISH: '/disable2candles15m',
  DISABLE_ONE_15M_BULLISH: '/disable1candles15m',

  SCHEDULE_TWO_15M_BEARISH: '/schedule2candles15mbearish',
  SCHEDULE_ONE_15M_BEARISH: '/schedule1candles15mbearish',
  DISABLE_TWO_15M_BEARISH: '/disable2candles15mbearish',
  DISABLE_ONE_15M_BEARISH: '/disable1candles15mbearish',

  TWO_1H_BULLISH: '/2candles1h',
  ONE_1H_BULLISH: '/1candles1h',

  SCHEDULE_TWO_1H_BULLISH: '/schedule2candles1h',
  SCHEDULE_ONE_1H_BULLISH: '/schedule1candles1h',
  DISABLE_TWO_1H_BULLISH: '/disable2candles1h',
  DISABLE_ONE_1H_BULLISH: '/disable1candles1h',

  SCHEDULE_TWO_1H_BEARISH: '/schedule2candles1hbearish',
  SCHEDULE_ONE_1H_BEARISH: '/schedule1candles1hbearish',
  DISABLE_TWO_1H_BEARISH: '/disable2candles1hbearish',
  DISABLE_ONE_1H_BEARISH: '/disable1candles1hbearish',

  ENABLED_EVENTS: '/enabled_events',
  NEW_ORDER: '/neworder',
  CANCEL_ORDER: '/cancelorder',
  ORDER_PREVIEW: '/orderpreview',
} as const;

export enum TelegramParseMode {
  MarkdownV2 = 'MarkdownV2',
  HTML = 'HTML',
}

export type TelegramCommand = keyof typeof TelegramCommands;

// Default mapping of Telegram commands to TradingView intervals
export const TelegramCommandIntervals: Record<string, { key: string; value: typeof TradingviewInterval[keyof typeof TradingviewInterval] }> = {
  [TelegramCommands.BTC1d]: { key: '1D', value: TradingviewInterval.Daily },
  [TelegramCommands.BTC8h]: { key: '8h', value: TradingviewInterval.H8 },
  [TelegramCommands.BTC4h]: { key: '4h', value: TradingviewInterval.H4 },
  [TelegramCommands.BTC1h]: { key: '1h', value: TradingviewInterval.H1 },
  [TelegramCommands.BTC15m]: { key: '15m', value: TradingviewInterval.Min15 },
};

export async function sendMessageToTelegram(request: TelegramMessageRequest, env: Env) {
  console.log(`Sending messagpace to Telegram: ${request.text}`);
  const url = `https://api.telegram.org/bot${env.TELEGRAM_KEY}/sendMessage`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!res.ok) {
    const errorLogs = {
      urlPathName: '/sendMessage',
      chatId: request.chat_id,
      message: request.text,
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

export const sendImageGroupToTelegram = async (groupRequest: TelegramImageGroupRequest, env: Env): Promise<void> => {
  const images = groupRequest.images;
  console.log(`Sending image group to Telegram with ${images.length} images`);
  const url = `https://api.telegram.org/bot${env.TELEGRAM_KEY}/sendMediaGroup`;
  const formData = new FormData();

  const media = images.map((item, index) => {
    const photoBlob = new Blob([item.photo], { type: 'image/png' });
    const fileName = `chart_${index + 1}.png`;
    formData.append(`photo${index}`, photoBlob, fileName);
    return {
      type: 'photo',
      media: `attach://photo${index}`,
      caption: item.caption,
    };
  });

  formData.append('chat_id', groupRequest.chat_id);
  formData.append('media', JSON.stringify(media));

  const response = await fetch(url, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errorLogs = {
      status: response.status,
      statusText: response.statusText,
      chatId: groupRequest.chat_id,
      mediaCount: groupRequest.images.length,
    };
    throw new Error(`Telegram API failed when send media group. ${JSON.stringify(errorLogs, null, 2)}`);
  }

  console.log('Image group sent to Telegram successfully');
};

export const setWebhookTelegram = async (env: Env): Promise<any> => {
  console.log('Setting Telegram webhook');
  const url = `https://api.telegram.org/bot${env.TELEGRAM_KEY}/setWebhook?url=${env.WORKER_URL}/webhook`;
  const response = await fetch(url, {
    method: 'POST',
  });

  if (!response.ok) {
    const errorLogs = {
      status: response.status,
      statusText: response.statusText,
      webhookUrl: `${env.WORKER_URL}/webhook`,
    };
    throw new Error(`Telegram API failed when setting webhook. ${JSON.stringify(errorLogs, null, 2)}`);
  }

  return {
    message: `Telegram webhook set successfully ${env.WORKER_URL}/webhook`,
  }
}

export async function sendChatActionTelegram(request: TelegramChatActionRequest, env: Env) {
  console.log(`Sending chat action to Telegram: ${request.action}`);
  await fetch(`https://api.telegram.org/bot${env.TELEGRAM_KEY}/sendChatAction`, {
    method: 'POST',
    body: JSON.stringify({ 
      chat_id: request.chat_id, 
      action: request.action
    }
    ),
  });
  console.log('Chat action sent to Telegram successfully');
}

/**
 * Safely escape Telegram MarkdownV2 special characters.
 * Docs: https://core.telegram.org/bots/api#markdownv2-style
 */
function escapeMarkdownV2(text: string): string {
  // eslint-disable-next-line no-useless-escape
  return text.replace(/([_*\[\]()~`>#+\-=|{}.!\\])/g, '\\$1');
}

/**
 * Format an object as a safe MarkdownV2 message for Telegram
 * @param title - The title of the message
 * @param data - The object or info to include
 */
export function formatMarkdownLog(title: TelegramMessageTitle, data: unknown): string {
  // Convert the object into a pretty JSON string 
  const json = JSON.stringify(data, null, 2);
  const escapedJson = escapeMarkdownV2(json);
  const escapedTitle = escapeMarkdownV2(title);
  return `*${escapedTitle}:*\n\`\`\`${escapedJson}\`\`\``;
}