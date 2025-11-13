/**
 * Candle analysis handlers
 */

import { BinanceCandlesRequest, BinanceSymbol, BinanceInterval, BinanceToTradingviewInterval, checkNumberClosedCandlesBullish, checkNumberClosedCandlesBearish } from '../binanceService';
import { Env } from '../types';
import { formatVietnamTime } from '../utils/timeUtils';
import { buildSendMessageToTelegram } from '../utils/telegramUtils';
import { snapshotChartWithSpecificInterval } from './chartHandlers';

export async function notifyNumberClosedCandlesBullish(
  request: BinanceCandlesRequest,
  env: Env
): Promise<object> {
  console.log(`Checking for ${request.limit} consecutive closed ${request.interval} bullish candles for ${request.symbol}...`);
  await buildSendMessageToTelegram(`Checking for ${request.limit} consecutive closed ${request.interval} bullish candles for ${request.symbol}...`, env);
  const isBullish = await checkNumberClosedCandlesBullish(request, env);

  if (isBullish) {
    const message = `🔥 Alert: ${request.limit} Consecutive closed ${request.interval} candles are bullish for ${request.symbol}! Time: ${formatVietnamTime()}`;
    console.log(message);
    await buildSendMessageToTelegram(message, env);

    // Optionally, send a chart snapshot for this interval
    await snapshotChartWithSpecificInterval(
      { key: request.interval, value: BinanceToTradingviewInterval[request.interval] },
      env,
    );

    return { message: `${request.limit} Consecutive closed ${request.interval} candles are bullish for ${request.symbol}.` };
  } else {
    const message = `No bullish pattern detected for the last consecutive ${request.interval} candles. Time: ${formatVietnamTime()}`;
    await buildSendMessageToTelegram(message, env);
    return { message };
  }
}

export async function notifyNumberClosedCandlesBearish(
  request: BinanceCandlesRequest,
  env: Env
): Promise<object> {
  console.log(`Checking for ${request.limit} consecutive closed ${request.interval} bearish candles for ${request.symbol}...`);
  await buildSendMessageToTelegram(`Checking for ${request.limit} consecutive closed ${request.interval} bearish candles for ${request.symbol}...`, env);
  const isBearish = await checkNumberClosedCandlesBearish(request, env);

  if (isBearish) {
    const message = `⚠️ Alert: ${request.limit} Consecutive closed ${request.interval} candles are bearish for ${request.symbol}! Time: ${formatVietnamTime()}`;
    console.log(message);
    await buildSendMessageToTelegram(message, env);

    // Optionally, send a chart snapshot for this interval
    await snapshotChartWithSpecificInterval(
      { key: request.interval, value: BinanceToTradingviewInterval[request.interval] },
      env,
    );

    return { message: `${request.limit} Consecutive closed ${request.interval} candles are bearish for ${request.symbol}.` };
  } else {
    const message = `No bearish pattern detected for the last consecutive ${request.interval} candles. Time: ${formatVietnamTime()}`;
    await buildSendMessageToTelegram(message, env);
    return { message };
  }
}

