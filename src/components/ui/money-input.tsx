import { cn } from "./cn";
import { controlClass } from "./field";

const symbols: Record<string, string> = {
  EUR: "€",
  GBP: "£",
  USD: "$",
};

export function MoneyInput({
  value,
  onChange,
  currency,
  ariaLabel,
  className,
  disabled,
  invalid,
}: {
  value: string;
  onChange: (value: string) => void;
  currency: string;
  ariaLabel?: string;
  className?: string;
  disabled?: boolean;
  invalid?: boolean;
}) {
  return (
    <span className={cn("relative block min-w-0", className)}>
      <span
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm font-bold text-[var(--muted)]"
      >
        {symbols[currency] ?? currency}
      </span>
      <input
        aria-label={ariaLabel}
        aria-invalid={invalid || undefined}
        inputMode="decimal"
        min="0"
        step="0.01"
        type="number"
        value={value}
        placeholder="0.00"
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        required
        className={cn(controlClass, "pr-3 pl-8 text-right tabular-nums")}
      />
    </span>
  );
}
