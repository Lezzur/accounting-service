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
    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    const { data: clients, error: clientsError } = await serviceClient
      .from('clients')
      .select('id, bir_registration_type, fiscal_year_start_month')
      .eq('status', 'active');

    if (clientsError) {
      console.error('Failed to fetch clients:', clientsError);
      return errorResponse(500, 'INTERNAL_ERROR', 'Failed to fetch active clients', requestId);
    }

    if (!clients || clients.length === 0) {
      return successResponse(
        { clientsProcessed: 0, totalDeadlinesCreated: 0, totalDeadlinesSkipped: 0 },
        { request_id: requestId, duration_ms: Date.now() - startTime },
      );
    }

    const referenceDate = new Date();
    let totalCreated = 0;
    let totalSkipped = 0;
    const errors: { clientId: string; error: string }[] = [];

    for (const client of clients) {
      const deadlines = generateDeadlinesForClient(
        client.id,
        client.bir_registration_type,
        client.fiscal_year_start_month,
        referenceDate,
      );

      const { data: inserted, error: insertError } = await serviceClient
        .from('deadlines')
        .upsert(deadlines, { onConflict: 'client_id,deadline_type,period_label', ignoreDuplicates: true })
        .select('id');

      if (insertError) {
        console.error(`Deadline insert error for client ${client.id}:`, insertError);
        errors.push({ clientId: client.id, error: insertError.message });
        continue;
      }

      const created = inserted?.length ?? 0;
      totalCreated += created;
      totalSkipped += deadlines.length - created;
    }

    return successResponse(
      {
        clientsProcessed: clients.length,
        totalDeadlinesCreated: totalCreated,
        totalDeadlinesSkipped: totalSkipped,
        ...(errors.length > 0 && { errors }),
      },
      { request_id: requestId, duration_ms: Date.now() - startTime },
    );
  } catch (err) {
    console.error('Unhandled error:', err);
    return errorResponse(500, 'INTERNAL_ERROR', 'An unexpected error occurred', requestId);
  }
});
