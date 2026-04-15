import { corsHeaders } from './cors.ts';

export function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

export function successResponse(
  data: Record<string, unknown>,
  meta: { request_id: string; duration_ms: number },
): Response {
  return jsonResponse({ success: true, data, meta });
}

export function errorResponse(
  status: number,
  code: string,
  message: string,
  requestId: string,
  details?: unknown[],
): Response {
  return jsonResponse(
    { error: { code, message, request_id: requestId, ...(details && { details }) } },
    status,
  );
}
