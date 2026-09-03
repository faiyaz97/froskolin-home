import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { MemberAvatar } from "@/components/household/member-avatar";
import { PageHeader, SectionTitle } from "@/components/ui/page";
import { requireHouseholdMembership } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";

export default async function AuditDetail({
  params,
}: {
  params: Promise<{ householdId: string; eventId: string }>;
}) {
  const { householdId, eventId } = await params;
  const { supabase } = await requireHouseholdMembership(householdId);
  const [eventResult, homeResult, membersResult] = await Promise.all([
    supabase
      .from("audit_events")
      .select("*")
      .eq("id", eventId)
      .eq("household_id", householdId)
      .maybeSingle(),
    supabase.from("households").select("locale, timezone").eq("id", householdId).single(),
    supabase
      .from("household_members")
      .select("user_id, display_name")
      .eq("household_id", householdId),
  ]);
  if (eventResult.error || homeResult.error || membersResult.error)
    throw eventResult.error ?? homeResult.error ?? membersResult.error;
  if (!eventResult.data) notFound();
  const event = eventResult.data;
  const actor = event.actor_user_id
    ? (membersResult.data?.find((member) => member.user_id === event.actor_user_id)?.display_name ??
      "A roommate")
    : "Froskolin";
  const previous = (event.previous_values ?? {}) as Record<string, unknown>;
  const next = (event.new_values ?? {}) as Record<string, unknown>;
  const fields = [...new Set([...Object.keys(previous), ...Object.keys(next)])].filter(
    (key) => !["id", "household_id"].includes(key),
  );

  return (
    <>
      <Link
        href={`/h/${householdId}/activity`}
        className="mb-6 inline-flex items-center gap-2 text-sm font-bold text-[var(--muted)] no-underline"
      >
        <ArrowLeft className="size-4" /> Back to activity
      </Link>
      <PageHeader
        eyebrow="Audit event"
        title={event.summary}
        description={formatDateTime(
          event.occurred_at,
          homeResult.data.locale,
          homeResult.data.timezone,
        )}
      />
      <div className="flex items-center gap-3 border-y border-[var(--line)] py-4">
        <MemberAvatar name={actor} />
        <p className="text-sm">
          <strong>{actor}</strong>
          <span className="block text-[var(--muted)] capitalize">
            {event.action_type} · {String(event.entity_type).replaceAll("_", " ")}
          </span>
        </p>
      </div>
      <section className="mt-8">
        <SectionTitle>Recorded details</SectionTitle>
        {!fields.length ? (
          <p className="text-sm text-[var(--muted)]">
            No additional values were needed for this event.
          </p>
        ) : (
          <dl className="grid gap-px overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--line)] sm:grid-cols-2">
            {fields.map((field) => (
              <div key={field} className="bg-[var(--paper)] p-4">
                <dt className="text-xs font-bold tracking-wider text-[var(--muted)] uppercase">
                  {field.replaceAll("_", " ")}
                </dt>
                {field in previous && (
                  <dd className="mt-1 text-sm text-[var(--muted)]">
                    <span className="font-bold">Before:</span> {displayValue(previous[field])}
                  </dd>
                )}
                {field in next && (
                  <dd className="mt-1 text-sm">
                    <span className="font-bold">After:</span> {displayValue(next[field])}
                  </dd>
                )}
              </div>
            ))}
          </dl>
        )}
      </section>
    </>
  );
}

function displayValue(value: unknown): ReactNode {
  if (value === null || value === undefined) return "Not set";
  if (typeof value === "object")
    return (
      <pre className="mt-2 max-h-72 overflow-auto rounded-lg bg-[var(--canvas)] p-3 font-mono text-xs leading-5 whitespace-pre-wrap">
        {JSON.stringify(value, null, 2)}
      </pre>
    );
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}
