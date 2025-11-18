/**
 * OpenAI service for AI-powered analysis
 */

import OpenAI from 'openai';
import { Env } from '../types/env';

/**
 * OpenAI model enum for type safety
 */
export enum OpenAIModel {
  GPT_5_1 = 'gpt-5.1',
  GPT_4O_MINI = 'gpt-4o-mini-2024-07-18',
  GPT_4_1_NANO = 'gpt-4.1-nano-2025-04-14',
  GPT_4_1 = 'gpt-4.1-2025-04-14',
  GPT_4O = 'gpt-4o-2024-08-06',
  GPT_4_TURBO = 'gpt-4-turbo',
  GPT_4 = 'gpt-4',
  GPT_3_5_TURBO = 'gpt-3.5-turbo-0125',
}

let openaiClient: OpenAI | null = null;

/**
 * Get or create OpenAI client instance
 */
function getOpenAIClient(env: Env): OpenAI {
  if (!openaiClient) {
    openaiClient = new OpenAI({
      apiKey: env.OPENAI_API_KEY,
    });
  }
  return openaiClient;
}

/**
 * Analyze data using OpenAI GPT model
 * 
 * @param env - Environment variables
 * @param prompt - The prompt/question to send to OpenAI
 * @param systemPrompt - Optional system prompt to set the AI's role/behavior
 * @param model - The OpenAI model to use (default: OpenAIModel.GPT_4O_MINI)
 * @param temperature - Temperature for response randomness (default: 0.7)
 * @param maxTokens - Maximum tokens in response (default: 2000)
 * @returns The AI-generated analysis text
 */
export async function analyzeWithAI(
  env: Env,
  prompt: string,
  systemPrompt?: string,
  model: OpenAIModel = OpenAIModel.GPT_4O_MINI,
  temperature: number = 0.7,
  maxTokens: number = 2000
): Promise<string> {
  const openai = getOpenAIClient(env);

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];

  // Add system prompt if provided
  if (systemPrompt) {
    messages.push({
      role: 'system',
      content: systemPrompt,
    });
  }

  // Add user prompt
  messages.push({
    role: 'user',
    content: prompt,
  });

  // Call OpenAI API
  const completion = await openai.chat.completions.create({
    model,
    messages,
    temperature,
    max_tokens: maxTokens,
  });

  return completion.choices[0]?.message?.content || 'Không thể phân tích dữ liệu.';
}

