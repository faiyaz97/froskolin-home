import Link from "next/link";
import { cn } from "./cn";

type Tone = "primary" | "secondary" | "quiet" | "accent" | "danger";
type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { tone?: Tone };

const base =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-[14px] px-4 py-2.5 text-sm font-extrabold no-underline transition-[background-color,color,border-color,transform,box-shadow] disabled:cursor-not-allowed disabled:opacity-50 active:translate-y-px";
const tones: Record<Tone, string> = {
  primary:
    "bg-[var(--brand)] text-white shadow-[0_8px_18px_rgb(15_118_110/0.18)] hover:bg-[var(--brand-strong)]",
  secondary:
    "border border-[var(--line)] bg-white text-[var(--ink)] shadow-[var(--shadow-sm)] hover:border-[#cbd5e1] hover:bg-[#f8fafc]",
  quiet: "text-[var(--brand)] hover:bg-[var(--brand-soft)]",
  accent:
    "bg-[var(--violet)] text-white shadow-[0_8px_18px_rgb(124_58_237/0.18)] hover:bg-[var(--violet-strong)]",
  danger: "border border-[#fecaca] bg-white text-[var(--negative)] hover:bg-[var(--negative-soft)]",
};

export function Button({ className, tone = "primary", type = "button", ...props }: ButtonProps) {
  return <button type={type} className={cn(base, tones[tone], className)} {...props} />;
}

export function ButtonLink({
  href,
  children,
  className,
  tone = "primary",
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
  tone?: Tone;
}) {
  return (
    <Link href={href} className={cn(base, tones[tone], className)}>
      {children}
    </Link>
  );
}
