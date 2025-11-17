import { Env } from '../types/env';

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

export type TelegramInlineKeyboardButton = {
  text: string;
  callback_data: string;
};

export type TelegramInlineKeyboardMarkup = {
  inline_keyboard: TelegramInlineKeyboardButton[][];
};

export type TelegramReplyKeyboardButton = {
  text: string;
};

export type TelegramReplyKeyboardMarkup = {
  keyboard: TelegramReplyKeyboardButton[][];
  resize_keyboard?: boolean;
  one_time_keyboard?: boolean;
};

export type TelegramReplyKeyboardRemove = {
  remove_keyboard: true;
  selective?: boolean;
};

export type TelegramMessageRequest = {
  chat_id: string;
  text: string;
  parse_mode?: TelegramParseMode;
  reply_markup?: TelegramInlineKeyboardMarkup | TelegramReplyKeyboardMarkup | TelegramReplyKeyboardRemove;
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
  callback_query?: {
    id: string;
    from: {
      id: number;
      is_bot: boolean;
      first_name: string;
      username: string;
    };
    message?: {
      message_id: number;
      chat: {
        id: number;
        title: number;
        username: string;
        type: string;
      };
      date: number;
      text?: string;
    };
    data: string;
  };
}

// Define the Telegram commands
export const TelegramCommands = {
  CHARTS: '/charts',
  ORDERS: '/orders',
  EVENTS: '/events',
  
  ORDER_STATS: '/orderstats',
  ORDER_STATS_MONTH: '/orderstatsmonth',
} as const;

export enum TelegramParseMode {
  MarkdownV2 = 'MarkdownV2',
  HTML = 'HTML',
}

export type TelegramCommand = keyof typeof TelegramCommands;


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

export const setWebhookTelegram = async (env: Env): Promise<{ message: string }> => {
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

/**
 * Answer a callback query (required by Telegram API)
 */
export async function answerCallbackQuery(callbackQueryId: string, env: Env, text?: string): Promise<void> {
  const url = `https://api.telegram.org/bot${env.TELEGRAM_KEY}/answerCallbackQuery`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      callback_query_id: callbackQueryId,
      text: text,
      show_alert: false,
    }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    console.error('Error answering callback query:', errorText);
    throw new Error(`Failed to answer callback query: ${errorText}`);
  }
}