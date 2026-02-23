/**
 * Model List Fetching – Dynamically fetch available models from LLM providers
 */

const OPENAI_MODELS_URL = 'https://api.openai.com/v1/models';
const ANTHROPIC_MODELS_URL = 'https://api.anthropic.com/v1/models';

/**
 * Fetch available OpenAI models from the API
 * Returns empty array on error (triggers manual input fallback in UI)
 */
export async function fetchOpenAIModels(apiKey: string): Promise<string[]> {
  if (!apiKey || apiKey.trim() === '') {
    return [];
  }

  try {
    const response = await fetch(OPENAI_MODELS_URL, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) {
      return [];
    }

    const data = await response.json() as {
      data: Array<{ id: string; object: string }>;
    };

    // Filter for GPT-4 and GPT-5 models only
    const chatModels = data.data
      .filter(model => {
        const id = model.id.toLowerCase();
        return (
          id.startsWith('gpt-4') ||
          id.startsWith('gpt-5')
        );
      })
      .map(model => model.id)
      .sort();

    return chatModels;
  } catch {
    return [];
  }
}

/**
 * Fetch available Anthropic Claude models from the API
 * Returns empty array on error (triggers manual input fallback in UI)
 */
export async function fetchClaudeModels(apiKey: string): Promise<string[]> {
  if (!apiKey || apiKey.trim() === '') {
    return [];
  }

  try {
    const response = await fetch(ANTHROPIC_MODELS_URL, {
      method: 'GET',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
    });

    if (!response.ok) {
      return [];
    }

    const data = await response.json() as {
      models: Array<{ id: string }>;
    };

    // Extract model IDs and sort
    const models = data.models
      .map(model => model.id)
      .sort();

    return models;
  } catch {
    return [];
  }
}
