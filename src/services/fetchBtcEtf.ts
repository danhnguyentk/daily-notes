import { TelegramParseMode, sendMessageToTelegram } from "./telegramService";
import { Env } from "../types/env";
import { buildProxyUrl } from "./scraperService";
import * as cheerio from "cheerio";

export type EtfRow = {
  data: string; // date
  funds: Record<string, number | null>;
  total: number;
  recommendation?: string;
}

const FundNames: Record<string, string> = {
  IBIT: 'BlackRock',
  FBTC: 'Fidelity',
  BITB: 'Bitwise',
  ARKB: 'ArkInvest',
  BTCO: 'Invesco',
  EZBC: 'Franklin',
  BRRR: 'Valkyrie',
  HODL: 'VanEck',
  BTCW: 'WisdomTree',
  GBTC: 'GrayScale',
  BTC: 'Grayscale',
}

// <div align="right"><span class="tabletext">191.1</span></div>
// <div align="right"><span class="tabletext"><span class="redFont">(430.8)</span></span></div>
function parseCellValue(cell: cheerio.Cheerio<any>, $: cheerio.CheerioAPI): number | null {
  const redSpan = $(cell).find("span.redFont");
  if (redSpan.length) {
    // If redFont exists, get its text and treat as negative
    const valueText = redSpan.text().replace(/[^\d.]/g, "");
    return valueText ? -parseFloat(valueText) : null;
  } else {
    // Normal cell
    const valueText = $(cell).text().replace(/[^\d.]/g, ""); 
    return valueText ? parseFloat(valueText) : null;
  }
}

function extractTable(htmlEncoded: string): EtfRow[] {
  // Decode HTML entities from WP JSON (like \u003C)
  const html = htmlEncoded;

  const $ = cheerio.load(html);
  const table = $("table.etf").first();

  if (!table.length) throw new Error("No <table class='etf'> found!");

  // Extract headers for fund columns
  // Correct: use second <tr> in <thead> for actual header names
  const headers: string[] = [];
  table.find("thead tr").eq(1).find("th").each((i, th) => {
    const text = $(th).text().trim();
    if (i > 0 && text) headers.push(text);
    // if (text && text.toLowerCase() !== "total") headers.push(text);
  });

  const rows: EtfRow[] = [];
  table.find("tbody tr").each((_, tr) => {
    const cells = $(tr).find("td");
    if (cells.length === 0) return;
    const data = $(cells[0]).text().trim();
    const funds: Record<string, number | null> = {};
    for (let i = 1; i < cells.length - 1; i++) {

      // <div align="right"><span class="tabletext">191.1</span></div>
      // <div align="right"><span class="tabletext"><span class="redFont">(430.8)</span></span></div>
      //console.log($(cells[i]).html() );

      funds[headers[i - 1] || `col${i}`] = parseCellValue($(cells[i]), $);
    }

    const total = parseCellValue($(cells[cells.length - 1]), $) || 0;

    rows.push({ data, funds, total });
  });

  console.log('First row:', rows[0]);
  console.log('Second row:', rows[1]);
  console.log(`Last Date Buy/Sell`, rows[rows.length - 5]);
  return rows;
}

export async function fetchBtcEtf(env: Env): Promise<EtfRow[]> {
  console.log("Fetching BTC ETF data...");
  const targetUrl = "https://farside.co.uk/wp-json/wp/v2/pages?slug=btc";
  const proxyUrl = buildProxyUrl(targetUrl, env);
  const res = await fetch(proxyUrl);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }

  // Example json data
  /**
  [
    {
      "id": 997,
      "date": "2024-01-26T12:09:23",
      "date_gmt": "2024-01-26T12:09:23",
      "guid": {
        "rendered": "https://farside.co.uk/?p=997"
      },
      "modified": "2024-10-30T09:55:49",
      "modified_gmt": "2024-10-30T09:55:49",
      "slug": "btc",
      "status": "publish",
      "type": "page",
      "link": "https://farside.co.uk/btc/",
      "title": {
        "rendered": "Bitcoin ETF Flow (US$m)"
      },
      "content": {
        "rendered": 
  */
 // Step 1: parse JSON
  const json = await res.json() as any[];
  if (!json || !json.length) throw new Error("No page data returned from WP API");

  // Step 2: extract HTML from content.rendered
  const html = json[0].content.rendered;
  if (!html) throw new Error('No content.rendered found.');

  const rows = extractTable(html);
  console.log(`Found ${rows.length} rows in HTML table.`);

  return extractTable(html);
}

