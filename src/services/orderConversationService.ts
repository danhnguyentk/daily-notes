/**
 * Service to manage order conversation flow
 */

import { Env } from '../types/env';
import { sendMessageToTelegram, TelegramInlineKeyboardMarkup, TelegramReplyKeyboardMarkup, TelegramReplyKeyboardRemove } from './telegramService';
import { OrderConversationState, OrderConversationStep, OrderData, MarketState, OrderDirection, TradingSymbol, CallbackDataPrefix } from '../types/orderTypes';
import { updateOrderWithClosePrice } from '../handlers/orderStatisticsHandler';
import { formatHarsiValue, formatRiskUnit, safeToFixed } from '../utils/formatUtils';
import { getCurrentPrice, getLowestPriceInClosedCandles, KuCoinSymbol, KuCoinInterval } from '../services/kucoinService';
import { getXAUPrice } from '../services/goldService';
import { getTrends, TrendRecord } from '../services/supabaseService';
import { formatVietnamTime } from '../utils/timeUtils';

const CONVERSATION_STATE_KEY_PREFIX = 'order_conversation_';
const ENTRY_PROMPT_BASE = 'Vui lòng nhập Entry price:';
const TRADING_SYMBOL_TO_KUCOIN: Partial<Record<TradingSymbol, KuCoinSymbol>> = {
  [TradingSymbol.BTCUSDT]: KuCoinSymbol.BTCUSDT,
  [TradingSymbol.ETHUSDT]: KuCoinSymbol.ETHUSDT,
};

function getSurveyButtonConfig(symbol: TradingSymbol): {
  callbackData: CallbackDataPrefix;
  buttonText: string;
} {
  switch (symbol) {
    case TradingSymbol.BTCUSDT:
      return {
        callbackData: CallbackDataPrefix.TREND_SURVEY_BTC,
        buttonText: '🔄 Khảo Sát Mới BTC',
      };
    case TradingSymbol.ETHUSDT:
      return {
        callbackData: CallbackDataPrefix.TREND_SURVEY_ETH,
        buttonText: '🔄 Khảo Sát Mới ETH',
      };
    case TradingSymbol.XAUUSD:
      return {
        callbackData: CallbackDataPrefix.TREND_SURVEY_XAU,
        buttonText: '🔄 Khảo Sát Mới XAU',
      };
    default:
      return {
        callbackData: CallbackDataPrefix.TREND_SURVEY,
        buttonText: '🔄 Khảo Sát Mới',
      };
  }
}

function formatTrendSummaryForOrder(trend?: TrendRecord): string {
  if (!trend) {
    return '📊 Khảo sát gần nhất:\n• Chưa có dữ liệu.\nNhấn "Khảo Sát Mới" để cập nhật.';
  }

  const surveyedAt = trend.surveyed_at
    ? formatVietnamTime(new Date(trend.surveyed_at))
    : 'N/A';

  const formatValue = (value?: string | MarketState): string =>
    value ? formatHarsiValue(value as MarketState) : 'N/A';

  return [
    '📊 Khảo sát gần nhất:',
    `• Symbol: ${trend.symbol || 'N/A'}`,
    `• Thời gian: ${surveyedAt}`,
    `• Xu hướng: ${trend.trend ? formatHarsiValue(trend.trend as MarketState) : 'Không rõ'}`,
    `• HARSI 1W: ${formatValue(trend.harsi1w)}`,
    `• HARSI 3D: ${formatValue(trend.harsi3d)}`,
    `• HARSI 2D: ${formatValue(trend.harsi2d)}`,
    `• HARSI 1D: ${formatValue(trend.harsi1d)}`,
    `• HARSI 8H: ${formatValue(trend.harsi8h)}`,
    `• HARSI 4H: ${formatValue(trend.harsi4h)}`,
    `• HARSI 2H: ${formatValue(trend.hasri2h)}`,
    trend.recommendation ? `\n📝 Khuyến nghị:\n${trend.recommendation}` : '',
  ].filter(Boolean).join('\n');
}

export async function buildTrendSummaryMessage(symbol: TradingSymbol, env: Env): Promise<string> {
  try {
    const [latestTrend] = await getTrends(1, env, symbol);
    return formatTrendSummaryForOrder(latestTrend);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Failed to fetch latest trend for order conversation', { symbol, error: errorMessage });
    return '📊 Không thể tải trend gần nhất. Nhấn "Khảo Sát Mới" để cập nhật.';
  }
}

export async function attachLatestTrendDataToOrder(
  orderData: OrderData,
  env: Env
): Promise<void> {
  if (!orderData.symbol) {
    return;
  }
  try {
    const [latestTrend] = await getTrends(1, env, orderData.symbol);
    if (!latestTrend) {
      return;
    }
    orderData.harsi1w = latestTrend.harsi1w as MarketState | undefined;
    orderData.harsi3d = latestTrend.harsi3d as MarketState | undefined;
    orderData.harsi2d = latestTrend.harsi2d as MarketState | undefined;
    orderData.harsi1d = latestTrend.harsi1d as MarketState | undefined;
    orderData.harsi8h = latestTrend.harsi8h as MarketState | undefined;
    orderData.harsi4h = latestTrend.harsi4h as MarketState | undefined;
    orderData.hasri2h = latestTrend.hasri2h as MarketState | undefined;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Failed to attach latest trend data to order', {
      symbol: orderData.symbol,
      error: errorMessage,
    });
  }
}

