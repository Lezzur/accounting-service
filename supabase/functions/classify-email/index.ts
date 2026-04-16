// classify-email Edge Function
// Internal function called by gmail-webhook — not client-callable.
// Classifies an email as a financial document using Claude Haiku,
// then inserts into email_notifications.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL_HAIKU = 'claude-haiku-4-5-20251001';
const TIMEOUT_MS = 30_000;
const DEFAULT_CONFIDENCE_THRESHOLD = 0.70;

// ─── Types ──────────────────────────────────────────────────────────────────

interface ClassifyEmailInput {
  gmailMessageId: string;
  gmailThreadId: string | null;
  senderEmail: string;
  senderName: string;
  subject: string;
  snippet: string;
  hasAttachments: boolean;
  attachmentNames: string[];
  matchedClientId: string | null;
  receivedAt: string;
}

interface ClassificationResult {
  isDocument: boolean;
  documentType: string | null;
  confidence: number;
  reasoning: string;
}

// ─── Prompt ─────────────────────────────────────────────────────────────────

function buildPrompt(input: ClassifyEmailInput): string {
  return `You are an email classifier for an accounting firm. Determine if this email contains a financial document (receipt, bank statement, invoice, credit card statement, expense report, or payroll data).

Sender: ${input.senderEmail} (${input.senderName})
Subject: ${input.subject}
Preview: ${input.snippet}
Attachments: ${input.attachmentNames.length > 0 ? input.attachmentNames.join(', ') : 'None'}
Known client: ${input.matchedClientId ? 'yes' : 'no'}

Respond in JSON:
{
  "isDocument": boolean,
  "documentType": "receipt" | "bank_statement" | "invoice" | "credit_card_statement" | "expense_report" | "payroll_data" | "other" | null,
  "confidence": 0.0-1.0,
  "reasoning": "brief explanation"
}`;
}

// ─── Claude API call ────────────────────────────────────────────────────────

async function callClassifier(
  prompt: string,
  apiKey: string,
): Promise<ClassificationResult> {
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

  if (response.status === 429) {
    throw new Error('RATE_LIMIT');
  }

  if (!response.ok) {
    throw new Error('API_ERROR');
  }

  const result = await response.json();
  const textBlock = result.content?.find(
    (b: { type: string }) => b.type === 'text',
  );
  if (!textBlock?.text) {
    throw new Error('PARSE_ERROR');
  }

  const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('PARSE_ERROR');
  }

  const parsed = JSON.parse(jsonMatch[0]);
  if (typeof parsed.isDocument !== 'boolean' || typeof parsed.confidence !== 'number') {
    throw new Error('PARSE_ERROR');
  }

  return {
    isDocument: parsed.isDocument,
    documentType: parsed.documentType ?? null,
    confidence: Math.max(0, Math.min(1, parsed.confidence)),
    reasoning: parsed.reasoning ?? '',
  };
}

// Retry wrapper for rate-limit errors (exponential backoff: 2s, 4s, 8s)
async function callClassifierWithRetry(
  prompt: string,
  apiKey: string,
): Promise<ClassificationResult> {
  const delays = [2000, 4000, 8000];
  let lastError: unknown;

  for (let attempt = 0; attempt <= delays.length; attempt++) {
    try {
      return await callClassifier(prompt, apiKey);
    } catch (err) {
      lastError = err;
      const msg = err instanceof Error ? err.message : '';
      if (msg === 'RATE_LIMIT' && attempt < delays.length) {
        await new Promise((r) => setTimeout(r, delays[attempt]!));
        continue;
      }
      throw err;
    }
  }

  throw lastError;
}

// ─── Confidence threshold loader ────────────────────────────────────────────

async function getConfidenceThreshold(
  serviceClient: ReturnType<typeof createClient>,
): Promise<number> {
  const { data } = await serviceClient
    .from('system_settings')
    .select('value')
    .eq('key', 'email_classification_confidence_threshold')
    .single();

  if (data?.value != null) {
    const parsed = typeof data.value === 'number' ? data.value : parseFloat(String(data.value));
    if (!isNaN(parsed) && parsed >= 0 && parsed <= 1) return parsed;
  }

  return DEFAULT_CONFIDENCE_THRESHOLD;
}

// ─── Edge Function ──────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  // Internal function — only called by other Edge Functions via service role.
  // No CORS handling needed.

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'POST required' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const requestId = `req_${crypto.randomUUID().slice(0, 12)}`;

  try {
    const input: ClassifyEmailInput = await req.json();

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');

    const serviceClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Load confidence threshold from system_settings
    const threshold = await getConfidenceThreshold(serviceClient);

    // Classify the email
    let classification: ClassificationResult;
    let failedOpen = false;

    if (anthropicKey) {
      try {
        const prompt = buildPrompt(input);
        classification = await callClassifierWithRetry(prompt, anthropicKey);
      } catch (err) {
        // Fail-open: create notification with null classification so accountant reviews
        console.error(`[classify-email] Classification failed for ${input.gmailMessageId}:`, err);
        classification = {
          isDocument: false,
          documentType: null,
          confidence: 0,
          reasoning: err instanceof Error ? `Classification failed: ${err.message}` : 'Classification failed',
        };
        failedOpen = true;
      }
    } else {
      // No API key configured — fail-open
      console.error('[classify-email] ANTHROPIC_API_KEY not set, failing open');
      classification = {
        isDocument: false,
        documentType: null,
        confidence: 0,
        reasoning: 'AI service not configured',
      };
      failedOpen = true;
    }

    // Determine notification status:
    // - Classification failure → fail-open: status=unprocessed (let accountant decide)
    // - isDocument=true AND confidence >= threshold → status=unprocessed (surface in Workdesk)
    // - isDocument=false OR confidence < threshold → status=dismissed, auto_dismissed=true
    let status: string;
    let autoDismissed: boolean;

    if (failedOpen) {
      status = 'unprocessed';
      autoDismissed = false;
    } else if (classification.isDocument && classification.confidence >= threshold) {
      status = 'unprocessed';
      autoDismissed = false;
    } else {
      status = 'dismissed';
      autoDismissed = true;
    }

    // Insert into email_notifications
    const { error: insertError } = await serviceClient
      .from('email_notifications')
      .insert({
        gmail_message_id: input.gmailMessageId,
        gmail_thread_id: input.gmailThreadId,
        client_id: input.matchedClientId,
        sender_email: input.senderEmail,
        sender_name: input.senderName,
        subject: input.subject,
        snippet: input.snippet,
        received_at: input.receivedAt,
        document_type_guess: classification.documentType,
        classification_confidence: classification.confidence,
        is_document: classification.isDocument,
        status,
        auto_dismissed: autoDismissed,
      });

    if (insertError) {
      // UNIQUE constraint on gmail_message_id → duplicate delivery, silently skip
      if (insertError.code === '23505') {
        console.log(`[classify-email] Duplicate gmail_message_id ${input.gmailMessageId}, skipping`);
        return new Response(JSON.stringify({ success: true, duplicate: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      console.error('[classify-email] Insert error:', insertError);
      return new Response(
        JSON.stringify({ error: { code: 'INSERT_FAILED', message: insertError.message, request_id: requestId } }),
        { status: 500, headers: { 'Content-Type': 'application/json' } },
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          gmailMessageId: input.gmailMessageId,
          status,
          isDocument: classification.isDocument,
          documentType: classification.documentType,
          confidence: classification.confidence,
          autoDismissed,
        },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('[classify-email] Unhandled error:', err);
    return new Response(
      JSON.stringify({ error: { code: 'INTERNAL_ERROR', message: 'Unexpected error', request_id: requestId } }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
});
