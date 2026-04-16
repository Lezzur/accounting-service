import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { successResponse, errorResponse } from '../_shared/response.ts';
import { decryptTokenWithKeyRotation } from '../_shared/encryption.ts';

// ─── Constants ──────────────────────────────────────────────────────────────

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const GOOGLE_VISION_URL = 'https://vision.googleapis.com/v1/images:annotate';
const GMAIL_API_URL = 'https://gmail.googleapis.com/gmail/v1';

const MODEL_SONNET = 'claude-sonnet-4-6';
const MODEL_HAIKU = 'claude-haiku-4-5-20251001';

const TIMEOUT_MS = 120_000;
const VISION_TIMEOUT_MS = 60_000;
const CATEGORIZE_TIMEOUT_MS = 30_000;
const GMAIL_TIMEOUT_MS = 15_000;

const MAX_PAGES_PER_BATCH = 3;
const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25MB
const PROCESSING_LOCK_MINUTES = 5;
const CATEGORY_CONFIDENCE_THRESHOLD = 0.85;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ─── Types ──────────────────────────────────────────────────────────────────

interface ExtractedTransaction {
  date: string;
  description: string;
  amount: string;
  type: 'credit' | 'debit';
  vendor?: string;
  pageNumber: number;
  runningBalance?: string;
}

interface ExtractionResult {
  transactions: ExtractedTransaction[];
  runningBalance?: string;
  warnings: string[];
}

interface CategorizedTransaction extends ExtractedTransaction {
  categoryCode: string | null;
  categoryName: string | null;
  categoryConfidence: number;
}

interface CategoryOption {
  code: string;
  name: string;
  type: string;
}

// ─── Gmail helpers ──────────────────────────────────────────────────────────

async function refreshAccessToken(refreshToken: string): Promise<string> {
  const clientId = Deno.env.get('GOOGLE_CLIENT_ID')!;
  const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET')!;

  const response = await fetchWithTimeout(
    'https://oauth2.googleapis.com/token',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    },
    GMAIL_TIMEOUT_MS,
  );

  if (!response.ok) {
    throw new Error('TOKEN_REFRESH_FAILED');
  }

  const data = await response.json();
  return data.access_token;
}

interface GmailAttachment {
  filename: string;
  mimeType: string;
  data: Uint8Array;
  size: number;
}

