import { cn } from "./cn";
export function Field({
  label,
  hint,
  error,
  children,
  className,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("grid gap-2 text-[13px] font-extrabold text-[var(--ink)]", className)}>
      {label}
      {children}
      {error ? (
        <span className="font-normal text-[var(--negative)]">{error}</span>
      ) : hint ? (
        <span className="leading-5 font-normal text-[var(--muted)]">{hint}</span>
      ) : null}
    </label>
  );
}
export const inputClass =
  "min-h-[52px] w-full rounded-[14px] border border-[var(--line)] bg-white px-4 text-base text-[var(--ink)] shadow-[var(--shadow-sm)] placeholder:text-[#94a3b8] hover:border-[#cbd5e1] focus:border-[var(--brand)] focus:ring-3 focus:ring-[#99f6e4]/45 focus:outline-none";
export const textareaClass = `${inputClass} min-h-28 py-3 resize-y`;
