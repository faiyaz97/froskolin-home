import { cn } from "./cn";

export type IconActionTone = "neutral" | "brand" | "violet" | "peach" | "sky" | "negative";

const tones: Record<IconActionTone, string> = {
  neutral: "text-[var(--ink-soft)] hover:bg-[var(--soft-line)]",
  brand: "text-[var(--brand)] hover:bg-[var(--brand-icon-hover)]",
  violet: "text-[var(--violet)] hover:bg-[var(--violet-soft)]",
  peach: "text-[var(--peach)] hover:bg-[var(--peach-soft)]",
  sky: "text-[var(--sky)] hover:bg-[var(--sky-soft)]",
  negative: "text-[var(--negative)] hover:bg-[var(--negative-soft)]",
};

const activeTones: Record<IconActionTone, string> = {
  neutral: "bg-[var(--canvas)]",
  brand: "bg-[var(--brand-icon-soft)]",
  violet: "bg-[var(--pastel-lavender)]",
  peach: "bg-[var(--pastel-peach)]",
  sky: "bg-[var(--pastel-sky)]",
  negative: "bg-[color-mix(in_srgb,var(--negative-soft)_55%,white)]",
};

export function iconActionClass({
  tone = "neutral",
  active = false,
  className,
}: {
  tone?: IconActionTone;
  active?: boolean;
  className?: string;
} = {}) {
  return cn(
    "grid shrink-0 place-items-center rounded-full bg-transparent transition-colors outline-none focus-visible:ring-2 focus-visible:ring-current focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40",
    tones[tone],
    active && activeTones[tone],
    className,
  );
}