async function fetchGmailAttachments(
  accessToken: string,
  messageId: string,
): Promise<GmailAttachment[]> {
  // Fetch full message to get attachment metadata
  const msgResponse = await fetchWithTimeout(
    `${GMAIL_API_URL}/users/me/messages/${messageId}?format=full`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
    GMAIL_TIMEOUT_MS,
  );

  if (!msgResponse.ok) {
    throw new Error('GMAIL_FETCH_FAILED');
  }

  const message = await msgResponse.json();
  const parts = message.payload?.parts ?? [];
  const attachments: GmailAttachment[] = [];

  for (const part of parts) {
    if (!part.body?.attachmentId || !part.filename) continue;

    const attResponse = await fetchWithTimeout(
      `${GMAIL_API_URL}/users/me/messages/${messageId}/attachments/${part.body.attachmentId}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
      GMAIL_TIMEOUT_MS,
    );

    if (!attResponse.ok) {
      throw new Error('GMAIL_ATTACHMENT_FETCH_FAILED');
    }

    const attData = await attResponse.json();
    // Gmail returns URL-safe base64
    const base64 = attData.data.replace(/-/g, '+').replace(/_/g, '/');
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

    attachments.push({
      filename: part.filename,
      mimeType: part.mimeType ?? 'application/octet-stream',
      data: bytes,
      size: bytes.length,
    });
  }

  return attachments;
}

// ─── Vision extraction ──────────────────────────────────────────────────────

function buildExtractionPrompt(
  pageStart: number,
  pageEnd: number,
  totalPages: number,
  documentType?: string,
  runningBalance?: string,
): string {
  const pageRange = pageStart === pageEnd ? `page ${pageStart}` : `pages ${pageStart}-${pageEnd}`;
  const docTypeHint = documentType ? `\nDocument type: ${documentType}` : '';
  const balanceHint = runningBalance
    ? `\nPrevious page ended with balance: ${runningBalance}`
    : '';

  return `You are a financial document OCR specialist for Philippine SMB bookkeeping. Extract all transactions from the attached document image(s).

This is ${pageRange} of a ${totalPages}-page document.${docTypeHint}${balanceHint}

For each transaction found, extract:
- date: the transaction date in YYYY-MM-DD format
- description: the transaction description as shown on the document
- amount: the amount as a decimal string (e.g. "1500.00")
- type: "credit" or "debit"
- vendor: the vendor/payee name if identifiable, otherwise empty string
- pageNumber: which page this transaction appears on
- runningBalance: the running balance shown after this transaction, if visible

Also extract the final running balance visible on the last page of this batch.

Respond in JSON:
{
  "transactions": [
    {
      "date": "YYYY-MM-DD",
      "description": "string",
      "amount": "string",
      "type": "credit" | "debit",
      "vendor": "string",
      "pageNumber": number,
      "runningBalance": "string or omit"
    }
  ],
  "runningBalance": "final running balance or omit",
  "warnings": ["any issues encountered"]
}`;
}

async function extractWithClaudeVision(
  prompt: string,
  imageBase64List: string[],
  imageMimeTypes: string[],
  apiKey: string,
): Promise<ExtractionResult> {
  const content: Array<Record<string, unknown>> = [];

  for (let i = 0; i < imageBase64List.length; i++) {
    content.push({
      type: 'image',
      source: {
        type: 'base64',
        media_type: imageMimeTypes[i],
        data: imageBase64List[i],
      },
    });
  }

  content.push({ type: 'text', text: prompt });

  const response = await fetchWithTimeout(
    ANTHROPIC_API_URL,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'zero-data-retention',
      },
      body: JSON.stringify({
        model: MODEL_SONNET,
        max_tokens: 4096,
        messages: [{ role: 'user', content }],
      }),
    },
    VISION_TIMEOUT_MS,
  );

  if (!response.ok) {
    const status = response.status;
    if (status === 429) throw new Error('VISION_RATE_LIMIT');
    if (status >= 500) throw new Error('VISION_SERVER_ERROR');
    throw new Error('VISION_API_ERROR');
  }

  const result = await response.json();
  const textBlock = result.content?.find((b: { type: string }) => b.type === 'text');
  if (!textBlock?.text) {
    throw new Error('VISION_PARSE_ERROR');
  }

  return parseExtractionResponse(textBlock.text);
}

function parseExtractionResponse(raw: string): ExtractionResult {
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('VISION_PARSE_ERROR');

  const parsed = JSON.parse(jsonMatch[0]);

  if (!Array.isArray(parsed.transactions)) {
    throw new Error('VISION_PARSE_ERROR');
  }

  return {
    transactions: parsed.transactions.map((t: Record<string, unknown>) => ({
      date: String(t.date ?? ''),
      description: String(t.description ?? ''),
      amount: String(t.amount ?? '0.00'),
      type: t.type === 'credit' ? 'credit' : 'debit',
      vendor: t.vendor ? String(t.vendor) : '',
      pageNumber: Number(t.pageNumber) || 1,
      runningBalance: t.runningBalance ? String(t.runningBalance) : undefined,
    })),
    runningBalance: parsed.runningBalance ? String(parsed.runningBalance) : undefined,
    warnings: Array.isArray(parsed.warnings) ? parsed.warnings.map(String) : [],
  };
}

// ─── Google Cloud Vision fallback ───────────────────────────────────────────

async function extractWithGoogleVision(
  imageBase64List: string[],
  apiKey: string,
): Promise<string> {
  const requests = imageBase64List.map((b64) => ({
    image: { content: b64 },
    features: [{ type: 'DOCUMENT_TEXT_DETECTION' }],
  }));

  const response = await fetchWithTimeout(
    `${GOOGLE_VISION_URL}?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requests }),
    },
    VISION_TIMEOUT_MS,
  );

  if (!response.ok) {
    throw new Error('GOOGLE_VISION_FAILED');
  }

  const data = await response.json();
  const texts: string[] = [];

  for (const resp of data.responses ?? []) {
    const text = resp.fullTextAnnotation?.text ?? resp.textAnnotations?.[0]?.description ?? '';
    texts.push(text);
  }

  return texts.join('\n\n--- PAGE BREAK ---\n\n');
}

