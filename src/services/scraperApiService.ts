import { Env } from "../types/env";

/**
 * Generate a ScraperAPI URL for a target endpoint
 * @param targetUrl Full URL to scrape (e.g., Binance API endpoint)
 * @param env Environment containing the SCRAPER_KEY
*/
export function buildScraperApiUrl(targetUrl: string, env: Env): string {
  return `https://api.scraperapi.com?api_key=${env.SCRAPER_KEY}&url=${encodeURIComponent(targetUrl)}`;
}