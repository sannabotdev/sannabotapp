/**
 * LLM Provider Registry – Centralized provider creation
 * 
 * This module provides a single source of truth for creating LLM providers,
 * eliminating code duplication across the codebase.
 */

import type { LLMProvider } from './types';
import { ClaudeProvider } from './claude-provider';
import { OpenAIProvider } from './openai-provider';

export type ProviderType = 'claude' | 'openai' | 'custom';

export interface CreateProviderOptions {
  provider: ProviderType;
  apiKey: string;
  model: string;
  customBaseUrl?: string;
}

/**
 * Create an LLM provider based on the specified configuration.
 * 
 * @param options - Provider configuration
 * @returns An instance of the appropriate LLM provider
 */
export function createLLMProvider(options: CreateProviderOptions): LLMProvider {
  const { provider, apiKey, model, customBaseUrl } = options;

  switch (provider) {
    case 'claude':
      return new ClaudeProvider(apiKey, model);
    
    case 'custom':
      if (!customBaseUrl) {
        throw new Error('customBaseUrl is required for custom provider');
      }
      return new OpenAIProvider(apiKey, model, customBaseUrl);
    
    case 'openai':
    default:
      return new OpenAIProvider(apiKey, model);
  }
}
