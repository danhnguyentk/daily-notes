import { Env } from '../../types/env';
import { analyzeWithAI, OpenAIModel } from './openAiService';
import { analyzeWithZai, ZaiModel } from './zaiService';

/**
 * Supported AI providers
 */
export enum AIProvider {
  OPENAI = 'openai',
  ZAI = 'zai',
}

/**
 * Interface for AI service implementations
 */
export interface AIService {
  /**
   * Analyze data using the AI provider
   * @param env Environment containing provider-specific keys
   * @param prompt The prompt/question to send to the AI
   * @param systemPrompt Optional system prompt to set the AI's role/behavior
   * @param temperature Temperature for response randomness (default: 0.7)
   * @param maxTokens Maximum tokens in response (default: 2000)
   * @returns The AI-generated analysis text
   */
  analyze(
    env: Env,
    prompt: string,
    systemPrompt?: string,
    temperature?: number,
    maxTokens?: number
  ): Promise<string>;
}

/**
 * OpenAI implementation
 */
class OpenAIService implements AIService {
  async analyze(
    env: Env,
    prompt: string,
    systemPrompt?: string,
    temperature: number = 0.7,
    maxTokens: number = 2000
  ): Promise<string> {
    return analyzeWithAI(
      env,
      prompt,
      systemPrompt,
      OpenAIModel.GPT_4O_MINI,
      temperature,
      maxTokens
    );
  }
}

/**
 * Zai implementation
 */
class ZaiService implements AIService {
  async analyze(
    env: Env,
    prompt: string,
    systemPrompt?: string,
    temperature: number = 0.7,
    maxTokens: number = 2000
  ): Promise<string> {
    return analyzeWithZai(
      env,
      prompt,
      systemPrompt,
      ZaiModel.GLM_4_5_FLASH,
      temperature,
      maxTokens
    );
  }
}

/**
 * Get the AI service instance based on provider configuration
 * @param env Environment containing AI_PROVIDER and provider-specific keys
 * @returns AIService instance
 * @throws Error if provider is not supported or required keys are missing
 */
export function getAIService(env: Env): AIService {
  const providerValue = (env.AI_PROVIDER ?? AIProvider.ZAI).toLowerCase();

  if (providerValue === AIProvider.OPENAI) {
    if (!env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is required for OpenAI provider');
    }
    return new OpenAIService();
  }

  if (providerValue === AIProvider.ZAI) {
    if (!env.ZAI_API_KEY) {
      throw new Error('ZAI_API_KEY is required for Zai provider');
    }
    return new ZaiService();
  }

  throw new Error(`Unsupported AI provider: ${providerValue}. Supported providers: ${Object.values(AIProvider).join(', ')}`);
}

/**
 * Analyze data using the configured AI provider
 * This is a convenience function that uses the provider from env
 * @param env Environment containing AI_PROVIDER and provider-specific keys
 * @param prompt The prompt/question to send to the AI
 * @param systemPrompt Optional system prompt to set the AI's role/behavior
 * @param temperature Temperature for response randomness (default: 0.7)
 * @param maxTokens Maximum tokens in response (default: 2000)
 * @returns The AI-generated analysis text
 */
export async function analyzeWithAIProvider(
  env: Env,
  prompt: string,
  systemPrompt?: string,
  temperature: number = 0.7,
  maxTokens: number = 2000
): Promise<string> {
  const service = getAIService(env);
  return service.analyze(env, prompt, systemPrompt, temperature, maxTokens);
}

