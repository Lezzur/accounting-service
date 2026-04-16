import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { z } from 'https://esm.sh/zod@3';

const ALLOWED_ORIGINS = [
  'https://numera.ph',
  'http://localhost:3000',
  'http://localhost:3001',
];

function corsHeaders(requestOrigin: string | null): Record<string, string> {
  const origin =
    requestOrigin && ALLOWED_ORIGINS.includes(requestOrigin)
      ? requestOrigin
      : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  };
}

const ContactFormSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  phone: z.string().max(20).optional(),
  businessName: z.string().max(200).optional(),
  message: z.string().min(10).max(1000),
  website: z.string().optional(),
});

const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_HOURS = 1;

Deno.serve(async (req: Request): Promise<Response> => {
  const cors = corsHeaders(req.headers.get('origin'));
  try {

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors });
  }

  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405, headers: cors });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ error: 'VALIDATION_FAILED', message: 'Invalid JSON' }),
      { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } },
    );
  }

  // Allowlist fields — strip everything else
  const allowed = ['name', 'email', 'phone', 'businessName', 'message', 'website'];
  const filtered = Object.fromEntries(
    allowed
      .filter((k) => k in (body as Record<string, unknown>))
      .map((k) => [k, (body as Record<string, unknown>)[k]]),
  );

  const parsed = ContactFormSchema.safeParse(filtered);
  if (!parsed.success) {
    return new Response(
      JSON.stringify({ error: 'VALIDATION_FAILED', details: parsed.error.flatten() }),
      { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } },
    );
  }

  const { name, email, phone, businessName, message, website } = parsed.data;

  // Honeypot — silently succeed, give bot no signal
  if (website && website.length > 0) {
    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } },
    );
  }

  // Normalize email
  const normalizedEmail = email.trim().toLowerCase();

  // Service client — bypasses RLS for rate limit table and leads insert
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  // Extract IP for rate limiting
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    req.headers.get('cf-connecting-ip') ??
    'unknown';

  // Rate limit check — count submissions from this IP in the last hour
  const windowStart = new Date(
    Date.now() - RATE_LIMIT_WINDOW_HOURS * 60 * 60 * 1000,
  ).toISOString();

  const { count, error: countError } = await supabase
    .from('contact_form_rate_limits')
    .select('*', { count: 'exact', head: true })
    .eq('ip_address', ip)
    .gte('submitted_at', windowStart);

  if (countError) {
    console.error('Rate limit check failed:', countError);
    // Fail open — don't block legitimate users if the rate limit table is unavailable
  } else if ((count ?? 0) >= RATE_LIMIT_MAX) {
    return new Response(
      JSON.stringify({ error: 'RATE_LIMITED' }),
      { status: 429, headers: { ...cors, 'Content-Type': 'application/json' } },
    );
  }

  // Record this submission in the rate limit table
  const { error: rlInsertError } = await supabase
    .from('contact_form_rate_limits')
    .insert({ ip_address: ip });

  if (rlInsertError) {
    console.error('Rate limit record insert failed:', rlInsertError);
  }

  // Insert lead
  const { error: leadError } = await supabase.from('leads').insert({
    contact_name: name.trim(),
    contact_email: normalizedEmail,
    contact_phone: phone?.trim() ?? null,
    business_name: businessName?.trim() || name.trim(),
    source: 'website_form',
    stage: 'lead',
    created_by: null,
    notes: message.trim(),
  });

  if (leadError) {
    console.error('Lead insert failed:', leadError);
    return new Response(
      JSON.stringify({ error: 'INTERNAL_ERROR', debug: leadError }),
      { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } },
    );
  }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('Unhandled error:', err);
    return new Response(
      JSON.stringify({ error: 'INTERNAL_ERROR', debug: String(err) }),
      { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } },
    );
  }
});