async function getEntryPrompt(symbol: TradingSymbol | undefined, env: Env): Promise<string> {
  if (!symbol) {
    return ENTRY_PROMPT_BASE;
  }

  // Handle XAUUSD separately using gold service
  if (symbol === TradingSymbol.XAUUSD) {
    try {
      const price = await getXAUPrice(env);
      if (!Number.isFinite(price)) {
        return ENTRY_PROMPT_BASE;
      }
      const normalizedPrice = Math.round(price);
      return `${ENTRY_PROMPT_BASE} (Current price /${normalizedPrice})`;
    } catch (error) {
      console.error('Failed to fetch XAU price for entry prompt', {
        symbol,
        error,
      });
      return ENTRY_PROMPT_BASE;
    }
  }

  // Handle KuCoin symbols (BTCUSDT, ETHUSDT)
  const kuCoinSymbol = TRADING_SYMBOL_TO_KUCOIN[symbol];
  if (!kuCoinSymbol) {
    return ENTRY_PROMPT_BASE;
  }

  try {
    const price = await getCurrentPrice(kuCoinSymbol, env);
    if (!Number.isFinite(price)) {
      return ENTRY_PROMPT_BASE;
    }
    const normalizedPrice = price >= 1000 ? Math.round(price) : parseFloat(price.toFixed(1));
    return `${ENTRY_PROMPT_BASE} (Current price /${normalizedPrice})`;
  } catch (error) {
    console.error('Failed to fetch current price for entry prompt', {
      symbol,
      error,
    });
    return ENTRY_PROMPT_BASE;
  }
}

function getConversationKey(userId: number): string {
  return `${CONVERSATION_STATE_KEY_PREFIX}${userId}`;
}

/**
 * Create reply keyboard for quantity selection
 * This will show buttons at the bottom of the chat that send text like /0.01
 */
function createQuantityKeyboard(): TelegramReplyKeyboardMarkup {
  return {
    keyboard: [
      [
        { text: '0.01' },
        { text: '0.02' },
      ],
      [
        { text: '0.1' },
        { text: '0.2' },
      ],
      [
        { text: '/skip' },
      ],
    ],
    resize_keyboard: true,
    one_time_keyboard: true,
  };
}

/**
 * Create inline keyboard for Stop Loss selection
 * Shows suggested Stop Loss prices based on Entry and Direction
 * Values are rounded to nearest hundred
 */
function getStopLossOffsets(symbol?: TradingSymbol): number[] {
  if (symbol === TradingSymbol.XAUUSD) {
    return [3, 4, 5, 6];
  }
  return [200, 300, 400, 500];
}

function roundStopLossBySymbol(value: number, symbol?: TradingSymbol): number {
  if (symbol === TradingSymbol.BTCUSDT) {
    return Math.floor(value / 100) * 100;
  }
  return Math.round(value);
}

async function getRecentLowestPriceForSymbol(symbol: TradingSymbol | undefined, env: Env): Promise<number | undefined> {
  if (!symbol) {
    return undefined;
  }

  const kuCoinSymbol = TRADING_SYMBOL_TO_KUCOIN[symbol];
  if (!kuCoinSymbol) {
    return undefined;
  }

  try {
    const lowestResult = await getLowestPriceInClosedCandles({
      symbol: kuCoinSymbol,
      interval: KuCoinInterval.FIFTEEN_MINUTES,
      limit: 3,
    }, env);
    return lowestResult?.price;
  } catch (error) {
    console.error('Failed to fetch lowest price for stop loss suggestion', {
      symbol,
      error,
    });
    return undefined;
  }
}

function createStopLossKeyboard(
  entry: number,
  direction: string,
  symbol?: TradingSymbol,
  extraStopLoss?: number
): TelegramInlineKeyboardMarkup {
  const isLong = direction?.toUpperCase() === 'LONG' || direction?.toUpperCase() === 'L';
  const offsets = getStopLossOffsets(symbol);
  
  const stopLossButtons = offsets.map(offset => {
    const stopLossRaw = isLong ? entry - offset : entry + offset;
    const stopLossRounded = roundStopLossBySymbol(stopLossRaw, symbol);
    return {
      text: `SL ${offset} Giá (${stopLossRounded})`,
      callback_data: `${CallbackDataPrefix.STOP_LOSS}${stopLossRounded}`,
    };
  });
  
  const inlineRows = [
    stopLossButtons.slice(0, 2),
    stopLossButtons.slice(2, 4),
  ];

  if (extraStopLoss && extraStopLoss > 0) {
    const roundedExtra = roundStopLossBySymbol(extraStopLoss, symbol);
    inlineRows.push([
      {
        text: `Đáy gần nhất (${roundedExtra})`,
        callback_data: `${CallbackDataPrefix.STOP_LOSS}${roundedExtra}`,
      },
    ]);
  }

  return {
    inline_keyboard: inlineRows,
  };
}

