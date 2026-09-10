"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition, type FormEvent } from "react";
import { UserRound } from "lucide-react";

import { createHouseholdAction, joinHouseholdAction, loginAction } from "@/lib/actions";
import { currencyFromLocale } from "@/lib/device-currency";
import { readRememberedDevice, rememberDevice, type RememberedDevice } from "@/lib/device-memory";
import { Button } from "../ui/button";
import { cn } from "../ui/cn";
import { Field, Input } from "../ui/field";
import { StatusNote } from "../ui/page";

type AuthKind = "create" | "join" | "login";

const modes: { kind: AuthKind; label: string; href: string }[] = [
  { kind: "login", label: "Sign in", href: "/login" },
  { kind: "create", label: "Create", href: "/?mode=create" },
  { kind: "join", label: "Join", href: "/?mode=join" },
];

const content = {
  create: { title: "Create group", action: "Create" },
  join: { title: "Join group", action: "Join" },
  login: { title: "Sign in", action: "Sign in" },
} satisfies Record<AuthKind, { title: string; action: string }>;

function GroupCodeField({ error, disabled }: { error?: string; disabled: boolean }) {
  return (
    <Field label="Group code" error={error}>
      <Input
        name="houseCode"
        className="tracking-[0.08em] uppercase"
        placeholder="FROSKO-2847"
        autoCapitalize="characters"
        autoCorrect="off"
        spellCheck={false}
        pattern="[A-Za-z0-9][A-Za-z0-9-]{4,22}[A-Za-z0-9]"
        minLength={6}
        maxLength={24}
        required
        disabled={disabled}
      />
    </Field>
  );
}

function PinField({
  name,
  label,
  error,
  disabled,
  allowLegacy = false,
  current = false,
}: {
  name: "joinPin" | "pin";
  label: string;
  error?: string;
  disabled: boolean;
  allowLegacy?: boolean;
  current?: boolean;
}) {
  return (
    <Field label={label} error={error}>
      <Input
        name={name}
        className="tracking-[0.35em]"
        inputMode="numeric"
        pattern={allowLegacy ? "(?:[0-9]{4}|[0-9]{6})" : "[0-9]{6}"}
        minLength={allowLegacy ? 4 : 6}
        maxLength={6}
        type="password"
        autoComplete={current ? "current-password" : "new-password"}
        placeholder="••••••"
        required
        disabled={disabled}
      />
    </Field>
  );
}

