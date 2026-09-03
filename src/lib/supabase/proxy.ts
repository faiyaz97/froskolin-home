import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { getSupabasePublicConfig } from "./env";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  try {
    const { url, publishableKey } = getSupabasePublicConfig();
    const supabase = createServerClient(url, publishableKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    });

    // getUser validates the token with Auth; do not rely on unverified cookie data.
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const mustChangePin = user?.app_metadata?.must_change_pin === true;
    if (
      mustChangePin &&
      request.nextUrl.pathname.startsWith("/h/") &&
      !request.nextUrl.pathname.startsWith("/change-pin")
    ) {
      const redirect = NextResponse.redirect(new URL("/change-pin", request.url));
      response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
      return redirect;
    }
  } catch {
    // Configuration errors are shown by the public/auth pages, not swallowed by proxy.
  }

  return response;
}
