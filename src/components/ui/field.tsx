import { cn } from "./cn";

export const controlClass =
  "froskolin-control h-11 w-full rounded-xl border border-[var(--control-line)] bg-white px-3.5 text-[15px] font-semibold text-[var(--ink)] shadow-[0_1px_2px_rgb(15_23_42/0.04)] outline-none transition-[border-color,box-shadow,background-color] placeholder:font-normal placeholder:text-[#94a3b8] hover:border-[var(--control-line-hover)] focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--control-ring)] focus:outline-none disabled:cursor-not-allowed disabled:border-[var(--line)] disabled:bg-[var(--control-disabled)] disabled:text-[var(--muted)] disabled:shadow-none disabled:opacity-70 aria-[invalid=true]:border-[var(--negative)] aria-[invalid=true]:ring-2 aria-[invalid=true]:ring-[#dc2626]/10";

export const controlActiveClass =
  "border-[var(--brand)] ring-2 ring-[var(--control-ring)] outline-none";

export const controlPopoverClass =
  "z-[60] mt-1.5 rounded-[14px] border border-[var(--control-line)] bg-white shadow-[0_14px_36px_rgb(15_23_42/0.14)]";

export const choiceInputClass =
  "froskolin-choice size-[18px] shrink-0 accent-[var(--brand)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--control-ring)] focus-visible:ring-offset-2";

export const choiceCardClass =
  "flex min-h-12 cursor-pointer items-center gap-2.5 rounded-xl border border-[var(--control-line)] bg-white px-3 text-sm font-semibold text-[var(--ink-soft)] transition-[border-color,background-color,box-shadow] hover:border-[var(--control-line-hover)]";

export const choiceCardSelectedClass =
  "border-[var(--pastel-mint-line)] bg-[var(--pastel-mint)] text-[var(--ink)]";

export const formSectionClass =
  "rounded-2xl border border-[var(--line)] bg-white p-3 shadow-[var(--shadow-sm)]";

export function SwitchField({
  label,
  description,
  checked,
  onCheckedChange,
  disabled,
  className,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <label
      className={cn(
        "flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-[var(--control-line)] bg-white px-3 py-2 transition-[border-color,background-color,box-shadow] focus-within:ring-2 focus-within:ring-[var(--control-ring)] hover:border-[var(--control-line-hover)]",
        checked && "border-[var(--pastel-mint-line)] bg-[var(--pastel-mint)]",
        disabled && "cursor-not-allowed opacity-60",
        className,
      )}
    >
      <span className="min-w-0 flex-1">
        <strong className="block text-sm font-bold text-[var(--ink)]">{label}</strong>
        {description && (
          <span className="mt-0.5 block text-[11px] leading-4 text-[var(--muted)]">
            {description}
          </span>
        )}
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onCheckedChange(event.target.checked)}
        disabled={disabled}
        className="screen-reader-only"
      />
      <span
        className={cn(
          "relative h-6 w-10 shrink-0 rounded-full bg-[#cbd5e1] transition-colors",
          checked && "bg-[var(--brand)]",
        )}
        aria-hidden="true"
      >
        <span
          className={cn(
            "absolute top-1/2 left-1 size-4 -translate-y-1/2 rounded-full bg-white shadow-sm transition-transform",
            checked && "translate-x-4",
          )}
        />
      </span>
    </label>
  );
}

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(controlClass, className)} {...props} />;
}

export function Textarea({
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(controlClass, "h-auto min-h-24 resize-y px-3.5 py-2.5 leading-5", className)}
      {...props}
    />
  );
}

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
    <label
      className={cn(
        "grid gap-1.5 text-xs font-bold text-[var(--ink-soft)] transition-colors focus-within:text-[var(--brand-strong)]",
        className,
      )}
    >
      <span>{label}</span>
      {children}
      {error ? (
        <span className="text-[11px] leading-4 font-medium text-[var(--negative)]">{error}</span>
      ) : hint ? (
        <span className="text-[11px] leading-4 font-normal text-[var(--muted)]">{hint}</span>
      ) : null}
    </label>
  );
}
