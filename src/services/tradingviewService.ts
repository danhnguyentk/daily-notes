import { Env } from '../types/env';

export type TradingviewRequest = {
  symbol: string;
  interval: string;
};

export const TradingviewSymbol = {
  BitgetBtcUsdt: 'BITGET:BTCUSDT',
  BitgetBtcUsdtPerp: 'BITGET:BTCUSDT.P',
  BinanceBtcUsdt: 'BINANCE:BTCUSDT',
  BinanceBtcUsdtPerp: 'BINANCE:BTCUSDT.P',
};

export enum TradingviewInterval {
  Min1 = '1m',
  Min5 = '5m',
  Min15 = '15m',
  Min30 = '30m',
  H1 = '1h',
  H2 = '2h',
  H4 = '4h',
  H6 = '6h',
  H8 = '8h',
  Daily = '1D',
  D2 = '2D',
  D3 = '3D',
  Weekly = '1W',
  Monthly = '1M',
};

export async function getTradingViewImage(request: TradingviewRequest, env: Env): Promise<ArrayBuffer> {
  try {
    console.log(`Getting TradingView chart image for ${request.symbol} at interval ${request.interval}`);
    const url = `https://api.chart-img.com/v2/tradingview/layout-chart/${env.TRADINGVIEW_LAYOUT_ID}`;
    const requestBody = JSON.stringify(request);
    console.log(`Request URL: ${url}`);
    console.log(`Request body: ${requestBody}`);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'x-api-key': env.CHART_IMAGE_KEY,
        'Content-Type': 'application/json',
      },
      body: requestBody,
    });

    console.log(`Response status: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Chart-Img API error response: ${errorText}`);
      throw new Error(`Chart-Img failed: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    console.log(`Received TradingView chart image for ${request.symbol} at interval ${request.interval}, size: ${arrayBuffer.byteLength} bytes`);
    return arrayBuffer;
  } catch (error) {
    console.error(`Error getting TradingView chart image for ${request.symbol} at ${request.interval}:`, error);
    console.error(`Error details:`, error instanceof Error ? error.message : String(error));
    throw error;
  }
}