/**
 * Create inline keyboard for Take Profit suggestions (1R, 2R)
 */
function createTakeProfitKeyboard(
  entry: number | undefined,
  stopLoss: number | undefined,
  direction: string | undefined
): TelegramInlineKeyboardMarkup | undefined {
  if (!entry || !stopLoss || !direction) {
    return undefined;
  }

  const normalizedDirection = direction.toUpperCase();
  const isLong = normalizedDirection === 'LONG' || normalizedDirection === 'L';
  const riskPerUnit = isLong ? entry - stopLoss : stopLoss - entry;

  if (!Number.isFinite(riskPerUnit) || riskPerUnit <= 0) {
    return undefined;
  }

  const multipliers = [1, 1.5, 2, 3];
  const buttons = multipliers.map((multiplier) => {
    const target = isLong ? entry + riskPerUnit * multiplier : entry - riskPerUnit * multiplier;
    const roundedTarget = Math.round(target);
    return {
      text: `TP ${multiplier}R (${roundedTarget})`,
      callback_data: `${CallbackDataPrefix.TAKE_PROFIT}${roundedTarget}`,
    };
  });

  const inlineRows: { text: string; callback_data: string }[][] = [];
  for (let i = 0; i < buttons.length; i += 2) {
    inlineRows.push(buttons.slice(i, i + 2));
  }

  return {
    inline_keyboard: inlineRows,
  };
}

async function advanceToQuantityStep(
  state: OrderConversationState,
  chatId: string,
  env: Env
): Promise<void> {
  state.step = OrderConversationStep.WAITING_QUANTITY;
  const message = `✅ Take Profit: ${state.data.takeProfit ?? 'N/A'}\n\nVui lòng chọn Quantity (hoặc /skip để bỏ qua):`;
  const quantityKeyboard = createQuantityKeyboard();

  await saveConversationState(state, env);
  await sendMessageToTelegram({
    chat_id: chatId,
    text: message,
    reply_markup: quantityKeyboard,
  }, env);
}

export async function handleStopLossSelectionFromInline(
  userId: number,
  chatId: string,
  stopLossInput: string,
  env: Env
): Promise<void> {
  const state = await getConversationState(userId, env);
  if (!state) {
    await sendMessageToTelegram({
      chat_id: chatId,
      text: '❌ Không tìm thấy phiên nhập lệnh. Gửi /neworder để bắt đầu lại.',
    }, env);
    return;
  }

  if (state.step !== OrderConversationStep.WAITING_STOP_LOSS) {
    await sendMessageToTelegram({
      chat_id: chatId,
      text: '⚠️ Bạn chưa ở bước nhập Stop Loss hoặc đã hoàn thành bước này.',
    }, env);
    return;
  }

  const stopLoss = parseFloat(stopLossInput.trim());
  if (isNaN(stopLoss) || stopLoss <= 0) {
    await sendMessageToTelegram({
      chat_id: chatId,
      text: '❌ Stop Loss không hợp lệ. Vui lòng chọn lại.',
    }, env);
    return;
  }

  state.data.stopLoss = stopLoss;
  state.step = OrderConversationStep.WAITING_TAKE_PROFIT;
  await saveConversationState(state, env);

  const takeProfitKeyboard = createTakeProfitKeyboard(state.data.entry, stopLoss, state.data.direction);

  await sendMessageToTelegram({
    chat_id: chatId,
    text: `✅ Stop Loss: ${stopLoss}\n\nVui lòng nhập Take Profit (hoặc gửi /skip để bỏ qua):`,
    reply_markup: takeProfitKeyboard,
  }, env);
}

export async function handleTakeProfitSelectionFromInline(
  userId: number,
  chatId: string,
  takeProfitInput: string,
  env: Env
): Promise<void> {
  const state = await getConversationState(userId, env);
  if (!state) {
    await sendMessageToTelegram({
      chat_id: chatId,
      text: '❌ Không tìm thấy phiên nhập lệnh. Gửi /neworder để bắt đầu lại.',
    }, env);
    return;
  }

  if (state.step !== OrderConversationStep.WAITING_TAKE_PROFIT) {
    await sendMessageToTelegram({
      chat_id: chatId,
      text: '⚠️ Bạn chưa ở bước nhập Take Profit hoặc đã hoàn thành bước này.',
    }, env);
    return;
  }

  const takeProfit = parseFloat(takeProfitInput.trim());
  if (isNaN(takeProfit) || takeProfit <= 0) {
    await sendMessageToTelegram({
      chat_id: chatId,
      text: '❌ Take Profit không hợp lệ. Vui lòng chọn lại.',
    }, env);
    return;
  }

  state.data.takeProfit = takeProfit;
  await advanceToQuantityStep(state, chatId, env);
}

