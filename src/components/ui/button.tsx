import Link from "next/link";
import { cn } from "./cn";

type Tone =
  | "primary"
  | "secondary"
  | "quiet"
  | "accent"
  | "danger"
  | "pastel"
  | "pastelAccent"
  | "pastelWarm";
type Appearance = "standard" | "floating";
type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: Tone;
  appearance?: Appearance;
};

const base =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-[14px] border border-transparent px-4 py-2.5 text-sm font-extrabold no-underline transition-[background-color,color,border-color,transform,box-shadow] disabled:cursor-not-allowed disabled:opacity-50 active:translate-y-px";
const tones: Record<Tone, string> = {
  primary:
    "bg-[var(--brand)] text-white shadow-[0_6px_16px_rgb(15_118_110/0.2)] hover:bg-[var(--brand-strong)] hover:shadow-[0_8px_20px_rgb(15_118_110/0.24)]",
  secondary:
    "border-[var(--line)] bg-white text-[var(--ink)] shadow-[var(--shadow-sm)] hover:border-[#cbd5e1] hover:bg-[var(--soft-line)]",
  quiet:
    "bg-[var(--soft-line)] text-[var(--ink-soft)] hover:bg-[var(--line)] hover:text-[var(--ink)]",
  accent:
    "bg-[var(--violet)] text-white shadow-[0_6px_16px_rgb(124_58_237/0.18)] hover:bg-[var(--violet-strong)]",
  danger:
    "border-[#fecaca] bg-white text-[var(--negative)] hover:border-[var(--negative)] hover:bg-[var(--negative-soft)]",
  pastel:
    "bg-[var(--brand)] text-white shadow-[0_6px_16px_rgb(15_118_110/0.18)] hover:bg-[var(--brand-strong)] hover:shadow-[0_8px_20px_rgb(15_118_110/0.22)]",
  pastelAccent:
    "bg-[var(--violet)] text-white shadow-[0_6px_16px_rgb(124_58_237/0.16)] hover:bg-[var(--violet-strong)]",
  pastelWarm:
    "bg-[var(--peach)] text-white shadow-[0_6px_16px_rgb(234_88_12/0.16)] hover:bg-[#c2410c]",
};

const floatingTones: Record<Tone, string> = {
  primary:
    "bg-[var(--brand)] text-white shadow-[0_8px_18px_rgb(15_118_110/0.18)] hover:bg-[var(--brand-strong)]",
  secondary:
    "border-[var(--line)] bg-white text-[var(--ink)] shadow-[var(--shadow-sm)] hover:border-[#cbd5e1] hover:bg-[#f8fafc]",
  quiet: "text-[var(--brand)] hover:bg-[var(--brand-icon-hover)]",
  accent:
    "bg-[var(--violet)] text-white shadow-[0_8px_18px_rgb(124_58_237/0.18)] hover:bg-[var(--violet-strong)]",
  danger: "border-[#fecaca] bg-white text-[var(--negative)] hover:bg-[var(--negative-soft)]",
  pastel:
    "border-[var(--pastel-mint-line)] bg-[var(--pastel-mint)] text-[var(--brand-strong)] shadow-[0_8px_18px_rgb(15_118_110/0.1)] hover:border-[var(--brand)]",
  pastelAccent:
    "border-[var(--pastel-lavender-line)] bg-[var(--pastel-lavender)] text-[var(--violet-strong)] shadow-[0_8px_18px_rgb(124_58_237/0.1)] hover:border-[var(--violet)]",
  pastelWarm:
    "border-[var(--pastel-peach-line)] bg-[var(--pastel-peach)] text-[var(--peach)] shadow-[0_8px_18px_rgb(234_88_12/0.1)] hover:border-[var(--peach)]",
};

export function Button({
  className,
  tone = "primary",
  appearance = "standard",
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(base, appearance === "floating" ? floatingTones[tone] : tones[tone], className)}
      {...props}
    />
  );
}

export function ButtonLink({
  href,
  children,
  className,
  tone = "primary",
  appearance = "standard",
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
  tone?: Tone;
  appearance?: Appearance;
}) {
  return (
    <Link
      href={href}
      className={cn(base, appearance === "floating" ? floatingTones[tone] : tones[tone], className)}
    >
      {children}
    </Link>
  );
}
