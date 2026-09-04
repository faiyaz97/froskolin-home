import { cn } from "./cn";

type SurfaceTone = "plain" | "mint" | "lavender" | "peach" | "sky";

const tones: Record<SurfaceTone, string> = {
  plain: "border-[var(--line)] bg-white",
  mint: "border-[var(--pastel-mint-line)] bg-[var(--pastel-mint)]",
  lavender: "border-[var(--pastel-lavender-line)] bg-[var(--pastel-lavender)]",
  peach: "border-[var(--pastel-peach-line)] bg-[var(--pastel-peach)]",
  sky: "border-[var(--pastel-sky-line)] bg-[var(--pastel-sky)]",
};

export function Surface({
  tone = "plain",
  className,
  ...props
}: React.ComponentProps<"section"> & { tone?: SurfaceTone }) {
  return (
    <section
      className={cn(
        "rounded-[var(--radius-surface)] border shadow-[var(--shadow-sm)]",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}