/**
 * Create inline keyboard for notes selection with current selected notes
 */
function createNotesKeyboard(currentNotes?: string): TelegramInlineKeyboardMarkup {
  // Split by comma (handles both "note1, note2" and "note1,note2" formats)
  const notes = currentNotes ? currentNotes.split(',').map(n => n.trim()).filter(n => n) : [];
  
  return {
    inline_keyboard: [
      [
        { text: 'Strong Buy 5M', callback_data: `${CallbackDataPrefix.NOTE_ADD}Strong Buy 5M` },
        { text: 'Strong Buy 15M', callback_data: `${CallbackDataPrefix.NOTE_ADD}Strong Buy 15M` },
      ],
      [
        { text: 'Medium Buy 5M', callback_data: `${CallbackDataPrefix.NOTE_ADD}Medium Buy 5M` },
        { text: 'Medium Buy 15M', callback_data: `${CallbackDataPrefix.NOTE_ADD}Medium Buy 15M` },
      ],
      [
        { text: 'Very Strong Buy 5M', callback_data: `${CallbackDataPrefix.NOTE_ADD}Very Strong Buy 5M` },
        { text: 'Very Strong Buy 15M', callback_data: `${CallbackDataPrefix.NOTE_ADD}Very Strong Buy 15M` },
      ],
      [
        ...(notes.length > 0 ? [{ text: '🗑️ Clear', callback_data: CallbackDataPrefix.NOTE_CLEAR }] : []),
        { text: '✅ Done', callback_data: CallbackDataPrefix.NOTE_DONE },
        { text: '⏭️ Skip', callback_data: CallbackDataPrefix.NOTE_SKIP },
      ],
    ],
  };
}

/**
 * Get current conversation state for a user
 */
export async function getConversationState(
  userId: number,
  env: Env
): Promise<OrderConversationState | null> {
  const key = getConversationKey(userId);
  const stateJson = await env.DAILY_NOTES_KV.get(key);
  if (!stateJson) {
    return null;
  }
  return JSON.parse(stateJson) as OrderConversationState;
}

/**
 * Save conversation state for a user
 */
export async function saveConversationState(
  state: OrderConversationState,
  env: Env
): Promise<void> {
  const key = getConversationKey(state.userId);
  await env.DAILY_NOTES_KV.put(key, JSON.stringify(state));
}

/**
 * Clear conversation state for a user
 */
export async function clearConversationState(
  userId: number,
  env: Env
): Promise<void> {
  const key = getConversationKey(userId);
  await env.DAILY_NOTES_KV.delete(key);
}

/**
 * Initialize a new order conversation
 */
export async function startOrderConversation(
  userId: number,
  chatId: string,
  env: Env
): Promise<void> {
  const existingState = await getConversationState(userId, env);
  if (existingState && existingState.step !== OrderConversationStep.COMPLETED) {
    await clearConversationState(userId, env);
  }

  const newState: OrderConversationState = {
    userId,
    step: OrderConversationStep.WAITING_SYMBOL,
    data: {},
    createdAt: Date.now(),
  };

  await saveConversationState(newState, env);
  const message = `📝 Bắt đầu nhập lệnh mới!\n\nVui lòng chọn Symbol:\n` +
    `/BTCUSDT - BTCUSDT\n` +
    `/ETHUSDT - ETHUSDT\n` +
    `/XAUUSD - XAUUSD\n`;
  await sendMessageToTelegram({
    chat_id: chatId,
    text: message,
  }, env);
}

/**
 * Process user input based on current step
 */
