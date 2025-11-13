/**
 * Service to manage order conversation flow
 */

import { Env } from '../types';
import { sendMessageToTelegram, TelegramInlineKeyboardMarkup } from '../telegramService';
import { OrderConversationState, OrderConversationStep, OrderData } from '../types/orderTypes';

const CONVERSATION_STATE_KEY_PREFIX = 'order_conversation_';

function getConversationKey(userId: number): string {
  return `${CONVERSATION_STATE_KEY_PREFIX}${userId}`;
}

/**
 * Create inline keyboard for notes selection with current selected notes
 */
function createNotesKeyboard(currentNotes?: string): TelegramInlineKeyboardMarkup {
  const notes = currentNotes ? currentNotes.split(', ').filter(n => n.trim()) : [];
  
  return {
    inline_keyboard: [
      [
        { text: '2 Nen 15M Tang lien tuc', callback_data: 'note_add_2 Nen 15M Tang lien tuc' },
        { text: 'HARSI 8h Xanh', callback_data: 'note_add_HARSI 8h Xanh' },
      ],
      [
        { text: '2 Nen 15M Tang lien tuc, HARSI 8h Xanh', callback_data: 'note_add_2 Nen 15M Tang lien tuc, HARSI 8h Xanh' },
      ],
      [
        ...(notes.length > 0 ? [{ text: '🗑️ Clear', callback_data: 'note_clear' }] : []),
        { text: '✅ Done', callback_data: 'note_done' },
        { text: '⏭️ Skip', callback_data: 'note_skip' },
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
  const message = `📝 Bắt đầu nhập lệnh mới!\n\nVui lòng nhập Symbol: \n 
/BTCUSDT - BTCUSDT\n
/ETHUSDT - ETHUSDT\n
/XAUUSD - XAUUSD\n`;
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
      updatedState.data.symbol = input.trim().toUpperCase();
      updatedState.step = OrderConversationStep.WAITING_DIRECTION;
      message = `✅ Symbol: ${updatedState.data.symbol}\n\nVui lòng chọn hướng:\n/LONG - Long\n/SHORT - Short`;
      break;

    case OrderConversationStep.WAITING_DIRECTION:
      const directionInput = input.trim().toUpperCase().replace('/', '');
      if (directionInput === 'LONG') {
        updatedState.data.direction = 'LONG';
      } else if (directionInput === 'SHORT') {
        updatedState.data.direction = 'SHORT';
      } else {
        await sendMessageToTelegram({
          chat_id: chatId,
          text: '❌ Vui lòng chọn /LONG hoặc /SHORT',
        }, env);
        return { completed: false };
      }
      updatedState.step = OrderConversationStep.WAITING_ENTRY;
      message = `✅ Direction: ${updatedState.data.direction}\n\nVui lòng nhập Entry price:`;
      break;

    case OrderConversationStep.WAITING_ENTRY:
      const entry = parseFloat(input.trim());
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
      const stopLoss = parseFloat(input.trim());
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
        const takeProfit = parseFloat(input.trim());
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
      message = `✅ Take Profit: ${updatedState.data.takeProfit || 'N/A'}\n\nVui lòng nhập Quantity (hoặc /skip để bỏ qua): \n /0.01 /0.02 /0.1 /0.2`;
      break;

    case OrderConversationStep.WAITING_QUANTITY:
      if (input.trim().toUpperCase() === '/SKIP' || input.trim() === '') {
        updatedState.data.quantity = undefined;
      } else {
        const quantity = parseFloat(input.trim());
        if (isNaN(quantity) || quantity <= 0) {
          await sendMessageToTelegram({
            chat_id: chatId,
            text: '❌ Quantity không hợp lệ. Vui lòng nhập số dương hoặc /skip.',
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
      
      await saveConversationState(updatedState, env);
      await sendMessageToTelegram({ 
        chat_id: chatId, 
        text: message,
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
      break;

    default:
      await sendMessageToTelegram({
        chat_id: chatId,
        text: '❌ Trạng thái không hợp lệ.',
      }, env);
      return { completed: false };
  }

  await saveConversationState(updatedState, env);
  await sendMessageToTelegram({ chat_id: chatId, text: message }, env);

  if (updatedState.step === OrderConversationStep.COMPLETED) {
    return { completed: true, orderData: updatedState.data };
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
  await sendMessageToTelegram({
    chat_id: chatId,
    text: '✅ Đã hủy nhập lệnh.',
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
  const notesArray = currentNotes ? currentNotes.split(', ').filter(n => n.trim()) : [];
  
  // Add new note if not already exists
  if (!notesArray.includes(noteText.trim())) {
    notesArray.push(noteText.trim());
  }
  
  state.data.notes = notesArray.join(', ');
  await saveConversationState(state, env);

  // Show updated keyboard
  const message = `✅ Quantity: ${state.data.quantity || 'N/A'}\n\n📝 Notes đã chọn: ${state.data.notes || '(chưa có)'}\n\nVui lòng chọn thêm Notes hoặc nhấn Done:`;
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
  const preview = `
📋 Thông tin lệnh hiện tại:

Symbol: ${data.symbol || 'Chưa nhập'}
Direction: ${data.direction || 'Chưa nhập'}
Entry: ${data.entry || 'Chưa nhập'}
Stop Loss: ${data.stopLoss || 'Chưa nhập'}
Take Profit: ${data.takeProfit || 'N/A'}
Quantity: ${data.quantity || 'N/A'}
Notes: ${data.notes || 'N/A'}

Bước hiện tại: ${state.step}
  `.trim();

  await sendMessageToTelegram({ chat_id: chatId, text: preview }, env);
}

