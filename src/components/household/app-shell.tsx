"use client";

import { ArrowLeft, Check, CircleCheck, LoaderCircle } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useRef, useState } from "react";

import { cn } from "../ui/cn";
import { CatMark } from "../ui/brand";
import { iconActionClass } from "../ui/icon-action";
import { AppNavigation } from "./app-navigation";

const MobileTitleContext = createContext<((title: string | null) => void) | null>(null);

export function MobilePageTitle({ title }: { title: string }) {
  const setTitle = useContext(MobileTitleContext);

  useEffect(() => {
    setTitle?.(title);
    return () => setTitle?.(null);
  }, [setTitle, title]);

  return null;
}

export function AppShell({
  householdId,
  memberName,
  memberAvatarColor,
  mustChangePin,
  children,
}: {
  householdId: string;
  memberName: string;
  memberAvatarColor: string | null;
  mustChangePin: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const root = `/h/${householdId}`;
  const [mobileTitleOverride, setMobileTitleOverride] = useState<string | null>(null);
  const [mobileSaving, setMobileSaving] = useState(false);
  const [saveComplete, setSaveComplete] = useState<string | null>(null);
  const mainRef = useRef<HTMLElement>(null);
  const primaryPaths = [root, `${root}/calendar`, `${root}/activity`, `${root}/account`];
  const isPrimaryPage = primaryPaths.includes(pathname);
  const isHome = pathname === root;
  const mobileTitle = mobileTitleOverride ?? getMobileTitle(pathname, root);
  const mobileSubmitLabel = getMobileSubmitLabel(pathname, root);

  useEffect(() => {
    if (mustChangePin && pathname !== `${root}/account`) router.replace(`${root}/account`);
  }, [mustChangePin, pathname, root, router]);

  useEffect(() => {
    const main = mainRef.current;
    if (!main) return;
    const readSaving = () =>
      setMobileSaving(
        main.querySelector<HTMLFormElement>('form[data-mobile-submit][aria-busy="true"]') !== null,
      );
    readSaving();
    const observer = new MutationObserver(readSaving);
    observer.observe(main, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["aria-busy"],
    });
    return () => observer.disconnect();
  }, [pathname]);

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const onSaved = (event: Event) => {
      setSaveComplete((event as CustomEvent<string>).detail);
      clearTimeout(timeout);
      timeout = setTimeout(() => setSaveComplete(null), 3000);
    };
    window.addEventListener("froskolin:save-complete", onSaved);
    return () => {
      window.removeEventListener("froskolin:save-complete", onSaved);
      clearTimeout(timeout);
    };
  }, []);

  function goBack() {
    if (/\/expenses\/[^/]+\/attachment$/.test(pathname)) {
      router.replace(pathname.slice(0, -"/attachment".length));
      return;
    }
    if (window.history.length > 1) router.back();
    else router.replace(root);
  }

  function submitCurrentForm() {
    const form = document.querySelector<HTMLFormElement>("form[data-mobile-submit]");
    const submitter = form?.querySelector<HTMLButtonElement>('button[type="submit"]');
    if (!form || submitter?.disabled || mobileSaving) return;
    form.requestSubmit(submitter ?? undefined);
  }

  return (
    <MobileTitleContext.Provider value={setMobileTitleOverride}>
      <div className="min-h-dvh w-full max-w-full overflow-x-clip bg-[var(--canvas)]">
        <div className="w-full max-w-full min-w-0">
          <header className="sticky top-0 z-30 hidden border-b border-[var(--line)] bg-white/92 px-6 py-2.5 backdrop-blur-xl md:block lg:px-8">
            <div className="mx-auto flex max-w-[980px] items-center">
              <CatMark />
            </div>
          </header>

          {!isPrimaryPage && (
            <header className="sticky top-0 z-40 border-b border-[var(--line)] bg-white/96 pt-[env(safe-area-inset-top)] backdrop-blur-xl md:hidden">
              <div className="grid min-h-13 grid-cols-[3rem_minmax(0,1fr)_3rem] items-center px-1.5">
                <button
                  type="button"
                  onClick={goBack}
                  className={iconActionClass({ className: "size-10" })}
                  aria-label="Go back"
                >
                  <ArrowLeft className="size-5" strokeWidth={2.4} aria-hidden="true" />
                </button>
                <h1
                  className="truncate text-center text-[15px] font-black tracking-[-0.02em]"
                  aria-live="polite"
                >
                  {mobileSaving ? "Saving…" : mobileTitle}
                </h1>
                {mobileSubmitLabel ? (
                  <button
                    type="button"
                    onClick={submitCurrentForm}
                    className={iconActionClass({
                      tone: "brand",
                      className: cn("size-10", mobileSaving && "disabled:opacity-100"),
                    })}
                    aria-label={mobileSaving ? "Saving" : mobileSubmitLabel}
                    disabled={mobileSaving}
                  >
                    {mobileSaving ? (
                      <LoaderCircle
                        className="size-5 motion-safe:animate-spin"
                        strokeWidth={2.5}
                        aria-hidden="true"
                      />
                    ) : (
                      <Check className="size-5" strokeWidth={3} aria-hidden="true" />
                    )}
                  </button>
                ) : (
                  <span aria-hidden="true" />
                )}
              </div>
            </header>
          )}

          <main
            ref={mainRef}
            className={cn(
              "mx-auto w-full max-w-[980px] min-w-0 md:px-6 md:pt-7 md:pb-36 lg:px-8 lg:pt-8",
              isHome ? "px-0 pt-0" : "px-3 pt-3",
              isPrimaryPage ? "app-safe-bottom" : "mobile-subpage pb-6",
            )}
          >
            {children}
          </main>
        </div>

        {saveComplete && (
          <div
            role="status"
            className={cn(
              "pointer-events-none fixed inset-x-3 z-50 mx-auto flex w-fit max-w-[calc(100vw-1.5rem)] items-center gap-2 rounded-full bg-[var(--positive)] px-4 py-2.5 text-sm font-bold text-white shadow-[var(--shadow-float)] md:hidden",
              isPrimaryPage
                ? "bottom-[calc(5rem+env(safe-area-inset-bottom))]"
                : "bottom-[calc(1rem+env(safe-area-inset-bottom))]",
            )}
          >
            <CircleCheck className="size-4 shrink-0" aria-hidden="true" />
            {saveComplete}
          </div>
        )}

        <AppNavigation
          householdId={householdId}
          memberName={memberName}
          memberAvatarColor={memberAvatarColor}
          showOnMobile={isPrimaryPage}
        />
      </div>
    </MobileTitleContext.Provider>
  );
}

