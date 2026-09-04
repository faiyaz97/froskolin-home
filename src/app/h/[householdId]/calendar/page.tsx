import { AwayCalendar } from "@/components/calendar/away-calendar";
import { resolveAvatarColor, type AvatarColor } from "@/components/household/member-avatar";
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
    .select("member_id, start_date, end_date")
    .eq("household_id", householdId)
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
        <nav
          aria-label="Choose whose away dates to edit"
          className="mb-6 flex gap-2 overflow-x-auto pb-1"
        >
          {(members ?? []).map((member) => (
            <Link
              key={member.id}
              href={`/h/${householdId}/calendar?member=${member.id}`}
              aria-current={member.id === targetMemberId ? "page" : undefined}
              className="shrink-0 rounded-full border-2 px-4 py-2 text-sm font-extrabold no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]"
              style={{
                borderColor: resolveAvatarColor(
                  String(member.display_name),
                  member.avatar_color as AvatarColor | null,
                ),
                backgroundColor:
                  member.id === targetMemberId
                    ? resolveAvatarColor(
                        String(member.display_name),
                        member.avatar_color as AvatarColor | null,
                      )
                    : `${resolveAvatarColor(
                        String(member.display_name),
                        member.avatar_color as AvatarColor | null,
                      )}18`,
                color:
                  member.id === targetMemberId
                    ? "white"
                    : resolveAvatarColor(
                        String(member.display_name),
                        member.avatar_color as AvatarColor | null,
                      ),
              }}
            >
              {member.display_name}
              {member.removed_at ? " · removed" : ""}
            </Link>
          ))}
        </nav>
      )}
      <AwayCalendar
        key={targetMemberId}
        householdId={householdId}
        memberId={targetMemberId}
        memberName={String(targetMember.display_name)}
        members={(members ?? []).map((member) => ({
          id: member.id,
          name: String(member.display_name),
          color: (member.avatar_color as AvatarColor | null) ?? null,
          removed: Boolean(member.removed_at),
        }))}
        initialHouseholdRanges={(ranges ?? []).map((range) => ({
          memberId: range.member_id,
          start: String(range.start_date),
          end: String(range.end_date),
        }))}
      />
    </>
  );
}
