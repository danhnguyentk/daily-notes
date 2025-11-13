/**
 * Types for order conversation flow
 */
export interface OrderData {
  symbol?: string;
  direction?: 'LONG' | 'SHORT';
  entry?: number;
  stopLoss?: number;
  takeProfit?: number;
  quantity?: number;
  notes?: string;
}

export enum OrderConversationStep {
  IDLE = 'idle',
  WAITING_SYMBOL = 'waiting_symbol',
  WAITING_DIRECTION = 'waiting_direction',
  WAITING_ENTRY = 'waiting_entry',
  WAITING_STOP_LOSS = 'waiting_stop_loss',
  WAITING_TAKE_PROFIT = 'waiting_take_profit',
  WAITING_QUANTITY = 'waiting_quantity',
  WAITING_NOTES = 'waiting_notes',
  COMPLETED = 'completed',
}

export interface OrderConversationState {
  userId: number;
  step: OrderConversationStep;
  data: OrderData;
  createdAt: number;
}