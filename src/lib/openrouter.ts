const OPENROUTER_BASE = import.meta.env.VITE_OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1';
const API_KEY = import.meta.env.VITE_OPENROUTER_API_KEY;
const TEXT_MODEL = import.meta.env.VITE_TEXT_MODEL || 'google/gemini-2.0-flash-001';
const IMAGE_MODEL = import.meta.env.VITE_IMAGE_MODEL || 'google/gemini-2.0-flash-001';

interface OpenRouterMessage {
  role: 'user' | 'assistant' | 'system';
  content: string | Array<{ type: 'text' | 'image_url'; text?: string; image_url?: { url: string } }>;
}

interface ChatCompletionOptions {
  maxTokens?: number;
  temperature?: number;
}

export async function chatCompletion(
  model: string,
  messages: OpenRouterMessage[],
  options?: ChatCompletionOptions
): Promise<string> {
  if (!API_KEY) {
    throw new Error('OpenRouter API key not configured. Set VITE_OPENROUTER_API_KEY in .env.local');
  }

  const response = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': window.location.origin,
      'X-Title': 'Zookeeper',
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: options?.maxTokens ?? 4096,
      temperature: options?.temperature ?? 0.7,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(`OpenRouter API error: ${response.status} - ${error.error?.message || 'Unknown error'}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

export async function generateText(prompt: string, options?: ChatCompletionOptions): Promise<string> {
  return chatCompletion(TEXT_MODEL, [{ role: 'user', content: prompt }], options);
}

export async function analyzeImage(
  imageBase64: string,
  prompt: string,
  options?: ChatCompletionOptions
): Promise<string> {
  return chatCompletion(
    IMAGE_MODEL,
    [{
      role: 'user',
      content: [
        {
          type: 'image_url',
          image_url: { url: `data:image/jpeg;base64,${imageBase64}` },
        },
        {
          type: 'text',
          text: prompt,
        },
      ],
    }],
    options
  );
}

export { TEXT_MODEL, IMAGE_MODEL };
