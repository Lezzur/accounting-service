import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { successResponse, errorResponse } from '../_shared/response.ts';

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL_SONNET = 'claude-sonnet-4-6';
const TIMEOUT_MS = 15_000;

const VALID_TEMPLATE_TYPES = [
  'document_request',
  'deadline_reminder',
  'report_delivery',
  'custom',
] as const;

type TemplateType = (typeof VALID_TEMPLATE_TYPES)[number];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ─── Prompt builder ─────────────────────────────────────────────────────────

interface ClientProfile {
  business_name: string;
  contact_name: string;
  contact_email: string;
  industry: string;
}

interface InteractionContext {
  recentDocuments: string[];
  pendingDeadlines: Array<{ type: string; dueDate: string; period: string }>;
  lastContactDate: string | null;
}

function buildPrompt(
  client: ClientProfile,
  interaction: InteractionContext,
  templateType: TemplateType,
  customIntent?: string,
): string {
  let contextBlock = '';

  if (interaction.recentDocuments.length > 0) {
    contextBlock += `\nRecent documents received:\n${interaction.recentDocuments.map((d) => `- ${d}`).join('\n')}`;
  }

  if (interaction.pendingDeadlines.length > 0) {
    contextBlock += `\nPending deadlines:\n${interaction.pendingDeadlines.map((d) => `- ${d.type} (${d.period}): due ${d.dueDate}`).join('\n')}`;
  }

  if (interaction.lastContactDate) {
    contextBlock += `\nLast contact: ${interaction.lastContactDate}`;
  }

  const intentLine =
    templateType === 'custom' && customIntent ? `\nCustom intent: ${customIntent}` : '';

  return `You are drafting a professional follow-up email for a Philippine accounting firm. The tone should be warm, professional, and respectful.

Template type: ${templateType}
Client: ${client.business_name} (${client.industry})
Contact: ${client.contact_name} (${client.contact_email})
${contextBlock}${intentLine}

Draft a short, professional email. Use Filipino-English business tone. Include a greeting and sign-off. Do not include any placeholder brackets — use the actual client name.

Respond in JSON:
{
  "subject": "email subject line",
  "body": "full email body"
}`;
}

// ─── Claude API call ────────────────────────────────────────────────────────

async function callClaude(prompt: string, apiKey: string): Promise<{ subject: string; body: string }> {
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
        model: MODEL_SONNET,
        max_tokens: 1024,
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
  if (typeof parsed.subject !== 'string' || typeof parsed.body !== 'string') {
    throw new Error('PARSE_ERROR');
  }

  return { subject: parsed.subject, body: parsed.body };
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

    const { clientId, templateType, customIntent } = body;

    const errors: Array<{ field: string; issue: string }> = [];

    if (!clientId || typeof clientId !== 'string' || !UUID_RE.test(clientId)) {
      errors.push({ field: 'clientId', issue: 'Must be a valid UUID' });
    }

    if (!templateType || !VALID_TEMPLATE_TYPES.includes(templateType)) {
      errors.push({
        field: 'templateType',
        issue: `Must be one of: ${VALID_TEMPLATE_TYPES.join(', ')}`,
      });
    }

    if (templateType === 'custom') {
      if (!customIntent || typeof customIntent !== 'string') {
        errors.push({ field: 'customIntent', issue: 'Required when templateType is custom' });
      } else if (customIntent.length > 500) {
        errors.push({ field: 'customIntent', issue: 'Must be 500 characters or fewer' });
      }
    }

    if (errors.length > 0) {
      return errorResponse(400, 'VALIDATION_FAILED', 'Request validation failed', requestId, errors);
    }

    // --- Load client profile ---
    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    const { data: client, error: clientError } = await serviceClient
      .from('clients')
      .select('business_name, contact_name, contact_email, industry')
      .eq('id', clientId)
      .single();

    if (clientError || !client) {
      return errorResponse(404, 'NOT_FOUND', 'Client not found', requestId);
    }

    // --- Load recent context (non-blocking — partial failure is ok) ---

    const [deadlinesResult, emailsResult] = await Promise.all([
      serviceClient
        .from('deadlines')
        .select('deadline_type, due_date, period')
        .eq('client_id', clientId)
        .eq('status', 'pending')
        .order('due_date', { ascending: true })
        .limit(5),
      serviceClient
        .from('email_notifications')
        .select('subject, received_at')
        .eq('client_id', clientId)
        .order('received_at', { ascending: false })
        .limit(5),
    ]);

    const pendingDeadlines = (deadlinesResult.data ?? []).map((d) => ({
      type: d.deadline_type,
      dueDate: d.due_date,
      period: d.period,
    }));

    const recentDocuments = (emailsResult.data ?? []).map((e) => e.subject);

    const lastContactDate = emailsResult.data?.[0]?.received_at ?? null;

    // --- Build prompt & call Claude ---
    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!anthropicKey) {
      return errorResponse(500, 'INTERNAL_ERROR', 'AI service not configured', requestId);
    }

    const prompt = buildPrompt(
      client as ClientProfile,
      { recentDocuments, pendingDeadlines, lastContactDate },
      templateType as TemplateType,
      customIntent,
    );

    let draft: { subject: string; body: string };
    try {
      draft = await callClaude(prompt, anthropicKey);
    } catch (e) {
      const msg = e instanceof Error ? e.message : '';
      if (msg === 'TIMEOUT' || msg === 'UNREACHABLE') {
        return errorResponse(503, 'DEPENDENCY_UNAVAILABLE', 'AI service unavailable', requestId);
      }
      return errorResponse(500, 'INTERNAL_ERROR', 'AI generation failed', requestId);
    }

    return successResponse(
      {
        subject: draft.subject,
        body: draft.body,
        templateType,
        clientName: client.business_name,
      },
      { request_id: requestId, duration_ms: Date.now() - startTime },
    );
  } catch (err) {
    console.error('Unhandled error:', err);
    return errorResponse(500, 'INTERNAL_ERROR', 'An unexpected error occurred', requestId);
  }
});