export async function processOrderInput(
  userId: number,
  chatId: string,
  input: string,
  env: Env
): Promise<{ completed: boolean; orderData?: OrderData }> {
  const state = await getConversationState(userId, env);
  if (!state) {
    await sendMessageToTelegram({
      chat_id: chatId,
      text: '❌ Không tìm thấy phiên nhập lệnh. Gửi /neworder để bắt đầu.',
    }, env);
    return { completed: false };
  }

  // Check for cancel command
  const normalizedInput = input.trim().toLowerCase().replace('/', '');
  if (normalizedInput === 'cancelorder' || normalizedInput === 'cancel') {
    await cancelOrderConversation(userId, chatId, env);
    return { completed: false };
  }

  const updatedState = { ...state };
  let message = '';
  let replyMarkup:
    | TelegramInlineKeyboardMarkup
    | TelegramReplyKeyboardMarkup
    | TelegramReplyKeyboardRemove
    | undefined;
  
  // For inline keyboard, we'll set it separately when needed

  switch (state.step) {
    case OrderConversationStep.WAITING_SYMBOL:
      const symbolInput = input.trim().toUpperCase().replace('/', '');
      const symbolValue = Object.values(TradingSymbol).find(s => s === symbolInput);
      if (!symbolValue) {
        await sendMessageToTelegram({
          chat_id: chatId,
          text: `❌ Symbol không hợp lệ. Vui lòng chọn:\n/BTCUSDT\n/ETHUSDT\n/XAUUSD`,
        }, env);
        return { completed: false };
      }
      updatedState.data.symbol = symbolValue;
      updatedState.step = OrderConversationStep.WAITING_DIRECTION;
      const trendSummary = await buildTrendSummaryMessage(symbolValue, env);
      const { callbackData: surveyCallbackData, buttonText } = getSurveyButtonConfig(symbolValue);
      replyMarkup = {
        inline_keyboard: [
          [{ text: buttonText, callback_data: surveyCallbackData }],
        ],
      };
      message = `✅ Symbol: ${updatedState.data.symbol}\n\n${trendSummary}\n\nVui lòng chọn hướng:\n/LONG - Long\n/SHORT - Short`;
      break;

    case OrderConversationStep.WAITING_DIRECTION:
      const directionInput = input.trim().toLowerCase().replace('/', '');
      let selectedDirection: OrderDirection | undefined;
      if (directionInput === OrderDirection.LONG) {
        selectedDirection = OrderDirection.LONG;
      } else if (directionInput === OrderDirection.SHORT) {
        selectedDirection = OrderDirection.SHORT;
      } else {
        await sendMessageToTelegram({
          chat_id: chatId,
          text: '❌ Vui lòng chọn /LONG hoặc /SHORT',
        }, env);
        return { completed: false };
      }

      let latestTrend: TrendRecord | undefined;
      const symbolForTrend = updatedState.data.symbol;
      let trendSummaryForDirection = '📊 Chưa có khảo sát gần đây cho symbol này.';
      let directionAdvice = 'ℹ️ Không có đủ dữ liệu trend để so sánh.';
      if (symbolForTrend) {
        try {
          [latestTrend] = await getTrends(1, env, symbolForTrend);
          trendSummaryForDirection = formatTrendSummaryForOrder(latestTrend);
        } catch (trendError) {
          console.error('Failed to fetch trend summary after direction selection', {
            symbol: symbolForTrend,
            error: trendError instanceof Error ? trendError.message : trendError,
          });
          trendSummaryForDirection = '📊 Không thể tải khảo sát gần nhất.';
          directionAdvice = 'ℹ️ Không thể so sánh với xu hướng hiện tại.';
        }
      }

      const latestHarsi1d = latestTrend?.harsi1d as MarketState | undefined;
      const latestHarsi8h = latestTrend?.harsi8h as MarketState | undefined;
      const isLongDirection = selectedDirection === OrderDirection.LONG;

      if (
        isLongDirection &&
        latestHarsi1d === MarketState.Bearish &&
        latestHarsi8h === MarketState.Bearish
      ) {
        const { callbackData: surveyCallbackData, buttonText } = getSurveyButtonConfig(symbolForTrend || TradingSymbol.BTCUSDT);
        await sendMessageToTelegram({
          chat_id: chatId,
          text:
            '❌ HARSI 1D & 8H đều Bearish.\n' +
            'Không được vào lệnh LONG ngược xu hướng hiện tại.\n' +
            '👉 Vui lòng khảo sát lại trước khi tiếp tục.',
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: buttonText || '🔄 Khảo Sát Lại',
                  callback_data: surveyCallbackData,
                },
              ],
            ],
          },
        }, env);
        return { completed: false };
      }

      if (
        !isLongDirection &&
        latestHarsi1d === MarketState.Bullish &&
        latestHarsi8h === MarketState.Bullish
      ) {
        const { callbackData: surveyCallbackData, buttonText } = getSurveyButtonConfig(symbolForTrend || TradingSymbol.BTCUSDT);
        await sendMessageToTelegram({
          chat_id: chatId,
          text:
            '❌ HARSI 1D & 8H đều Bullish.\n' +
            'Không được vào lệnh SHORT ngược xu hướng hiện tại.\n' +
            '👉 Vui lòng khảo sát lại trước khi tiếp tục.',
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: buttonText || '🔄 Khảo Sát Lại',
                  callback_data: surveyCallbackData,
                },
              ],
            ],
          },
        }, env);
        return { completed: false };
      }

      updatedState.data.direction = selectedDirection;
      updatedState.step = OrderConversationStep.WAITING_ENTRY;
      const entryPrompt = await getEntryPrompt(updatedState.data.symbol, env);
      replyMarkup = undefined;
      message = [
        `✅ Direction: ${updatedState.data.direction}`,
        '',
        trendSummaryForDirection,
        '',
        directionAdvice,
        '',
        entryPrompt,
      ].join('\n');
      break;

    case OrderConversationStep.WAITING_ENTRY:
      const entry = parseFloat(input.trim().replace('/', ''));
      if (isNaN(entry) || entry <= 0) {
        await sendMessageToTelegram({
          chat_id: chatId,
          text: '❌ Entry price không hợp lệ. Vui lòng nhập số dương.',
        }, env);
        return { completed: false };
      }
      updatedState.data.entry = entry;
      updatedState.step = OrderConversationStep.WAITING_STOP_LOSS;
      message = `✅ Entry: ${entry}\n\nVui lòng nhập Stop Loss:`;
      // Add reply keyboard with Stop Loss suggestions
      const lowestPriceSuggestion = await getRecentLowestPriceForSymbol(updatedState.data.symbol, env);
      replyMarkup = createStopLossKeyboard(
        entry,
        updatedState.data.direction || '',
        updatedState.data.symbol,
        lowestPriceSuggestion,
      );
      break;

    case OrderConversationStep.WAITING_STOP_LOSS:
      const stopLoss = parseFloat(input.trim().replace('/', ''));
      if (isNaN(stopLoss) || stopLoss <= 0) {
        await sendMessageToTelegram({
          chat_id: chatId,
          text: '❌ Stop Loss không hợp lệ. Vui lòng nhập số dương.',
        }, env);
        return { completed: false };
      }
      updatedState.data.stopLoss = stopLoss;
      updatedState.step = OrderConversationStep.WAITING_TAKE_PROFIT;
      message = `✅ Stop Loss: ${stopLoss}\n\nVui lòng nhập Take Profit (hoặc gửi /skip để bỏ qua):`;
      replyMarkup = createTakeProfitKeyboard(updatedState.data.entry, stopLoss, updatedState.data.direction);
      break;

    case OrderConversationStep.WAITING_TAKE_PROFIT:
      if (input.trim().toUpperCase() === '/SKIP' || input.trim() === '') {
        updatedState.data.takeProfit = undefined;
      } else {
        const takeProfit = parseFloat(input.trim().replace('/', ''));
        if (isNaN(takeProfit) || takeProfit <= 0) {
          await sendMessageToTelegram({
            chat_id: chatId,
            text: '❌ Take Profit không hợp lệ. Vui lòng nhập số dương hoặc /skip.',
          }, env);
          return { completed: false };
        }
        updatedState.data.takeProfit = takeProfit;
      }
      await advanceToQuantityStep(updatedState, chatId, env);
      return { completed: false };

    case OrderConversationStep.WAITING_QUANTITY:
      if (input.trim().toUpperCase() === '/SKIP' || input.trim() === '') {
        updatedState.data.quantity = undefined;
      } else {
        const quantity = parseFloat(input.trim().replace('/', ''));
        if (isNaN(quantity) || quantity <= 0) {
          await sendMessageToTelegram({
            chat_id: chatId,
            text: `❌ Quantity ${input.trim()} không hợp lệ. Vui lòng nhập số dương hoặc /skip.`,
            reply_markup: createQuantityKeyboard(), // Giữ keyboard khi input sai
          }, env);
          return { completed: false };
        }
        updatedState.data.quantity = quantity;
      }
      updatedState.step = OrderConversationStep.WAITING_NOTES;
      // Initialize notes as empty string if not set
      if (!updatedState.data.notes) {
        updatedState.data.notes = '';
      }
      message = `✅ Quantity: ${updatedState.data.quantity || 'N/A'}\n\nVui lòng chọn Notes (có thể chọn nhiều):`;
      
      // Create inline keyboard with note examples
      const noteExamples = createNotesKeyboard(updatedState.data.notes);
      
      // Remove reply keyboard và chuyển sang inline keyboard
      const removeKeyboard: TelegramReplyKeyboardRemove = { remove_keyboard: true };
      
      await saveConversationState(updatedState, env);
      await sendMessageToTelegram({ 
        chat_id: chatId, 
        text: message,
        reply_markup: removeKeyboard,
      }, env);
      
      // Gửi message riêng với inline keyboard
      await sendMessageToTelegram({ 
        chat_id: chatId, 
        text: 'Chọn notes:',
        reply_markup: noteExamples,
      }, env);
      return { completed: false };

    case OrderConversationStep.WAITING_NOTES:
      // This case is now handled by callback queries (note_add, note_done, note_skip, note_clear)
      // Regular text input still works for manual entry
      if (input.trim().toUpperCase() === '/SKIP' || input.trim() === '') {
        updatedState.data.notes = undefined;
      } else {
        updatedState.data.notes = input.trim();
      }
      updatedState.step = OrderConversationStep.COMPLETED;
      message = '✅ Đã hoàn thành nhập lệnh!';
      // Remove any remaining keyboards
      const removeKeyboardOnComplete: TelegramReplyKeyboardRemove = { remove_keyboard: true };
      await sendMessageToTelegram({
        chat_id: chatId,
        text: message,
        reply_markup: removeKeyboardOnComplete,
      }, env);
      await saveConversationState(updatedState, env);
      return { completed: true, orderData: updatedState.data };

    case OrderConversationStep.WAITING_CLOSE_PRICE:
      const closePrice = parseFloat(input.trim().replace('/', ''));
      if (isNaN(closePrice) || closePrice <= 0) {
        await sendMessageToTelegram({
          chat_id: chatId,
          text: '❌ Close Price không hợp lệ. Vui lòng nhập số dương.',
        }, env);
        return { completed: false };
      }

      // Update order với close price
      if (!updatedState.selectedOrderId) {
        await sendMessageToTelegram({
          chat_id: chatId,
          text: '❌ Không tìm thấy order ID.',
        }, env);
        return { completed: false };
      }

      const updatedOrder = await updateOrderWithClosePrice(
        updatedState.selectedOrderId,
        closePrice,
        env
      );

      if (!updatedOrder) {
        await sendMessageToTelegram({
          chat_id: chatId,
          text: '❌ Không thể cập nhật lệnh.',
        }, env);
        return { completed: false };
      }

      const resultMessage = `
✅ Đã cập nhật lệnh với Close Price!

📋 Thông tin lệnh:
Symbol: ${updatedOrder.symbol}
Direction: ${updatedOrder.direction}
Entry: ${updatedOrder.entry}
Stop Loss: ${updatedOrder.stopLoss}
Close Price: ${closePrice}

📊 Kết quả:
${updatedOrder.actualRiskRewardRatio !== undefined && updatedOrder.actualRiskRewardRatio !== null
  ? `   • R: ${formatRiskUnit(updatedOrder.actualRiskRewardRatio)}
   ${updatedOrder.actualRiskRewardRatio > 0
     ? `(Lợi nhuận ${safeToFixed(updatedOrder.actualRiskRewardRatio * 100, 1)}% rủi ro)`
     : `(Thua lỗ ${safeToFixed(Math.abs(updatedOrder.actualRiskRewardRatio * 100), 1)}% rủi ro)`}
   • Actual PnL: ${updatedOrder.actualRealizedPnL && updatedOrder.actualRealizedPnL > 0 ? '+' : ''}${safeToFixed(updatedOrder.actualRealizedPnL, 4)}
   • Actual PnL USD: ${updatedOrder.actualRealizedPnLUsd && updatedOrder.actualRealizedPnLUsd > 0 ? '+' : ''}$${safeToFixed(updatedOrder.actualRealizedPnLUsd, 2)}`
  : 'Chưa tính toán được R'}

⏰ Thời gian: ${new Date().toLocaleString('vi-VN')}
      `.trim();

      // Remove any keyboards trước khi gửi kết quả
      const removeKeyboardOnUpdate: TelegramReplyKeyboardRemove = { remove_keyboard: true };
      await sendMessageToTelegram({
        chat_id: chatId,
        text: resultMessage,
        reply_markup: removeKeyboardOnUpdate,
      }, env);

      // Clear conversation state
      await clearConversationState(userId, env);
      return { completed: false }; // Không return completed vì đây là update, không phải tạo mới

    default:
      await sendMessageToTelegram({
        chat_id: chatId,
        text: '❌ Trạng thái không hợp lệ.',
      }, env);
      return { completed: false };
  }

  await saveConversationState(updatedState, env);
  
  // Chỉ gửi message nếu chưa được gửi ở trên (tránh duplicate)
  // Các case đã return sớm (WAITING_QUANTITY, WAITING_NOTES, WAITING_CLOSE_PRICE) sẽ không đến đây
  if (message) {
    await sendMessageToTelegram({
      chat_id: chatId,
      text: message,
      reply_markup: replyMarkup,
    }, env);
  }

  return { completed: false };
}

