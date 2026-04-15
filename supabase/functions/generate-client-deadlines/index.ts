import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { successResponse, errorResponse } from '../_shared/response.ts';
import { generateDeadlinesForClient } from '../_shared/deadline-generator.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const startTime = Date.now();
  const requestId = `req_${crypto.randomUUID().slice(0, 12)}`;

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return errorResponse(401, 'UNAUTHORIZED', 'Missing authorization header', requestId);
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return errorResponse(401, 'UNAUTHORIZED', 'Invalid or expired token', requestId);
    }

    const body = await req.json().catch(() => null);
    if (!body?.clientId || typeof body.clientId !== 'string') {
      return errorResponse(400, 'VALIDATION_FAILED', 'Missing or invalid clientId', requestId, [
        { field: 'clientId', issue: 'Must be a valid UUID string' },
      ]);
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(body.clientId)) {
      return errorResponse(400, 'VALIDATION_FAILED', 'clientId is not a valid UUID', requestId, [
        { field: 'clientId', issue: 'Must be a valid UUID' },
      ]);
    }

    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    const { data: client, error: clientError } = await serviceClient
      .from('clients')
      .select('id, bir_registration_type, fiscal_year_start_month')
      .eq('id', body.clientId)
      .single();

    if (clientError || !client) {
      return errorResponse(404, 'NOT_FOUND', 'Client not found', requestId);
    }

    const deadlines = generateDeadlinesForClient(
      client.id,
      client.bir_registration_type,
      client.fiscal_year_start_month,
      new Date(),
    );

    const { data: inserted, error: insertError } = await serviceClient
      .from('deadlines')
      .upsert(deadlines, { onConflict: 'client_id,deadline_type,period_label', ignoreDuplicates: true })
      .select('id');

    if (insertError) {
      console.error('Deadline insert error:', insertError);
      return errorResponse(500, 'INTERNAL_ERROR', 'Failed to insert deadlines', requestId);
    }

    const createdCount = inserted?.length ?? 0;
    const skippedCount = deadlines.length - createdCount;

    const now = new Date();
    const endMonth = new Date(now.getFullYear(), now.getMonth() + 12, 1);
    const startLabel = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const endLabel = `${endMonth.getFullYear()}-${String(endMonth.getMonth() + 1).padStart(2, '0')}`;

    return successResponse(
      {
        deadlinesCreated: createdCount,
        deadlinesSkipped: skippedCount,
        clientId: client.id,
        periodCovered: `${startLabel} to ${endLabel}`,
      },
      { request_id: requestId, duration_ms: Date.now() - startTime },
    );
  } catch (err) {
    console.error('Unhandled error:', err);
    return errorResponse(500, 'INTERNAL_ERROR', 'An unexpected error occurred', requestId);
  }
});
