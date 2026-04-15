import Anthropic from '@anthropic-ai/sdk';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface AIClientConfig {
  apiKey?: string;
  defaultTimeout?: number;
  maxRetries?: number;
}

export interface CallOptions {
  model?: string;
  maxTokens?: number;
  timeout?: number;
  system?: string;
}

export interface VisionCallOptions extends CallOptions {
  images: Array<{
    base64: string;
    mediaType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';
  }>;
}

export class AIError extends Error {
  constructor(
    message: string,
    public readonly code: 'TIMEOUT' | 'RATE_LIMIT' | 'SERVER_ERROR' | 'PARSE_ERROR' | 'API_ERROR',
    public readonly retriable: boolean,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'AIError';
  }
}

// ─── Constants ───────────────────────────────────────────────────────────────

const RETRY_DELAYS_MS = [2000, 4000, 8000];
const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_TOKENS = 1024;

export const MODEL_HAIKU = 'claude-haiku-4-5-20251001';
export const MODEL_SONNET = 'claude-sonnet-4-6';

// ─── Client ──────────────────────────────────────────────────────────────────

let client: Anthropic | null = null;

function getClient(apiKey?: string): Anthropic {
  if (!client) {
    client = new Anthropic({
      apiKey,
      defaultHeaders: {
        'anthropic-beta': 'zero-data-retention',
      },
    });
  }
  return client;
}

export function resetClient(): void {
  client = null;
}

// ─── Retry logic ─────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRateLimitError(err: unknown): boolean {
  return err instanceof Anthropic.RateLimitError;
}

function isServerError(err: unknown): boolean {
  return err instanceof Anthropic.InternalServerError || err instanceof Anthropic.APIConnectionError;
}

async function withRetry<T>(fn: () => Promise<T>, maxRetries: number): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;

      if (isRateLimitError(err) && attempt < maxRetries) {
        await sleep(RETRY_DELAYS_MS[attempt] ?? 8000);
        continue;
      }

      if (isServerError(err) && attempt === 0) {
        await sleep(RETRY_DELAYS_MS[0]!);
        continue;
      }

      throw err;
    }
  }

  throw lastError;
}

// ─── Timeout ─────────────────────────────────────────────────────────────────

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new AIError(`Request timed out after ${ms}ms`, 'TIMEOUT', true));
    }, ms);

    promise.then(
      (val) => { clearTimeout(timer); resolve(val); },
      (err) => { clearTimeout(timer); reject(err); },
    );
  });
}

// ─── Public API ──────────────────────────────────────────────────────────────

export async function callClaude(
  prompt: string,
  options: CallOptions = {},
  config: AIClientConfig = {},
): Promise<string> {
  const {
    model = MODEL_HAIKU,
    maxTokens = DEFAULT_MAX_TOKENS,
    timeout = config.defaultTimeout ?? DEFAULT_TIMEOUT_MS,
    system,
  } = options;

  const anthropic = getClient(config.apiKey);
  const maxRetries = config.maxRetries ?? RETRY_DELAYS_MS.length;

  try {
    const response = await withRetry(
      () =>
        withTimeout(
          anthropic.messages.create({
            model,
            max_tokens: maxTokens,
            ...(system ? { system } : {}),
            messages: [{ role: 'user', content: prompt }],
          }),
          timeout,
        ),
      maxRetries,
    );

    const textBlock = response.content.find((b) => b.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
      throw new AIError('No text content in response', 'PARSE_ERROR', false);
    }
    return textBlock.text;
  } catch (err) {
    if (err instanceof AIError) throw err;
    if (isRateLimitError(err)) {
      throw new AIError('Rate limit exceeded after retries', 'RATE_LIMIT', true, err);
    }
    if (isServerError(err)) {
      throw new AIError('Server error after retries', 'SERVER_ERROR', true, err);
    }
    throw new AIError('API call failed', 'API_ERROR', false, err);
  }
}

export async function callClaudeVision(
  prompt: string,
  options: VisionCallOptions,
  config: AIClientConfig = {},
): Promise<string> {
  const {
    model = MODEL_SONNET,
    maxTokens = 4096,
    timeout = config.defaultTimeout ?? 120_000,
    system,
    images,
  } = options;

  const anthropic = getClient(config.apiKey);
  const maxRetries = config.maxRetries ?? RETRY_DELAYS_MS.length;

  const content: Anthropic.Messages.ContentBlockParam[] = [
    ...images.map((img) => ({
      type: 'image' as const,
      source: {
        type: 'base64' as const,
        media_type: img.mediaType,
        data: img.base64,
      },
    })),
    { type: 'text' as const, content: prompt },
  ];

  try {
    const response = await withRetry(
      () =>
        withTimeout(
          anthropic.messages.create({
            model,
            max_tokens: maxTokens,
            ...(system ? { system } : {}),
            messages: [{ role: 'user', content }],
          }),
          timeout,
        ),
      maxRetries,
    );

    const textBlock = response.content.find((b) => b.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
      throw new AIError('No text content in response', 'PARSE_ERROR', false);
    }
    return textBlock.text;
  } catch (err) {
    if (err instanceof AIError) throw err;
    if (isRateLimitError(err)) {
      throw new AIError('Rate limit exceeded after retries', 'RATE_LIMIT', true, err);
    }
    if (isServerError(err)) {
      throw new AIError('Server error after retries', 'SERVER_ERROR', true, err);
    }
    throw new AIError('API call failed', 'API_ERROR', false, err);
  }
}

export function parseJSONResponse<T>(raw: string, label: string): T {
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new AIError(`No JSON object found in ${label} response`, 'PARSE_ERROR', false);
  }
  try {
    return JSON.parse(jsonMatch[0]) as T;
  } catch {
    throw new AIError(`Malformed JSON in ${label} response`, 'PARSE_ERROR', false);
  }
}

export function parseJSONArrayResponse<T>(raw: string, label: string): T[] {
  const jsonMatch = raw.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    throw new AIError(`No JSON array found in ${label} response`, 'PARSE_ERROR', false);
  }
  try {
    return JSON.parse(jsonMatch[0]) as T[];
  } catch {
    throw new AIError(`Malformed JSON array in ${label} response`, 'PARSE_ERROR', false);
  }
}
