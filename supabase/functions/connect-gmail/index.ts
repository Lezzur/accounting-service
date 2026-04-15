import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { encryptToken } from '../_shared/encryption.ts';

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GMAIL_PROFILE_URL =
  'https://gmail.googleapis.com/gmail/v1/users/me/profile';
const GMAIL_WATCH_URL =
  'https://gmail.googleapis.com/gmail/v1/users/me/watch';

const TIMEOUT_MS = 15_000;

interface ErrorResponse {
  code: string;
  message: string;
  request_id: string;
  details?: Array<{ field: string; issue: string }>;
}

function errorJson(
  status: number,
  code: string,
  message: string,
  requestId: string,
  details?: ErrorResponse['details'],
): Response {
  const body: { error: ErrorResponse } = {
    error: { code, message, request_id: requestId },
  };
  if (details) body.error.details = details;
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function successJson(
  data: Record<string, unknown>,
  requestId: string,
  startTime: number,
): Response {
  return new Response(
    JSON.stringify({
      success: true,
      data,
      meta: {
        request_id: requestId,
        duration_ms: Date.now() - startTime,
      },
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

Deno.serve(async (req) => {
  const startTime = Date.now();
  const requestId = `req_${crypto.randomUUID().slice(0, 12)}`;

  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers':
          'authorization, x-client-info, apikey, content-type',
      },
    });
  }

  if (req.method !== 'POST') {
    return errorJson(405, 'METHOD_NOT_ALLOWED', 'POST required', requestId);
  }

  // --- Auth: verify JWT and admin role ---
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return errorJson(401, 'UNAUTHORIZED', 'Missing authorization token', requestId);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const {
    data: { user },
    error: authError,
  } = await userClient.auth.getUser();

  if (authError || !user) {
    return errorJson(401, 'UNAUTHORIZED', 'Invalid authorization token', requestId);
  }

  const serviceClient = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: userRow, error: userQueryError } = await serviceClient
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single();

  if (userQueryError || !userRow) {
    return errorJson(401, 'UNAUTHORIZED', 'User profile not found', requestId);
  }

  if (userRow.role !== 'admin') {
    return errorJson(403, 'FORBIDDEN', 'Admin role required', requestId);
  }

  // --- Parse & validate request body ---
  let body: { code?: string };
  try {
    body = await req.json();
  } catch {
    return errorJson(400, 'VALIDATION_FAILED', 'Invalid JSON body', requestId);
  }

  const code = body?.code;
  if (!code || typeof code !== 'string') {
    return errorJson(400, 'VALIDATION_FAILED', 'Missing code parameter', requestId, [
      { field: 'code', issue: 'Must be a non-empty string' },
    ]);
  }

  const encryptionKey = Deno.env.get('GMAIL_TOKEN_ENCRYPTION_KEY');
  if (!encryptionKey) {
    return errorJson(500, 'INTERNAL_ERROR', 'Encryption key not configured', requestId);
  }

  const googleClientId = Deno.env.get('GOOGLE_CLIENT_ID');
  const googleClientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET');
  const googleRedirectUri = Deno.env.get('GOOGLE_REDIRECT_URI');
  const pubsubTopic = Deno.env.get('GMAIL_PUBSUB_TOPIC');

  if (!googleClientId || !googleClientSecret || !googleRedirectUri) {
    return errorJson(500, 'INTERNAL_ERROR', 'Google OAuth not configured', requestId);
  }

  // --- Step 1: Exchange authorization code for tokens ---
  let accessToken: string;
  let refreshToken: string;
  let expiresIn: number;

  try {
    const tokenRes = await fetchWithTimeout(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: googleClientId,
        client_secret: googleClientSecret,
        redirect_uri: googleRedirectUri,
        grant_type: 'authorization_code',
      }),
    });

    const tokenData = await tokenRes.json();

    if (!tokenRes.ok) {
      const desc = tokenData.error_description || tokenData.error || 'Token exchange failed';
      return errorJson(422, 'PROCESSING_FAILED', `OAuth token exchange failed: ${desc}`, requestId);
    }

    accessToken = tokenData.access_token;
    refreshToken = tokenData.refresh_token;
    expiresIn = tokenData.expires_in;

    if (!accessToken || !refreshToken) {
      return errorJson(
        422,
        'PROCESSING_FAILED',
        'Token response missing access_token or refresh_token',
        requestId,
      );
    }
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') {
      return errorJson(503, 'DEPENDENCY_UNAVAILABLE', 'Google OAuth token endpoint timed out', requestId);
    }
    return errorJson(503, 'DEPENDENCY_UNAVAILABLE', 'Google OAuth token endpoint unreachable', requestId);
  }

  // --- Step 2: Fetch Gmail profile ---
  let gmailEmail: string;

  try {
    const profileRes = await fetchWithTimeout(GMAIL_PROFILE_URL, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!profileRes.ok) {
      return errorJson(503, 'DEPENDENCY_UNAVAILABLE', 'Failed to fetch Gmail profile', requestId);
    }

    const profile = await profileRes.json();
    gmailEmail = profile.emailAddress;

    if (!gmailEmail) {
      return errorJson(422, 'PROCESSING_FAILED', 'Gmail profile missing email address', requestId);
    }
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') {
      return errorJson(503, 'DEPENDENCY_UNAVAILABLE', 'Gmail API timed out', requestId);
    }
    return errorJson(503, 'DEPENDENCY_UNAVAILABLE', 'Gmail API unreachable', requestId);
  }

  // --- Step 3: Encrypt tokens ---
  const tokenExpiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();
  let accessTokenEncrypted: string;
  let refreshTokenEncrypted: string;

  try {
    accessTokenEncrypted = await encryptToken(accessToken, encryptionKey);
    refreshTokenEncrypted = await encryptToken(refreshToken, encryptionKey);
  } catch {
    return errorJson(500, 'INTERNAL_ERROR', 'Token encryption failed', requestId);
  }

  // --- Step 4: Upsert gmail_connections ---
  const { data: existing } = await serviceClient
    .from('gmail_connections')
    .select('id')
    .eq('gmail_email', gmailEmail)
    .maybeSingle();

  let connectionId: string;

  if (existing) {
    const { error: updateError } = await serviceClient
      .from('gmail_connections')
      .update({
        user_id: user.id,
        access_token_encrypted: accessTokenEncrypted,
        refresh_token_encrypted: refreshTokenEncrypted,
        token_expires_at: tokenExpiresAt,
        status: 'active',
        last_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id);

    if (updateError) {
      return errorJson(500, 'INTERNAL_ERROR', 'Failed to update Gmail connection', requestId);
    }
    connectionId = existing.id;
  } else {
    const { data: inserted, error: insertError } = await serviceClient
      .from('gmail_connections')
      .insert({
        user_id: user.id,
        gmail_email: gmailEmail,
        access_token_encrypted: accessTokenEncrypted,
        refresh_token_encrypted: refreshTokenEncrypted,
        token_expires_at: tokenExpiresAt,
        status: 'active',
      })
      .select('id')
      .single();

    if (insertError || !inserted) {
      return errorJson(500, 'INTERNAL_ERROR', 'Failed to create Gmail connection', requestId);
    }
    connectionId = inserted.id;
  }

  // --- Step 5: Set up Gmail watch ---
  let watchExpiration: string | null = null;
  let watchHistoryId: string | null = null;

  if (pubsubTopic) {
    try {
      const watchRes = await fetchWithTimeout(GMAIL_WATCH_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          topicName: pubsubTopic,
          labelIds: ['INBOX'],
        }),
      });

      if (watchRes.ok) {
        const watchData = await watchRes.json();
        watchHistoryId = watchData.historyId?.toString() ?? null;
        watchExpiration = watchData.expiration
          ? new Date(Number(watchData.expiration)).toISOString()
          : null;

        await serviceClient
          .from('gmail_connections')
          .update({
            watch_history_id: watchHistoryId,
            watch_expiration: watchExpiration,
            updated_at: new Date().toISOString(),
          })
          .eq('id', connectionId);
      }
    } catch {
      // Watch setup is non-fatal — connection is still usable.
      // The cron-renew-watch job will retry.
    }
  }

  return successJson(
    {
      gmailEmail,
      connectionId,
      watchExpiration,
      status: 'active',
    },
    requestId,
    startTime,
  );
});
