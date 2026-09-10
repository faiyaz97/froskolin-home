import { redirect } from "next/navigation";

import { PublicForm } from "@/components/public/auth-form";
import { PublicAuthShell } from "@/components/public/auth-shell";
import { createClient } from "@/lib/supabase/server";

export default async function EntryPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string | string[] }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data: membership } = await supabase
      .from("household_members")
      .select("household_id")
      .eq("user_id", user.id)
      .is("removed_at", null)
      .maybeSingle();
    if (membership) redirect(`/h/${membership.household_id}`);
  }

  const mode = (await searchParams).mode === "join" ? "join" : "create";

  return (
    <PublicAuthShell>
      <PublicForm kind={mode} />
    </PublicAuthShell>
  );
}
