"use client";

import { Check, ChevronRight, KeyRound, LogOut, Pencil } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore, useTransition } from "react";

import { changePinAction, signOutAction, updatePersonalSettingsAction } from "@/lib/actions";
import { avatars, resolveAvatarId } from "@/lib/avatar";
import { updateRememberedMemberName } from "@/lib/device-memory";
import { Dialog } from "../ui/dialog";
import { Field, Input } from "../ui/field";
import { iconActionClass } from "../ui/icon-action";
import { StatusNote } from "../ui/page";
import { MemberAvatar, type AvatarColor } from "./member-avatar";

const avatarChoices: AvatarColor[] = ["orange", "rose", "blue", "indigo", "teal", "violet"];
const subscribeToHydration = () => () => undefined;

export function PersonalSettingsPanel({
  householdId,
  houseCode,
  initialName,
  initialAvatarColor,
  forcePinChange = false,
}: {
  householdId: string;
  houseCode: string;
  initialName: string;
  initialAvatarColor: AvatarColor | null;
  forcePinChange?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const hydrated = useSyncExternalStore(
    subscribeToHydration,
    () => true,
    () => false,
  );
  const [name, setName] = useState(initialName);
  const [avatarColor, setAvatarColor] = useState<AvatarColor>(
    initialAvatarColor ?? resolveAvatarId(initialName),
  );
  const [nameDialogOpen, setNameDialogOpen] = useState(false);
  const [avatarDialogOpen, setAvatarDialogOpen] = useState(false);
  const [pinDialogOpen, setPinDialogOpen] = useState(forcePinChange);
  const [draftName, setDraftName] = useState(initialName);
  const [draftAvatar, setDraftAvatar] = useState<AvatarColor>(avatarColor);
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [dialogError, setDialogError] = useState("");

  function saveProfile(nextName: string, nextAvatar: AvatarColor, onSaved: () => void) {
    setDialogError("");
    startTransition(async () => {
      const displayName = nextName.trim();
      const result = await updatePersonalSettingsAction({
        householdId,
        displayName,
        avatarColor: nextAvatar,
      });
      if (!result.ok) {
        setDialogError(result.error);
        return;
      }
      setName(displayName);
      setAvatarColor(nextAvatar);
      updateRememberedMemberName(houseCode, displayName);
      onSaved();
      router.refresh();
    });
  }

  function openNameDialog() {
    setDraftName(name);
    setDialogError("");
    setNameDialogOpen(true);
  }

  function openAvatarDialog() {
    setDraftAvatar(avatarColor);
    setDialogError("");
    setAvatarDialogOpen(true);
  }

  function openPinDialog() {
    setCurrentPin("");
    setNewPin("");
    setConfirmation("");
    setDialogError("");
    setPinDialogOpen(true);
  }

  function savePin() {
    setDialogError("");
    if (newPin !== confirmation) {
      setDialogError("The two new PINs do not match.");
      return;
    }
    startTransition(async () => {
      const result = await changePinAction({ currentPin, newPin });
      if (!result.ok) {
        setDialogError(result.error);
        return;
      }
      setPinDialogOpen(false);
      setCurrentPin("");
      setNewPin("");
      setConfirmation("");
      router.refresh();
    });
  }

  const pinReady =
    /^(?:\d{4}|\d{6})$/.test(currentPin) && /^\d{6}$/.test(newPin) && /^\d{6}$/.test(confirmation);

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <header className="sticky top-0 z-20 -mx-3 -mt-3 overflow-hidden rounded-b-[28px] bg-[linear-gradient(135deg,var(--pastel-sky),var(--pastel-mint))] px-5 pt-[calc(env(safe-area-inset-top)+1rem)] pb-5 shadow-[var(--shadow-sm)] md:relative md:mx-0 md:mt-0 md:rounded-[28px] md:p-7">
        <div
          className="pointer-events-none absolute -top-16 -right-14 size-52 rounded-full opacity-45 blur-2xl"
          style={{ background: avatars[avatarColor].background }}
          aria-hidden="true"
        />
        <div className="relative flex items-center gap-4 sm:gap-5">
          <button
            type="button"
            aria-label="Change avatar"
            className="group relative shrink-0 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-2"
            disabled={!hydrated || pending}
            onClick={openAvatarDialog}
          >
            <MemberAvatar
              name={name}
              color={avatarColor}
              className="size-20 border-4 shadow-[0_12px_28px_rgb(15_23_42/0.12)] transition-transform group-hover:scale-[1.03] sm:size-24"
            />
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-black tracking-[0.14em] text-[var(--brand-strong)] uppercase">
              Your account
            </p>
            <div className="mt-1 flex min-w-0 items-center gap-2">
              <h1 className="truncate text-2xl font-black tracking-[-0.04em] sm:text-3xl">
                {name || "Your profile"}
              </h1>
              <button
                type="button"
                aria-label="Edit display name"
                className={iconActionClass({ tone: "brand", className: "size-7" })}
                disabled={!hydrated || pending}
                onClick={openNameDialog}
              >
                <Pencil className="size-3.5" aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <section className="overflow-hidden rounded-[22px] bg-white/85 shadow-[var(--shadow-sm)]">
        <button
          type="button"
          className="group flex min-h-16 w-full items-center gap-3 px-4 text-left text-sm font-extrabold text-[var(--ink)] transition-colors hover:bg-[var(--row-hover)] focus-visible:bg-[var(--row-hover)] focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
          disabled={!hydrated || pending}
          onClick={openPinDialog}
        >
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--pastel-mint)] text-[var(--brand)] transition-[background-color,transform] group-hover:scale-[1.03] group-hover:bg-[var(--brand-soft)] group-focus-visible:scale-[1.03] group-focus-visible:bg-[var(--brand-soft)]">
            <KeyRound className="size-5" aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1">Change personal PIN</span>
          <ChevronRight
            className="size-5 shrink-0 text-[var(--muted)] transition-transform group-hover:translate-x-0.5 group-focus-visible:translate-x-0.5"
            aria-hidden="true"
          />
        </button>
        <div className="mx-4 h-px bg-[var(--soft-line)]" aria-hidden="true" />
        <button
          type="button"
          className="group flex min-h-16 w-full items-center gap-3 px-4 text-left text-sm font-extrabold text-[var(--ink)] transition-colors hover:bg-[var(--row-hover)] focus-visible:bg-[var(--row-hover)] focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
          disabled={!hydrated || pending}
          onClick={() => startTransition(async () => void (await signOutAction()))}
        >
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--negative-soft)] text-[var(--negative)] transition-[background-color,transform] group-hover:scale-[1.03] group-hover:bg-[#fee2e2] group-focus-visible:scale-[1.03] group-focus-visible:bg-[#fee2e2]">
            <LogOut className="size-5" aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1">Sign out</span>
          <ChevronRight
            className="size-5 shrink-0 text-[var(--muted)] transition-transform group-hover:translate-x-0.5 group-focus-visible:translate-x-0.5"
            aria-hidden="true"
          />
        </button>
      </section>

      {nameDialogOpen && (
        <Dialog
          title="Display name"
          onClose={() => !pending && setNameDialogOpen(false)}
          onDone={() => saveProfile(draftName, avatarColor, () => setNameDialogOpen(false))}
          doneDisabled={pending || !draftName.trim() || draftName.trim() === name}
        >
          <div className="grid gap-4 px-2 pt-2 pb-3">
            {dialogError && <StatusNote tone="error" title={dialogError} />}
            <Field label="Display name">
              <Input
                value={draftName}
                onChange={(event) => setDraftName(event.target.value)}
                maxLength={40}
                autoComplete="nickname"
                autoFocus
                disabled={pending}
              />
            </Field>
          </div>
        </Dialog>
      )}

      {avatarDialogOpen && (
        <Dialog
          title="Choose your avatar"
          onClose={() => !pending && setAvatarDialogOpen(false)}
          onDone={() => saveProfile(name, draftAvatar, () => setAvatarDialogOpen(false))}
          doneDisabled={pending || draftAvatar === avatarColor}
        >
          <div className="grid gap-4 px-1 pt-2 pb-3">
            {dialogError && <StatusNote tone="error" title={dialogError} />}
            <div className="grid grid-cols-3 gap-3">
              {avatarChoices.map((avatarId) => {
                const selected = draftAvatar === avatarId;
                const avatar = avatars[avatarId];
                return (
                  <button
                    key={avatarId}
                    type="button"
                    aria-label={`${avatar.name} avatar`}
                    aria-pressed={selected}
                    className="relative grid min-w-0 gap-1.5 rounded-2xl bg-[var(--canvas)] p-1.5 text-center transition hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] disabled:opacity-60"
                    style={{
                      boxShadow: selected
                        ? `0 0 0 2px white, 0 0 0 4px ${avatar.background}`
                        : undefined,
                    }}
                    disabled={pending}
                    onClick={() => setDraftAvatar(avatarId)}
                  >
                    <MemberAvatar
                      name={avatar.name}
                      color={avatarId}
                      className="aspect-square h-auto w-full rounded-xl border-0 shadow-none"
                    />
                    <span className="truncate px-0.5 text-[10px] font-extrabold text-[var(--ink-soft)]">
                      {avatar.name}
                    </span>
                    {selected && (
                      <span className="absolute top-2 right-2 grid size-5 place-items-center rounded-full bg-[var(--brand)] text-white shadow-sm">
                        <Check className="size-3" strokeWidth={3} aria-hidden="true" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </Dialog>
      )}

      {pinDialogOpen && (
        <Dialog
          title={forcePinChange ? "Set a new PIN" : "Change personal PIN"}
          onClose={() => !pending && !forcePinChange && setPinDialogOpen(false)}
          onDone={savePin}
          doneDisabled={pending || !pinReady}
          dismissible={!forcePinChange}
        >
          <div className="grid gap-3 px-2 pt-2 pb-3">
            {dialogError && <StatusNote tone="error" title={dialogError} />}
            <Field label="Current or temporary PIN">
              <Input
                value={currentPin}
                onChange={(event) => setCurrentPin(event.target.value)}
                className="tracking-[0.35em]"
                inputMode="numeric"
                pattern="(?:[0-9]{4}|[0-9]{6})"
                minLength={4}
                maxLength={6}
                type="password"
                autoComplete="current-password"
                autoFocus
                disabled={pending}
              />
            </Field>
            <Field label="New personal PIN">
              <Input
                value={newPin}
                onChange={(event) => setNewPin(event.target.value)}
                className="tracking-[0.35em]"
                inputMode="numeric"
                pattern="[0-9]{6}"
                minLength={6}
                maxLength={6}
                type="password"
                autoComplete="new-password"
                placeholder="••••••"
                disabled={pending}
              />
            </Field>
            <Field label="Confirm new PIN">
              <Input
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                className="tracking-[0.35em]"
                inputMode="numeric"
                pattern="[0-9]{6}"
                minLength={6}
                maxLength={6}
                type="password"
                autoComplete="new-password"
                placeholder="••••••"
                disabled={pending}
              />
            </Field>
          </div>
        </Dialog>
      )}
    </div>
  );
}