/**
 * Cancel current order conversation
 */
export async function cancelOrderConversation(
  userId: number,
  chatId: string,
  env: Env
): Promise<void> {
  const state = await getConversationState(userId, env);
  if (!state) {
    await sendMessageToTelegram({
      chat_id: chatId,
      text: 'ℹ️ Không có lệnh nào đang nhập.',
    }, env);
    return;
  }

  await clearConversationState(userId, env);
  
  // Remove reply keyboard khi cancel
  const removeKeyboard: TelegramReplyKeyboardRemove = { remove_keyboard: true };
  await sendMessageToTelegram({
    chat_id: chatId,
    text: '✅ Đã hủy nhập lệnh.',
    reply_markup: removeKeyboard,
  }, env);
}

/**
 * Add a note to the current notes list
 */
export async function addNoteToOrder(
  userId: number,
  chatId: string,
  noteText: string,
  env: Env
): Promise<void> {
  const state = await getConversationState(userId, env);
  if (!state || state.step !== OrderConversationStep.WAITING_NOTES) {
    await sendMessageToTelegram({
      chat_id: chatId,
      text: '❌ Không tìm thấy phiên nhập lệnh hoặc không ở bước nhập Notes.',
    }, env);
    return;
  }

  const currentNotes = state.data.notes || '';
  // Split by comma (handles both "note1, note2" and "note1,note2" formats)
  const notesArray = currentNotes ? currentNotes.split(',').map(n => n.trim()).filter(n => n) : [];
  
  // Add new note if not already exists
  const trimmedNote = noteText.trim();
  if (!notesArray.includes(trimmedNote)) {
    notesArray.push(trimmedNote);
  }
  
  // Join with comma and space for consistent storage
  state.data.notes = notesArray.join(', ');
  await saveConversationState(state, env);

  // Show updated keyboard
  const formattedNotes = state.data.notes && state.data.notes.trim() 
    ? formatNotes(state.data.notes) 
    : '(chưa có)';
  const message = `✅ Quantity: ${state.data.quantity || 'N/A'}\n\n📝 Notes đã chọn:\n${formattedNotes}\n\nVui lòng chọn thêm Notes hoặc nhấn Done:`;
  const noteExamples = createNotesKeyboard(state.data.notes);
  
  await sendMessageToTelegram({ 
    chat_id: chatId, 
    text: message,
    reply_markup: noteExamples,
  }, env);
}