async function parseOCRTextWithClaude(
  ocrText: string,
  pageStart: number,
  pageEnd: number,
  totalPages: number,
  apiKey: string,
  documentType?: string,
  runningBalance?: string,
): Promise<ExtractionResult> {
  const prompt = `You are a financial document parser for Philippine SMB bookkeeping. Parse the following OCR text into structured transactions.

This is pages ${pageStart}-${pageEnd} of a ${totalPages}-page document.${documentType ? `\nDocument type: ${documentType}` : ''}${runningBalance ? `\nPrevious page ended with balance: ${runningBalance}` : ''}

OCR Text:
${ocrText}

Extract all transactions found. For each transaction:
- date: YYYY-MM-DD format
- description: transaction description
- amount: decimal string (e.g. "1500.00")
- type: "credit" or "debit"
- vendor: vendor/payee if identifiable, else empty string
- pageNumber: which page
- runningBalance: if visible

Respond in JSON:
{
  "transactions": [...],
  "runningBalance": "final balance or omit",
  "warnings": ["any issues"]
}`;

  const response = await fetchWithTimeout(
    ANTHROPIC_API_URL,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'zero-data-retention',
      },
      body: JSON.stringify({
        model: MODEL_SONNET,
        max_tokens: 4096,
        messages: [{ role: 'user', content: prompt }],
      }),
    },
    VISION_TIMEOUT_MS,
  );

  if (!response.ok) throw new Error('FALLBACK_PARSE_FAILED');

  const result = await response.json();
  const textBlock = result.content?.find((b: { type: string }) => b.type === 'text');
  if (!textBlock?.text) throw new Error('FALLBACK_PARSE_FAILED');

  return parseExtractionResponse(textBlock.text);
}

// ─── Transaction categorization ─────────────────────────────────────────────

async function categorizeTransaction(
  description: string,
  amount: string,
  type: 'credit' | 'debit',
  clientIndustry: string,
  categories: CategoryOption[],
  corrections: Array<{ original: string; corrected: string; description: string }>,
  apiKey: string,
): Promise<{ categoryCode: string; confidence: number; reasoning: string }> {
  const categoriesList = categories.map((c) => `${c.code}: ${c.name} (${c.type})`).join('\n');

  let correctionsBlock = '';
  if (corrections.length > 0) {
    const lines = corrections
      .map((c) => `"${c.description}" was "${c.original}" → corrected to "${c.corrected}"`)
      .join('\n');
    correctionsBlock = `\nRecent corrections for similar transactions (learn from these):\n${lines}\n`;
  }

  const prompt = `You are a transaction categorizer for Philippine SMB bookkeeping. Assign the most appropriate chart of accounts category.

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
  "reasoning": "brief"
}`;

  const response = await fetchWithTimeout(
    ANTHROPIC_API_URL,
    {
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
    },
    CATEGORIZE_TIMEOUT_MS,
  );

  if (!response.ok) {
    return { categoryCode: '', confidence: 0, reasoning: 'Categorization API failed' };
  }

  const result = await response.json();
  const textBlock = result.content?.find((b: { type: string }) => b.type === 'text');
  if (!textBlock?.text) {
    return { categoryCode: '', confidence: 0, reasoning: 'Empty categorization response' };
  }

  const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return { categoryCode: '', confidence: 0, reasoning: 'Failed to parse categorization' };
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    return {
      categoryCode: String(parsed.categoryCode ?? ''),
      confidence: Number(parsed.confidence) || 0,
      reasoning: String(parsed.reasoning ?? ''),
    };
  } catch {
    return { categoryCode: '', confidence: 0, reasoning: 'JSON parse error' };
  }
}

// ─── Multi-page processing ──────────────────────────────────────────────────

