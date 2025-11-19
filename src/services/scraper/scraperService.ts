import { Env } from '../../types/env';
import { buildScraperApiUrl } from './scraperApiService';
import { buildScrapingBeeApiUrl } from './scrapingbeeApiService';

/**
 * Supported scraper providers
 */
export enum ScraperProvider {
  SCRAPER = 'scraper',
  SCRAPINGBEE = 'scrapingbee',
}

/**
 * Interface for scraper service implementations
 */
export interface ScraperService {
  /**
   * Build a proxy URL for the target URL using the scraper provider
   * @param targetUrl Full URL to scrape
   * @param env Environment containing provider-specific keys
   * @returns Proxy URL that can be used to fetch the target URL
   */
  buildProxyUrl(targetUrl: string, env: Env): string;
}

/**
 * ScraperAPI implementation
 */
class ScraperApiService implements ScraperService {
  buildProxyUrl(targetUrl: string, env: Env): string {
    return buildScraperApiUrl(targetUrl, env);
  }
}

/**
 * ScrapingBee implementation
 */
class ScrapingBeeService implements ScraperService {
  buildProxyUrl(targetUrl: string, env: Env): string {
    return buildScrapingBeeApiUrl(targetUrl, env);
  }
}

/**
 * Get the scraper service instance based on provider configuration
 * @param env Environment containing SCRAPER_PROVIDER and provider-specific keys
 * @returns ScraperService instance
 * @throws Error if provider is not supported or required keys are missing
 */
export function getScraperService(env: Env): ScraperService {
  const providerValue = (env.SCRAPER_PROVIDER ?? ScraperProvider.SCRAPER).toLowerCase();

  if (providerValue === ScraperProvider.SCRAPER) {
    if (!env.SCRAPER_API_KEY) {
      throw new Error('SCRAPER_API_KEY is required for ScraperAPI provider');
    }
    return new ScraperApiService();
  }

  if (providerValue === ScraperProvider.SCRAPINGBEE) {
    if (!env.SCRAPINGBEE_API_KEY) {
      throw new Error('SCRAPINGBEE_API_KEY is required for ScrapingBee provider');
    }
    return new ScrapingBeeService();
  }

  throw new Error(`Unsupported scraper provider: ${providerValue}. Supported providers: ${Object.values(ScraperProvider).join(', ')}`);
}

/**
 * Build a proxy URL using the configured scraper provider
 * This is a convenience function that uses the provider from env
 * @param targetUrl Full URL to scrape
 * @param env Environment containing SCRAPER_PROVIDER and provider-specific keys
 * @returns Proxy URL that can be used to fetch the target URL
 */
export function buildProxyUrl(targetUrl: string, env: Env): string {
  const service = getScraperService(env);
  return service.buildProxyUrl(targetUrl, env);
}

