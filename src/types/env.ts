export interface Env {
  SCRAPER_API_KEY: string;
  SCRAPINGBEE_API_KEY: string;
  SCRAPER_PROVIDER?: string; // 'scraper' or 'scrapingbee', defaults to 'scraper'
  TELEGRAM_KEY: string;
  TELEGRAM_CHAT_ID: string;
  TRADINGVIEW_LAYOUT_ID: string;
  CHART_IMAGE_KEY: string;
  WORKER_URL: string;
  DAILY_NOTES_KV: KVNamespace;
  SUPABASE_URL: string;
  SUPABASE_SECRET_KEY: string;
  OPENAI_API_KEY: string;
  ZAI_API_KEY?: string;
  AI_PROVIDER?: string; // 'openai' or 'zai', defaults to 'zai'
  GOLD_APISED_API_KEY: string;
  PUSHOVER_TOKEN?: string;
  PUSHOVER_USER?: string;
}

