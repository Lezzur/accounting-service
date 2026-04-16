import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { z } from 'https://esm.sh/zod@3';
import { corsHeaders } from '../_shared/cors.ts';
import { successResponse, errorResponse } from '../_shared/response.ts';

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL_HAIKU = 'claude-haiku-4-5-20251001';
const TIMEOUT_MS = 10_000;
const DEFAULT_CONFIDENCE_THRESHOLD = 0.85;
const MAX_CORRECTIONS = 10;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ─── Zod validation ─────────────────────────────────────────────────────────

const uuidSchema = z.string().regex(UUID_RE, 'Must be a valid UUID');

const byTransactionSchema = z.object({
  transactionId: uuidSchema,
  description: z.undefined(),
  amount: z.undefined(),
  type: z.undefined(),
  clientId: z.undefined(),
});

const byRawDataSchema = z.object({
  transactionId: z.undefined(),
  description: z.string().min(1).max(255),
  amount: z.string().regex(/^\d{1,13}\.\d{2}$/, 'Must be a decimal with 2 places'),
  type: z.enum(['credit', 'debit']),
  clientId: uuidSchema,
});

const requestSchema = z.union([byTransactionSchema, byRawDataSchema]);

// ─── Prompt builder ─────────────────────────────────────────────────────────

interface CategoryOption {
  code: string;
  name: string;
  type: string;
}

interface CorrectionExample {
  original: string;
  corrected: string;
  description: string;
}

function buildPrompt(
  description: string,
  amount: string,
  type: string,
  clientIndustry: string,
  categories: CategoryOption[],
  corrections: CorrectionExample[],
): string {
  const categoriesList = categories
    .map((c) => `${c.code}: ${c.name} (${c.type})`)
    .join('\n');

  let correctionsBlock = '';
  if (corrections.length > 0) {
    const lines = corrections
      .map((c) => `"${c.description}" was "${c.original}" → corrected to "${c.corrected}"`)
      .join('\n');
    correctionsBlock = `\nRecent corrections for similar transactions (learn from these):\n${lines}\n`;
  }

  return `You are a transaction categorizer for Philippine SMB bookkeeping. Assign the most appropriate chart of accounts category. Also provide up to 3 alternative categories ranked by likelihood.

Transaction:
- Description: ${description}
- Amount: ₱${amount}
- Type: ${type}
- Client industry: ${clientIndustry}

Available categories:
${categoriesList}
${correctionsBlock}
Respond in JSON:
{
  "categoryCode": "string",
  "confidence": 0.0-1.0,
  "reasoning": "brief explanation",
  "alternatives": [
    { "categoryCode": "string", "confidence": 0.0-1.0 }
  ]
}`;
}

// ─── Claude API call ────────────────────────────────────────────────────────

interface SuggestResult {
  categoryCode: string;
  confidence: number;
  reasoning: string;
  alternatives: Array<{ categoryCode: string; confidence: number }>;
}

async function callClaude(prompt: string, apiKey: string): Promise<SuggestResult> {
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
        max_tokens: 512,
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

  const alternatives = Array.isArray(parsed.alternatives)
    ? parsed.alternatives
        .filter(
          (a: unknown) =>
            typeof a === 'object' &&
            a !== null &&
            typeof (a as Record<string, unknown>).categoryCode === 'string' &&
            typeof (a as Record<string, unknown>).confidence === 'number',
        )
        .slice(0, 3)
        .map((a: { categoryCode: string; confidence: number }) => ({
          categoryCode: a.categoryCode,
          confidence: a.confidence,
        }))
    : [];

  return {
    categoryCode: parsed.categoryCode,
    confidence: parsed.confidence,
    reasoning: parsed.reasoning,
    alternatives,
  };
}