function getMobileSubmitLabel(pathname: string, root: string) {
  if (pathname === `${root}/add/expense`) return "Add expense";
  if (pathname === `${root}/add/bill`) return "Add bill";
  if (pathname === `${root}/add/settlement`) return "Record payment";
  if (/^\/h\/[^/]+\/bills\/[^/]+\/confirm$/.test(pathname)) return "Add bill";
  if (
    /^\/h\/[^/]+\/expenses\/[^/]+\/edit$/.test(pathname) ||
    /^\/h\/[^/]+\/settlements\/[^/]+\/edit$/.test(pathname) ||
    /^\/h\/[^/]+\/settings\/recurring\/[^/]+\/edit$/.test(pathname)
  ) {
    return "Save";
  }
  return null;
}

function getMobileTitle(pathname: string, root: string) {
  if (pathname === `${root}/add/expense`) return "Add expense";
  if (pathname === `${root}/add/bill`) return "Utility bill";
  if (pathname === `${root}/add/settlement`) return "Record payment";
  if (pathname === `${root}/add`) return "Add";
  if (pathname === `${root}/balances`) return "Group balances";
  if (pathname === `${root}/landlord`) return "Landlord balance";
  if (pathname === `${root}/settings`) return "Group settings";
  if (/\/settings\/recurring\/[^/]+\/edit$/.test(pathname)) return "Edit recurring";
  if (/\/expenses\/[^/]+\/edit$/.test(pathname)) return "Edit expense";
  if (/\/bills\/[^/]+\/confirm$/.test(pathname)) return "Utility bill";
  if (/\/settlements\/[^/]+\/edit$/.test(pathname)) return "Edit payment";
  if (/\/expenses\/[^/]+\/attachment$/.test(pathname)) return "Attachment";
  if (/\/expenses\/[^/]+$/.test(pathname)) return "Expense";
  if (/\/settlements\/[^/]+$/.test(pathname)) return "Payment";
  if (/\/activity\/[^/]+$/.test(pathname)) return "Activity";
  return "Froskolin";
}
