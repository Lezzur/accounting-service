import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { successResponse, errorResponse } from '../_shared/response.ts';
import { decryptTokenWithKeyRotation, encryptToken } from '../_shared/encryption.ts';

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GMAIL_WATCH_URL = 'https://gmail.googleapis.com/gmail/v1/users/me/watch';

// 5-minute buffer: refresh tokens that expire within this window
const TOKEN_EXPIRY_BUFFER_MS = 5 * 60 * 1000;
const WATCH_RETRY_ATTEMPTS = 3;
const WATCH_RETRY_DELAY_MS = 60_000;
const FETCH_TIMEOUT_MS = 30_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

interface TokenRefreshResult {
  accessToken: string;
  accessTokenEncrypted: string;
  refreshTokenEncrypted: string;
  tokenExpiresAt: string;
  newRefreshToken?: string;
}

/**
 * Refresh an OAuth2 access token using the refresh token.
 * Returns the new tokens (encrypted) and expiry.
 * Throws with `{ revoked: true }` if the token is no longer valid.
 */
async function refreshAccessToken(
  refreshTokenEncrypted: string,
  encryptionKey: string,
): Promise<TokenRefreshResult> {
  const googleClientId = Deno.env.get('GOOGLE_CLIENT_ID')!;
  const googleClientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET')!;

  const refreshToken = await decryptTokenWithKeyRotation(refreshTokenEncrypted);

  const res = await fetchWithTimeout(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: googleClientId,
      client_secret: googleClientSecret,
    }),
  });

  const data = await res.json();

  if (!res.ok) {
    const errCode: string = data.error ?? '';
    // invalid_grant = token revoked or expired permanently
    if (errCode === 'invalid_grant' || res.status === 400 || res.status === 401) {
      const revocationErr = new Error(`Token revoked: ${errCode}`);
      (revocationErr as Error & { revoked: boolean }).revoked = true;
      throw revocationErr;
    }
    throw new Error(`Token refresh failed (${res.status}): ${errCode || data.error_description}`);
  }

  const accessToken: string = data.access_token;
  const expiresIn: number = data.expires_in ?? 3600;
  // Google may rotate the refresh token; if absent, reuse the existing one.
  const newRefreshToken: string | undefined = data.refresh_token;

  const tokenExpiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();
  const accessTokenEncrypted = await encryptToken(accessToken, encryptionKey);
  const refreshTokenEncrypted2 = newRefreshToken
    ? await encryptToken(newRefreshToken, encryptionKey)
    : refreshTokenEncrypted;

  return {
    accessToken,
    accessTokenEncrypted,
    refreshTokenEncrypted: refreshTokenEncrypted2,
    tokenExpiresAt,
    newRefreshToken,
  };
}

/**
 * Call gmail.users.watch() and return the new expiration and historyId.
 * Retries up to WATCH_RETRY_ATTEMPTS times with WATCH_RETRY_DELAY_MS between retries.
 */
