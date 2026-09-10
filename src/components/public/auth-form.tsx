"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition, type FormEvent } from "react";
import { Home, UserRound, type LucideIcon } from "lucide-react";

import { createHouseholdAction, joinHouseholdAction, loginAction } from "@/lib/actions";
import { readRememberedDevice, rememberDevice, type RememberedDevice } from "@/lib/device-memory";
import { Button } from "../ui/button";
import { Field, Input } from "../ui/field";
import { StatusNote } from "../ui/page";
import { SelectInput } from "../ui/select-input";

function AuthGroup({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: LucideIcon;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="grid gap-2.5 rounded-2xl border border-[var(--line)] bg-[var(--canvas)]/55 p-2.5">
      <legend className="screen-reader-only">{title}</legend>
      <div className="flex items-center gap-2 border-b border-[var(--soft-line)] pb-2">
        <span className="grid size-7 place-items-center rounded-[9px] bg-white text-[var(--brand)] shadow-[var(--shadow-sm)]">
          <Icon className="size-3.5" aria-hidden="true" />
        </span>
        <h2 className="text-sm font-black">{title}</h2>
      </div>
      {children}
    </fieldset>
  );
}

export function PublicForm({ kind }: { kind: "create" | "join" | "login" }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [rememberedDevice, setRememberedDevice] = useState<RememberedDevice | null>(null);
  const [useRememberedDevice, setUseRememberedDevice] = useState(true);
  const content = {
    create: { title: "Create household", action: "Create" },
    join: { title: "Join roommates", action: "Join" },
    login: { title: "Sign in", action: "Sign in" },
  }[kind];

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
      const common = {
        displayName,
        pin: String(data.get("pin") ?? ""),
      };
      const result =
        kind === "create"
          ? await createHouseholdAction({
              ...common,
              householdName: String(data.get("householdName") ?? ""),
              joinPin: String(data.get("joinPin") ?? ""),
              defaultCurrency: String(data.get("defaultCurrency") ?? "EUR"),
              locale: navigator.language || "en-GB",
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
      <h1 className="text-2xl leading-7 font-black tracking-[-0.045em]">{content.title}</h1>
      <form className="mt-2 grid gap-2" onSubmit={submit} aria-busy={pending}>
        {error && <StatusNote tone="error" title={error} />}

        {kind === "create" && (
          <div className="grid gap-2">
            <AuthGroup title="Household details" icon={Home}>
              <Field label="Household name" error={fieldErrors.householdName?.[0]}>
                <Input
                  name="householdName"
                  placeholder="Via dei Gatti"
                  autoComplete="organization"
                  required
                  disabled={pending}
                />
              </Field>
              <Field label="House Join PIN" error={fieldErrors.joinPin?.[0]}>
                <Input
                  name="joinPin"
                  className="tracking-[0.35em]"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  minLength={6}
                  maxLength={6}
                  type="password"
                  autoComplete="new-password"
                  placeholder="••••••"
                  required
                  disabled={pending}
                />
              </Field>
              <Field label="Household currency" error={fieldErrors.defaultCurrency?.[0]}>
                <SelectInput
                  name="defaultCurrency"
                  defaultValue="EUR"
                  ariaLabel="Household currency"
                  disabled={pending}
                  options={[
                    { value: "EUR", label: "EUR · Euro" },
                    { value: "GBP", label: "GBP · British pound" },
                    { value: "USD", label: "USD · US dollar" },
                  ]}
                />
              </Field>
            </AuthGroup>
            <AuthGroup title="Owner details" icon={UserRound}>
              <Field label="Owner name" error={fieldErrors.displayName?.[0]}>
                <Input
                  name="displayName"
                  placeholder="Andrea"
                  autoComplete="nickname"
                  required
                  disabled={pending}
                />
              </Field>
              <Field label="Personal PIN" error={fieldErrors.pin?.[0]}>
                <Input
                  name="pin"
                  className="tracking-[0.35em]"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  minLength={6}
                  maxLength={6}
                  type="password"
                  autoComplete="new-password"
                  placeholder="••••••"
                  required
                  disabled={pending}
                />
              </Field>
            </AuthGroup>
          </div>
        )}

        {kind === "join" && (
          <div className="grid gap-2">
            <AuthGroup title="Household details" icon={Home}>
              <Field label="House Code" error={fieldErrors.houseCode?.[0]}>
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
                  disabled={pending}
                />
              </Field>
              <Field label="House Join PIN" error={fieldErrors.joinPin?.[0]}>
                <Input
                  name="joinPin"
                  className="tracking-[0.35em]"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  minLength={6}
                  maxLength={6}
                  type="password"
                  autoComplete="new-password"
                  placeholder="••••••"
                  required
                  disabled={pending}
                />
              </Field>
            </AuthGroup>
            <AuthGroup title="Your details" icon={UserRound}>
              <Field label="Your name" error={fieldErrors.displayName?.[0]}>
                <Input
                  name="displayName"
                  placeholder="Andrea"
                  autoComplete="nickname"
                  required
                  disabled={pending}
                />
              </Field>
              <Field label="Personal PIN" error={fieldErrors.pin?.[0]}>
                <Input
                  name="pin"
                  className="tracking-[0.35em]"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  minLength={6}
                  maxLength={6}
                  type="password"
                  autoComplete="new-password"
                  placeholder="••••••"
                  required
                  disabled={pending}
                />
              </Field>
            </AuthGroup>
          </div>
        )}

        {kind === "login" && !useRememberedLogin && (
          <div className="grid gap-2">
            <AuthGroup title="Household details" icon={Home}>
              <Field label="House Code" error={fieldErrors.houseCode?.[0]}>
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
                  disabled={pending}
                />
              </Field>
            </AuthGroup>
            <AuthGroup title="Your details" icon={UserRound}>
              <Field label="Member name" error={fieldErrors.displayName?.[0]}>
                <Input
                  name="displayName"
                  placeholder="Andrea"
                  autoComplete="nickname"
                  required
                  disabled={pending}
                />
              </Field>
              <Field label="Personal PIN" error={fieldErrors.pin?.[0]}>
                <Input
                  name="pin"
                  className="tracking-[0.35em]"
                  inputMode="numeric"
                  pattern="(?:[0-9]{4}|[0-9]{6})"
                  minLength={4}
                  maxLength={6}
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••"
                  required
                  disabled={pending}
                />
              </Field>
            </AuthGroup>
          </div>
        )}

        {useRememberedLogin && (
          <AuthGroup title="Your details" icon={UserRound}>
            <input type="hidden" name="houseCode" value={rememberedDevice.houseCode} />
            <input type="hidden" name="displayName" value={rememberedDevice.memberName} />
            <div className="flex items-center gap-3 rounded-xl border border-[var(--line)] bg-white p-3">
              <span className="grid size-10 place-items-center rounded-xl bg-[var(--brand-soft)] text-[var(--brand)]">
                <UserRound className="size-5" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <strong className="block truncate">{rememberedDevice.memberName}</strong>
                <span className="text-xs font-bold text-[var(--muted)]">
                  {rememberedDevice.houseCode}
                </span>
              </div>
              <button
                type="button"
                className="text-xs font-extrabold text-[var(--brand)] hover:underline"
                onClick={() => setUseRememberedDevice(false)}
              >
                Change
              </button>
            </div>
            <Field label="Personal PIN" error={fieldErrors.pin?.[0]}>
              <Input
                name="pin"
                className="tracking-[0.35em]"
                inputMode="numeric"
                pattern="(?:[0-9]{4}|[0-9]{6})"
                minLength={4}
                maxLength={6}
                type="password"
                autoComplete="current-password"
                placeholder="••••••"
                required
                disabled={pending}
              />
            </Field>
          </AuthGroup>
        )}

        <Button type="submit" className="min-h-10 w-full py-2" disabled={pending}>
          {pending ? "One moment…" : content.action}
        </Button>
      </form>

      <p className="mt-2 text-center text-xs text-[var(--muted)]">
        {kind === "create" || kind === "join" ? (
          <Link href="/login" className="font-extrabold text-[var(--brand-strong)]">
            Sign in
          </Link>
        ) : (
          <>
            <Link href="/?mode=join" className="font-extrabold text-[var(--brand-strong)]">
              Join roommates
            </Link>
            {" · "}
            <Link href="/?mode=create" className="font-extrabold text-[var(--brand-strong)]">
              Create household
            </Link>
          </>
        )}
      </p>
    </section>
  );
}
