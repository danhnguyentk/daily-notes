/**
 * Chart snapshot handlers
 */

import { BinanceToTradingviewInterval, BinanceInterval } from '../binanceService';
import { sendImageGroupToTelegram, sendImageToTelegram, TelegramImageRequest } from '../telegramService';
import { TradingviewInterval, TradingviewSymbol, getTradingViewImage } from '../tradingviewService';
import { Env } from '../types';
import { formatVietnamTime } from '../utils/timeUtils';

export async function snapshotChart(env: Env): Promise<void> {
  console.log('📸 Snapshot TradingView chart and send to Telegram');

  // Define the list of timeframes you want to capture
  const intervals = [
    { key: '1D', value: TradingviewInterval.Daily },
    { key: '4h', value: TradingviewInterval.H4 },
    { key: '1h', value: TradingviewInterval.H1 },
    { key: '15m', value: TradingviewInterval.Min15 },
  ];

  const images: TelegramImageRequest[] = [];
  for (const tf of intervals) {
    console.log(`Generating snapshot for ${tf.key}...`);

    const arrayBufferImage = await getTradingViewImage(
      {
        symbol: TradingviewSymbol.BitgetBtcUsdtPerp,
        interval: tf.value,
      },
      env,
    );

    images.push({
      chat_id: env.TELEGRAM_CHAT_ID,
      caption: `${tf.key} ${formatVietnamTime()}`,
      photo: arrayBufferImage,
    });
  }

  await sendImageGroupToTelegram({
    chat_id: env.TELEGRAM_CHAT_ID,
    images: images,
  }, env);
  console.log('📸 Snapshot chart sent to Telegram successfully');
}

/**
 * Send snapshot for a specific interval only
 */
export async function snapshotChartWithSpecificInterval(
  interval: { key: string; value: TradingviewInterval },
  env: Env,
): Promise<void> {
  console.log(`📸 Snapshot TradingView chart for ${interval.key} and send to Telegram`);

  const arrayBufferImage = await getTradingViewImage(
    {
      symbol: TradingviewSymbol.BitgetBtcUsdtPerp,
      interval: interval.value,
    },
    env,
  );

  await sendImageToTelegram({
    chat_id: env.TELEGRAM_CHAT_ID,
    caption: `${interval.key} ${formatVietnamTime()}`,
    photo: arrayBufferImage,
  }, env);

  console.log(`📸 Snapshot chart for ${interval.key} sent to Telegram successfully`);
}

