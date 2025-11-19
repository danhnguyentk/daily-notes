import { sendMessageToTelegram } from "./telegramService";
import { TradingviewInterval } from "./tradingviewService";
import { Env } from "../types/env";

export type KuCoinKline = {
  openTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  closeTime: number;
  quoteAssetVolume: number;
  ignore: number;
}

export const enum KuCoinSymbol {
  BTCUSDT = 'BTC-USDT',
  ETHUSDT = 'ETH-USDT',
  BNBUSDT = 'BNB-USDT',
  ADAUSDT = 'ADA-USDT',
  XRPUSDT = 'XRP-USDT'
}

export const CryptoSymbolIcons: Record<KuCoinSymbol, string> = {
  [KuCoinSymbol.BTCUSDT]: '🟡 ₿',
  [KuCoinSymbol.ETHUSDT]: 'Ξ',
  [KuCoinSymbol.BNBUSDT]: '🅱️',
  [KuCoinSymbol.ADAUSDT]: '₳',
  [KuCoinSymbol.XRPUSDT]: '✕',
}

export const enum KuCoinInterval {
  FIVE_MINUTES = '5min',
  FIFTEEN_MINUTES = '15min',
  THIRTY_MINUTES = '30min',
  ONE_HOUR = '1hour',
  TWO_HOURS = '2hour',
  FOUR_HOURS = '4hour',
  SIX_HOURS = '6hour',
  EIGHT_HOURS = '8hour',
  ONE_DAY = '1day',
  THREE_DAYS = '3day',
  ONE_WEEK = '1week',
  ONE_MONTH = '1month'
}

export const KuCoinToTradingviewInterval: Record<KuCoinInterval, TradingviewInterval> = {
  [KuCoinInterval.FIVE_MINUTES]: TradingviewInterval.Min5,
  [KuCoinInterval.FIFTEEN_MINUTES]: TradingviewInterval.Min15,
  [KuCoinInterval.THIRTY_MINUTES]: TradingviewInterval.Min30,
  [KuCoinInterval.ONE_HOUR]: TradingviewInterval.H1,
  [KuCoinInterval.TWO_HOURS]: TradingviewInterval.H2,
  [KuCoinInterval.FOUR_HOURS]: TradingviewInterval.H4,
  [KuCoinInterval.SIX_HOURS]: TradingviewInterval.H6,
  [KuCoinInterval.EIGHT_HOURS]: TradingviewInterval.H8,
  [KuCoinInterval.ONE_DAY]: TradingviewInterval.Daily,
  [KuCoinInterval.THREE_DAYS]: TradingviewInterval.ThreeDay,
  [KuCoinInterval.ONE_WEEK]: TradingviewInterval.Weekly,
  [KuCoinInterval.ONE_MONTH]: TradingviewInterval.Monthly,
}

export type KuCoinCandlesRequest = {
  symbol: KuCoinSymbol;
  interval: KuCoinInterval;
  limit: number;
}

/**
 * KuCoin kline data format: [time, open, close, high, low, volume, turnover]
 * Time is in seconds (not milliseconds)
 */
type KuCoinKlineData = [string, string, string, string, string, string, string];

/**
 * Parse KuCoin kline data format
 * KuCoin returns: [time, open, close, high, low, volume, turnover]
 * Time is in seconds (not milliseconds)
 * We need to convert to our standard format
 */
function parseKline(data: KuCoinKlineData, interval: KuCoinInterval): KuCoinKline {
  const openTimeSeconds = parseInt(data[0]);
  const openTime = openTimeSeconds * 1000; // Convert to milliseconds
  const intervalDuration = getIntervalDuration(interval);
  
  return {
    openTime: openTime,
    open: parseFloat(data[1]),
    close: parseFloat(data[2]),
    high: parseFloat(data[3]),
    low: parseFloat(data[4]),
    volume: parseFloat(data[5]),
    closeTime: openTime + intervalDuration - 1, // End of the candle period
    quoteAssetVolume: parseFloat(data[6] || '0'), // turnover
    ignore: 0,
  }
}

/**
 * Get interval duration in milliseconds for calculating closeTime
 */
function getIntervalDuration(interval: KuCoinInterval): number {
  const intervalMap: Record<KuCoinInterval, number> = {
    [KuCoinInterval.FIVE_MINUTES]: 5 * 60 * 1000,
    [KuCoinInterval.FIFTEEN_MINUTES]: 15 * 60 * 1000,
    [KuCoinInterval.THIRTY_MINUTES]: 30 * 60 * 1000,
    [KuCoinInterval.ONE_HOUR]: 60 * 60 * 1000,
    [KuCoinInterval.TWO_HOURS]: 2 * 60 * 60 * 1000,
    [KuCoinInterval.FOUR_HOURS]: 4 * 60 * 60 * 1000,
    [KuCoinInterval.SIX_HOURS]: 6 * 60 * 60 * 1000,
    [KuCoinInterval.EIGHT_HOURS]: 8 * 60 * 60 * 1000,
    [KuCoinInterval.ONE_DAY]: 24 * 60 * 60 * 1000,
    [KuCoinInterval.THREE_DAYS]: 3 * 24 * 60 * 60 * 1000,
    [KuCoinInterval.ONE_WEEK]: 7 * 24 * 60 * 60 * 1000,
    [KuCoinInterval.ONE_MONTH]: 30 * 24 * 60 * 60 * 1000,
  }
  return intervalMap[interval] || 60 * 60 * 1000; // Default to 1 hour
}

