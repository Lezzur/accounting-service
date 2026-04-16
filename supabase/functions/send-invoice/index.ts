import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { z } from 'https://esm.sh/zod@3';
import { corsHeaders } from '../_shared/cors.ts';
import { successResponse, errorResponse } from '../_shared/response.ts';
import { decryptTokenWithKeyRotation } from '../_shared/encryption.ts';

const GMAIL_SEND_URL = 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send';
const TIMEOUT_MS = 30_000;

// ─── Validation ──────────────────────────────────────────────────────────────

const sendInvoiceSchema = z.object({
  invoiceId: z.string().uuid('Must be a valid UUID'),
});

// ─── MIME helpers ─────────────────────────────────────────────────────────────

function base64Encode(data: Uint8Array): string {
  let binary = '';
  for (const b of data) binary += String.fromCharCode(b);
  return btoa(binary);
}

function base64UrlEncode(data: Uint8Array): string {
  return base64Encode(data).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function textToBase64Url(text: string): string {
  return base64UrlEncode(new TextEncoder().encode(text));
}

function formatCurrency(amount: string | number): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return `₱${num.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' });
}

/**
 * Build a multipart MIME message with a PDF attachment, encoded as base64url
 * for the Gmail API `raw` field.
 */
function buildMimeWithAttachment(
  from: string,
  to: string,
  subject: string,
  htmlBody: string,
  pdfBytes: Uint8Array,
  pdfFilename: string,
): string {
  const boundary = `boundary_${crypto.randomUUID().replace(/-/g, '')}`;

  const mimeLines = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    base64Encode(new TextEncoder().encode(htmlBody)),
    '',
    `--${boundary}`,
    `Content-Type: application/pdf; name="${pdfFilename}"`,
    'Content-Transfer-Encoding: base64',
    `Content-Disposition: attachment; filename="${pdfFilename}"`,
    '',
    base64Encode(pdfBytes),
    '',
    `--${boundary}--`,
  ];

  return textToBase64Url(mimeLines.join('\r\n'));
}

/**
 * Compose a professional HTML email body for the invoice.
 */
function composeInvoiceEmailBody(invoice: {
  invoiceNumber: string;
  clientName: string;
  totalAmount: string;
  dueDate: string;
  issueDate: string;
  lineItemCount: number;
}): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family: Arial, sans-serif; color: #1a202c; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="border-bottom: 2px solid #1a365d; padding-bottom: 16px; margin-bottom: 24px;">
    <h1 style="color: #1a365d; margin: 0; font-size: 24px;">Numera</h1>
    <p style="color: #718096; margin: 4px 0 0; font-size: 12px;">Accounting Services</p>
  </div>

  <p>Dear ${invoice.clientName},</p>

  <p>Please find attached Invoice <strong>${invoice.invoiceNumber}</strong> for your records.</p>

  <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
    <tr>
      <td style="padding: 8px 12px; background: #f7fafc; border: 1px solid #e2e8f0; font-weight: bold;">Invoice Number</td>
      <td style="padding: 8px 12px; border: 1px solid #e2e8f0;">${invoice.invoiceNumber}</td>
    </tr>
    <tr>
      <td style="padding: 8px 12px; background: #f7fafc; border: 1px solid #e2e8f0; font-weight: bold;">Issue Date</td>
      <td style="padding: 8px 12px; border: 1px solid #e2e8f0;">${formatDate(invoice.issueDate)}</td>
    </tr>
    <tr>
      <td style="padding: 8px 12px; background: #f7fafc; border: 1px solid #e2e8f0; font-weight: bold;">Due Date</td>
      <td style="padding: 8px 12px; border: 1px solid #e2e8f0;">${formatDate(invoice.dueDate)}</td>
    </tr>
    <tr>
      <td style="padding: 8px 12px; background: #f7fafc; border: 1px solid #e2e8f0; font-weight: bold;">Items</td>
      <td style="padding: 8px 12px; border: 1px solid #e2e8f0;">${invoice.lineItemCount} line item${invoice.lineItemCount !== 1 ? 's' : ''}</td>
    </tr>
    <tr>
      <td style="padding: 8px 12px; background: #1a365d; color: white; border: 1px solid #1a365d; font-weight: bold;">Total Amount</td>
      <td style="padding: 8px 12px; background: #1a365d; color: white; border: 1px solid #1a365d; font-weight: bold; font-size: 16px;">${formatCurrency(invoice.totalAmount)}</td>
    </tr>
  </table>

  <p>If you have any questions about this invoice, please don't hesitate to reach out.</p>

  <p style="margin-top: 32px;">
    Best regards,<br>
    <strong>Numera Accounting Services</strong>
  </p>

  <hr style="border: none; border-top: 1px solid #e2e8f0; margin-top: 32px;">
  <p style="font-size: 11px; color: #718096;">This invoice was generated and sent via Numera. The PDF is attached to this email.</p>
</body>
</html>`;
}

// ─── Gmail send with attachment ──────────────────────────────────────────────

