/**
 * Handler for chart menu display
 */

import { Env } from '../types/env';
import { CallbackDataPrefix } from '../types/orderTypes';
import { sendMessageToTelegram, TelegramInlineKeyboardMarkup } from '../services/telegramService';

/**
 * Show chart menu with inline keyboard buttons for all BTC chart options
 */
export async function showChartMenu(chatId: string, env: Env): Promise<void> {
  const menuButtons: Array<Array<{ text: string; callback_data: string }>> = [
    [
      {
        text: '💰 BTC Price',
        callback_data: CallbackDataPrefix.CHART_BTC_PRICE,
      },
    ],
    [
      {
        text: '📊 BTC 1W 3D 1D',
        callback_data: CallbackDataPrefix.CHART_BTC_1W3D1D,
      },
      {
        text: '📊 BTC 4H 1H 15M',
        callback_data: CallbackDataPrefix.CHART_BTC_4H1H15M,
      },
    ],
    [
      {
        text: '📈 BTC 1D',
        callback_data: CallbackDataPrefix.CHART_BTC_1D,
      },
      {
        text: '📈 BTC 8H',
        callback_data: CallbackDataPrefix.CHART_BTC_8H,
      },
      {
        text: '📈 BTC 4H',
        callback_data: CallbackDataPrefix.CHART_BTC_4H,
      },
    ],
    [
      {
        text: '📈 BTC 1H',
        callback_data: CallbackDataPrefix.CHART_BTC_1H,
      },
      {
        text: '📈 BTC 15M',
        callback_data: CallbackDataPrefix.CHART_BTC_15M,
      },
    ],
    [
      {
        text: '📸 Snapshot All',
        callback_data: CallbackDataPrefix.CHART_SNAPSHOT,
      },
      {
        text: '📊 ETF Data',
        callback_data: CallbackDataPrefix.CHART_ETF,
      },
    ],
  ];

  const keyboard: TelegramInlineKeyboardMarkup = {
    inline_keyboard: menuButtons,
  };

  const message = '📊 Menu biểu đồ BTC\n\nChọn một tùy chọn:';

  await sendMessageToTelegram(
    {
      chat_id: chatId,
      text: message,
      reply_markup: keyboard,
    },
    env
  );
}

