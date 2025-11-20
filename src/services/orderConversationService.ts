/**
 * Service to manage order conversation flow
 */

import { Env } from '../types/env';
import { sendMessageToTelegram, TelegramInlineKeyboardMarkup, TelegramReplyKeyboardMarkup, TelegramReplyKeyboardRemove } from './telegramService';
import { OrderConversationState, OrderConversationStep, OrderData, MarketState, OrderDirection, TradingSymbol, CallbackDataPrefix } from '../types/orderTypes';
import { updateOrderWithClosePrice } from '../handlers/orderStatisticsHandler';
import { formatHarsiValue, formatRiskUnit, safeToFixed } from '../utils/formatUtils';
import { getCurrentPrice, KuCoinSymbol } from '../services/kucoinService';
import { getXAUPrice } from '../services/goldService';

const CONVERSATION_STATE_KEY_PREFIX = 'order_conversation_';
const ENTRY_PROMPT_BASE = 'Vui lòng nhập Entry price:';
const TRADING_SYMBOL_TO_KUCOIN: Partial<Record<TradingSymbol, KuCoinSymbol>> = {
  [TradingSymbol.BTCUSDT]: KuCoinSymbol.BTCUSDT,
  [TradingSymbol.ETHUSDT]: KuCoinSymbol.ETHUSDT,
};

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
      const normalizedPrice = price >= 1000 ? Math.round(price) : parseFloat(price.toFixed(2));
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
    const normalizedPrice = price >= 1000 ? Math.round(price) : parseFloat(price.toFixed(2));
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
 * Create inline keyboard for HARSI market state selection
 */
