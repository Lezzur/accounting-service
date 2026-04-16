import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "../../../../../lib/supabase/server";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const origin = new URL(request.url).origin;
  const { searchParams } = new URL(request.url);

  function toSettings(params: Record<string, string>): NextResponse {
    const url = new URL("/settings", origin);
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v);
    }
    return NextResponse.redirect(url);
  }

  const oauthError = searchParams.get("error");
  if (oauthError) {
    const message =
      searchParams.get("error_description") ?? "Google OAuth was denied.";
    return toSettings({ gmail: "error", message });
  }

  const code = searchParams.get("code");
  if (!code) {
    return toSettings({ gmail: "error", message: "Missing authorization code." });
  }

  // Get the current user's session to pass to the edge function
  const supabase = createClient();
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError || !session) {
    return toSettings({
      gmail: "error",
      message: "Not authenticated. Please sign in and try again.",
    });
  }

  // Call the connect-gmail edge function
  const edgeFunctionUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/connect-gmail`;

  let resp: Response;
  try {
    resp = await fetch(edgeFunctionUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ code }),
    });
  } catch {
    return toSettings({
      gmail: "error",
      message: "Could not reach the Gmail connect service. Please try again.",
    });
  }

  if (!resp.ok) {
    let message = "Failed to connect Gmail.";
    try {
      const body = (await resp.json()) as { error?: { message?: string } };
      if (body?.error?.message) {
        message = body.error.message;
      }
    } catch {
      // ignore JSON parse error
    }
    return toSettings({ gmail: "error", message });
  }

  return toSettings({ gmail: "connected" });
}