// Format individual fund value with color icons
function formatFundValue(value: number | null): string {
  if (value === null) return '<i>N/A</i>'; // no data
  if (value > 0) return `🟢 <b>${value.toFixed(1)}</b>`; // positive inflow
  if (value < 0) return `🔴 <b>${value.toFixed(1)}</b>`; // negative outflow
  return `⚪ <b>${value.toFixed(1)}</b>`; // neutral (0)
}

// Generate Telegram message for a given ETF row
function generateEtfTelegramMessage(etf: EtfRow, latestFundDate?: boolean): string {
  const fundLines = Object.entries(etf.funds)
    .map(([name, value]) => {
      return `• ${name} (${FundNames[name]}): ${formatFundValue(value)}`;
    })
    .join("\n");

  let dateLine = `📅 <b>Ngày:</b> ${etf.data}`;
  if (latestFundDate) {
    dateLine += `\n<b>(Ngày gần nhất thống kê từ quỹ)</b>`;
  }

  return (
    dateLine + "\n\n" +
    `🏦 <b>Dòng tiền ETF BTC (triệu USD)</b>\n` +
    `${fundLines}\n\n` +
    `💰 <b>Tổng dòng tiền:</b> ${formatFundValue(etf.total)} triệu USD\n\n` +
    `💡 <b>Nhận định:</b> ${etf.recommendation}`
  );
}

// Fetch ETF data and send formatted Telegram message
export async function fetchAndNotifyEtf(env: Env) {
  const rows: EtfRow[] = await fetchBtcEtf(env);
    
  // Get the latest row based on date
  const latestRow = rows.reduce((latest, current) => {
    return new Date(current.data) > new Date(latest.data) ? current : latest;
  }, rows[0]);
  console.log('Latest Row:', latestRow);

  // Compute recommendation based on FBTC-Fidelity
  const fbtcValue = latestRow.funds[`FBTC`] as number | null;
  let recommendation = 'Thị trường chưa rõ ràng. Quan sát thêm.';
  if (fbtcValue !== null) {
    if (fbtcValue < 0) {
      recommendation = 'Canh thoát lệnh trading ngắn hạn vì dòng tiền từ quỹ đang ÂM nhẹ.';
    }
    else if (fbtcValue < -50) {
      recommendation = 'Không mua BTC vì dòng tiền từ quỹ đang ÂM.';
    }
    else if (fbtcValue < -150) {
      recommendation = 'QUAN TRỌNG.CÂN NHẮC BÁN BTC vì dòng tiền từ quỹ đang RẤT ÂM.';
    } else if (fbtcValue >= 50) {
      recommendation = 'Cân nhắc BUY BTC vì dòng tiền từ quỹ đang DƯƠNG.';
    } else if (fbtcValue >= 150) {
      recommendation = 'Mạnh dạn BUY BTC vì dòng tiền từ quỹ đang RẤT DƯƠNG.';
    }
  }

  // Attach recommendation to the latest row
  latestRow.recommendation = recommendation;

  // Generate nicely formatted HTML message
  const message = generateEtfTelegramMessage(latestRow, true);
  await sendMessageToTelegram({
    chat_id: env.TELEGRAM_CHAT_ID,
    text: message,
    parse_mode: TelegramParseMode.HTML,
  }, env);
}