async function sendGmailWithAttachment(
  accessToken: string,
  from: string,
  to: string,
  subject: string,
  htmlBody: string,
  pdfBytes: Uint8Array,
  pdfFilename: string,
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
        raw: buildMimeWithAttachment(from, to, subject, htmlBody, pdfBytes, pdfFilename),
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

// ─── Edge Function ───────────────────────────────────────────────────────────

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

    const parsed = sendInvoiceSchema.safeParse(rawBody);
    if (!parsed.success) {
      const details = parsed.error.issues.map((i) => ({
        field: i.path.join('.'),
        issue: i.message,
      }));
      return errorResponse(400, 'VALIDATION_FAILED', 'Request validation failed', requestId, details);
    }

    const { invoiceId } = parsed.data;

    const serviceClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // --- Load invoice with client data and line items ---
    const { data: invoice, error: invoiceError } = await serviceClient
      .from('invoices')
      .select('*, clients(id, business_name, contact_email, registered_address), invoice_line_items(*)')
      .eq('id', invoiceId)
      .single();

    if (invoiceError || !invoice) {
      return errorResponse(404, 'NOT_FOUND', 'Invoice not found', requestId);
    }

    // --- Validate invoice status ---
    if (invoice.status !== 'draft' && invoice.status !== 'sent') {
      return errorResponse(
        422,
        'PROCESSING_FAILED',
        `Invoice cannot be sent with status '${invoice.status}'. Only 'draft' or 'sent' invoices can be sent.`,
        requestId,
      );
    }

    const client = invoice.clients as {
      id: string;
      business_name: string;
      contact_email: string;
      registered_address: string;
    } | null;

    if (!client?.contact_email) {
      return errorResponse(
        422,
        'PROCESSING_FAILED',
        'Client does not have a contact email address',
        requestId,
      );
    }

    const lineItems = (
      invoice.invoice_line_items as Array<{
        description: string;
        quantity: number;
        unit_price: string;
        line_total: string;
        display_order: number;
      }>
    )?.sort((a, b) => a.display_order - b.display_order) ?? [];

    // --- Render invoice PDF via render-pdf function ---
    let pdfBytes: Uint8Array;
    try {
      const renderRes = await fetch(`${supabaseUrl}/functions/v1/render-pdf`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${supabaseServiceKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ type: 'invoice', id: invoiceId }),
      });

      if (!renderRes.ok) {
        const errText = await renderRes.text().catch(() => '');
        console.error('render-pdf failed:', renderRes.status, errText);
        throw new Error('RENDER_FAILED');
      }

      const renderResult = await renderRes.json();
      if (!renderResult.success || !renderResult.data?.signedUrl) {
        throw new Error('RENDER_FAILED');
      }

      // Download the rendered PDF from storage
      const pdfRes = await fetch(renderResult.data.signedUrl);
      if (!pdfRes.ok) {
        throw new Error('RENDER_FAILED');
      }

      pdfBytes = new Uint8Array(await pdfRes.arrayBuffer());
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (msg === 'RENDER_FAILED') {
        return errorResponse(422, 'PROCESSING_FAILED', 'Failed to render invoice PDF', requestId);
      }
      console.error('PDF rendering error:', err);
      return errorResponse(422, 'PROCESSING_FAILED', 'Failed to render invoice PDF', requestId);
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
      return errorResponse(503, 'DEPENDENCY_UNAVAILABLE', 'Failed to decrypt Gmail credentials — connection may have expired', requestId);
    }

    // --- Compose and send email via Gmail API ---
    const subject = `Invoice ${invoice.invoice_number} from Numera`;
    const pdfFilename = `${invoice.invoice_number}.pdf`;
    const htmlBody = composeInvoiceEmailBody({
      invoiceNumber: invoice.invoice_number,
      clientName: client.business_name,
      totalAmount: invoice.total_amount,
      dueDate: invoice.due_date,
      issueDate: invoice.issue_date,
      lineItemCount: lineItems.length,
    });

    let gmailResult: { id: string; threadId: string };
    try {
      gmailResult = await sendGmailWithAttachment(
        accessToken,
        connection.gmail_email,
        client.contact_email,
        subject,
        htmlBody,
        pdfBytes,
        pdfFilename,
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : '';
      if (msg === 'TIMEOUT') {
        return errorResponse(503, 'DEPENDENCY_UNAVAILABLE', 'Gmail API request timed out', requestId);
      }
      if (msg === 'UNREACHABLE') {
        return errorResponse(503, 'DEPENDENCY_UNAVAILABLE', 'Gmail API unreachable', requestId);
      }
      if (msg === 'GMAIL_ERROR') {
        return errorResponse(503, 'DEPENDENCY_UNAVAILABLE', 'Gmail API returned an error — invoice status was not updated', requestId);
      }
      throw e;
    }

    // --- Gmail send succeeded — update invoice status ---
    const sentAt = new Date().toISOString();

    await serviceClient
      .from('invoices')
      .update({
        status: 'sent',
        sent_at: sentAt,
        gmail_message_id: gmailResult.id,
      })
      .eq('id', invoiceId);

    // --- Audit log ---
    await serviceClient.from('client_activity_log').insert({
      client_id: client.id,
      action: 'invoice_sent',
      details: {
        invoice_id: invoiceId,
        invoice_number: invoice.invoice_number,
        recipient: client.contact_email,
        gmail_message_id: gmailResult.id,
        total_amount: invoice.total_amount,
        sent_at: sentAt,
      },
    });

    return successResponse(
      {
        gmailMessageId: gmailResult.id,
        sentTo: client.contact_email,
        sentAt,
        invoiceNumber: invoice.invoice_number,
      },
      { request_id: requestId, duration_ms: Date.now() - startTime },
    );
  } catch (err) {
    console.error('Unhandled error in send-invoice:', err);
    return errorResponse(500, 'INTERNAL_ERROR', 'An unexpected error occurred', requestId);
  }
});