/**
 * Clear all notes
 */
export async function clearNotes(
  userId: number,
  chatId: string,
  env: Env
): Promise<void> {
  const state = await getConversationState(userId, env);
  if (!state || state.step !== OrderConversationStep.WAITING_NOTES) {
    await sendMessageToTelegram({
      chat_id: chatId,
      text: '❌ Không tìm thấy phiên nhập lệnh hoặc không ở bước nhập Notes.',
    }, env);
    return;
  }

  state.data.notes = '';
  await saveConversationState(state, env);

  // Show updated keyboard
  const message = `✅ Quantity: ${state.data.quantity || 'N/A'}\n\nVui lòng chọn Notes (có thể chọn nhiều):`;
  const noteExamples = createNotesKeyboard('');
  
  await sendMessageToTelegram({ 
    chat_id: chatId, 
    text: message,
    reply_markup: noteExamples,
  }, env);
}

/**
 * Finish notes selection and complete the order
 */
export async function finishNotesSelection(
  userId: number,
  chatId: string,
  env: Env
): Promise<{ completed: boolean; orderData?: OrderData }> {
  const state = await getConversationState(userId, env);
  if (!state || state.step !== OrderConversationStep.WAITING_NOTES) {
    await sendMessageToTelegram({
      chat_id: chatId,
      text: '❌ Không tìm thấy phiên nhập lệnh hoặc không ở bước nhập Notes.',
    }, env);
    return { completed: false };
  }

  // Set notes to undefined if empty, otherwise keep the selected notes
  if (!state.data.notes || state.data.notes.trim() === '') {
    state.data.notes = undefined;
  } else {
    state.data.notes = state.data.notes.trim();
  }

  state.step = OrderConversationStep.COMPLETED;
  await saveConversationState(state, env);
  
  await sendMessageToTelegram({
    chat_id: chatId,
    text: '✅ Đã hoàn thành nhập lệnh!',
  }, env);

  return { completed: true, orderData: state.data };
}

