import {
  CalendarDays,
  FileText,
  HandCoins,
  House,
  ReceiptText,
  Repeat2,
  Settings,
  UserRound,
} from "lucide-react";

import { UtilityTypeIcon, type UtilityType } from "../bills/bill-meta-controls";
import { cn } from "../ui/cn";

const icons = {
  absence_period: { icon: CalendarDays, color: "bg-[var(--pastel-sky)] text-[var(--sky)]" },
  bill_document: { icon: FileText, color: "bg-[var(--pastel-lavender)] text-[var(--violet)]" },
  expense: { icon: ReceiptText, color: "bg-[var(--pastel-mint)] text-[var(--brand)]" },
  household: { icon: Settings, color: "bg-[var(--pastel-sky)] text-[var(--sky)]" },
  household_member: { icon: UserRound, color: "bg-[var(--pastel-sky)] text-[var(--sky)]" },
  recurring_rule: { icon: Repeat2, color: "bg-[var(--pastel-lavender)] text-[var(--violet)]" },
  settlement: { icon: HandCoins, color: "bg-[var(--pastel-mint)] text-[var(--brand)]" },
  landlord_payment: { icon: House, color: "bg-[var(--pastel-peach)] text-[var(--peach)]" },
};

export function ActivityTypeIcon({
  entityType,
  utilityType,
  className,
  iconClassName,
}: {
  entityType: string;
  utilityType?: UtilityType;
  className?: string;
  iconClassName?: string;
}) {
  if (entityType === "expense" && utilityType) {
    return (
      <UtilityTypeIcon
        value={utilityType}
        className={cn(className, iconClassName && "[&>svg]:size-3")}
      />
    );
  }

  const iconData = icons[entityType as keyof typeof icons] ?? icons.expense;
  const Icon = iconData.icon;

  return (
    <span
      className={cn(
        "grid size-10 shrink-0 place-items-center rounded-xl",
        iconData.color,
        className,
      )}
    >
      <Icon className={cn("size-4", iconClassName)} strokeWidth={2.3} aria-hidden="true" />
    </span>
  );
}
