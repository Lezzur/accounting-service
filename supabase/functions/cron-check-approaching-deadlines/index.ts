import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { successResponse, errorResponse } from '../_shared/response.ts';

const SUPABASE_FUNCTIONS_URL_SUFFIX = '/functions/v1';
const DRAFT_EMAIL_TIMEOUT_MS = 15_000;

interface ApproachingDeadline {
  id: string;
  client_id: string;
  deadline_type: string;
  due_date: string;
  period_label: string;
  status: string;
}

interface DraftEmailResult {
  subject: string;
  body: string;
}

/**
 * Invoke the draft-email Edge Function using the service role key.
 * Returns the generated draft or throws on failure.
 */
async function invokeDraftEmail(
  supabaseUrl: string,
  serviceRoleKey: string,
  clientId: string,
): Promise<DraftEmailResult> {
  const url = `${supabaseUrl}${SUPABASE_FUNCTIONS_URL_SUFFIX}/draft-email`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DRAFT_EMAIL_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({
        clientId,
        templateType: 'deadline_reminder',
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`draft-email returned ${res.status}: ${body.slice(0, 200)}`);
    }

    const json = await res.json();
    if (!json.success || !json.data?.subject || !json.data?.body) {
      throw new Error('draft-email returned unexpected response shape');
    }

    return { subject: json.data.subject, body: json.data.body };
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error('draft-email timed out');
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Parse a period_label like "January 2026" or "Q1 2026" into a date range
 * for querying email_notifications within that period.
 */
function periodLabelToDateRange(periodLabel: string): { start: string; end: string } | null {
  const MONTHS: Record<string, number> = {
    January: 0, February: 1, March: 2, April: 3, May: 4, June: 5,
    July: 6, August: 7, September: 8, October: 9, November: 10, December: 11,
  };

  // Monthly: "January 2026"
  const monthMatch = periodLabel.match(/^(\w+)\s+(\d{4})$/);
  if (monthMatch) {
    const month0 = MONTHS[monthMatch[1]];
    const year = parseInt(monthMatch[2], 10);
    if (month0 !== undefined) {
      const start = new Date(year, month0, 1);
      const end = new Date(year, month0 + 1, 0); // last day of month
      return {
        start: start.toISOString().slice(0, 10),
        end: end.toISOString().slice(0, 10),
      };
    }
  }

  // Quarterly: "Q1 2026"
  const quarterMatch = periodLabel.match(/^Q(\d)\s+(\d{4})$/);
  if (quarterMatch) {
    const q = parseInt(quarterMatch[1], 10);
    const year = parseInt(quarterMatch[2], 10);
    const startMonth0 = (q - 1) * 3;
    const start = new Date(year, startMonth0, 1);
    const end = new Date(year, startMonth0 + 3, 0);
    return {
      start: start.toISOString().slice(0, 10),
      end: end.toISOString().slice(0, 10),
    };
  }

  // Annual: "FY 2025"
  const fyMatch = periodLabel.match(/^FY\s+(\d{4})$/);
  if (fyMatch) {
    const year = parseInt(fyMatch[1], 10);
    return {
      start: `${year}-01-01`,
      end: `${year}-12-31`,
    };
  }

  return null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const startTime = Date.now();
  const requestId = `req_${crypto.randomUUID().slice(0, 12)}`;

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // ── Step 1: Query approaching deadlines (due within 3 days, not completed) ──

    const now = new Date();
    const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const todayStr = now.toISOString().slice(0, 10);
    const threeDayStr = threeDaysFromNow.toISOString().slice(0, 10);
    const sevenDayStr = sevenDaysFromNow.toISOString().slice(0, 10);

    // Fetch deadlines within 7 days (superset — we use the 3-day subset for drafts)
    const { data: deadlines, error: deadlinesError } = await serviceClient
      .from('deadlines')
      .select('id, client_id, deadline_type, due_date, period_label, status')
      .gte('due_date', todayStr)
      .lte('due_date', sevenDayStr)
      .neq('status', 'completed');

    if (deadlinesError) {
      console.error('Failed to fetch deadlines:', deadlinesError);
      return errorResponse(500, 'INTERNAL_ERROR', 'Failed to fetch approaching deadlines', requestId);
    }

    if (!deadlines || deadlines.length === 0) {
      console.log('No approaching deadlines found');
      return successResponse(
        { deadlinesChecked: 0, draftsGenerated: 0, draftsSkipped: 0, notificationsCreated: 0 },
        { request_id: requestId, duration_ms: Date.now() - startTime },
      );
    }

    // ── Step 2: Process deadlines within 3 days for draft generation ──

    const threeDay = (deadlines as ApproachingDeadline[]).filter(
      (d) => d.due_date <= threeDayStr,
    );

    let draftsGenerated = 0;
    let draftsSkipped = 0;
    const errors: { deadlineId: string; clientId: string; error: string }[] = [];

    for (const deadline of threeDay) {
      try {
        // 2a. Check if deliverable already received — query email_notifications
        //     for this client within the deadline's period
        const dateRange = periodLabelToDateRange(deadline.period_label);

        if (dateRange) {
          const { count: emailCount } = await serviceClient
            .from('email_notifications')
            .select('id', { count: 'exact', head: true })
            .eq('client_id', deadline.client_id)
            .gte('received_at', dateRange.start)
            .lte('received_at', `${dateRange.end}T23:59:59.999Z`)
            .in('status', ['unprocessed', 'processing', 'processed']);

          if (emailCount && emailCount > 0) {
            // Deliverable likely received — skip draft
            draftsSkipped++;
            continue;
          }
        }

        // 2b. Check if a draft already exists for this (client_id, deadline_id)
        const { count: draftCount } = await serviceClient
          .from('draft_emails')
          .select('id', { count: 'exact', head: true })
          .eq('client_id', deadline.client_id)
          .eq('deadline_id', deadline.id);

        if (draftCount && draftCount > 0) {
          draftsSkipped++;
          continue;
        }

        // 2c. Generate draft via draft-email Edge Function
        let draft: DraftEmailResult;
        try {
          draft = await invokeDraftEmail(supabaseUrl, serviceRoleKey, deadline.client_id);
        } catch (draftErr) {
          const msg = draftErr instanceof Error ? draftErr.message : String(draftErr);
          console.error(
            `Draft generation failed for deadline ${deadline.id} (client ${deadline.client_id}):`,
            msg,
          );
          errors.push({ deadlineId: deadline.id, clientId: deadline.client_id, error: msg });
          continue; // Don't abort — process remaining deadlines
        }

        // 2d. Store draft in draft_emails
        const { error: insertError } = await serviceClient
          .from('draft_emails')
          .insert({
            client_id: deadline.client_id,
            deadline_id: deadline.id,
            template_type: 'deadline_reminder',
            subject: draft.subject,
            body: draft.body,
            status: 'pending_review',
          });

        if (insertError) {
          console.error(
            `Failed to insert draft for deadline ${deadline.id}:`,
            insertError.message,
          );
          errors.push({
            deadlineId: deadline.id,
            clientId: deadline.client_id,
            error: `DB insert failed: ${insertError.message}`,
          });
          continue;
        }

        draftsGenerated++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`Unexpected error processing deadline ${deadline.id}:`, msg);
        errors.push({ deadlineId: deadline.id, clientId: deadline.client_id, error: msg });
      }
    }

    // ── Step 3: Upsert deadline_notifications for in-app banner (7-day window) ──
    //
    // The deadline_notifications table does not exist yet in the schema.
    // For now, we mark the approaching deadlines by updating their status
    // from 'upcoming' to 'in_progress' if they are within 7 days,
    // which surfaces them in the Toolbox UI's deadline banner.

    let notificationsCreated = 0;

    const upcomingDeadlines = (deadlines as ApproachingDeadline[]).filter(
      (d) => d.status === 'upcoming',
    );

    if (upcomingDeadlines.length > 0) {
      const upcomingIds = upcomingDeadlines.map((d) => d.id);
      const { error: updateError, count } = await serviceClient
        .from('deadlines')
        .update({ status: 'in_progress' })
        .in('id', upcomingIds);

      if (updateError) {
        console.error('Failed to update deadline statuses:', updateError.message);
      } else {
        notificationsCreated = count ?? upcomingDeadlines.length;
      }
    }

    // ── Step 4: Log summary ──

    const summary = {
      deadlinesChecked: deadlines.length,
      draftsGenerated,
      draftsSkipped,
      notificationsCreated,
      ...(errors.length > 0 && { errors }),
    };

    console.log('cron-check-approaching-deadlines summary:', JSON.stringify(summary));

    return successResponse(summary, {
      request_id: requestId,
      duration_ms: Date.now() - startTime,
    });
  } catch (err) {
    console.error('Unhandled error in cron-check-approaching-deadlines:', err);
    return errorResponse(500, 'INTERNAL_ERROR', 'An unexpected error occurred', requestId);
  }
});
