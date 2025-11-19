/**
 * Candle analysis handlers
 */

import { KuCoinCandlesRequest, KuCoinToTradingviewInterval, checkNumberClosedCandlesBullish, checkNumberClosedCandlesBearish } from '../services/kucoinService';
import { Env } from '../types/env';
import { CandleDirection } from '../types/candleTypes';
import { formatVietnamTime } from '../utils/timeUtils';
import { buildSendMessageToTelegram } from '../utils/telegramUtils';
import { snapshotChartWithSpecificInterval } from './chartHandlers';

export async function notifyNumberClosedCandles(
  request: KuCoinCandlesRequest,
  direction: CandleDirection,
  env: Env
): Promise<object> {
  const emoji = direction === CandleDirection.BULLISH ? '🔥' : '⚠️';
  const checkFunction = direction === CandleDirection.BULLISH ? checkNumberClosedCandlesBullish : checkNumberClosedCandlesBearish;

  console.log(`Checking for ${request.limit} consecutive closed ${request.interval} ${direction} candles for ${request.symbol}...`);
  await buildSendMessageToTelegram(`Checking for ${request.limit} consecutive closed ${request.interval} ${direction} candles for ${request.symbol}...`, env);
  
  const isMatch = await checkFunction(request, env);

  if (isMatch) {
    const message = `${emoji} Alert: ${request.limit} Consecutive closed ${request.interval} candles are ${direction} for ${request.symbol}! Time: ${formatVietnamTime()}`;
    console.log(message);
    await buildSendMessageToTelegram(message, env);

    // Optionally, send a chart snapshot for this interval
    await snapshotChartWithSpecificInterval(
      { key: request.interval, value: KuCoinToTradingviewInterval[request.interval] },
      env,
    );

    return { message: `${request.limit} Consecutive closed ${request.interval} candles are ${direction} for ${request.symbol}.` };
  } else {
    const message = `No ${direction} pattern detected for the last consecutive ${request.interval} candles. Time: ${formatVietnamTime()}`;
    await buildSendMessageToTelegram(message, env);
    return { message };
  }
}

export async function notifyNumberClosedCandlesBullish(
  request: KuCoinCandlesRequest,
  env: Env
): Promise<object> {
  return notifyNumberClosedCandles(request, CandleDirection.BULLISH, env);
}

export async function notifyNumberClosedCandlesBearish(
  request: KuCoinCandlesRequest,
  env: Env
): Promise<object> {
  return notifyNumberClosedCandles(request, CandleDirection.BEARISH, env);
}

