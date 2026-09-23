"use client";

import { Copy, Download, Send, Share2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createGroupInvitationUrl, parseGroupInvitationHash } from "@/lib/group-invitation";
import { createGroupInvitationImage } from "@/lib/group-invitation-image";
import { Dialog } from "../ui/dialog";
import { controlClass } from "../ui/field";
import { cn } from "../ui/cn";
import { iconActionClass } from "../ui/icon-action";
import { FacebookIcon, InstagramIcon, WhatsAppIcon } from "./invitation-social-icons";

const socialTargets = [
  { name: "WhatsApp", icon: WhatsAppIcon, tone: "brand" },
  { name: "Telegram", icon: Send, tone: "sky" },
  { name: "Instagram", icon: InstagramIcon, tone: "violet" },
  { name: "Facebook", icon: FacebookIcon, tone: "sky" },
] as const;
type SocialTarget = (typeof socialTargets)[number]["name"] | "More";
type InvitationProps = { groupName: string; houseCode: string; joinPin: string };

function isShareCancelled(error: unknown) {
  return (
    typeof error === "object" && error !== null && "name" in error && error.name === "AbortError"
  );
}

function InvitationDialog({
  groupName,
  houseCode,
  joinPin,
  onClose,
}: InvitationProps & { onClose: () => void }) {
  const shareAttempt = useRef(0);
  const shareTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sharePending = useRef(false);
  useEffect(
    () => () => {
      shareAttempt.current += 1;
      if (shareTimer.current) clearTimeout(shareTimer.current);
    },
    [],
  );
  const linkRef = useRef<HTMLInputElement>(null);
  const [invitationUrl] = useState(() =>
    createGroupInvitationUrl({ origin: window.location.origin, houseCode, joinPin }),
  );
  const [image, setImage] = useState<{ file: File; url: string } | null>(null);
  const [imageError, setImageError] = useState(false);
  const [message, setMessage] = useState("");
  const [fallback, setFallback] = useState<SocialTarget | null>(null);
  const [sharing, setSharing] = useState(false);
  const [textTarget, setTextTarget] = useState<SocialTarget | null>(null);
  const [attempt, setAttempt] = useState(0);
  const shareIntro = `Join ${groupName} on Froskolin!\n\nGroup code: ${houseCode}\nGroup pin: ${joinPin}`;
  const shareText = `${shareIntro}\n\n${invitationUrl}`;

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | undefined;
    createGroupInvitationImage({ groupName, houseCode, joinPin })
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setImage({
          file: new File([blob], "froskolin-invitation.png", { type: "image/png" }),
          url: objectUrl,
        });
      })
      .catch(() => {
        if (!cancelled) setImageError(true);
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [groupName, houseCode, joinPin, attempt]);

  async function copyLink() {
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Unavailable");
      await navigator.clipboard.writeText(invitationUrl);
      setMessage("Link copied.");
    } catch {
      linkRef.current?.focus();
      linkRef.current?.select();
      setMessage("Select the link and copy it manually.");
    }
  }

  function startShare(target: SocialTarget, data: ShareData, withImage: boolean) {
    if (sharePending.current) return;
    const id = ++shareAttempt.current;
    const finish = () => {
      if (id !== shareAttempt.current) return false;
      if (shareTimer.current) clearTimeout(shareTimer.current);
      sharePending.current = false;
      setSharing(false);
      setMessage("");
      return true;
    };
    setMessage("");
    setFallback(null);
    try {
      if (!navigator.share || (withImage && !navigator.canShare?.({ files: data.files }))) {
        setFallback(target);
        return;
      }
      sharePending.current = true;
      setSharing(true);
      // Stay in the click handler to retain transient user activation.
      const result = navigator.share(data);
      setMessage(
        target === "More"
          ? "Choose an app in the share menu."
          : `Choose ${target} in the share menu.`,
      );
      // Some native share sheets never settle their promise. Restore access to
      // download/link fallbacks and ignore a late completion from this attempt.
      shareTimer.current = setTimeout(() => {
        if (!finish()) return;
        shareAttempt.current += 1;
        setFallback(target);
      }, 15000);
      void result.then(
        () => {
          if (finish() && withImage) setTextTarget(target);
        },
        (error: unknown) => {
          if (finish() && !isShareCancelled(error)) setFallback(target);
        },
      );
    } catch (error) {
      if (finish() && !isShareCancelled(error)) setFallback(target);
    }
  }

  function shareInvitation(target: SocialTarget) {
    if (!image || sharePending.current) return;
    setTextTarget(null);
    startShare(target, { files: [image.file], text: shareText }, true);
  }

  function shareInvitationText() {
    if (textTarget) startShare(textTarget, { text: shareText }, false);
  }

  const fallbackUrl =
    fallback === "WhatsApp"
      ? `https://wa.me/?text=${encodeURIComponent(shareText)}`
      : fallback === "Telegram"
        ? `https://t.me/share/url?url=${encodeURIComponent(invitationUrl)}&text=${encodeURIComponent(shareIntro)}`
        : fallback === "Facebook"
          ? `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(invitationUrl)}`
          : fallback === "Instagram"
            ? "https://www.instagram.com/"
            : null;

  return (
    <Dialog title="Invite members" onClose={onClose}>
      <div className="grid gap-4 px-2 pt-1 pb-3">
        {image ? (
          // Blob URLs are generated locally; no remote image service receives credentials.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={image.url}
            alt={`Froskolin invitation to ${groupName}. Group code ${houseCode}. Group PIN ${joinPin}.`}
            className="aspect-square w-full rounded-2xl"
          />
        ) : (
          <div
            className="grid aspect-square place-content-center gap-3 rounded-2xl bg-[var(--pastel-sky)] p-6 text-center text-sm text-[var(--ink-soft)]"
            role="status"
          >
            {imageError ? (
              <>
                <p>The invitation image could not be created.</p>
                <button
                  type="button"
                  className="font-bold text-[var(--brand)]"
                  onClick={() => {
                    setImageError(false);
                    setAttempt((value) => value + 1);
                  }}
                >
                  Try again
                </button>
              </>
            ) : (
              "Preparing your invitation…"
            )}
          </div>
        )}
        <div className="flex min-w-0 items-center gap-1.5">
          <input
            ref={linkRef}
            aria-label="Invitation link"
            value={invitationUrl}
            readOnly
            spellCheck={false}
            onFocus={(event) => event.currentTarget.select()}
            className={cn(controlClass, "min-w-0 flex-1 text-xs")}
          />
          <button
            type="button"
            aria-label="Copy link"
            title="Copy link"
            className={iconActionClass({ tone: "brand", className: "size-11" })}
            onClick={copyLink}
          >
            <Copy className="size-5" aria-hidden="true" />
          </button>
          {image && (
            <a
              href={image.url}
              download="froskolin-invitation.png"
              aria-label="Download invitation image"
              title="Download invitation image"
              className={iconActionClass({ className: "size-11" })}
            >
              <Download className="size-5" aria-hidden="true" />
            </a>
          )}
        </div>
        <div className="grid grid-cols-5 justify-items-center gap-1" aria-label="Share invitation">
          {socialTargets.map(({ name, icon: Icon, tone }) => (
            <button
              key={name}
              type="button"
              aria-label={`Share on ${name}`}
              title={`Share on ${name}`}
              disabled={!image || sharing}
              onClick={() => shareInvitation(name)}
              className={iconActionClass({ tone, active: true, className: "size-11" })}
            >
              <Icon className="size-5" aria-hidden="true" />
            </button>
          ))}
          <button
            type="button"
            aria-label="More sharing options"
            title="More sharing options"
            disabled={!image || sharing}
            onClick={() => shareInvitation("More")}
            className={iconActionClass({ active: true, className: "size-11" })}
          >
            <Share2 className="size-5" aria-hidden="true" />
          </button>
        </div>
        {textTarget && !fallback && (
          <div className="flex items-center gap-2 rounded-xl bg-[var(--canvas)] p-3" role="status">
            <p className="flex-1 text-xs leading-5 text-[var(--ink-soft)]">
              If your app left out the caption, share the text to the same chat.
            </p>
            <button
              type="button"
              aria-label="Share invitation text"
              title="Share invitation text"
              disabled={sharing}
              onClick={shareInvitationText}
              className={iconActionClass({ tone: "brand", className: "size-11" })}
            >
              <Send className="size-5" aria-hidden="true" />
            </button>
          </div>
        )}
        {fallback && (
          <div
            role="status"
            className="rounded-xl bg-[var(--canvas)] p-3 text-xs leading-5 text-[var(--ink-soft)]"
          >
            <p>
              Save the invitation image, then attach it{" "}
              {fallback === "More" ? "in your preferred app" : `in ${fallback}`} first. Then share
              the invitation text to the same chat.
            </p>
            {fallbackUrl && (
              <a
                href={fallbackUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 inline-block font-bold text-[var(--brand)]"
              >
                Open {fallback}
                {fallback === "Instagram" ? "" : " with link"}
              </a>
            )}
          </div>
        )}
        {message && (
          <p role="status" className="text-xs font-semibold text-[var(--muted)]">
            {message}
          </p>
        )}
        <p className="text-center text-[11px] text-[var(--muted)]">
          Anyone with this invitation can join your group.
        </p>
      </div>
    </Dialog>
  );
}

export function GroupInvitationAction({
  groupName,
  houseCode,
  joinPin,
  joiningEnabled,
  disabled = false,
}: InvitationProps & { joiningEnabled: boolean; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const canInvite =
    joiningEnabled &&
    Boolean(
      parseGroupInvitationHash(new URLSearchParams({ code: houseCode, pin: joinPin }).toString()),
    );
  return (
    <>
      <button
        type="button"
        disabled={disabled || !canInvite}
        aria-label="Invite members"
        title="Invite members"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
        className={iconActionClass({ tone: "brand", className: "size-11" })}
      >
        <Share2 className="size-5" aria-hidden="true" />
      </button>
      {open && canInvite && (
        <InvitationDialog
          key={`${groupName}:${houseCode}:${joinPin}`}
          groupName={groupName}
          houseCode={houseCode}
          joinPin={joinPin}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