/**
 * Convert KuCoin interval to API format
 */
function convertIntervalToKuCoinFormat(interval: KuCoinInterval): string {
  return interval; // KuCoin intervals are already in the correct format
}

/**
 * KuCoin API response format for candles
 */
interface KuCoinCandlesResponse {
  code: string;
  data: KuCoinKlineData[];
  msg?: string;
}

/**
 * Fetch candles from KuCoin API
 * KuCoin API: GET /api/v1/market/candles?symbol={symbol}&type={type}&startAt={startAt}&endAt={endAt}
 */
async function getKuCoinCandles(request: KuCoinCandlesRequest, _env: Env): Promise<KuCoinKline[]> {
  const { symbol, interval, limit = 500 } = request;
  
  // KuCoin API endpoint - no proxy needed as it's a public API
  const intervalType = convertIntervalToKuCoinFormat(interval);
  const url = `https://api.kucoin.com/api/v1/market/candles?symbol=${symbol}&type=${intervalType}`;
  
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0',
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to fetch KuCoin candles: ${response.status} ${response.statusText} - ${errorText}`);
  }

  const data = await response.json() as KuCoinCandlesResponse;
  
  // KuCoin returns: { code: "200000", data: [[time, open, close, high, low, volume, turnover], ...] }
  if (data.code !== '200000' || !data.data) {
    throw new Error(`KuCoin API error: ${data.msg || 'Unknown error'}`);
  }

  // KuCoin returns data in reverse chronological order (newest first)
  // We need to reverse it to get oldest first, then take the last 'limit' items
  const klines = data.data.reverse().slice(-limit);
  
  return klines.map(kline => parseKline(kline, interval));
}

/**
 * Fetch the latest closed candles from KuCoin
 */
async function getNumberClosedLatestKuCoinCandles(
  request: KuCoinCandlesRequest,
  env: Env
): Promise<KuCoinKline[]> {
  // Fetch one extra candle to skip the currently forming one
  const candles = await getKuCoinCandles({ ...request, limit: request.limit + 1 }, env);

  // Remove the last candle (still forming)
  const closedCandles = candles.slice(0, -1);

  // Return the last 'request.limit' closed candles
  return closedCandles.slice(-request.limit);
}

/**
 * Check if the latest closed candles are all bullish
 */
export async function checkNumberClosedCandlesBullish(
  request: KuCoinCandlesRequest,
  env: Env
): Promise<boolean> {
  const closedCandles = await getNumberClosedLatestKuCoinCandles(request, env);

  // Check if all latest closed candles are bullish
  return closedCandles.every(candle => candle.close > candle.open);
}

/**
 * Check if the latest closed candles are all bearish
 */
export async function checkNumberClosedCandlesBearish(
  request: KuCoinCandlesRequest,
  env: Env
): Promise<boolean> {
  const closedCandles = await getNumberClosedLatestKuCoinCandles(request, env);

  // Check if all latest closed candles are bearish
  return closedCandles.every(candle => candle.close < candle.open);
}

/**
 * KuCoin API response format for ticker price
 */
interface KuCoinTickerResponse {
  code: string;
  data: {
    price: string;
  };
}

/**
 * Fetch current price for a given symbol from KuCoin
 * KuCoin API: GET /api/v1/market/orderbook/level1?symbol={symbol}
 */
export async function getCurrentPrice(symbol: KuCoinSymbol, _env: Env): Promise<number> {
  const url = `https://api.kucoin.com/api/v1/market/orderbook/level1?symbol=${symbol}`;

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0',
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to fetch KuCoin price: ${response.status} ${response.statusText} - ${errorText}`);
  }

  const data = await response.json() as KuCoinTickerResponse;
  
  if (data.code !== '200000' || !data.data) {
    throw new Error(`KuCoin API error: ${data.code || 'Unknown error'}`);
  }

  return parseFloat(data.data.price);
}

/**
 * Get current price and send notification to Telegram
 */
export async function getCurrentPriceAndNotify(symbol: KuCoinSymbol, chatId: string, env: Env): Promise<number> {
  const price = await getCurrentPrice(symbol, env);
  const message = `${CryptoSymbolIcons[symbol]}: ${price.toLocaleString('en-US', { maximumFractionDigits: 0 })} USD`;
  await sendMessageToTelegram({
    chat_id: chatId,
    text: message,
  }, env);
  return price;
}