async function renewGmailWatch(
  accessToken: string,
  pubsubTopic: string,
): Promise<{ watchExpiration: string; watchHistoryId: string }> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= WATCH_RETRY_ATTEMPTS; attempt++) {
    try {
      const res = await fetchWithTimeout(GMAIL_WATCH_URL, {
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

      if (!res.ok) {
        const body = await res.text();
        throw new Error(`watch() returned ${res.status}: ${body.slice(0, 200)}`);
      }

      const data = await res.json();
      const watchExpiration = data.expiration
        ? new Date(Number(data.expiration)).toISOString()
        : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      const watchHistoryId = data.historyId?.toString() ?? '';

      return { watchExpiration, watchHistoryId };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < WATCH_RETRY_ATTEMPTS) {
        console.error(
          `watch() attempt ${attempt}/${WATCH_RETRY_ATTEMPTS} failed, retrying in ${WATCH_RETRY_DELAY_MS / 1000}s:`,
          lastError.message,
        );
        await sleep(WATCH_RETRY_DELAY_MS);
      }
    }
  }

  throw lastError ?? new Error('watch() failed after all retries');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const startTime = Date.now();
  const requestId = `req_${crypto.randomUUID().slice(0, 12)}`;

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const encryptionKey = Deno.env.get('GMAIL_TOKEN_ENCRYPTION_KEY');
    const pubsubTopic = Deno.env.get('GMAIL_PUBSUB_TOPIC');

    if (!encryptionKey) {
      console.error('GMAIL_TOKEN_ENCRYPTION_KEY not configured');
      return errorResponse(500, 'INTERNAL_ERROR', 'Encryption key not configured', requestId);
    }

    if (!pubsubTopic) {
      console.error('GMAIL_PUBSUB_TOPIC not configured');
      return errorResponse(500, 'INTERNAL_ERROR', 'Pub/Sub topic not configured', requestId);
    }

    const serviceClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // --- Step 1: Fetch all active Gmail connections ---
    const { data: connections, error: fetchError } = await serviceClient
      .from('gmail_connections')
      .select(
        'id, gmail_email, access_token_encrypted, refresh_token_encrypted, token_expires_at',
      )
      .eq('status', 'active');

    if (fetchError) {
      console.error('Failed to fetch gmail_connections:', fetchError);
      return errorResponse(500, 'INTERNAL_ERROR', 'Failed to fetch active connections', requestId);
    }

    if (!connections || connections.length === 0) {
      return successResponse(
        { connectionsProcessed: 0, renewed: 0, tokenRefreshed: 0, errors: [] },
        { request_id: requestId, duration_ms: Date.now() - startTime },
      );
    }

    // --- Step 2: Process each connection independently ---
    let renewed = 0;
    let tokenRefreshed = 0;
    const errors: { connectionId: string; gmailEmail: string; error: string }[] = [];

    for (const conn of connections) {
      const { id: connectionId, gmail_email: gmailEmail } = conn;

      try {
        // --- 2a. Refresh access token if expired (or expiring soon) ---
        let accessToken: string;
        let updatedTokenFields: Record<string, string> | null = null;

        const tokenExpiresAt = conn.token_expires_at
          ? new Date(conn.token_expires_at).getTime()
          : 0;
        const tokenNeedsRefresh = tokenExpiresAt - Date.now() < TOKEN_EXPIRY_BUFFER_MS;

        if (tokenNeedsRefresh) {
          console.log(`Refreshing access token for connection ${connectionId}`);

          let refreshResult: TokenRefreshResult;
          try {
            refreshResult = await refreshAccessToken(
              conn.refresh_token_encrypted,
              encryptionKey,
            );
          } catch (err) {
            const isRevoked =
              err instanceof Error && (err as Error & { revoked?: boolean }).revoked === true;

            if (isRevoked) {
              // Token permanently revoked — surface in Toolbox
              await serviceClient
                .from('gmail_connections')
                .update({
                  status: 'revoked',
                  last_error: 'Gmail authorization revoked. Reconnect in Settings.',
                  updated_at: new Date().toISOString(),
                })
                .eq('id', connectionId);

              console.error(`Connection ${connectionId} (${gmailEmail}): token revoked`);
              errors.push({
                connectionId,
                gmailEmail,
                error: 'Token revoked',
              });
            } else {
              const msg = err instanceof Error ? err.message : String(err);
              await serviceClient
                .from('gmail_connections')
                .update({
                  status: 'error',
                  last_error: `Token refresh failed: ${msg}`,
                  updated_at: new Date().toISOString(),
                })
                .eq('id', connectionId);

              console.error(`Connection ${connectionId} (${gmailEmail}): token refresh error:`, msg);
              errors.push({ connectionId, gmailEmail, error: `Token refresh failed: ${msg}` });
            }

            // Either way, cannot proceed with watch() — skip to next connection
            continue;
          }

          accessToken = refreshResult.accessToken;
          tokenRefreshed++;

          updatedTokenFields = {
            access_token_encrypted: refreshResult.accessTokenEncrypted,
            refresh_token_encrypted: refreshResult.refreshTokenEncrypted,
            token_expires_at: refreshResult.tokenExpiresAt,
          };
        } else {
          // Token still valid — decrypt the stored access token for watch()
          accessToken = await decryptTokenWithKeyRotation(conn.access_token_encrypted);
        }

        // --- 2b. Renew Gmail watch() ---
        let watchExpiration: string;
        let watchHistoryId: string;

        try {
          ({ watchExpiration, watchHistoryId } = await renewGmailWatch(accessToken, pubsubTopic));
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          await serviceClient
            .from('gmail_connections')
            .update({
              status: 'error',
              last_error: `watch() renewal failed after ${WATCH_RETRY_ATTEMPTS} attempts: ${msg}`,
              updated_at: new Date().toISOString(),
              // Persist refreshed tokens even if watch() failed, so a future run can retry
              ...(updatedTokenFields ?? {}),
            })
            .eq('id', connectionId);

          console.error(`Connection ${connectionId} (${gmailEmail}): watch() failed:`, msg);
          errors.push({ connectionId, gmailEmail, error: `watch() renewal failed: ${msg}` });
          continue;
        }

        // --- 2c. Persist all updates ---
        await serviceClient
          .from('gmail_connections')
          .update({
            watch_expiration: watchExpiration,
            watch_history_id: watchHistoryId || undefined,
            status: 'active',
            last_error: null,
            updated_at: new Date().toISOString(),
            ...(updatedTokenFields ?? {}),
          })
          .eq('id', connectionId);

        renewed++;
        console.log(
          `Connection ${connectionId} (${gmailEmail}): watch renewed until ${watchExpiration}`,
        );
      } catch (err) {
        // Unexpected error for this connection — log and continue with the rest
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`Unexpected error for connection ${connectionId} (${gmailEmail}):`, msg);
        errors.push({ connectionId, gmailEmail, error: `Unexpected error: ${msg}` });

        try {
          await serviceClient
            .from('gmail_connections')
            .update({
              status: 'error',
              last_error: `Unexpected error during watch renewal: ${msg}`,
              updated_at: new Date().toISOString(),
            })
            .eq('id', connectionId);
        } catch {
          // Best-effort DB update — do not let a secondary failure mask the primary one
        }
      }
    }

    return successResponse(
      {
        connectionsProcessed: connections.length,
        renewed,
        tokenRefreshed,
        ...(errors.length > 0 && { errors }),
      },
      { request_id: requestId, duration_ms: Date.now() - startTime },
    );
  } catch (err) {
    console.error('Unhandled error in cron-gmail-watch:', err);
    return errorResponse(500, 'INTERNAL_ERROR', 'An unexpected error occurred', requestId);
  }
});
