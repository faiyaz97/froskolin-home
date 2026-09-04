"use client";

import { Check, KeyRound, LogOut, Palette } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore, useTransition, type FormEvent } from "react";

import { signOutAction, updatePersonalSettingsAction } from "@/lib/actions";
import { forgetRememberedDevice, updateRememberedMemberName } from "@/lib/device-memory";
import { Button, ButtonLink } from "../ui/button";
import { Field, Input } from "../ui/field";
import { SectionTitle, StatusNote } from "../ui/page";
import { Surface } from "../ui/surface";
import { avatarColors, MemberAvatar, type AvatarColor } from "./member-avatar";

const colorNames: Record<AvatarColor, string> = {
  teal: "Teal",
  violet: "Violet",
  orange: "Orange",
  blue: "Blue",
  rose: "Rose",
  indigo: "Indigo",
};

const subscribeToHydration = () => () => undefined;

export function PersonalSettingsPanel({
  householdId,
  houseCode,
  initialName,
  initialAvatarColor,
}: {
  householdId: string;
  houseCode: string;
  initialName: string;
  initialAvatarColor: AvatarColor | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const hydrated = useSyncExternalStore(
    subscribeToHydration,
    () => true,
    () => false,
  );
  const [name, setName] = useState(initialName);
  const [avatarColor, setAvatarColor] = useState<AvatarColor>(initialAvatarColor ?? "teal");
  const [message, setMessage] = useState("");
  const [saved, setSaved] = useState(false);

  function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setSaved(false);
    const displayName = name.trim();
    startTransition(async () => {
      const result = await updatePersonalSettingsAction({
        householdId,
        displayName,
        avatarColor,
      });
      if (!result.ok) {
        setMessage(result.error);
        return;
      }
      setName(displayName);
      updateRememberedMemberName(houseCode, displayName);
      setMessage("Personal settings saved.");
      setSaved(true);
      router.refresh();
    });
  }

  return (
    <div className="mx-auto max-w-xl space-y-8">
      <Surface tone="lavender" className="flex items-center gap-4 p-5 sm:p-6">
        <MemberAvatar name={name} color={avatarColor} className="size-14 text-base" />
        <div className="min-w-0">
          <p className="text-[11px] font-black tracking-[0.14em] text-[var(--violet-strong)] uppercase">
            Account settings
          </p>
          <h1 className="mt-1 truncate text-2xl font-black tracking-[-0.035em]">
            {name || "Your profile"}
          </h1>
        </div>
      </Surface>

      {message && <StatusNote tone={saved ? "success" : "error"} title={message} />}

      <section>
        <SectionTitle>Your profile</SectionTitle>
        <form
          onSubmit={saveProfile}
          className="grid gap-5 rounded-2xl border border-[var(--line)] bg-white p-5 shadow-[var(--shadow-sm)]"
        >
          <Field label="Display name">
            <Input
              name="displayName"
              value={name}
              maxLength={40}
              autoComplete="nickname"
              required
              disabled={!hydrated || pending}
              onChange={(event) => setName(event.target.value)}
            />
          </Field>

          <fieldset>
            <legend className="flex items-center gap-2 text-sm font-extrabold">
              <Palette className="size-4 text-[var(--brand)]" aria-hidden="true" /> Avatar color
            </legend>
            <div className="mt-3 grid grid-cols-6 gap-2">
              {(Object.keys(avatarColors) as AvatarColor[]).map((color) => {
                const selected = avatarColor === color;
                return (
                  <button
                    key={color}
                    type="button"
                    aria-label={`${colorNames[color]} avatar`}
                    aria-pressed={selected}
                    className="grid aspect-square place-items-center rounded-full border-2 border-white shadow-sm ring-offset-2 transition-transform hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]"
                    style={{
                      background: avatarColors[color],
                      boxShadow: selected
                        ? `0 0 0 3px white, 0 0 0 5px ${avatarColors[color]}`
                        : undefined,
                    }}
                    disabled={!hydrated || pending}
                    onClick={() => setAvatarColor(color)}
                  >
                    <Check
                      className={`size-4 text-white ${selected ? "opacity-100" : "opacity-0"}`}
                      strokeWidth={3}
                      aria-hidden="true"
                    />
                  </button>
                );
              })}
            </div>
          </fieldset>

          <Button type="submit" className="w-full" disabled={!hydrated || pending}>
            {pending ? "Saving…" : "Save profile"}
          </Button>
        </form>
      </section>

      <section>
        <SectionTitle>Security</SectionTitle>
        <div className="rounded-2xl border border-[var(--line)] bg-white p-5 shadow-[var(--shadow-sm)]">
          <h2 className="font-extrabold">Personal PIN</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">Change the PIN used to sign in as you.</p>
          <ButtonLink href="/change-pin" tone="secondary" className="mt-4 w-full">
            <KeyRound className="size-4" /> Change personal PIN
          </ButtonLink>
        </div>
      </section>

      <section>
        <SectionTitle>Session</SectionTitle>
        <div className="grid gap-2 rounded-2xl border border-[var(--line)] bg-white p-5 shadow-[var(--shadow-sm)]">
          <Button
            type="button"
            tone="secondary"
            disabled={!hydrated || pending}
            onClick={() => startTransition(async () => void (await signOutAction()))}
          >
            <LogOut className="size-4" /> Sign out
          </Button>
          <Button
            type="button"
            tone="danger"
            disabled={!hydrated || pending}
            onClick={() => {
              if (!window.confirm("Forget this household and member on this device?")) return;
              startTransition(async () => {
                forgetRememberedDevice();
                await signOutAction("/");
              });
            }}
          >
            Forget this device
          </Button>
        </div>
      </section>
    </div>
  );
}
