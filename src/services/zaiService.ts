/**
 * Zai service for AI-powered analysis
 */

import { Env } from '../types/env';

/**
 * Zai model enum for type safety
 */
export enum ZaiModel {
  GLM_4_5_FLASH = 'GLM-4.5-Flash',
}

/**
 * Analyze data using Zai API
 * 
 * @param env - Environment variables
 * @param prompt - The prompt/question to send to Zai
 * @param systemPrompt - Optional system prompt to set the AI's role/behavior
 * @param model - The Zai model to use (default: ZaiModel.GLM_4_6)
 * @param temperature - Temperature for response randomness (default: 0.7)
 * @param maxTokens - Maximum tokens in response (default: 2000)
 * @returns The AI-generated analysis text
 */
export async function analyzeWithZai(
  env: Env,
  prompt: string,
  systemPrompt?: string,
  model: ZaiModel = ZaiModel.GLM_4_5_FLASH,
  temperature: number = 0.7,
  maxTokens: number = 2000
): Promise<string> {
  if (!env.ZAI_API_KEY) {
    throw new Error('ZAI_API_KEY is not configured');
  }

  const url = 'https://api.z.ai/api/paas/v4/chat/completions';
  
  console.log('Analyzing with Zai:', { url, model, temperature, maxTokens, systemPrompt, prompt });
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${env.ZAI_API_KEY}`,
  };

  const messages: Array<{ role: string; content: string }> = [];
  
  if (systemPrompt) {
    messages.push({ role: 'system', content: systemPrompt });
  }
  
  messages.push({ role: 'user', content: prompt });

  const body = {
    model,
    messages,
    temperature,
    max_tokens: maxTokens,
  };

  const resp = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Zai API error ${resp.status}: ${text}`);
  }

  interface ZaiResponse {
    choices?: Array<{
      message?: {
        content?: string;
        reasoning_content?: string;
      };
    }>;
  }

  const data: ZaiResponse = await resp.json();
  const content = data.choices?.[0]?.message?.content;
  console.log('Zai response:', content);
  return data.choices?.[0]?.message?.content || 'Không thể phân tích dữ liệu.';
}

