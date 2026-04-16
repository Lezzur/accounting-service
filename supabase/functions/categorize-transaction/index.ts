import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { jsonResponse } from '../_shared/response.ts';

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL_HAIKU = 'claude-haiku-4-5-20251001';
const TIMEOUT_MS = 10_000;
const DEFAULT_CONFIDENCE_THRESHOLD = 0.85;

// ─── Types ──────────────────────────────────────────────────────────────────

interface CategorizeInput {
  description: string;
  amount: string;
  type: 'credit' | 'debit';
  clientIndustry: string;
  existingCategories: Array<{ code: string; name: string; type: string }>;
  recentCorrections?: Array<{ original: string; corrected: string; description: string }>;
}

interface CategorizeResult {
  categoryCode: string;
  confidence: number;
  reasoning: string;
}

// ─── Prompt builder ─────────────────────────────────────────────────────────

function buildPrompt(input: CategorizeInput): string {
  const categoriesList = input.existingCategories
    .map((c) => `${c.code}: ${c.name} (${c.type})`)
    .join('\n');

  let correctionsBlock = '';
  if (input.recentCorrections && input.recentCorrections.length > 0) {
    const lines = input.recentCorrections
      .map((c) => `"${c.description}" was "${c.original}" → corrected to "${c.corrected}"`)
      .join('\n');
    correctionsBlock = `\nRecent corrections for similar transactions (learn from these):\n${lines}\n`;
  }

  return `You are a transaction categorizer for Philippine SMB bookkeeping. Assign the most appropriate chart of accounts category.

Transaction:
- Description: ${input.description}
- Amount: ₱${input.amount}
- Type: ${input.type}
- Client industry: ${input.clientIndustry}

Available categories:
${categoriesList}
${correctionsBlock}
Respond in JSON:
{
  "categoryCode": "string",
  "confidence": 0.0-1.0,
  "reasoning": "brief"
}`;
}

// ─── Claude API call ────────────────────────────────────────────────────────

async function callClaude(prompt: string, apiKey: string): Promise<CategorizeResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'zero-data-retention',
      },
      body: JSON.stringify({
        model: MODEL_HAIKU,
        max_tokens: 256,
        messages: [{ role: 'user', content: prompt }],
      }),
      signal: controller.signal,
    });
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') {
      throw new Error('TIMEOUT');
    }
    throw new Error('UNREACHABLE');
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    throw new Error('API_ERROR');
  }

  const result = await response.json();
  const textBlock = result.content?.find((b: { type: string }) => b.type === 'text');
  if (!textBlock?.text) {
    throw new Error('PARSE_ERROR');
  }

  const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('PARSE_ERROR');
  }

  const parsed = JSON.parse(jsonMatch[0]);

  if (
    typeof parsed.categoryCode !== 'string' ||
    typeof parsed.confidence !== 'number' ||
    parsed.confidence < 0 ||
    parsed.confidence > 1 ||
    typeof parsed.reasoning !== 'string'
  ) {
    throw new Error('PARSE_ERROR');
  }

  return {
    categoryCode: parsed.categoryCode,
    confidence: parsed.confidence,
    reasoning: parsed.reasoning,
  };
}

// ─── Edge Function ──────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // --- Verify service role key (internal function only) ---
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return jsonResponse({ error: { code: 'UNAUTHORIZED', message: 'Missing authorization' } }, 401);
    }

    // --- Parse body ---
    const body: CategorizeInput | null = await req.json().catch(() => null);
    if (!body) {
      return jsonResponse({ error: { code: 'VALIDATION_FAILED', message: 'Invalid JSON body' } }, 400);
    }

    const { description, amount, type, clientIndustry, existingCategories, recentCorrections } = body;

    if (
      !description || typeof description !== 'string' ||
      !amount || typeof amount !== 'string' ||
      !type || (type !== 'credit' && type !== 'debit') ||
      !clientIndustry || typeof clientIndustry !== 'string' ||
      !Array.isArray(existingCategories) || existingCategories.length === 0
    ) {
      return jsonResponse(
        { error: { code: 'VALIDATION_FAILED', message: 'Missing or invalid required fields' } },
        400,
      );
    }

    // --- Read confidence threshold from system_settings ---
    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    let confidenceThreshold = DEFAULT_CONFIDENCE_THRESHOLD;
    const { data: setting } = await serviceClient
      .from('system_settings')
      .select('value')
      .eq('key', 'category_confidence_threshold')
      .single();

    if (setting?.value != null) {
      const parsed = Number(setting.value);
      if (!isNaN(parsed) && parsed >= 0 && parsed <= 1) {
        confidenceThreshold = parsed;
      }
    }

    // --- Call Claude ---
    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!anthropicKey) {
      return jsonResponse(
        { error: { code: 'INTERNAL_ERROR', message: 'AI service not configured' } },
        500,
      );
    }

    const prompt = buildPrompt({
      description,
      amount,
      type,
      clientIndustry,
      existingCategories,
      recentCorrections,
    });

    let result: CategorizeResult;
    try {
      result = await callClaude(prompt, anthropicKey);
    } catch (e) {
      const msg = e instanceof Error ? e.message : '';
      if (msg === 'TIMEOUT' || msg === 'UNREACHABLE') {
        return jsonResponse(
          { error: { code: 'DEPENDENCY_UNAVAILABLE', message: 'AI service unavailable' } },
          503,
        );
      }
      return jsonResponse(
        { error: { code: 'INTERNAL_ERROR', message: 'AI categorization failed' } },
        500,
      );
    }

    // --- Apply confidence threshold ---
    return jsonResponse({
      success: true,
      data: {
        categoryCode: result.confidence >= confidenceThreshold ? result.categoryCode : null,
        confidence: result.confidence,
        reasoning: result.reasoning,
        confidenceThreshold,
      },
    });
  } catch (err) {
    console.error('categorize-transaction unhandled error:', err);
    return jsonResponse(
      { error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } },
      500,
    );
  }
});