async function processDocumentPages(
  imageBase64List: string[],
  imageMimeTypes: string[],
  anthropicKey: string,
  documentType?: string,
): Promise<{ result: ExtractionResult; usedFallback: boolean }> {
  const totalPages = imageBase64List.length;
  const allTransactions: ExtractedTransaction[] = [];
  const allWarnings: string[] = [];
  let runningBalance: string | undefined;
  let usedFallback = false;

  for (let i = 0; i < totalPages; i += MAX_PAGES_PER_BATCH) {
    const batchImages = imageBase64List.slice(i, i + MAX_PAGES_PER_BATCH);
    const batchMimeTypes = imageMimeTypes.slice(i, i + MAX_PAGES_PER_BATCH);
    const pageStart = i + 1;
    const pageEnd = i + batchImages.length;

    const prompt = buildExtractionPrompt(pageStart, pageEnd, totalPages, documentType, runningBalance);

    let batchResult: ExtractionResult;

    // Try Claude Vision first
    try {
      batchResult = await extractWithClaudeVision(prompt, batchImages, batchMimeTypes, anthropicKey);
    } catch (claudeError) {
      // Fallback to Google Cloud Vision
      const googleApiKey = Deno.env.get('GOOGLE_CLOUD_VISION_API_KEY');
      if (!googleApiKey) {
        throw new Error('BOTH_APIS_UNAVAILABLE');
      }

      try {
        usedFallback = true;
        allWarnings.push(`Pages ${pageStart}-${pageEnd}: Claude Vision failed, used Google Cloud Vision fallback`);

        const ocrText = await extractWithGoogleVision(batchImages, googleApiKey);
        batchResult = await parseOCRTextWithClaude(
          ocrText,
          pageStart,
          pageEnd,
          totalPages,
          anthropicKey,
          documentType,
          runningBalance,
        );
      } catch {
        throw new Error('BOTH_APIS_FAILED');
      }
    }

    allTransactions.push(...batchResult.transactions);
    allWarnings.push(...batchResult.warnings);
    runningBalance = batchResult.runningBalance ?? runningBalance;
  }

  // Deduplicate boundary transactions
  const deduped = deduplicatePageBoundary(allTransactions);

  return {
    result: { transactions: deduped, runningBalance, warnings: allWarnings },
    usedFallback,
  };
}

// ─── Deduplication ──────────────────────────────────────────────────────────

function deduplicatePageBoundary(transactions: ExtractedTransaction[]): ExtractedTransaction[] {
  if (transactions.length <= 1) return transactions;

  const result: ExtractedTransaction[] = [transactions[0]];

  for (let i = 1; i < transactions.length; i++) {
    const prev = transactions[i - 1];
    const curr = transactions[i];

    const isBoundary = curr.pageNumber !== prev.pageNumber;
    if (
      isBoundary &&
      curr.date === prev.date &&
      curr.amount === prev.amount &&
      levenshtein(curr.description, prev.description) <= 3
    ) {
      continue; // Skip duplicate
    }

    result.push(curr);
  }

  return result;
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0) as number[]);

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }

  return dp[m][n];
}

// ─── PDF page handling ──────────────────────────────────────────────────────

async function getPageCount(data: Uint8Array, mimeType: string): Promise<number> {
  if (mimeType === 'application/pdf') {
    // Count PDF pages by searching for /Type /Page entries
    const text = new TextDecoder('latin1').decode(data);
    const matches = text.match(/\/Type\s*\/Page[^s]/g);
    return matches ? matches.length : 1;
  }
  // Images are 1 page
  return 1;
}

async function pdfToImages(data: Uint8Array): Promise<Array<{ base64: string; mimeType: string }>> {
  // For PDFs, we send the raw PDF base64 — Claude Vision handles PDF pages directly
  const base64 = uint8ToBase64(data);
  return [{ base64, mimeType: 'application/pdf' }];
}

function imageToBase64Page(data: Uint8Array, mimeType: string): Array<{ base64: string; mimeType: string }> {
  return [{ base64: uint8ToBase64(data), mimeType }];
}

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

// ─── Utility ────────────────────────────────────────────────────────────────

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') {
      throw new Error('TIMEOUT');
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

