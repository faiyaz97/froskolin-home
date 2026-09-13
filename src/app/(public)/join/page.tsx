import { redirect } from "next/navigation";

import { PublicForm } from "@/components/public/auth-form";
import { createClient } from "@/lib/supabase/server";

export default async function JoinPage() {
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

  return <PublicForm kind="join" />;
}
