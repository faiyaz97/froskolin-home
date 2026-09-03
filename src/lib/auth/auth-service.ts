import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { deriveSupabasePassword, GENERIC_AUTH_ERROR } from "./pin";

/**
 * Account provisioning crosses the Auth/database boundary and is deliberately
 * kept here. Callers clean up the Auth user if the following alias,
 * household, or membership write fails.
 */
export async function provisionAuthUser(alias: string, pin: string) {
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email: alias,
    password: deriveSupabasePassword(alias, pin),
    email_confirm: true,
  });
  if (error || !data.user) throw new Error("Unable to create the account.");
  return data.user;
}

export async function signInWithInternalAlias(alias: string, pin: string) {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: alias,
    password: deriveSupabasePassword(alias, pin),
  });
  if (error) throw new Error(GENERIC_AUTH_ERROR);
}
