import { AwayCalendar } from "@/components/calendar/away-calendar";
import { type AvatarColor } from "@/components/household/member-avatar";
import { PageHeader } from "@/components/ui/page";
import { requireHouseholdMembership } from "@/lib/auth";
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
    .select("id, display_name, removed_at, avatar_color")
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
      <div className="mx-auto max-w-3xl">
        <PageHeader title="Calendar" compact />
      </div>
      <AwayCalendar
        key={targetMemberId}
        householdId={householdId}
        memberId={targetMemberId}
        memberName={String(targetMember.display_name)}
        isOwner={membership.role === "owner"}
        members={(members ?? []).map((member) => ({
          id: member.id,
          name: String(member.display_name),
          color: (member.avatar_color as AvatarColor | null) ?? null,
          removed: Boolean(member.removed_at),
        }))}
        initialRanges={(ranges ?? []).map((range) => ({
          start: String(range.start_date),
          end: String(range.end_date),
        }))}
      />
    </>
  );
}
