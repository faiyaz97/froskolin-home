import { AlertTriangle, CheckCircle2, Inbox } from "lucide-react";
import { cn } from "./cn";
export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <header className="mb-6 flex items-start justify-between gap-4 sm:mb-8">
      <div>
        {eyebrow && (
          <p className="mb-2 text-[11px] font-black tracking-[0.16em] text-[var(--brand)] uppercase">
            {eyebrow}
          </p>
        )}
        <h1 className="text-[clamp(1.75rem,6vw,2.5rem)] leading-[1.08] font-black tracking-[-0.045em]">
          {title}
        </h1>
        {description && (
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)] sm:text-[15px]">
            {description}
          </p>
        )}
      </div>
      {action}
    </header>
  );
}
export function SectionTitle({
  children,
  aside,
}: {
  children: React.ReactNode;
  aside?: React.ReactNode;
}) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-4">
      <h2 className="text-base font-black tracking-[-0.02em]">{children}</h2>
      {aside && <div className="text-sm text-[var(--muted)]">{aside}</div>}
    </div>
  );
}
export function StatusNote({
  tone = "info",
  title,
  children,
}: {
  tone?: "info" | "warning" | "success" | "error";
  title: string;
  children?: React.ReactNode;
}) {
  const styles = {
    info: "border-[#bae6fd] bg-[var(--sky-soft)]",
    warning: "border-[#fde68a] bg-[var(--warning-soft)]",
    success: "border-[#bbf7d0] bg-[var(--positive-soft)]",
    error: "border-[#fecaca] bg-[var(--negative-soft)]",
  };
  const Icon = tone === "success" ? CheckCircle2 : AlertTriangle;
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn("flex gap-3 rounded-[14px] border p-4 text-sm", styles[tone])}
    >
      <Icon className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
      <div>
        <p className="font-black">{title}</p>
        {children && <div className="mt-1 leading-5 text-[var(--muted)]">{children}</div>}
      </div>
    </div>
  );
}
export function EmptyState({
  title,
  children,
  action,
}: {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-[var(--line)] bg-white px-5 py-12 text-center">
      <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-[var(--brand-soft)] text-[var(--brand)]">
        <Inbox className="size-6" aria-hidden="true" />
      </span>
      <h2 className="mt-3 font-black">{title}</h2>
      <p className="mx-auto mt-1 max-w-sm text-sm leading-6 text-[var(--muted)]">{children}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
