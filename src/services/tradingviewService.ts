import { Env } from '../types/env';

export type TradingviewRequest = {
  symbol: string;
  interval: string;
};

export const TradingviewSymbol = {
  BitgetBtcUsdt: 'BITGET:BTCUSDT',
  BitgetBtcUsdtPerp: 'BITGET:BTCUSDT.P',
};

export enum TradingviewInterval {
  Min5 = '5m',
  Min15 = '15m',
  Min30 = '30m',
  H1 = '1h',
  H2 = '2h',
  H4 = '4h',
  H6 = '6h',
  H8 = '8h',
  Daily = '1D',
  ThreeDay = '3D',
  Weekly = '1W',
  Monthly = '1M',
};

export async function getTradingViewImage(request: TradingviewRequest, env: Env): Promise<ArrayBuffer> {
  console.log(`Getting TradingView chart image for ${request.symbol} at interval ${request.interval}`);
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