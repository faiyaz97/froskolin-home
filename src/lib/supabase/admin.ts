import { createClient } from "@supabase/supabase-js";

import { getSupabasePublicConfig, getSupabaseServiceRoleKey } from "./env";

/** Server-only: never import this module from a Client Component. */
export function createAdminClient() {
  const { url } = getSupabasePublicConfig();
  return createClient(url, getSupabaseServiceRoleKey(), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
