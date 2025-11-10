import { Env } from './types';

export type TradingviewRequest = {
  symbol: string;
  interval: string;
};

export const TradingviewSymbol = {
  BitgetBtcUsdt: 'BITGET:BTCUSDT',
  BitgetBtcUsdtPerp: 'BITGET:BTCUSDT.P',
};

export const TradingviewInterval = {
  Min15: '15m',
  H1: '1h',
  H2: '2h',
  H4: '4h',
  H8: '8h',
  Daily: '1D',
  Weekly: '1W',
  Monthly: '1M',
};

export async function getTradingViewImage(request: TradingviewRequest, env: Env): Promise<ArrayBuffer> {
  console.log(`Getting TradingView chart image for ${request.symbol} at interval ${request.interval}`);
  const url = `https://api.chart-img.com/v2/tradingview/layout-chart/${env.TRADINGVIEW_LAYOUT_ID}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'x-api-key': env.TRADINGVIEW_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ...request,
      // price on the right side of the chart overlaps and hides the last candlestick bars,
      // So we need to move the chart to the left a bit
      moveLeft: 2,
    }),
  });

  if (!response.ok) {
    throw new Error(`Chart-Img failed: ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  console.log(`Received TradingView chart image for ${request.symbol} at interval ${request.interval}`);
  return arrayBuffer;
}