// ─── Edge Function ──────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const startTime = Date.now();
  const requestId = `req_${crypto.randomUUID().slice(0, 12)}`;

  try {
    // ── Auth ──────────────────────────────────────────────────────────────
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return errorResponse(401, 'UNAUTHORIZED', 'Missing authorization header', requestId);
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
      return errorResponse(401, 'UNAUTHORIZED', 'Invalid or expired token', requestId);
    }

    const serviceClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // ── Parse & validate body ────────────────────────────────────────────
    const body = await req.json().catch(() => null);
    if (!body) {
      return errorResponse(400, 'VALIDATION_FAILED', 'Invalid JSON body', requestId);
    }

    const { notificationId } = body;
    if (!notificationId || typeof notificationId !== 'string' || !UUID_RE.test(notificationId)) {
      return errorResponse(400, 'VALIDATION_FAILED', 'notificationId must be a valid UUID', requestId, [
        { field: 'notificationId', issue: 'Must be a valid UUID' },
      ]);
    }

    // ── Step 1: Load notification & verify status ────────────────────────
    const { data: notification, error: notifError } = await serviceClient
      .from('email_notifications')
      .select('*')
      .eq('id', notificationId)
      .single();

    if (notifError || !notification) {
      return errorResponse(404, 'NOT_FOUND', 'Notification not found', requestId);
    }

    if (notification.status === 'processed') {
      return errorResponse(409, 'CONFLICT', 'Notification already processed', requestId);
    }

    if (notification.status === 'processing') {
      const startedAt = notification.processing_started_at
        ? new Date(notification.processing_started_at).getTime()
        : 0;
      const minutesAgo = (Date.now() - startedAt) / 60_000;

      if (minutesAgo < PROCESSING_LOCK_MINUTES) {
        return errorResponse(
          409,
          'CONFLICT',
          'Notification is currently being processed',
          requestId,
        );
      }
      // Stale lock — allow re-processing
    }

    if (notification.status !== 'unprocessed' && notification.status !== 'processing') {
      return errorResponse(
        409,
        'CONFLICT',
        `Notification has status "${notification.status}" and cannot be processed`,
        requestId,
      );
    }

    // ── Step 2: Set status = processing ──────────────────────────────────
    const { error: lockError } = await serviceClient
      .from('email_notifications')
      .update({
        status: 'processing',
        processing_started_at: new Date().toISOString(),
      })
      .eq('id', notificationId);

    if (lockError) {
      return errorResponse(500, 'INTERNAL_ERROR', 'Failed to lock notification for processing', requestId);
    }

    // ── Step 3: Get Gmail access token & fetch attachments ───────────────
    const clientId = notification.client_id;

    const { data: gmailConn, error: gmailError } = await serviceClient
      .from('gmail_connections')
      .select('encrypted_access_token, encrypted_refresh_token, token_expires_at')
      .eq('status', 'active')
      .limit(1)
      .single();

    if (gmailError || !gmailConn) {
      await resetNotificationStatus(serviceClient, notificationId, 'unprocessed');
      return errorResponse(500, 'INTERNAL_ERROR', 'No active Gmail connection found', requestId);
    }

    let accessToken: string;
    try {
      const tokenExpiresAt = gmailConn.token_expires_at
        ? new Date(gmailConn.token_expires_at).getTime()
        : 0;

      if (tokenExpiresAt < Date.now() + 60_000) {
        // Token expired or about to expire — refresh it
        const refreshToken = await decryptTokenWithKeyRotation(gmailConn.encrypted_refresh_token);
        accessToken = await refreshAccessToken(refreshToken);
      } else {
        accessToken = await decryptTokenWithKeyRotation(gmailConn.encrypted_access_token);
      }
    } catch {
      await resetNotificationStatus(serviceClient, notificationId, 'unprocessed');
      return errorResponse(500, 'INTERNAL_ERROR', 'Failed to decrypt Gmail credentials', requestId);
    }

    let attachments: GmailAttachment[];
    try {
      attachments = await fetchGmailAttachments(accessToken, notification.gmail_message_id);
    } catch {
      await resetNotificationStatus(serviceClient, notificationId, 'unprocessed');
      return errorResponse(500, 'INTERNAL_ERROR', 'Failed to fetch Gmail attachments', requestId);
    }

    if (attachments.length === 0) {
      await resetNotificationStatus(serviceClient, notificationId, 'unprocessed');
      return errorResponse(422, 'PROCESSING_FAILED', 'No attachments found in email', requestId);
    }

    // ── Validate file sizes ──────────────────────────────────────────────
    const oversized = attachments.filter((a) => a.size > MAX_FILE_SIZE_BYTES);
    if (oversized.length > 0) {
      await resetNotificationStatus(serviceClient, notificationId, 'unprocessed');
      return errorResponse(
        400,
        'VALIDATION_FAILED',
        `Attachment(s) exceed 25MB limit: ${oversized.map((a) => a.filename).join(', ')}`,
        requestId,
      );
    }

    // ── Step 4 & 5: Store attachments & create document_attachments rows ─
    const year = new Date().getFullYear().toString();
    const extractionBatchId = crypto.randomUUID();
    const documentAttachmentIds: string[] = [];
    let documentsStored = 0;
    let totalPages = 0;
    const allPageImages: Array<{ base64: string; mimeType: string }> = [];
    const warnings: string[] = [];

    for (const attachment of attachments) {
      const storagePath = `documents/${clientId}/${year}/${attachment.filename}`;

      // Upload to Supabase Storage
      const { error: uploadError } = await serviceClient.storage
        .from('documents')
        .upload(storagePath, attachment.data, {
          contentType: attachment.mimeType,
          upsert: true,
        });

      if (uploadError) {
        warnings.push(`Failed to upload ${attachment.filename}: ${uploadError.message}`);
        continue;
      }

      documentsStored++;

      // Determine page count
      const pageCount = await getPageCount(attachment.data, attachment.mimeType);
      totalPages += pageCount;

      // Create document_attachments row
      const { data: docAttachment, error: docError } = await serviceClient
        .from('document_attachments')
        .insert({
          email_notification_id: notificationId,
          filename: attachment.filename,
          mime_type: attachment.mimeType,
          storage_path: storagePath,
          file_size_bytes: attachment.size,
          page_count: pageCount,
          extraction_batch_id: extractionBatchId,
        })
        .select('id')
        .single();

      if (docError || !docAttachment) {
        warnings.push(`Failed to create record for ${attachment.filename}`);
        continue;
      }

      documentAttachmentIds.push(docAttachment.id);

      // Prepare page images for extraction
      if (attachment.mimeType === 'application/pdf') {
        const pages = await pdfToImages(attachment.data);
        allPageImages.push(...pages);
      } else {
        allPageImages.push(...imageToBase64Page(attachment.data, attachment.mimeType));
      }
    }

    if (documentsStored === 0) {
      await resetNotificationStatus(serviceClient, notificationId, 'unprocessed');
      return errorResponse(422, 'PROCESSING_FAILED', 'Failed to store any attachments', requestId);
    }

    // ── Step 6-8: Process document pages (Vision + fallback + dedup) ─────
    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!anthropicKey) {
      await resetNotificationStatus(serviceClient, notificationId, 'unprocessed');
      return errorResponse(500, 'INTERNAL_ERROR', 'AI service not configured', requestId);
    }

    let extractionResult: ExtractionResult;
    let bothApisFailed = false;

    try {
      const processed = await processDocumentPages(
        allPageImages.map((p) => p.base64),
        allPageImages.map((p) => p.mimeType),
        anthropicKey,
        notification.document_type_guess ?? undefined,
      );
      extractionResult = processed.result;
      if (processed.usedFallback) {
        warnings.push('Used Google Cloud Vision fallback for some pages');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';

      if (msg === 'BOTH_APIS_UNAVAILABLE') {
        await resetNotificationStatus(serviceClient, notificationId, 'unprocessed');
        return errorResponse(
          503,
          'DEPENDENCY_UNAVAILABLE',
          'Both Claude Vision and Google Cloud Vision are unreachable',
          requestId,
        );
      }

      if (msg === 'BOTH_APIS_FAILED') {
        // Create transactions with manual_entry_required status
        bothApisFailed = true;
        extractionResult = {
          transactions: [],
          warnings: ['Vision API failed on all fallbacks — manual entry required'],
        };
      } else {
        await resetNotificationStatus(serviceClient, notificationId, 'unprocessed');
        return errorResponse(500, 'INTERNAL_ERROR', 'Document extraction failed', requestId);
      }
    }

    warnings.push(...extractionResult.warnings);

    // ── Step 9-10: Categorize & insert transactions ──────────────────────

    // Load chart of accounts and client industry for categorization
    const [coaResult, clientResult, correctionsResult] = await Promise.all([
      serviceClient.from('chart_of_accounts').select('code, name, account_type').order('display_order'),
      serviceClient.from('clients').select('industry').eq('id', clientId).single(),
      serviceClient
        .from('ai_corrections')
        .select('original_value, corrected_value, transaction_description')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false })
        .limit(10),
    ]);

    const categories: CategoryOption[] = (coaResult.data ?? []).map((c) => ({
      code: c.code,
      name: c.name,
      type: c.account_type,
    }));

    const clientIndustry = clientResult.data?.industry ?? 'general';

    const corrections = (correctionsResult.data ?? []).map((c) => ({
      original: c.original_value,
      corrected: c.corrected_value,
      description: c.transaction_description,
    }));

    // Read confidence threshold from system_settings
    const { data: settingsData } = await serviceClient
      .from('system_settings')
      .select('value')
      .eq('key', 'category_confidence_threshold')
      .single();

    const confidenceThreshold = settingsData?.value
      ? Number(settingsData.value)
      : CATEGORY_CONFIDENCE_THRESHOLD;

    const insertedTransactions: Array<Record<string, unknown>> = [];

    if (bothApisFailed) {
      // Insert a placeholder row so the accountant knows manual entry is needed
      const { data: manualTx, error: txError } = await serviceClient
        .from('transactions')
        .insert({
          client_id: clientId,
          date: new Date().toISOString().slice(0, 10),
          description: 'Manual entry required — document extraction failed',
          amount: '0.00',
          type: 'debit',
          status: 'manual_entry_required',
          source_email_notification_id: notificationId,
          extraction_batch_id: extractionBatchId,
          extraction_page_number: 1,
        })
        .select('id, date, description, amount, type, status')
        .single();

      if (!txError && manualTx) {
        insertedTransactions.push({
          ...manualTx,
          categoryCode: null,
          categoryName: null,
          categoryConfidence: 0,
        });
      }
    } else {
      // Categorize and insert each extracted transaction
      for (const tx of extractionResult.transactions) {
        let categorization = { categoryCode: '', confidence: 0, reasoning: '' };

        if (categories.length > 0) {
          categorization = await categorizeTransaction(
            tx.description,
            tx.amount,
            tx.type,
            clientIndustry,
            categories,
            corrections,
            anthropicKey,
          );
        }

        const assignCategory = categorization.confidence >= confidenceThreshold;
        const matchedCategory = assignCategory
          ? categories.find((c) => c.code === categorization.categoryCode)
          : null;

        const { data: inserted, error: txError } = await serviceClient
          .from('transactions')
          .insert({
            client_id: clientId,
            date: tx.date,
            description: tx.description,
            amount: tx.amount,
            type: tx.type,
            category_code: assignCategory ? categorization.categoryCode : null,
            status: 'pending',
            source_email_notification_id: notificationId,
            extraction_batch_id: extractionBatchId,
            extraction_page_number: tx.pageNumber,
          })
          .select('id, date, description, amount, type, category_code, status')
          .single();

        if (txError) {
          warnings.push(`Failed to insert transaction: ${tx.description} — ${txError.message}`);
          continue;
        }

        insertedTransactions.push({
          id: inserted.id,
          date: inserted.date,
          description: inserted.description,
          amount: inserted.amount,
          type: inserted.type,
          categoryCode: inserted.category_code ?? null,
          categoryName: matchedCategory?.name ?? null,
          categoryConfidence: categorization.confidence,
          status: inserted.status,
          pageNumber: tx.pageNumber,
        });
      }
    }

    // ── Step 11: Set notification status = processed ─────────────────────
    const { error: completeError } = await serviceClient
      .from('email_notifications')
      .update({ status: 'processed' })
      .eq('id', notificationId);

    if (completeError) {
      warnings.push('Failed to update notification status to processed');
    }

    // ── Return success response ──────────────────────────────────────────
    const responseData: Record<string, unknown> = {
      transactionsCreated: insertedTransactions.length,
      transactions: insertedTransactions,
      documentsStored,
      pagesProcessed: totalPages,
      extractionBatchId,
      warnings,
    };

    if (bothApisFailed) {
      return errorResponse(
        422,
        'PROCESSING_FAILED',
        'Vision API failed on all fallbacks. Transactions created with manual_entry_required status.',
        requestId,
      );
    }

    return successResponse(responseData, {
      request_id: requestId,
      duration_ms: Date.now() - startTime,
    });
  } catch (err) {
    console.error('Unhandled error in process-document:', err);
    return errorResponse(500, 'INTERNAL_ERROR', 'An unexpected error occurred', requestId);
  }
});

// ─── Helpers ────────────────────────────────────────────────────────────────

async function resetNotificationStatus(
  serviceClient: ReturnType<typeof createClient>,
  notificationId: string,
  status: string,
): Promise<void> {
  await serviceClient
    .from('email_notifications')
    .update({ status, processing_started_at: null })
    .eq('id', notificationId);
}
