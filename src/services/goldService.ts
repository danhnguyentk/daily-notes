import { sendMessageToTelegram } from "./telegramService";
import { Env } from "../types/env";

interface GoldApiResponse {
  status: string;
  data: {
    timestamp: number;
    base_currency: string;
    metals: string;
    weight_unit: string;
    weight_name: string;
    metal_prices: {
      XAU: {
        open: number;
        high: number;
        low: number;
        prev: number;
        change: number;
        change_percentage: number;
        price: number;
        ask: number;
        bid: number;
        price_24k: number;
        price_22k: number;
        price_21k: number;
        price_20k: number;
        price_18k: number;
        price_16k: number;
        price_14k: number;
        price_10k: number;
      };
    };
    currency_rates: {
      USD: number;
    };
  };
}

/**
 * Get current XAU (gold) price in USD per troy ounce
 */
export async function getXAUPrice(env: Env): Promise<number> {
  const url = 'https://gold.g.apised.com/v1/latest?metals=XAU&base_currency=USD&currencies=USD&weight_unit=toz';

  const response = await fetch(url, {
    headers: {
      'x-api-key': env.GOLD_APISED_API_KEY,
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to fetch XAU price: ${response.status} ${response.statusText} - ${errorText}`);
  }

  const data = await response.json() as GoldApiResponse;

  if (data.status !== 'success' || !data.data?.metal_prices?.XAU?.price) {
    throw new Error(`Gold API error: ${data.status !== 'success' ? `API returned status: ${data.status}` : 'Invalid response format'}`);
  }

  const price = data.data.metal_prices.XAU.price;
  return Number(price.toFixed(1));
}

/**
 * Get current XAU price and send notification to Telegram
 */
export async function getXAUPriceAndNotify(chatId: string, env: Env): Promise<number> {
  const price = await getXAUPrice(env);
  const message = `🥇 XAU: ${price.toLocaleString('en-US', { maximumFractionDigits: 2 })} USD/oz`;
  await sendMessageToTelegram({
    chat_id: chatId,
    text: message,
  }, env);
  return price;
}

