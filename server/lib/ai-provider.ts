/**
 * Unified AI Provider - Manages per-feature AI routing between Anthropic and DeepSeek
 *
 * This module centralizes all AI API calls and supports configurable provider/model
 * per feature, allowing cost optimization (DeepSeek for high-volume tasks, Claude for quality).
 */

import { AIConfig, AIFeature, AIFeatureConfig } from "@shared/schema";
import { logger } from "./logger";

export interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AICompletionOptions {
  messages: AIMessage[];
  maxTokens?: number;
  temperature?: number;
  stream?: boolean;
}

export interface AICompletionResult {
  content: string;
  provider: string;
  model: string;
  usage?: { inputTokens: number; outputTokens: number };
}

const DEFAULT_TIMEOUT_MS = 30000;
const REASONER_TIMEOUT_MS = 120000;

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timeout);
    return response;
  } catch (error) {
    clearTimeout(timeout);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Request timeout after ${timeoutMs}ms`);
    }
    throw error;
  }
}

async function callAnthropic(apiKey: string, model: string, options: AICompletionOptions): Promise<AICompletionResult> {
  const messages = options.messages.filter(m => m.role !== 'system');
  const systemMessage = options.messages.find(m => m.role === 'system')?.content;

  const body: any = {
    model,
    max_tokens: options.maxTokens || 4096,
    messages: messages.map(m => ({ role: m.role, content: m.content })),
  };
  if (systemMessage) {
    body.system = systemMessage;
  }
  if (options.temperature !== undefined) {
    body.temperature = options.temperature;
  }

  const response = await fetchWithTimeout(
    'https://api.anthropic.com/v1/messages',
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    },
    DEFAULT_TIMEOUT_MS
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Anthropic API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  if (!data.content?.[0]?.text) {
    throw new Error('Invalid Anthropic API response format');
  }

  return {
    content: data.content[0].text,
    provider: 'anthropic',
    model,
    usage: data.usage ? {
      inputTokens: data.usage.input_tokens,
      outputTokens: data.usage.output_tokens,
    } : undefined,
  };
}

async function callDeepSeek(apiKey: string, model: string, options: AICompletionOptions): Promise<AICompletionResult> {
  const isThinkingModel = model.includes('reasoner') || model.includes('r1');
  const timeout = isThinkingModel ? REASONER_TIMEOUT_MS : DEFAULT_TIMEOUT_MS;

  const body: any = {
    model,
    messages: options.messages.map(m => ({ role: m.role, content: m.content })),
    max_tokens: options.maxTokens || 4096,
  };
  if (options.temperature !== undefined && !isThinkingModel) {
    body.temperature = options.temperature;
  }

  const response = await fetchWithTimeout(
    'https://api.deepseek.com/chat/completions',
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    },
    timeout
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`DeepSeek API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  if (!data.choices?.[0]) {
    throw new Error('Invalid DeepSeek API response format');
  }

  const message = data.choices[0].message || {};
  let content = message.content || message.reasoning_content || '';

  // For reasoner models, combine reasoning + final content
  if (isThinkingModel && message.reasoning_content) {
    const finalContent = message.content || '';
    content = message.reasoning_content + (finalContent ? '\n' + finalContent : '');
  }

  return {
    content: typeof content === 'string' ? content : JSON.stringify(content),
    provider: 'deepseek',
    model,
    usage: data.usage ? {
      inputTokens: data.usage.prompt_tokens,
      outputTokens: data.usage.completion_tokens,
    } : undefined,
  };
}

// Default feature configurations (used when no custom config is set)
const DEFAULT_FEATURE_CONFIGS: Record<AIFeature, { provider: 'anthropic' | 'deepseek'; model: string }> = {
  email_analysis: { provider: 'anthropic', model: 'claude-sonnet-4-20250514' },
  chat_assistant: { provider: 'anthropic', model: 'claude-sonnet-4-20250514' },
  project_health: { provider: 'anthropic', model: 'claude-sonnet-4-20250514' },
  proactive_alerts: { provider: 'anthropic', model: 'claude-sonnet-4-20250514' },
  financial_forecast: { provider: 'anthropic', model: 'claude-sonnet-4-20250514' },
  report_generation: { provider: 'anthropic', model: 'claude-sonnet-4-20250514' },
};

/**
 * Get API key for a given provider. Checks stored config first, then env vars.
 */
function getApiKey(provider: 'anthropic' | 'deepseek', globalConfig?: AIConfig): string {
  // If global config has an API key and it matches the provider, use it
  if (globalConfig?.apiKey && globalConfig.provider === provider) {
    return globalConfig.apiKey;
  }

  // Fall back to environment variables
  if (provider === 'anthropic') {
    return process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY || process.env.AI_API_KEY || '';
  }
  return process.env.DEEPSEEK_API_KEY || '';
}

/**
 * Execute an AI completion for a specific feature, using per-feature config if available.
 */
export async function aiComplete(
  feature: AIFeature,
  options: AICompletionOptions,
  globalConfig?: AIConfig,
  featureConfigs?: AIFeatureConfig[],
): Promise<AICompletionResult> {
  // Determine which provider/model to use for this feature
  const featureConfig = featureConfigs?.find(fc => fc.feature === feature && fc.enabled);
  const provider = featureConfig?.provider || globalConfig?.provider || DEFAULT_FEATURE_CONFIGS[feature].provider;
  const model = featureConfig?.model || globalConfig?.model || DEFAULT_FEATURE_CONFIGS[feature].model;
  const apiKey = getApiKey(provider, globalConfig);

  if (!apiKey) {
    throw new Error(`Nessuna API key configurata per il provider ${provider}. Configura nelle impostazioni AI.`);
  }

  logger.info(`AI completion for feature=${feature}`, { provider, model });

  try {
    if (provider === 'deepseek') {
      return await callDeepSeek(apiKey, model, options);
    }
    return await callAnthropic(apiKey, model, options);
  } catch (error) {
    logger.error(`AI completion failed for feature=${feature}`, {
      provider,
      model,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

/**
 * Simple utility to call AI with a single prompt (no conversation history).
 */
export async function aiPrompt(
  feature: AIFeature,
  systemPrompt: string,
  userPrompt: string,
  globalConfig?: AIConfig,
  featureConfigs?: AIFeatureConfig[],
): Promise<string> {
  const result = await aiComplete(feature, {
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
  }, globalConfig, featureConfigs);
  return result.content;
}
