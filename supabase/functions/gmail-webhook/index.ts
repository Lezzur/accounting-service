// gmail-webhook Edge Function
// Receives Gmail push notifications via Google Pub/Sub and triggers
// the email classification pipeline.
// ALWAYS returns 200 OK — Gmail Pub/Sub retries on non-2xx responses.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { decryptTokenWithKeyRotation } from '../_shared/encryption.ts';

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GMAIL_HISTORY_URL = 'https://gmail.googleapis.com/gmail/v1/users/me/history';
const GMAIL_MESSAGE_URL = 'https://gmail.googleapis.com/gmail/v1/users/me/messages';
const CLASSIFY_EMAIL_URL_SUFFIX = '/functions/v1/classify-email';

const TIMEOUT_MS = 25_000; // Leave headroom within 30s function timeout

// ─── Helpers ────────────────────────────────────────────────────────────────

function ok(): Response {
  return new Response(JSON.stringify({}), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs = TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// ─── Token refresh ──────────────────────────────────────────────────────────

async function refreshAccessToken(refreshToken: string): Promise<string> {
  const clientId = Deno.env.get('GOOGLE_CLIENT_ID')!;
  const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET')!;

  const res = await fetchWithTimeout(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Token refresh failed (${res.status}): ${body}`);
  }

  const data = await res.json();
  return data.access_token;
}

// ─── Gmail API helpers ──────────────────────────────────────────────────────

interface HistoryMessage {
  id: string;
  threadId: string;
}

interface HistoryRecord {
  id: string;
  messagesAdded?: Array<{ message: HistoryMessage }>;
}

async function fetchHistory(
  accessToken: string,
  startHistoryId: string,
): Promise<{ history: HistoryRecord[]; historyId: string }> {
  const url = new URL(GMAIL_HISTORY_URL);
  url.searchParams.set('startHistoryId', startHistoryId);
  url.searchParams.set('historyTypes', 'messageAdded');
  url.searchParams.set('labelId', 'INBOX');

  const res = await fetchWithTimeout(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`history.list failed (${res.status}): ${body}`);
  }

  const data = await res.json();
  return {
    history: data.history ?? [],
    historyId: data.historyId ?? startHistoryId,
  };
}

interface GmailMessagePart {
  mimeType?: string;
  filename?: string;
  body?: { size?: number };
  parts?: GmailMessagePart[];
}

interface GmailMessagePayload {
  headers?: Array<{ name: string; value: string }>;
  parts?: GmailMessagePart[];
  mimeType?: string;
  filename?: string;
  body?: { size?: number };
}

interface GmailMessage {
  id: string;
  threadId: string;
  internalDate: string;
  snippet: string;
  payload: GmailMessagePayload;
}

async function fetchMessage(
  accessToken: string,
  messageId: string,
): Promise<GmailMessage> {
  const url = `${GMAIL_MESSAGE_URL}/${messageId}?format=metadata&metadataHeaders=From&metadataHeaders=Subject`;

  const res = await fetchWithTimeout(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    throw new Error(`messages.get failed (${res.status})`);
  }

  return res.json();
}

function getHeader(
  payload: GmailMessagePayload,
  name: string,
): string | undefined {
  return payload.headers?.find(
    (h) => h.name.toLowerCase() === name.toLowerCase(),
  )?.value;
}

function parseFromHeader(from: string): { email: string; name: string } {
  // "Display Name <email@example.com>" or just "email@example.com"
  const match = from.match(/^(?:"?([^"<]*)"?\s*)?<?([^>]+@[^>]+)>?$/);
  if (match) {
    return { name: (match[1] ?? '').trim(), email: match[2]!.trim().toLowerCase() };
  }
  return { name: '', email: from.trim().toLowerCase() };
}

function collectAttachmentNames(payload: GmailMessagePayload): string[] {
  const names: string[] = [];

  function walk(part: GmailMessagePart): void {
    if (part.filename && part.filename.length > 0 && (part.body?.size ?? 0) > 0) {
      names.push(part.filename);
    }
    if (part.parts) {
      for (const child of part.parts) walk(child);
    }
  }

  // Check top-level and nested parts
  if (payload.filename && payload.filename.length > 0) {
    names.push(payload.filename);
  }
  if (payload.parts) {
    for (const part of payload.parts) walk(part);
  }

  return names;
}

// ─── Edge Function ──────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  // Always return 200 — Gmail Pub/Sub retries on non-2xx
  if (req.method !== 'POST') {
    return ok();
  }

  try {
    // --- Parse Pub/Sub envelope ---
    const body = await req.json();
    const message = body?.message;
    if (!message?.data) {
      console.warn('[gmail-webhook] Missing message.data in request body');
      return ok();
    }

    // --- Verify subscription matches expected project ---
    const expectedSubscription = Deno.env.get('GMAIL_PUBSUB_SUBSCRIPTION');
    if (expectedSubscription && body.subscription) {
      if (body.subscription !== expectedSubscription) {
        console.warn(
          `[gmail-webhook] Unexpected subscription: ${body.subscription} (expected ${expectedSubscription})`,
        );
        return ok();
      }
    }

    // --- Decode base64 payload ---
    let decoded: { emailAddress?: string; historyId?: number | string };
    try {
      const jsonStr = atob(message.data);
      decoded = JSON.parse(jsonStr);
    } catch {
      console.warn('[gmail-webhook] Failed to decode message.data');
      return ok();
    }

    const emailAddress = decoded.emailAddress;
    const incomingHistoryId = decoded.historyId?.toString();

    if (!emailAddress || !incomingHistoryId) {
      console.warn('[gmail-webhook] Missing emailAddress or historyId in decoded data');
      return ok();
    }

    console.log(`[gmail-webhook] Notification for ${emailAddress}, historyId=${incomingHistoryId}`);

    // --- Look up gmail_connections ---
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const serviceClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: connection, error: connError } = await serviceClient
      .from('gmail_connections')
      .select('id, user_id, access_token_encrypted, refresh_token_encrypted, token_expires_at, watch_history_id, status')
      .eq('gmail_email', emailAddress)
      .single();

    if (connError || !connection) {
      console.log(`[gmail-webhook] No connection found for ${emailAddress}`);
      return ok();
    }

    // Only process active connections
    if (connection.status !== 'active') {
      console.log(`[gmail-webhook] Connection for ${emailAddress} is ${connection.status}, skipping`);
      return ok();
    }

    // --- Idempotency: only process newer history ---
    const lastHistoryId = connection.watch_history_id;
    if (lastHistoryId && BigInt(incomingHistoryId) <= BigInt(lastHistoryId)) {
      console.log(`[gmail-webhook] historyId ${incomingHistoryId} <= ${lastHistoryId}, no-op`);
      return ok();
    }

    // --- Decrypt tokens at runtime (never cache) ---
    let accessToken: string;
    let refreshToken: string;
    try {
      refreshToken = await decryptTokenWithKeyRotation(connection.refresh_token_encrypted);
    } catch (err) {
      console.error(`[gmail-webhook] Failed to decrypt refresh token for ${emailAddress}:`, err);
      await serviceClient
        .from('gmail_connections')
        .update({ status: 'error', last_error: 'Token decryption failed' })
        .eq('id', connection.id);
      return ok();
    }

    // Check if access token is expired and refresh if needed
    const tokenExpired = !connection.token_expires_at ||
      new Date(connection.token_expires_at) <= new Date();

    if (tokenExpired) {
      try {
        accessToken = await refreshAccessToken(refreshToken);
      } catch (err) {
        console.error(`[gmail-webhook] Token refresh failed for ${emailAddress}:`, err);
        const errorMsg = err instanceof Error ? err.message : 'Token refresh failed';
        const isRevoked = errorMsg.includes('invalid_grant') || errorMsg.includes('Token has been revoked');
        await serviceClient
          .from('gmail_connections')
          .update({
            status: isRevoked ? 'revoked' : 'error',
            last_error: errorMsg.slice(0, 500),
          })
          .eq('id', connection.id);
        return ok();
      }
    } else {
      try {
        accessToken = await decryptTokenWithKeyRotation(connection.access_token_encrypted);
      } catch {
        // If decryption fails, try refreshing
        try {
          accessToken = await refreshAccessToken(refreshToken);
        } catch (err) {
          console.error(`[gmail-webhook] Fallback token refresh failed for ${emailAddress}:`, err);
          return ok();
        }
      }
    }

    // --- Fetch Gmail history ---
    const startHistoryId = lastHistoryId ?? incomingHistoryId;
    let historyResult: { history: HistoryRecord[]; historyId: string };

    try {
      historyResult = await fetchHistory(accessToken, startHistoryId);
    } catch (err) {
      console.error(`[gmail-webhook] history.list failed for ${emailAddress}:`, err);
      // If 401, token may be stale — try one refresh
      const errMsg = err instanceof Error ? err.message : '';
      if (errMsg.includes('401')) {
        try {
          accessToken = await refreshAccessToken(refreshToken);
          historyResult = await fetchHistory(accessToken, startHistoryId);
        } catch (retryErr) {
          console.error(`[gmail-webhook] Retry after 401 failed:`, retryErr);
          return ok();
        }
      } else {
        return ok();
      }
    }

    // --- Pre-load client gmail_address map for sender matching ---
    const { data: clients } = await serviceClient
      .from('clients')
      .select('id, gmail_address')
      .eq('status', 'active');

    const clientByEmail = new Map<string, string>();
    if (clients) {
      for (const c of clients) {
        if (c.gmail_address) {
          clientByEmail.set(c.gmail_address.toLowerCase(), c.id);
        }
      }
    }

    // --- Collect unique new message IDs from history ---
    const newMessageIds = new Set<string>();
    for (const record of historyResult.history) {
      if (record.messagesAdded) {
        for (const added of record.messagesAdded) {
          newMessageIds.add(added.message.id);
        }
      }
    }

    console.log(`[gmail-webhook] ${newMessageIds.size} new messages for ${emailAddress}`);

    // --- Process each new message ---
    const classifyUrl = `${supabaseUrl}${CLASSIFY_EMAIL_URL_SUFFIX}`;

    for (const messageId of newMessageIds) {
      try {
        // Idempotency check: skip if already in email_notifications
        const { data: existing } = await serviceClient
          .from('email_notifications')
          .select('id')
          .eq('gmail_message_id', messageId)
          .maybeSingle();

        if (existing) {
          console.log(`[gmail-webhook] Message ${messageId} already processed, skipping`);
          continue;
        }

        // Fetch message metadata
        const msg = await fetchMessage(accessToken, messageId);

        // Extract attachment names
        const attachmentNames = collectAttachmentNames(msg.payload);
        const hasAttachments = attachmentNames.length > 0;

        // Parse sender
        const fromHeader = getHeader(msg.payload, 'From') ?? '';
        const { email: senderEmail, name: senderName } = parseFromHeader(fromHeader);
        const subject = getHeader(msg.payload, 'Subject') ?? '(no subject)';

        // Match sender against clients
        const matchedClientId = clientByEmail.get(senderEmail) ?? null;

        // Invoke classify-email internally
        try {
          await fetchWithTimeout(classifyUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${supabaseServiceKey}`,
            },
            body: JSON.stringify({
              gmailMessageId: messageId,
              gmailThreadId: msg.threadId ?? null,
              senderEmail,
              senderName,
              subject,
              snippet: msg.snippet ?? '',
              hasAttachments,
              attachmentNames,
              matchedClientId,
              receivedAt: new Date(Number(msg.internalDate)).toISOString(),
            }),
          });
        } catch (classifyErr) {
          // classify-email failed — fail-open: insert a bare notification
          console.error(`[gmail-webhook] classify-email call failed for ${messageId}:`, classifyErr);

          // Insert with null classification so accountant can review
          const { error: fallbackErr } = await serviceClient
            .from('email_notifications')
            .insert({
              gmail_message_id: messageId,
              gmail_thread_id: msg.threadId ?? null,
              client_id: matchedClientId,
              sender_email: senderEmail,
              sender_name: senderName,
              subject,
              snippet: msg.snippet ?? '',
              received_at: new Date(Number(msg.internalDate)).toISOString(),
              document_type_guess: null,
              classification_confidence: null,
              is_document: false,
              status: 'unprocessed',
              auto_dismissed: false,
            });

          if (fallbackErr && fallbackErr.code !== '23505') {
            console.error(`[gmail-webhook] Fallback insert failed for ${messageId}:`, fallbackErr);
          }
        }
      } catch (msgErr) {
        // Log and continue — don't let one bad message block the rest
        console.error(`[gmail-webhook] Error processing message ${messageId}:`, msgErr);
        continue;
      }
    }

    // --- Update watch_history_id to latest ---
    const newHistoryId = historyResult.historyId;
    if (newHistoryId && (!lastHistoryId || BigInt(newHistoryId) > BigInt(lastHistoryId))) {
      await serviceClient
        .from('gmail_connections')
        .update({
          watch_history_id: newHistoryId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', connection.id);
    }

    return ok();
  } catch (err) {
    // Top-level catch — log but always return 200
    console.error('[gmail-webhook] Unhandled error:', err);
    return ok();
  }
});