export function PublicForm({ kind }: { kind: AuthKind }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [rememberedDevice, setRememberedDevice] = useState<RememberedDevice | null>(null);
  const [useRememberedDevice, setUseRememberedDevice] = useState(true);

  useEffect(() => {
    if (kind !== "login") return;
    const timer = window.setTimeout(() => setRememberedDevice(readRememberedDevice()), 0);
    return () => window.clearTimeout(timer);
  }, [kind]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setFieldErrors({});
    const data = new FormData(event.currentTarget);
    startTransition(async () => {
      const displayName = String(data.get("displayName") ?? "");
      const houseCode = String(data.get("houseCode") ?? "")
        .trim()
        .toUpperCase();
      const common = { displayName, pin: String(data.get("pin") ?? "") };
      const locale = navigator.language || "en-GB";
      const result =
        kind === "create"
          ? await createHouseholdAction({
              ...common,
              householdName: String(data.get("householdName") ?? ""),
              joinPin: String(data.get("joinPin") ?? ""),
              defaultCurrency: currencyFromLocale(locale),
              locale,
              timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
            })
          : kind === "join"
            ? await joinHouseholdAction({
                ...common,
                houseCode,
                joinPin: String(data.get("joinPin") ?? ""),
              })
            : await loginAction({ ...common, houseCode });

      if (!result.ok) {
        setError(result.error);
        setFieldErrors(result.fieldErrors ?? {});
        return;
      }
      if (kind === "create") {
        const created = result.data as { householdId: string; houseCode: string };
        rememberDevice({ houseCode: created.houseCode, memberName: displayName });
        router.replace(`/h/${created.householdId}`);
        return;
      }
      rememberDevice({ houseCode, memberName: displayName });
      router.replace(`/h/${(result.data as { householdId: string }).householdId}`);
    });
  }

  const useRememberedLogin = kind === "login" && rememberedDevice && useRememberedDevice;

  return (
    <section>
      <nav
        className="grid grid-cols-3 rounded-[14px] bg-[var(--soft-line)] p-1"
        aria-label="Group access"
      >
        {modes.map((mode) => (
          <Link
            key={mode.kind}
            href={mode.href}
            aria-current={kind === mode.kind ? "page" : undefined}
            className={cn(
              "rounded-[11px] px-2 py-2 text-center text-xs font-extrabold no-underline transition-colors",
              kind === mode.kind
                ? "bg-white text-[var(--brand-strong)] shadow-sm"
                : "text-[var(--muted)] hover:text-[var(--ink)]",
            )}
          >
            {mode.label}
          </Link>
        ))}
      </nav>

      <h1 className="mt-5 text-center text-2xl leading-7 font-black tracking-[-0.045em]">
        {content[kind].title}
      </h1>

      <form className="mt-4 grid gap-3" onSubmit={submit} aria-busy={pending}>
        {error && <StatusNote tone="error" title={error} />}

        {kind === "create" && (
          <>
            <Field label="Group name" error={fieldErrors.householdName?.[0]}>
              <Input
                name="householdName"
                placeholder="Weekend trip"
                autoComplete="organization"
                required
                disabled={pending}
              />
            </Field>
            <PinField
              name="joinPin"
              label="Group PIN"
              error={fieldErrors.joinPin?.[0]}
              disabled={pending}
            />
            <Field label="Your name" error={fieldErrors.displayName?.[0]}>
              <Input
                name="displayName"
                placeholder="Froskolin"
                autoComplete="nickname"
                required
                disabled={pending}
              />
            </Field>
            <PinField
              name="pin"
              label="Personal PIN"
              error={fieldErrors.pin?.[0]}
              disabled={pending}
            />
          </>
        )}

        {kind === "join" && (
          <>
            <GroupCodeField error={fieldErrors.houseCode?.[0]} disabled={pending} />
            <PinField
              name="joinPin"
              label="Group PIN"
              error={fieldErrors.joinPin?.[0]}
              disabled={pending}
            />
            <Field label="Your name" error={fieldErrors.displayName?.[0]}>
              <Input
                name="displayName"
                placeholder="Froskolin"
                autoComplete="nickname"
                required
                disabled={pending}
              />
            </Field>
            <PinField
              name="pin"
              label="Personal PIN"
              error={fieldErrors.pin?.[0]}
              disabled={pending}
            />
          </>
        )}

        {kind === "login" && !useRememberedLogin && (
          <>
            <GroupCodeField error={fieldErrors.houseCode?.[0]} disabled={pending} />
            <Field label="Your name" error={fieldErrors.displayName?.[0]}>
              <Input
                name="displayName"
                placeholder="Froskolin"
                autoComplete="nickname"
                required
                disabled={pending}
              />
            </Field>
            <PinField
              name="pin"
              label="Personal PIN"
              error={fieldErrors.pin?.[0]}
              disabled={pending}
              allowLegacy
              current
            />
          </>
        )}

        {useRememberedLogin && (
          <>
            <input type="hidden" name="houseCode" value={rememberedDevice.houseCode} />
            <input type="hidden" name="displayName" value={rememberedDevice.memberName} />
            <div className="flex items-center gap-3 rounded-xl bg-[var(--canvas)] p-3">
              <span className="grid size-10 place-items-center rounded-full bg-[var(--brand-icon-soft)] text-[var(--brand)]">
                <UserRound className="size-5" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <strong className="block truncate text-sm">{rememberedDevice.memberName}</strong>
                <span className="text-xs font-bold text-[var(--muted)]">
                  {rememberedDevice.houseCode}
                </span>
              </div>
              <button
                type="button"
                className="text-xs font-extrabold text-[var(--brand)] hover:text-[var(--brand-strong)] hover:underline"
                onClick={() => setUseRememberedDevice(false)}
              >
                Use another
              </button>
            </div>
            <PinField
              name="pin"
              label="Personal PIN"
              error={fieldErrors.pin?.[0]}
              disabled={pending}
              allowLegacy
              current
            />
          </>
        )}

        <Button type="submit" className="mt-1 w-full rounded-full" disabled={pending}>
          {pending ? "One moment…" : content[kind].action}
        </Button>
      </form>
    </section>
  );
}