export function createHarsiMarketStateKeyboard(): TelegramInlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [
        { text: '📈 Bullish', callback_data: `${CallbackDataPrefix.HARSI}${MarketState.Bullish}` },
        { text: '📉 Bearish', callback_data: `${CallbackDataPrefix.HARSI}${MarketState.Bearish}` },
      ],
      [
        { text: '⚪ Neutral', callback_data: `${CallbackDataPrefix.HARSI}${MarketState.Neutral}` },
        { text: '⏭️ Skip', callback_data: CallbackDataPrefix.HARSI_SKIP },
      ],
    ],
  };
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
        { text: '2 Nen 15M Tang lien tuc', callback_data: `${CallbackDataPrefix.NOTE_ADD}2 Nen 15M Tang lien tuc` },
      ],
      [
        { text: 'HARSI 8h Xanh', callback_data: `${CallbackDataPrefix.NOTE_ADD}HARSI 8h Xanh` },
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
    await sendMessageToTelegram({
      chat_id: chatId,
      text: '⚠️ Bạn đang có một lệnh đang nhập. Gửi /cancelorder để hủy và bắt đầu lại.',
    }, env);
    return;
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

  const updatedState = { ...state };
  let message = '';

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
      message = `✅ Symbol: ${updatedState.data.symbol}\n\nVui lòng chọn hướng:\n/LONG - Long\n/SHORT - Short`;
      break;

    case OrderConversationStep.WAITING_DIRECTION:
      const directionInput = input.trim().toLowerCase().replace('/', '');
      if (directionInput === OrderDirection.LONG) {
        updatedState.data.direction = OrderDirection.LONG;
      } else if (directionInput === OrderDirection.SHORT) {
        updatedState.data.direction = OrderDirection.SHORT;
      } else {
        await sendMessageToTelegram({
          chat_id: chatId,
          text: '❌ Vui lòng chọn /LONG hoặc /SHORT',
        }, env);
        return { completed: false };
      }
      updatedState.step = OrderConversationStep.WAITING_HARSI_1W;
      message = `✅ Direction: ${updatedState.data.direction}\n\nVui lòng chọn HARSI 1W:`;
      
      await saveConversationState(updatedState, env);
      await sendMessageToTelegram({ 
        chat_id: chatId, 
        text: message,
        reply_markup: createHarsiMarketStateKeyboard(),
      }, env);
      return { completed: false };

    case OrderConversationStep.WAITING_HARSI_1W:
      // This case is handled by callback queries (harsi_Bullish, harsi_Bearish, harsi_Neutral, harsi_skip)
      // Regular text input still works for manual entry
      const harsi1wInput = input.trim();
      if (harsi1wInput.toUpperCase() === '/SKIP' || harsi1wInput === '') {
        updatedState.data.harsi1w = undefined;
      } else {
        const harsi1wValue = Object.values(MarketState).find(
          v => v.toLowerCase() === harsi1wInput.toLowerCase()
        );
        if (!harsi1wValue) {
          await sendMessageToTelegram({
            chat_id: chatId,
            text: '❌ Vui lòng chọn Bullish, Bearish, Neutral hoặc /skip',
            reply_markup: createHarsiMarketStateKeyboard(),
          }, env);
          return { completed: false };
        }
        updatedState.data.harsi1w = harsi1wValue;
      }
      updatedState.step = OrderConversationStep.WAITING_HARSI_3D;
      message = `✅ HARSI 1W: ${updatedState.data.harsi1w || 'N/A'}\n\nVui lòng chọn HARSI 3D:`;
      
      await saveConversationState(updatedState, env);
      await sendMessageToTelegram({ 
        chat_id: chatId, 
        text: message,
        reply_markup: createHarsiMarketStateKeyboard(),
      }, env);
      return { completed: false };

    case OrderConversationStep.WAITING_HARSI_3D:
      // This case is handled by callback queries (harsi_Bullish, harsi_Bearish, harsi_Neutral, harsi_skip)
      // Regular text input still works for manual entry
      const harsi3dInput = input.trim();
      if (harsi3dInput.toUpperCase() === '/SKIP' || harsi3dInput === '') {
        updatedState.data.harsi3d = undefined;
      } else {
        const harsi3dValue = Object.values(MarketState).find(
          v => v.toLowerCase() === harsi3dInput.toLowerCase()
        );
        if (!harsi3dValue) {
          await sendMessageToTelegram({
            chat_id: chatId,
            text: '❌ Vui lòng chọn Bullish, Bearish, Neutral hoặc /skip',
            reply_markup: createHarsiMarketStateKeyboard(),
          }, env);
          return { completed: false };
        }
        updatedState.data.harsi3d = harsi3dValue;
      }
      updatedState.step = OrderConversationStep.WAITING_HARSI_2D;
      message = `✅ HARSI 3D: ${updatedState.data.harsi3d || 'N/A'}\n\nVui lòng chọn HARSI 2D:`;
      
      await saveConversationState(updatedState, env);
      await sendMessageToTelegram({ 
        chat_id: chatId, 
        text: message,
        reply_markup: createHarsiMarketStateKeyboard(),
      }, env);
      return { completed: false };

    case OrderConversationStep.WAITING_HARSI_2D:
      // This case is handled by callback queries (harsi_Bullish, harsi_Bearish, harsi_Neutral, harsi_skip)
      // Regular text input still works for manual entry
      const harsi2dInput = input.trim();
      if (harsi2dInput.toUpperCase() === '/SKIP' || harsi2dInput === '') {
        updatedState.data.harsi2d = undefined;
      } else {
        const harsi2dValue = Object.values(MarketState).find(
          v => v.toLowerCase() === harsi2dInput.toLowerCase()
        );
        if (!harsi2dValue) {
          await sendMessageToTelegram({
            chat_id: chatId,
            text: '❌ Vui lòng chọn Bullish, Bearish, Neutral hoặc /skip',
            reply_markup: createHarsiMarketStateKeyboard(),
          }, env);
          return { completed: false };
        }
        updatedState.data.harsi2d = harsi2dValue;
      }
      updatedState.step = OrderConversationStep.WAITING_HARSI_1D;
      message = `✅ HARSI 2D: ${updatedState.data.harsi2d || 'N/A'}\n\nVui lòng chọn HARSI 1D:`;
      
      await saveConversationState(updatedState, env);
      await sendMessageToTelegram({ 
        chat_id: chatId, 
        text: message,
        reply_markup: createHarsiMarketStateKeyboard(),
      }, env);
      return { completed: false };

    case OrderConversationStep.WAITING_HARSI_1D:
      // This case is handled by callback queries (harsi_Bullish, harsi_Bearish, harsi_Neutral, harsi_skip)
      // Regular text input still works for manual entry
      const harsi1dInput = input.trim();
      if (harsi1dInput.toUpperCase() === '/SKIP' || harsi1dInput === '') {
        updatedState.data.harsi1d = undefined;
      } else {
        const harsi1dValue = Object.values(MarketState).find(
          v => v.toLowerCase() === harsi1dInput.toLowerCase()
        );
        if (!harsi1dValue) {
          await sendMessageToTelegram({
            chat_id: chatId,
            text: '❌ Vui lòng chọn Bullish, Bearish, Neutral hoặc /skip',
            reply_markup: createHarsiMarketStateKeyboard(),
          }, env);
          return { completed: false };
        }
        updatedState.data.harsi1d = harsi1dValue;
      }
      updatedState.step = OrderConversationStep.WAITING_HARSI_8H;
      message = `✅ HARSI 1D: ${updatedState.data.harsi1d || 'N/A'}\n\nVui lòng chọn HARSI 8H:`;
      
      await saveConversationState(updatedState, env);
      await sendMessageToTelegram({ 
        chat_id: chatId, 
        text: message,
        reply_markup: createHarsiMarketStateKeyboard(),
      }, env);
      return { completed: false };

    case OrderConversationStep.WAITING_HARSI_8H:
      // This case is handled by callback queries (harsi_Bullish, harsi_Bearish, harsi_Neutral, harsi_skip)
      // Regular text input still works for manual entry
      const harsi8hInput = input.trim();
      if (harsi8hInput.toUpperCase() === '/SKIP' || harsi8hInput === '') {
        updatedState.data.harsi8h = undefined;
      } else {
        const harsi8hValue = Object.values(MarketState).find(
          v => v.toLowerCase() === harsi8hInput.toLowerCase()
        );
        if (!harsi8hValue) {
          await sendMessageToTelegram({
            chat_id: chatId,
            text: '❌ Vui lòng chọn Bullish, Bearish, Neutral hoặc /skip',
            reply_markup: createHarsiMarketStateKeyboard(),
          }, env);
          return { completed: false };
        }
        updatedState.data.harsi8h = harsi8hValue;
      }
      
      if (updatedState.data.harsi8h === MarketState.Bearish) {
        // Show warning and ask for confirmation
        updatedState.step = OrderConversationStep.WAITING_HARSI_8H_CONFIRMATION;
        await saveConversationState(updatedState, env);
        
        const warningMessage = `
⚠️ CẢNH BÁO RỦI RO

HARSI 8H đang ở trạng thái Bearish (Giảm).

📌 Lưu ý:
   • Thị trường có xu hướng giảm trên khung thời gian 8 giờ
   • Dễ dàng chạm Stop Loss nếu xu hướng giảm tiếp tục
   • Nên cân nhắc kỹ trước khi vào lệnh
   • Đảm bảo Stop Loss được đặt hợp lý và quản lý rủi ro tốt

💡 Gợi ý:
   • Kiểm tra lại các khung thời gian khác (1D, 12H, 6H, 4H)
   • Xem xét các tín hiệu phân tích kỹ thuật khác
   • Quản lý vốn cẩn thận, không nên risk quá nhiều
        `.trim();

        const confirmationKeyboard: TelegramInlineKeyboardMarkup = {
          inline_keyboard: [
            [
              { text: '✅ Tiếp Tục', callback_data: CallbackDataPrefix.HARSI_8H_CONTINUE },
              { text: '❌ Hủy', callback_data: CallbackDataPrefix.HARSI_8H_CANCEL },
            ],
          ],
        };

        await sendMessageToTelegram({ 
          chat_id: chatId, 
          text: warningMessage,
        }, env);
        
        await sendMessageToTelegram({ 
          chat_id: chatId, 
          text: 'Bạn muốn tiếp tục chứ?',
          reply_markup: confirmationKeyboard,
        }, env);
        return { completed: false };
      } else {
        // Not Bearish, proceed normally
        updatedState.step = OrderConversationStep.WAITING_HARSI_4H;
        message = `✅ HARSI 8H: ${updatedState.data.harsi8h || 'N/A'}\n\nVui lòng chọn HARSI 4H:`;
        
        await saveConversationState(updatedState, env);
        await sendMessageToTelegram({ 
          chat_id: chatId, 
          text: message,
          reply_markup: createHarsiMarketStateKeyboard(),
        }, env);
        return { completed: false };
      }


    case OrderConversationStep.WAITING_HARSI_4H:
      // This case is handled by callback queries (harsi_Bullish, harsi_Bearish, harsi_Neutral, harsi_skip)
      // Regular text input still works for manual entry
      const harsi4hInput = input.trim();
      if (harsi4hInput.toUpperCase() === '/SKIP' || harsi4hInput === '') {
        updatedState.data.harsi4h = undefined;
      } else {
        const harsi4hValue = Object.values(MarketState).find(
          v => v.toLowerCase() === harsi4hInput.toLowerCase()
        );
        if (!harsi4hValue) {
          await sendMessageToTelegram({
            chat_id: chatId,
            text: '❌ Vui lòng chọn Bullish, Bearish, Neutral hoặc /skip',
            reply_markup: createHarsiMarketStateKeyboard(),
          }, env);
          return { completed: false };
        }
        updatedState.data.harsi4h = harsi4hValue;
      }
      updatedState.step = OrderConversationStep.WAITING_ENTRY;
      message = `✅ HARSI 4H: ${updatedState.data.harsi4h || 'N/A'}\n\n${await getEntryPrompt(updatedState.data.symbol, env)}`;
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
      updatedState.step = OrderConversationStep.WAITING_QUANTITY;
      message = `✅ Take Profit: ${updatedState.data.takeProfit || 'N/A'}\n\nVui lòng chọn Quantity (hoặc /skip để bỏ qua):`;
      
      // Create reply keyboard with quantity options
      // This will show buttons at the bottom that send text like /0.01
      const quantityKeyboard = createQuantityKeyboard();
      
      await saveConversationState(updatedState, env);
      await sendMessageToTelegram({ 
        chat_id: chatId, 
        text: message,
        reply_markup: quantityKeyboard,
      }, env);
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
    await sendMessageToTelegram({ chat_id: chatId, text: message }, env);
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
 * Handle HARSI market state selection (for 1W, 3D, 2D, 1D, 8H, and 4H)
 */
export async function handleHarsiSelection(
  userId: number,
  chatId: string,
  marketState: MarketState | 'skip',
  env: Env
): Promise<void> {
  const state = await getConversationState(userId, env);
  if (!state) {
    await sendMessageToTelegram({
      chat_id: chatId,
      text: '❌ Không tìm thấy phiên nhập lệnh.',
    }, env);
    return;
  }

  if (state.step === OrderConversationStep.WAITING_HARSI_1W) {
    if (marketState === 'skip') {
      state.data.harsi1w = undefined;
    } else {
      state.data.harsi1w = marketState;
    }
    state.step = OrderConversationStep.WAITING_HARSI_3D;
    await saveConversationState(state, env);
    
    const message = `✅ HARSI 1W: ${state.data.harsi1w || 'N/A'}\n\nVui lòng chọn HARSI 3D:`;
    await sendMessageToTelegram({ 
      chat_id: chatId, 
      text: message,
      reply_markup: createHarsiMarketStateKeyboard(),
    }, env);
  } else if (state.step === OrderConversationStep.WAITING_HARSI_3D) {
    if (marketState === 'skip') {
      state.data.harsi3d = undefined;
    } else {
      state.data.harsi3d = marketState;
    }
    state.step = OrderConversationStep.WAITING_HARSI_2D;
    await saveConversationState(state, env);
    
    const message = `✅ HARSI 3D: ${state.data.harsi3d || 'N/A'}\n\nVui lòng chọn HARSI 2D:`;
    await sendMessageToTelegram({ 
      chat_id: chatId, 
      text: message,
      reply_markup: createHarsiMarketStateKeyboard(),
    }, env);
  } else if (state.step === OrderConversationStep.WAITING_HARSI_2D) {
    if (marketState === 'skip') {
      state.data.harsi2d = undefined;
    } else {
      state.data.harsi2d = marketState;
    }
    state.step = OrderConversationStep.WAITING_HARSI_1D;
    await saveConversationState(state, env);
    
    const message = `✅ HARSI 2D: ${state.data.harsi2d || 'N/A'}\n\nVui lòng chọn HARSI 1D:`;
    await sendMessageToTelegram({ 
      chat_id: chatId, 
      text: message,
      reply_markup: createHarsiMarketStateKeyboard(),
    }, env);
  } else if (state.step === OrderConversationStep.WAITING_HARSI_1D) {
    if (marketState === 'skip') {
      state.data.harsi1d = undefined;
    } else {
      state.data.harsi1d = marketState;
    }
    state.step = OrderConversationStep.WAITING_HARSI_8H;
    await saveConversationState(state, env);
    
    const message = `✅ HARSI 1D: ${state.data.harsi1d || 'N/A'}\n\nVui lòng chọn HARSI 8H:`;
    await sendMessageToTelegram({ 
      chat_id: chatId, 
      text: message,
      reply_markup: createHarsiMarketStateKeyboard(),
    }, env);
  } else if (state.step === OrderConversationStep.WAITING_HARSI_8H) {
    if (marketState === 'skip') {
      state.data.harsi8h = undefined;
      state.step = OrderConversationStep.WAITING_HARSI_4H;
      await saveConversationState(state, env);
      
      const message = `✅ HARSI 8H: ${state.data.harsi8h || 'N/A'}\n\nVui lòng chọn HARSI 4H:`;
      await sendMessageToTelegram({ 
        chat_id: chatId, 
        text: message,
        reply_markup: createHarsiMarketStateKeyboard(),
      }, env);
    } else if (marketState === MarketState.Bearish) {
      // Show warning and ask for confirmation
      state.data.harsi8h = marketState;
      state.step = OrderConversationStep.WAITING_HARSI_8H_CONFIRMATION;
      await saveConversationState(state, env);
      
      const warningMessage = `
⚠️ CẢNH BÁO RỦI RO

HARSI 8H đang ở trạng thái Bearish (Giảm).

📌 Lưu ý:
   • Thị trường có xu hướng giảm trên khung thời gian 8 giờ
   • Dễ dàng chạm Stop Loss nếu xu hướng giảm tiếp tục
   • Nên cân nhắc kỹ trước khi vào lệnh
   • Đảm bảo Stop Loss được đặt hợp lý và quản lý rủi ro tốt

💡 Gợi ý:
   • Kiểm tra lại các khung thời gian khác (1W, 3D, 2D, 1D, 4H)
   • Xem xét các tín hiệu phân tích kỹ thuật khác
   • Quản lý vốn cẩn thận, không nên risk quá nhiều
      `.trim();

      const confirmationKeyboard: TelegramInlineKeyboardMarkup = {
        inline_keyboard: [
          [
            { text: '✅ Tiếp Tục', callback_data: CallbackDataPrefix.HARSI_8H_CONTINUE },
            { text: '❌ Hủy', callback_data: CallbackDataPrefix.HARSI_8H_CANCEL },
          ],
        ],
      };

      await sendMessageToTelegram({ 
        chat_id: chatId, 
        text: warningMessage,
      }, env);
      
      await sendMessageToTelegram({ 
        chat_id: chatId, 
        text: 'Bạn muốn tiếp tục chứ?',
        reply_markup: confirmationKeyboard,
      }, env);
    } else {
      // Not Bearish, proceed normally
      state.data.harsi8h = marketState;
      state.step = OrderConversationStep.WAITING_HARSI_4H;
      await saveConversationState(state, env);
      
      const message = `✅ HARSI 8H: ${state.data.harsi8h || 'N/A'}\n\nVui lòng chọn HARSI 4H:`;
      await sendMessageToTelegram({ 
        chat_id: chatId, 
        text: message,
        reply_markup: createHarsiMarketStateKeyboard(),
      }, env);
    }
  } else if (state.step === OrderConversationStep.WAITING_HARSI_4H) {
    if (marketState === 'skip') {
      state.data.harsi4h = undefined;
    } else {
      state.data.harsi4h = marketState;
    }
    state.step = OrderConversationStep.WAITING_ENTRY;
    await saveConversationState(state, env);
    
    const message = `✅ HARSI 4H: ${state.data.harsi4h || 'N/A'}\n\n${await getEntryPrompt(state.data.symbol, env)}`;
    await sendMessageToTelegram({ 
      chat_id: chatId, 
      text: message,
    }, env);
  } else {
    await sendMessageToTelegram({
      chat_id: chatId,
      text: '❌ Không ở bước nhập HARSI.',
    }, env);
  }
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