// ─── Edge Function ──────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const startTime = Date.now();
  const requestId = `req_${crypto.randomUUID().slice(0, 12)}`;

  try {
    // --- Auth ---
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return errorResponse(401, 'UNAUTHORIZED', 'Missing authorization header', requestId);
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return errorResponse(401, 'UNAUTHORIZED', 'Invalid or expired token', requestId);
    }

    // --- Parse & validate body ---
    const body = await req.json().catch(() => null);
    if (!body) {
      return errorResponse(400, 'VALIDATION_FAILED', 'Invalid JSON body', requestId);
    }

    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(
        400,
        'VALIDATION_FAILED',
        'Provide either transactionId or (description + amount + type + clientId)',
        requestId,
        parsed.error.issues.map((i) => ({ field: i.path.join('.'), issue: i.message })),
      );
    }

    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    // --- Resolve transaction data and client ---
    let description: string;
    let amount: string;
    let type: 'credit' | 'debit';
    let clientId: string;

    if (parsed.data.transactionId) {
      // Mode A: fetch existing transaction
      const { data: txn, error: txnError } = await serviceClient
        .from('transactions')
        .select('description, amount, type, client_id')
        .eq('id', parsed.data.transactionId)
        .single();

      if (txnError || !txn) {
        return errorResponse(404, 'NOT_FOUND', 'Transaction not found', requestId);
      }

      description = txn.description;
      amount = txn.amount;
      type = txn.type as 'credit' | 'debit';
      clientId = txn.client_id;
    } else {
      // Mode B: raw data
      description = parsed.data.description;
      amount = parsed.data.amount;
      type = parsed.data.type;
      clientId = parsed.data.clientId;
    }

    // --- Fetch client (validate exists + get industry) ---
    const { data: client, error: clientError } = await serviceClient
      .from('clients')
      .select('industry')
      .eq('id', clientId)
      .single();

    if (clientError || !client) {
      return errorResponse(404, 'NOT_FOUND', 'Client not found', requestId);
    }

    // --- Fetch active categories and recent corrections in parallel ---
    const [categoriesResult, correctionsResult, settingResult] = await Promise.all([
      serviceClient
        .from('chart_of_accounts')
        .select('code, name, type')
        .eq('is_active', true)
        .order('code', { ascending: true }),
      serviceClient
        .from('ai_corrections')
        .select('original_value, corrected_value, transaction_id')
        .eq('field_name', 'category_code')
        .order('created_at', { ascending: false })
        .limit(MAX_CORRECTIONS * 5), // fetch extra to filter by client
      serviceClient
        .from('system_settings')
        .select('value')
        .eq('key', 'category_confidence_threshold')
        .single(),
    ]);

    const categories = (categoriesResult.data ?? []).map((c) => ({
      code: c.code,
      name: c.name,
      type: c.type,
    }));

    if (categories.length === 0) {
      return errorResponse(500, 'INTERNAL_ERROR', 'No chart of accounts categories configured', requestId);
    }

    // Filter corrections to those belonging to transactions of this client
    let corrections: CorrectionExample[] = [];
    if (correctionsResult.data && correctionsResult.data.length > 0) {
      const correctionTxnIds = correctionsResult.data.map((c) => c.transaction_id);
      const { data: correctionTxns } = await serviceClient
        .from('transactions')
        .select('id, description')
        .eq('client_id', clientId)
        .in('id', correctionTxnIds);

      if (correctionTxns && correctionTxns.length > 0) {
        const txnMap = new Map(correctionTxns.map((t) => [t.id, t.description]));
        corrections = correctionsResult.data
          .filter((c) => txnMap.has(c.transaction_id))
          .slice(0, MAX_CORRECTIONS)
          .map((c) => ({
            original: c.original_value,
            corrected: c.corrected_value,
            description: txnMap.get(c.transaction_id)!,
          }));
      }
    }

    // --- Read confidence threshold ---
    let confidenceThreshold = DEFAULT_CONFIDENCE_THRESHOLD;
    if (settingResult.data?.value != null) {
      const thresholdNum = Number(settingResult.data.value);
      if (!isNaN(thresholdNum) && thresholdNum >= 0 && thresholdNum <= 1) {
        confidenceThreshold = thresholdNum;
      }
    }

    // --- Call Claude ---
    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!anthropicKey) {
      return errorResponse(500, 'INTERNAL_ERROR', 'AI service not configured', requestId);
    }

    const prompt = buildPrompt(description, amount, type, client.industry, categories, corrections);

    let result: SuggestResult;
    try {
      result = await callClaude(prompt, anthropicKey);
    } catch (e) {
      const msg = e instanceof Error ? e.message : '';
      if (msg === 'TIMEOUT' || msg === 'UNREACHABLE') {
        return errorResponse(503, 'DEPENDENCY_UNAVAILABLE', 'AI service unavailable', requestId);
      }
      return errorResponse(500, 'INTERNAL_ERROR', 'AI categorization failed', requestId);
    }

    // --- Resolve category names ---
    const categoryMap = new Map(categories.map((c) => [c.code, c.name]));

    const suggestedCategoryName = categoryMap.get(result.categoryCode) ?? null;
    const alternatives = result.alternatives
      .filter((a) => a.categoryCode !== result.categoryCode)
      .map((a) => ({
        categoryCode: a.categoryCode,
        categoryName: categoryMap.get(a.categoryCode) ?? null,
        confidence: a.confidence,
      }));

    return successResponse(
      {
        suggestedCategoryCode: result.confidence >= confidenceThreshold ? result.categoryCode : null,
        suggestedCategoryName: result.confidence >= confidenceThreshold ? suggestedCategoryName : null,
        confidence: result.confidence,
        reasoning: result.reasoning,
        alternatives,
      },
      { request_id: requestId, duration_ms: Date.now() - startTime },
    );
  } catch (err) {
    console.error('suggest-category unhandled error:', err);
    return errorResponse(500, 'INTERNAL_ERROR', 'An unexpected error occurred', requestId);
  }
});
