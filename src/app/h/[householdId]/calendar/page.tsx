import { AwayCalendar } from "@/components/calendar/away-calendar";
import { PageHeader } from "@/components/ui/page";
import { requireHouseholdMembership } from "@/lib/auth";
import Link from "next/link";
import { notFound } from "next/navigation";

export default async function CalendarPage({
  params,
  searchParams,
}: {
  params: Promise<{ householdId: string }>;
  searchParams: Promise<{ member?: string }>;
}) {
  const { householdId } = await params;
  const requestedMemberId = (await searchParams).member;
  const { supabase, membership } = await requireHouseholdMembership(householdId);
  const { data: members, error: membersError } = await supabase
    .from("household_members")
    .select("id, display_name, removed_at")
    .eq("household_id", householdId)
    .order("joined_at");
  if (membersError) throw membersError;
  const targetMemberId =
    membership.role === "owner" && requestedMemberId ? requestedMemberId : membership.id;
  const targetMember = members?.find((member) => member.id === targetMemberId);
  if (!targetMember) notFound();

  const { data: ranges, error: rangesError } = await supabase
    .from("absence_periods")
    .select("start_date, end_date")
    .eq("household_id", householdId)
    .eq("member_id", targetMemberId)
    .is("voided_at", null)
    .order("start_date");
  if (rangesError) throw rangesError;

  return (
    <>
      <PageHeader
        title="Days away"
        description={
          targetMemberId === membership.id
            ? "Select the dates you weren’t home."
            : `Edit ${targetMember.display_name}’s away dates.`
        }
      />
      {membership.role === "owner" && (
        <nav aria-label="Choose household member" className="mb-6 flex gap-2 overflow-x-auto pb-1">
          {(members ?? []).map((member) => (
            <Link
              key={member.id}
              href={`/h/${householdId}/calendar?member=${member.id}`}
              aria-current={member.id === targetMemberId ? "page" : undefined}
              className={`shrink-0 rounded-full border px-4 py-2 text-sm font-bold no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)] ${
                member.id === targetMemberId
                  ? "border-[var(--brand)] bg-[var(--brand)] text-white"
                  : "border-[var(--line)] bg-white text-[var(--ink)]"
              }`}
            >
              {member.display_name}
              {member.removed_at ? " · removed" : ""}
            </Link>
          ))}
        </nav>
      )}
      <AwayCalendar
        householdId={householdId}
        memberId={targetMemberId}
        memberName={String(targetMember.display_name)}
        initialRanges={(ranges ?? []).map((range) => ({
          start: String(range.start_date),
          end: String(range.end_date),
        }))}
      />
    </>
  );
}
