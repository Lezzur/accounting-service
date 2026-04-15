// supabase/functions/export-sheets/index.ts
// Export transaction data or report tables to a new Google Sheets spreadsheet.

import { createClient } from 'npm:@supabase/supabase-js@2'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ExportRequest {
  type: 'transactions' | 'report'
  clientId: string
  periodStart: string
  periodEnd: string
  reportId?: string
}

interface ValidationError {
  code: string
  message: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const SHEETS_BASE = 'https://sheets.googleapis.com/v4/spreadsheets'
const DRIVE_FILES_BASE = 'https://www.googleapis.com/drive/v3/files'
const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive',
]

const REPORT_TYPE_LABELS: Record<string, string> = {
  profit_and_loss: 'PnL',
  balance_sheet: 'BalanceSheet',
  cash_flow: 'CashFlow',
  bank_reconciliation: 'BankRec',
  ar_ageing: 'ARAgeing',
  ap_ageing: 'APAgeing',
  general_ledger: 'GenLedger',
  trial_balance: 'TrialBalance',
}

// ─── Main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS })
  }

  const t0 = Date.now()
  const requestId = `req_${crypto.randomUUID().replace(/-/g, '').slice(0, 6)}`

  try {
    // ── Auth ──────────────────────────────────────────────────────────────────
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return errorResponse(401, 'UNAUTHORIZED', 'Missing or invalid Authorization header', requestId, t0)
    }
    const jwt = authHeader.slice(7)

    // ── Parse + validate request body ─────────────────────────────────────────
    let body: ExportRequest
    try {
      body = await req.json()
    } catch {
      return errorResponse(400, 'VALIDATION_FAILED', 'Invalid JSON body', requestId, t0)
    }

    const validationErr = validateRequest(body)
    if (validationErr) {
      return errorResponse(400, validationErr.code, validationErr.message, requestId, t0)
    }

    // ── Verify JWT ────────────────────────────────────────────────────────────
    const anonClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: `Bearer ${jwt}` } } },
    )
    const { data: { user }, error: authErr } = await anonClient.auth.getUser()
    if (authErr || !user) {
      return errorResponse(401, 'UNAUTHORIZED', 'Invalid or expired token', requestId, t0)
    }

    // ── Service client for data queries ───────────────────────────────────────
    const svc = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    )

    // ── Fetch client ──────────────────────────────────────────────────────────
    const { data: client, error: clientErr } = await svc
      .from('clients')
      .select('id, business_name, google_sheet_folder_url')
      .eq('id', body.clientId)
      .single()

    if (clientErr || !client) {
      return errorResponse(404, 'NOT_FOUND', 'Client not found', requestId, t0)
    }

    if (!client.google_sheet_folder_url) {
      return errorResponse(422, 'PROCESSING_FAILED', 'Client has no Google Sheets folder configured', requestId, t0)
    }

    const folderId = extractFolderId(client.google_sheet_folder_url)
    if (!folderId) {
      return errorResponse(422, 'PROCESSING_FAILED', 'Client google_sheet_folder_url is not a valid Google Drive folder URL', requestId, t0)
    }

    // ── Fetch data ────────────────────────────────────────────────────────────
    let headers: string[]
    let rows: (string | number | null)[][]
    let sheetName: string
    let typeLabel: string

    if (body.type === 'transactions') {
      const { data: txns, error: txnErr } = await svc
        .from('transactions')
        .select('date, description, type, amount, currency, category_code, status, chart_of_accounts!category_code(name)')
        .eq('client_id', body.clientId)
        .gte('date', body.periodStart)
        .lte('date', body.periodEnd)
        .order('date')

      if (txnErr) {
        console.error('[export-sheets] transaction query error:', txnErr)
        throw new Error(`Failed to fetch transactions: ${txnErr.message}`)
      }

      headers = ['Date', 'Description', 'Debit/Credit', 'Amount (₱)', 'Currency', 'Category Code', 'Category', 'Status']
      rows = (txns ?? []).map((t) => [
        t.date,
        t.description,
        t.type,
        parseFloat(t.amount),
        t.currency,
        t.category_code,
        // deno-lint-ignore no-explicit-any
        (t.chart_of_accounts as any)?.name ?? '',
        t.status,
      ])
      sheetName = 'Transactions'
      typeLabel = 'Transactions'
    } else {
      // type === 'report'
      const { data: report, error: reportErr } = await svc
        .from('financial_reports')
        .select('id, client_id, report_type, period_start, period_end')
        .eq('id', body.reportId!)
        .eq('client_id', body.clientId)
        .single()

      if (reportErr || !report) {
        return errorResponse(404, 'NOT_FOUND', 'Report not found', requestId, t0)
      }

      const { data: txns, error: txnErr } = await svc
        .from('transactions')
        .select('category_code, amount, type, chart_of_accounts!category_code(name, type)')
        .eq('client_id', body.clientId)
        .gte('date', report.period_start)
        .lte('date', report.period_end)
        .eq('status', 'approved')
        .order('category_code')

      if (txnErr) {
        console.error('[export-sheets] report transaction query error:', txnErr)
        throw new Error(`Failed to fetch transactions for report: ${txnErr.message}`)
      }

      const reportData = buildReportRows(txns ?? [])
      headers = reportData.headers
      rows = reportData.rows
      sheetName = 'Report'
      typeLabel = REPORT_TYPE_LABELS[report.report_type] ?? 'Report'
    }

    // ── Google service account credentials ────────────────────────────────────
    const googleEmail = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL')
    const googleKeyRaw = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY')
    if (!googleEmail || !googleKeyRaw) {
      console.error('[export-sheets] Missing Google service account env vars')
      throw new Error('Missing Google service account credentials')
    }
    const googleKey = googleKeyRaw.replace(/\\n/g, '\n')

    // ── Build title ───────────────────────────────────────────────────────────
    const title = buildTitle(typeLabel, client.business_name, body.periodStart, body.periodEnd)

    // ── Google API operations (503 on any failure) ────────────────────────────
    let spreadsheetId: string
    try {
      const accessToken = await getGoogleAccessToken(googleEmail, googleKey, GOOGLE_SCOPES)
      spreadsheetId = await createSpreadsheet(accessToken, title, sheetName)
      await writeSheetData(accessToken, spreadsheetId, sheetName, headers, rows)
      await formatSheet(accessToken, spreadsheetId, headers, rows.length)
      await moveToFolder(accessToken, spreadsheetId, folderId)
    } catch (err) {
      console.error('[export-sheets] Google API error:', err)
      return errorResponse(503, 'DEPENDENCY_UNAVAILABLE', 'Google Sheets API unreachable', requestId, t0)
    }

    const spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}`

    return new Response(
      JSON.stringify({
        success: true,
        data: { spreadsheetUrl, spreadsheetId, title },
        meta: { request_id: requestId, duration_ms: Date.now() - t0 },
      }),
      { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    console.error('[export-sheets] Unhandled error:', err)
    return errorResponse(500, 'INTERNAL_ERROR', 'An unexpected error occurred', requestId, t0)
  }
})

// ─── Validation ───────────────────────────────────────────────────────────────

function validateRequest(body: unknown): ValidationError | null {
  if (!body || typeof body !== 'object') {
    return { code: 'VALIDATION_FAILED', message: 'Request body must be a JSON object' }
  }
  const b = body as Record<string, unknown>

  if (!['transactions', 'report'].includes(b.type as string)) {
    return { code: 'VALIDATION_FAILED', message: 'type must be "transactions" or "report"' }
  }
  if (!b.clientId || typeof b.clientId !== 'string') {
    return { code: 'VALIDATION_FAILED', message: 'clientId is required and must be a string' }
  }
  if (!b.periodStart || !/^\d{4}-\d{2}-\d{2}$/.test(b.periodStart as string)) {
    return { code: 'VALIDATION_FAILED', message: 'periodStart is required in YYYY-MM-DD format' }
  }
  if (!b.periodEnd || !/^\d{4}-\d{2}-\d{2}$/.test(b.periodEnd as string)) {
    return { code: 'VALIDATION_FAILED', message: 'periodEnd is required in YYYY-MM-DD format' }
  }
  if (b.type === 'report' && !b.reportId) {
    return { code: 'INVALID_INPUT', message: 'reportId is required when type is "report"' }
  }
  return null
}

// ─── Report data builder ──────────────────────────────────────────────────────

function buildReportRows(
  // deno-lint-ignore no-explicit-any
  transactions: any[],
): { headers: string[]; rows: (string | number | null)[][] } {
  // Aggregate by category_code, sum amounts
  const agg = new Map<string, { code: string; name: string; accountType: string; total: number }>()

  for (const t of transactions) {
    const code: string = t.category_code ?? 'UNKNOWN'
    if (!agg.has(code)) {
      agg.set(code, {
        code,
        // deno-lint-ignore no-explicit-any
        name: (t.chart_of_accounts as any)?.name ?? code,
        // deno-lint-ignore no-explicit-any
        accountType: (t.chart_of_accounts as any)?.type ?? '',
        total: 0,
      })
    }
    agg.get(code)!.total += parseFloat(t.amount)
  }

  // Sort: assets → liabilities → equity → revenue → expenses
  const typeOrder: Record<string, number> = {
    asset: 0, liability: 1, equity: 2, revenue: 3, expense: 4,
  }
  const sorted = [...agg.values()].sort((a, b) => {
    const diff = (typeOrder[a.accountType] ?? 9) - (typeOrder[b.accountType] ?? 9)
    return diff !== 0 ? diff : a.code.localeCompare(b.code)
  })

  return {
    headers: ['Account Code', 'Account Name', 'Account Type', 'Total (₱)'],
    rows: sorted.map((r) => [r.code, r.name, r.accountType, r.total]),
  }
}

// ─── Title builder ────────────────────────────────────────────────────────────

function buildTitle(
  typeLabel: string,
  clientName: string,
  periodStart: string,
  periodEnd: string,
): string {
  // Sanitize client name: keep alphanumerics, collapse everything else
  const sanitized = clientName.replace(/[^a-zA-Z0-9]/g, '').slice(0, 30)
  // Timestamp: YYYYMMDDTHHmmss
  const ts = new Date().toISOString()
    .replace(/-/g, '')
    .replace(/:/g, '')
    .slice(0, 15)
  const period = `${periodStart}_${periodEnd}`
  return `${typeLabel}-${sanitized}-${period}-${ts}`
}

// ─── Folder ID extraction ─────────────────────────────────────────────────────

function extractFolderId(url: string): string | null {
  const match = url.match(/\/folders\/([a-zA-Z0-9_-]+)/)
  return match ? match[1] : null
}

// ─── Google service account auth ──────────────────────────────────────────────

async function getGoogleAccessToken(
  clientEmail: string,
  privateKeyPem: string,
  scopes: string[],
): Promise<string> {
  const now = Math.floor(Date.now() / 1000)

  const header = { alg: 'RS256', typ: 'JWT' }
  const payload = {
    iss: clientEmail,
    scope: scopes.join(' '),
    aud: GOOGLE_TOKEN_URL,
    exp: now + 3600,
    iat: now,
  }

  const encHeader = base64url(JSON.stringify(header))
  const encPayload = base64url(JSON.stringify(payload))
  const signingInput = `${encHeader}.${encPayload}`

  const keyData = pemToArrayBuffer(privateKeyPem)
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    keyData,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  )

  const signatureBuffer = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    new TextEncoder().encode(signingInput),
  )
  const encSignature = base64urlFromBuffer(signatureBuffer)

  const jwtToken = `${signingInput}.${encSignature}`

  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwtToken,
    }),
    signal: AbortSignal.timeout(15000),
  })

  if (!res.ok) {
    throw new Error(`Google token exchange failed: ${res.status} ${await res.text()}`)
  }

  const { access_token } = await res.json()
  return access_token
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const b64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s+/g, '')
  const binary = atob(b64)
  const buffer = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    buffer[i] = binary.charCodeAt(i)
  }
  return buffer.buffer
}

function base64url(str: string): string {
  return btoa(unescape(encodeURIComponent(str)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

function base64urlFromBuffer(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  // Process in chunks to avoid stack overflow on large buffers
  const CHUNK = 1024
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.slice(i, i + CHUNK))
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

// ─── Google Sheets API ────────────────────────────────────────────────────────

async function createSpreadsheet(
  token: string,
  title: string,
  sheetName: string,
): Promise<string> {
  const res = await fetch(SHEETS_BASE, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      properties: { title },
      sheets: [{ properties: { title: sheetName, sheetId: 0 } }],
    }),
    signal: AbortSignal.timeout(30000),
  })

  if (!res.ok) {
    throw new Error(`Create spreadsheet failed: ${res.status} ${await res.text()}`)
  }

  const data = await res.json()
  return data.spreadsheetId as string
}

async function writeSheetData(
  token: string,
  spreadsheetId: string,
  sheetName: string,
  headers: string[],
  rows: (string | number | null)[][],
): Promise<void> {
  const values = [headers, ...rows]
  const range = `${sheetName}!A1`
  const url = `${SHEETS_BASE}/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`

  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ values }),
    signal: AbortSignal.timeout(30000),
  })

  if (!res.ok) {
    throw new Error(`Write sheet data failed: ${res.status} ${await res.text()}`)
  }
}

async function formatSheet(
  token: string,
  spreadsheetId: string,
  headers: string[],
  dataRowCount: number,
): Promise<void> {
  const sheetId = 0
  // +1 for the header row; clamp to at least 2 so the range is valid even if empty
  const endRow = Math.max(dataRowCount + 1, 2)

  // deno-lint-ignore no-explicit-any
  const requests: any[] = []

  // Bold the header row
  requests.push({
    repeatCell: {
      range: { sheetId, startRowIndex: 0, endRowIndex: 1 },
      cell: { userEnteredFormat: { textFormat: { bold: true } } },
      fields: 'userEnteredFormat.textFormat.bold',
    },
  })

  // Format individual columns based on header content
  for (let i = 0; i < headers.length; i++) {
    const h = headers[i]

    if (h.toLowerCase().includes('date')) {
      requests.push({
        repeatCell: {
          range: { sheetId, startRowIndex: 1, endRowIndex: endRow, startColumnIndex: i, endColumnIndex: i + 1 },
          cell: { userEnteredFormat: { numberFormat: { type: 'DATE', pattern: 'yyyy-mm-dd' } } },
          fields: 'userEnteredFormat.numberFormat',
        },
      })
    }

    if (h.includes('₱') || h.toLowerCase().includes('amount') || h.toLowerCase().includes('total')) {
      requests.push({
        repeatCell: {
          range: { sheetId, startRowIndex: 1, endRowIndex: endRow, startColumnIndex: i, endColumnIndex: i + 1 },
          cell: { userEnteredFormat: { numberFormat: { type: 'NUMBER', pattern: '₱#,##0.00' } } },
          fields: 'userEnteredFormat.numberFormat',
        },
      })
    }
  }

  // Auto-resize all columns
  requests.push({
    autoResizeDimensions: {
      dimensions: { sheetId, dimension: 'COLUMNS', startIndex: 0, endIndex: headers.length },
    },
  })

  const res = await fetch(`${SHEETS_BASE}/${spreadsheetId}:batchUpdate`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ requests }),
    signal: AbortSignal.timeout(30000),
  })

  if (!res.ok) {
    throw new Error(`Format sheet failed: ${res.status} ${await res.text()}`)
  }
}

// ─── Google Drive API ─────────────────────────────────────────────────────────

async function moveToFolder(
  token: string,
  fileId: string,
  folderId: string,
): Promise<void> {
  // Fetch current parents so we can remove them when adding the target folder
  const metaRes = await fetch(`${DRIVE_FILES_BASE}/${fileId}?fields=parents`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(15000),
  })

  if (!metaRes.ok) {
    throw new Error(`Fetch file parents failed: ${metaRes.status} ${await metaRes.text()}`)
  }

  const { parents } = await metaRes.json() as { parents?: string[] }
  const removeParents = (parents ?? []).join(',')

  const patchUrl = `${DRIVE_FILES_BASE}/${fileId}?addParents=${folderId}${removeParents ? `&removeParents=${removeParents}` : ''}&fields=id,parents`

  const res = await fetch(patchUrl, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(15000),
  })

  if (!res.ok) {
    throw new Error(`Move to folder failed: ${res.status} ${await res.text()}`)
  }
}

// ─── Response helpers ─────────────────────────────────────────────────────────

function errorResponse(
  status: number,
  code: string,
  message: string,
  requestId: string,
  t0: number,
): Response {
  return new Response(
    JSON.stringify({
      success: false,
      error: { code, message },
      meta: { request_id: requestId, duration_ms: Date.now() - t0 },
    }),
    { status, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
  )
}
