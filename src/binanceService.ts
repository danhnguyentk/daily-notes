import { buildScraperApiUrl } from "./scraperApiService";
import { TelegramParseMode, sendMessageToTelegram } from "./telegramService";
import { TradingviewInterval } from "./tradingviewService";
import { Env } from "./types";

export type BinanceKline = {
  openTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  closeTime: number;
  quoteAssetVolume: number;
  numberOfTrades: number;
  takerBuyBaseAssetVolume: number;
  takerBuyQuoteAssetVolume: number;
  ignore: number;
}

export const enum BinanceSymbol {
  BTCUSDT = 'BTCUSDT',
  ETHUSDT = 'ETHUSDT',
  BNBUSDT = 'BNBUSDT',
  ADAUSDT = 'ADAUSDT',
  XRPUSDT = 'XRPUSDT'
};

export const CryptoSymbolIcons: Record<BinanceSymbol, string> = {
  [BinanceSymbol.BTCUSDT]: '🟡 ₿',
  [BinanceSymbol.ETHUSDT]: 'Ξ',
  [BinanceSymbol.BNBUSDT]: '🅱️',
  [BinanceSymbol.ADAUSDT]: '₳',
  [BinanceSymbol.XRPUSDT]: '✕',
}

export const enum BinanceInterval {
  FIVE_MINUTES = '5m',
  FIFTEEN_MINUTES = '15m',
  THIRTY_MINUTES = '30m',
  ONE_HOUR = '1h',
  TWO_HOURS = '2h',
  FOUR_HOURS = '4h',
  SIX_HOURS = '6h',
  EIGHT_HOURS = '8h',
  ONE_DAY = '1d',
  THREE_DAYS = '3d',
  ONE_WEEK = '1w',
  ONE_MONTH = '1M'
};

export const BinanceToTradingviewInterval: Record<BinanceInterval, TradingviewInterval> = {
  [BinanceInterval.FIVE_MINUTES]: TradingviewInterval.Min5,
  [BinanceInterval.FIFTEEN_MINUTES]: TradingviewInterval.Min15,
  [BinanceInterval.THIRTY_MINUTES]: TradingviewInterval.Min30,
  [BinanceInterval.ONE_HOUR]: TradingviewInterval.H1,
  [BinanceInterval.TWO_HOURS]: TradingviewInterval.H2,
  [BinanceInterval.FOUR_HOURS]: TradingviewInterval.H4,
  [BinanceInterval.SIX_HOURS]: TradingviewInterval.H6,
  [BinanceInterval.EIGHT_HOURS]: TradingviewInterval.H8,
  [BinanceInterval.ONE_DAY]: TradingviewInterval.Daily,
  [BinanceInterval.THREE_DAYS]: TradingviewInterval.ThreeDay,
  [BinanceInterval.ONE_WEEK]: TradingviewInterval.Weekly,
  [BinanceInterval.ONE_MONTH]: TradingviewInterval.Monthly,
};


export type BinanceCandlesRequest = {
  symbol: BinanceSymbol;
  interval: BinanceInterval;
  limit: number;
}

function parseKline(data: any[]): BinanceKline {
  return {
    openTime: data[0],
    open: parseFloat(data[1]),
    high: parseFloat(data[2]),
    low: parseFloat(data[3]),
    close: parseFloat(data[4]),
    volume: parseFloat(data[5]),
    closeTime: data[6],
    quoteAssetVolume: parseFloat(data[7]),
    numberOfTrades: data[8],
    takerBuyBaseAssetVolume: parseFloat(data[9]),
    takerBuyQuoteAssetVolume: parseFloat(data[10]),
    ignore: data[11],
  }
}

async function getBinanceCandles(request: BinanceCandlesRequest, env: Env): Promise<BinanceKline[]> {
  const { symbol, interval, limit = 500 } = request;
  const url = `https://api.scraperapi.com?api_key=72dcac2fb1a01d4a325294bcbfe041b3&url=https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
  
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0', // required for Binance to allow request, avoid Forbidden Error
    },
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch Binance candles: ${response.statusText}`);
  }

  const data = (await response.json()) as any[];
  return data.map(parseKline);
}

// Fetch the latest closed candles from Binance
async function getNumberClosedLatestBinanceCandles(
  request: BinanceCandlesRequest,
  env: Env
): Promise<BinanceKline[]> {
  // Fetch one extra candle to skip the currently forming one
  const candles = await getBinanceCandles({ ...request, limit: request.limit + 1 }, env);

  // Remove the last candle (still forming)
  const closedCandles = candles.slice(0, -1);

  // Return the last 'request.limit' closed candles
  return closedCandles.slice(-request.limit);
}

// Check if the latest closed candles are all bullish
export async function checkNumberClosedCandlesBullish(
  request: BinanceCandlesRequest,
  env: Env
): Promise<boolean> {
  const closedCandles = await getNumberClosedLatestBinanceCandles(request, env);

  // Check if all latest closed candles are bullish
  return closedCandles.every(candle => candle.close > candle.open);
}

// Fetch current price for a given symbol from Binance
export async function getCurrentPrice(symbol: BinanceSymbol, env: Env): Promise<number> {
  const url = buildScraperApiUrl(`https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`, env);

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0', // required for Binance to allow request, avoid Forbidden Error
    },
  });

  const data = await response.json() as { symbol: string; price: string; };
  return parseFloat(data.price);
}

export async function getCurrentPriceAndNotify(symbol: BinanceSymbol, env: Env): Promise<number> {
  const price = await getCurrentPrice(symbol, env);
  const message = `${CryptoSymbolIcons[symbol]}: ${price.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD`;
  await sendMessageToTelegram({
    chat_id: env.TELEGRAM_CHAT_ID,
    text: message,
  }, env);
  return price;
}