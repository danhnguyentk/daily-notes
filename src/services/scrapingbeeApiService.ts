import { Env } from "../types/env";

/**
 * Generate a ScrapingBee API URL for a target endpoint
 * @param targetUrl Full URL to scrape (e.g., Binance API endpoint)
 * @param env Environment containing the SCRAPINGBEE_API_KEY
*/
export function buildScrapingBeeApiUrl(targetUrl: string, env: Env): string {
  return `https://app.scrapingbee.com/api/v1/?api_key=${env.SCRAPINGBEE_API_KEY}&url=${encodeURIComponent(targetUrl)}`;
}