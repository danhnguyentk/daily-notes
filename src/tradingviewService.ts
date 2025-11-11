import { Env } from './types';

export type TradingviewRequest = {
  symbol: string;
  interval: string;
};

export const TradingviewSymbol = {
  BitgetBtcUsdt: 'BITGET:BTCUSDT',
  BitgetBtcUsdtPerp: 'BITGET:BTCUSDT.P',
};

export enum TradingviewInterval {
  Min15 = '15m',
  H1 = '1h',
  H2 = '2h',
  H4 = '4h',
  H8 = '8h',
  Daily = '1D',
  Weekly = '1W',
  Monthly = '1M',
};

// Because the free plan allows only 50 requests/day per key,
// we use multiple Chart-Img API keys to distribute load.
// Later, we can upgrade to a paid plan for unlimited usage.
const CHART_IMAGE_KEYS = [
  'fSaD8OZjPf8duW7BBdRpv2CkWn9TNwh77zh3N0FA',
  'QMjMmjk1STaJOOWtfMpj48NUT1IWoJlD52mFmHFf',
  'CGyeQHWjlu8A4Ho4G3yBXa0XuEyN4oXJ4AVZ1SLQ',
  'xWJeAq6Dji1CRNCO4zYJkswW03X1jZh30JTbwEFc',
  'vp0p0XhyD01OVFogsz9HC94JNreQghBm7hRyjS26',
  'cv8D1LRZ799gZOfa18eNl9B1q4d0Qs6G2NnqXujz',
  'YnGCnOh7cs2IAsHwiglEU9HDEGT6PIGH5AAE17rq',
  'HvQKqwISnW1KkOQ1OiCMd5AkdBhwDH3N30jRJdzJ',
  'AyJg91gR8a4JbRI9PxNPo67hgNKJm41w8s1Wgceu'
];

/**
 * Pick a random Chart-Img API key from the list.
 */
function getRandomChartImageKey(): string {
  if (CHART_IMAGE_KEYS.length === 0) {
    throw new Error("No Chart-Img API keys configured!");
  }
  const randomIndex = Math.floor(Math.random() * CHART_IMAGE_KEYS.length);
  return CHART_IMAGE_KEYS[randomIndex];
}

export async function getTradingViewImage(request: TradingviewRequest, env: Env): Promise<ArrayBuffer> {
  console.log(`Getting TradingView chart image for ${request.symbol} at interval ${request.interval}`);
  // Use a random API key for each request to distribute load
  // Will remove this once we upgrade to a paid plan
  env.CHART_IMAGE_KEY = getRandomChartImageKey();
  
  const url = `https://api.chart-img.com/v2/tradingview/layout-chart/${env.TRADINGVIEW_LAYOUT_ID}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'x-api-key': env.CHART_IMAGE_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error(`Chart-Img failed: ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  console.log(`Received TradingView chart image for ${request.symbol} at interval ${request.interval}`);
  return arrayBuffer;
}