/**
 * Format notes for beautiful display
 * Exported so it can be used in other modules
 * Handles both comma-separated formats: "note1, note2" or "note1,note2"
 */
export function formatNotes(notes?: string): string {
  if (!notes || notes.trim() === '') {
    return 'N/A';
  }
  
  // Split notes by comma (with or without space) and format each note
  // This handles both "note1, note2" and "note1,note2" formats
  const notesArray = notes.split(',').map(n => n.trim()).filter(n => n);
  
  if (notesArray.length === 0) {
    return 'N/A';
  }
  
  // Format each note with bullet point
  return notesArray.map(note => `  • ${note}`).join('\n');
}

/**
 * Show current order data preview
 */
export async function showOrderPreview(
  userId: number,
  chatId: string,
  env: Env
): Promise<void> {
  const state = await getConversationState(userId, env);
  if (!state) {
    await sendMessageToTelegram({
      chat_id: chatId,
      text: 'ℹ️ Không có lệnh nào đang nhập.',
    }, env);
    return;
  }

  const { data } = state;
  const formattedNotes = formatNotes(data.notes);
  
  const preview = `
📋 Thông tin lệnh hiện tại:

Symbol: ${data.symbol || 'N/A'}
Direction: ${data.direction || 'N/A'}
HARSI 1W: ${formatHarsiValue(data.harsi1w)}
HARSI 3D: ${formatHarsiValue(data.harsi3d)}
HARSI 2D: ${formatHarsiValue(data.harsi2d)}
HARSI 1D: ${formatHarsiValue(data.harsi1d)}
HARSI 8H: ${formatHarsiValue(data.harsi8h)}
HARSI 4H: ${formatHarsiValue(data.harsi4h)}
HARSI 2H: ${formatHarsiValue(data.hasri2h)}
Entry: ${data.entry || 'N/A'}
Stop Loss: ${data.stopLoss || 'N/A'}
Take Profit: ${data.takeProfit || 'N/A'}
Quantity: ${data.quantity || 'N/A'}
Notes:
${formattedNotes}

Bước hiện tại: ${state.step}
  `.trim();

  await sendMessageToTelegram({ chat_id: chatId, text: preview }, env);
}

