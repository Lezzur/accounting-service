import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { z } from 'https://esm.sh/zod@3';
import { corsHeaders } from '../_shared/cors.ts';
import { successResponse, errorResponse } from '../_shared/response.ts';
import { decryptTokenWithKeyRotation } from '../_shared/encryption.ts';

const GMAIL_SEND_URL = 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send';
const TIMEOUT_MS = 15_000;

// ─── Validation schema ────────────────────────────────────────────────────────

const sendEmailSchema = z.object({
  to: z.string().email('Must be a valid email address'),
  subject: z.string().min(1, 'Subject is required').max(255, 'Subject must be 255 characters or fewer'),
  body: z.string().min(1, 'Body is required').max(5000, 'Body must be 5000 characters or fewer'),
  clientId: z.string().uuid('Must be a valid UUID'),
});

// ─── Gmail helpers ────────────────────────────────────────────────────────────

/**
 * Encode a plain-text email as RFC 2822 base64url for the Gmail API.
 */
function buildRfc2822(from: string, to: string, subject: string, body: string): string {
  const message = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    'Content-Type: text/plain; charset=UTF-8',
    'MIME-Version: 1.0',
    '',
    body,
  ].join('\r\n');

  // base64url encode (Deno TextEncoder → btoa → url-safe)
  const bytes = new TextEncoder().encode(message);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function sendGmailMessage(
  accessToken: string,
  from: string,
  to: string,
  subject: string,
  body: string,
): Promise<{ id: string; threadId: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(GMAIL_SEND_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        raw: buildRfc2822(from, to, subject, body),
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

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    console.error('Gmail send failed:', res.status, text);
    throw new Error('GMAIL_ERROR');
  }

  return res.json();
}

// ─── Edge Function ────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    const requestId = `req_${crypto.randomUUID().slice(0, 12)}`;
    return errorResponse(405, 'METHOD_NOT_ALLOWED', 'POST required', requestId);
  }

  const startTime = Date.now();
  const requestId = `req_${crypto.randomUUID().slice(0, 12)}`;

  try {
    // --- Auth ---
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return errorResponse(401, 'UNAUTHORIZED', 'Missing authorization token', requestId);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return errorResponse(401, 'UNAUTHORIZED', 'Invalid or expired token', requestId);
    }

    // --- Parse & validate ---
    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      return errorResponse(400, 'VALIDATION_FAILED', 'Invalid JSON body', requestId);
    }

    const parsed = sendEmailSchema.safeParse(rawBody);
    if (!parsed.success) {
      const details = parsed.error.issues.map((i) => ({
        field: i.path.join('.'),
        issue: i.message,
      }));
      return errorResponse(400, 'VALIDATION_FAILED', 'Request validation failed', requestId, details);
    }

    const { to, subject, body: emailBody, clientId } = parsed.data;

    const serviceClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // --- Verify client exists ---
    const { data: client, error: clientError } = await serviceClient
      .from('clients')
      .select('id')
      .eq('id', clientId)
      .single();

    if (clientError || !client) {
      return errorResponse(404, 'NOT_FOUND', 'Client not found', requestId);
    }

    // --- Fetch active Gmail connection ---
    const { data: connection, error: connError } = await serviceClient
      .from('gmail_connections')
      .select('access_token_encrypted, gmail_email, status')
      .eq('status', 'active')
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();

    if (connError || !connection) {
      return errorResponse(503, 'DEPENDENCY_UNAVAILABLE', 'No active Gmail connection found', requestId);
    }

    if (connection.status !== 'active') {
      return errorResponse(503, 'DEPENDENCY_UNAVAILABLE', 'Gmail connection is not active', requestId);
    }

    // --- Decrypt access token ---
    let accessToken: string;
    try {
      accessToken = await decryptTokenWithKeyRotation(connection.access_token_encrypted);
    } catch {
      return errorResponse(503, 'DEPENDENCY_UNAVAILABLE', 'Failed to decrypt Gmail credentials', requestId);
    }

    // --- Send email via Gmail API ---
    let gmailResult: { id: string; threadId: string };
    try {
      gmailResult = await sendGmailMessage(
        accessToken,
        connection.gmail_email,
        to,
        subject,
        emailBody,
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : '';
      if (msg === 'TIMEOUT' || msg === 'UNREACHABLE') {
        return errorResponse(503, 'DEPENDENCY_UNAVAILABLE', 'Gmail API unreachable', requestId);
      }
      if (msg === 'GMAIL_ERROR') {
        return errorResponse(503, 'DEPENDENCY_UNAVAILABLE', 'Gmail API returned an error', requestId);
      }
      throw e;
    }

    const sentAt = new Date().toISOString();

    // --- Audit log ---
    await serviceClient.from('client_activity_log').insert({
      client_id: clientId,
      action: 'email_sent',
      details: {
        subject,
        recipient: to,
        template_type: 'custom',
        gmail_message_id: gmailResult.id,
        sent_at: sentAt,
      },
    });

    return successResponse(
      {
        gmailMessageId: gmailResult.id,
        sentTo: to,
        sentAt,
      },
      { request_id: requestId, duration_ms: Date.now() - startTime },
    );
  } catch (err) {
    console.error('Unhandled error in send-email:', err);
    return errorResponse(500, 'INTERNAL_ERROR', 'An unexpected error occurred', requestId);
  }
});
