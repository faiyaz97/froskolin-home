"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition, type FormEvent } from "react";
import { Home, UserRound } from "lucide-react";

import {
  changePinAction,
  createHouseholdAction,
  joinHouseholdAction,
  loginAction,
} from "@/lib/actions";
import {
  forgetRememberedDevice,
  readRememberedDevice,
  rememberDevice,
  type RememberedDevice,
} from "@/lib/device-memory";
import { Button } from "../ui/button";
import { Field, inputClass } from "../ui/field";
import { StatusNote } from "../ui/page";
import { SelectInput } from "../ui/select-input";

export function PublicForm({ kind }: { kind: "create" | "join" | "login" | "pin" }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [rememberedDevice, setRememberedDevice] = useState<RememberedDevice | null>(null);
  const [useRememberedDevice, setUseRememberedDevice] = useState(true);
  const content = {
    create: { title: "Create household", action: "Create household" },
    join: { title: "Join roommates", action: "Join roommates" },
    login: { title: "Sign in", action: "Sign in" },
    pin: { title: "Change PIN", action: "Save new PIN" },
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
    if (kind === "pin" && data.get("newPin") !== data.get("confirmation")) {
      setFieldErrors({ confirmation: ["The two new PINs do not match."] });
      return;
    }

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
            : kind === "login"
              ? await loginAction({ ...common, houseCode })
              : await changePinAction({
                  currentPin: String(data.get("currentPin") ?? ""),
                  newPin: String(data.get("newPin") ?? ""),
                });

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
      if (kind === "pin") {
        router.replace("/");
        return;
      }

      rememberDevice({ houseCode, memberName: displayName });
      router.replace(`/h/${(result.data as { householdId: string }).householdId}`);
    });
  }

  const useRememberedLogin = kind === "login" && rememberedDevice && useRememberedDevice;

  return (
    <section>
      <h1 className="text-3xl font-black tracking-[-0.045em]">{content.title}</h1>
      <form className="mt-6 grid gap-5" onSubmit={submit} aria-busy={pending}>
        {error && <StatusNote tone="error" title={error} />}

        {useRememberedLogin && (
          <div className="rounded-2xl border border-[var(--line)] bg-[var(--canvas)] p-4">
            <input type="hidden" name="houseCode" value={rememberedDevice.houseCode} />
            <input type="hidden" name="displayName" value={rememberedDevice.memberName} />
            <div className="flex items-center gap-3">
              <span className="grid size-11 place-items-center rounded-xl bg-[var(--brand-soft)] text-[var(--brand)]">
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
          </div>
        )}

        {kind === "create" && (
          <Field label="Household name" error={fieldErrors.householdName?.[0]}>
            <input
              name="householdName"
              className={inputClass}
              placeholder="Via dei Gatti"
              autoComplete="organization"
              required
              disabled={pending}
            />
          </Field>
        )}

        {(kind === "join" || (kind === "login" && !useRememberedLogin)) && (
          <Field label="House Code" error={fieldErrors.houseCode?.[0]}>
            <input
              name="houseCode"
              className={`${inputClass} tracking-[0.08em] uppercase`}
              placeholder="FROSKO-2847"
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              pattern="FROSKO-[0-9]{4}"
              maxLength={11}
              required
              disabled={pending}
            />
          </Field>
        )}

        {kind !== "pin" && !useRememberedLogin && (
          <Field
            label={kind === "create" ? "Owner name" : kind === "join" ? "Your name" : "Member name"}
            error={fieldErrors.displayName?.[0]}
          >
            <input
              name="displayName"
              className={inputClass}
              placeholder="Andrea"
              autoComplete="nickname"
              required
              disabled={pending}
            />
          </Field>
        )}

        {(kind === "create" || kind === "join") && (
          <Field label="House Join PIN" error={fieldErrors.joinPin?.[0]}>
            <input
              name="joinPin"
              className={`${inputClass} tracking-[0.35em]`}
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
        )}

        {kind === "pin" && (
          <Field label="Current or temporary PIN" error={fieldErrors.currentPin?.[0]}>
            <input
              name="currentPin"
              className={`${inputClass} tracking-[0.35em]`}
              inputMode="numeric"
              pattern="(?:[0-9]{4}|[0-9]{6})"
              minLength={4}
              maxLength={6}
              type="password"
              autoComplete="current-password"
              required
              disabled={pending}
            />
          </Field>
        )}

        <Field
          label={kind === "pin" ? "New personal PIN" : "Personal PIN"}
          error={(kind === "pin" ? fieldErrors.newPin : fieldErrors.pin)?.[0]}
        >
          <input
            name={kind === "pin" ? "newPin" : "pin"}
            className={`${inputClass} tracking-[0.35em]`}
            inputMode="numeric"
            pattern={kind === "login" ? "(?:[0-9]{4}|[0-9]{6})" : "[0-9]{6}"}
            minLength={kind === "login" ? 4 : 6}
            maxLength={6}
            type="password"
            autoComplete={kind === "login" ? "current-password" : "new-password"}
            placeholder="••••••"
            required
            disabled={pending}
          />
        </Field>

        {kind === "create" && (
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
        )}

        {kind === "pin" && (
          <Field label="Confirm new PIN" error={fieldErrors.confirmation?.[0]}>
            <input
              name="confirmation"
              className={`${inputClass} tracking-[0.35em]`}
              inputMode="numeric"
              pattern="[0-9]{6}"
              minLength={6}
              maxLength={6}
              type="password"
              autoComplete="new-password"
              required
            />
          </Field>
        )}

        <Button type="submit" className="mt-1 min-h-[52px] w-full" disabled={pending}>
          {pending ? "One moment…" : content.action}
        </Button>
      </form>

      {kind !== "pin" && (
        <p className="mt-6 text-center text-sm text-[var(--muted)]">
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
      )}

      {useRememberedLogin && (
        <button
          type="button"
          className="mx-auto mt-4 flex items-center gap-1.5 text-xs font-bold text-[var(--muted)] hover:text-[var(--negative)]"
          onClick={() => {
            forgetRememberedDevice();
            setRememberedDevice(null);
            setUseRememberedDevice(false);
          }}
        >
          <Home className="size-3.5" aria-hidden="true" /> Forget this device
        </button>
      )}
    </section>
  );
}
