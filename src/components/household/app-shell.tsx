"use client";

import { ArrowLeft, Check } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useState } from "react";

import { cn } from "../ui/cn";
import { CatMark } from "../ui/brand";
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
  const primaryPaths = [root, `${root}/calendar`, `${root}/activity`, `${root}/account`];
  const isPrimaryPage = primaryPaths.includes(pathname);
  const isHome = pathname === root;
  const mobileTitle = mobileTitleOverride ?? getMobileTitle(pathname, root);
  const canSubmit = hasMobileSubmit(pathname, root);

  useEffect(() => {
    if (mustChangePin && pathname !== `${root}/account`) router.replace(`${root}/account`);
  }, [mustChangePin, pathname, root, router]);

  function goBack() {
    if (window.history.length > 1) router.back();
    else router.replace(root);
  }

  function submitCurrentForm() {
    const form = document.querySelector<HTMLFormElement>("form[data-mobile-submit]");
    const submitter = form?.querySelector<HTMLButtonElement>('button[type="submit"]');
    if (!form || submitter?.disabled) return;
    form.requestSubmit(submitter ?? undefined);
  }

  return (
    <MobileTitleContext.Provider value={setMobileTitleOverride}>
      <div className="min-h-dvh overflow-x-clip bg-[var(--canvas)]">
        <div className="min-w-0">
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
                  className="grid size-10 place-items-center rounded-xl text-[var(--ink)] transition-colors hover:bg-[var(--soft-line)]"
                  aria-label="Go back"
                >
                  <ArrowLeft className="size-5" strokeWidth={2.4} aria-hidden="true" />
                </button>
                <h1 className="truncate text-center text-[15px] font-black tracking-[-0.02em]">
                  {mobileTitle}
                </h1>
                {canSubmit ? (
                  <button
                    type="button"
                    onClick={submitCurrentForm}
                    className="grid size-10 place-items-center rounded-xl text-[var(--brand)] transition-colors hover:bg-[var(--brand-soft)]"
                    aria-label="Save"
                  >
                    <Check className="size-5" strokeWidth={3} aria-hidden="true" />
                  </button>
                ) : (
                  <span aria-hidden="true" />
                )}
              </div>
            </header>
          )}

          <main
            className={cn(
              "mx-auto w-full max-w-[980px] md:px-6 md:py-7 lg:px-8 lg:py-8",
              isHome ? "px-0 pt-0" : "px-3 pt-3",
              isPrimaryPage ? "app-safe-bottom" : "mobile-subpage pb-6 md:pb-28",
            )}
          >
            {children}
          </main>
        </div>

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

function hasMobileSubmit(pathname: string, root: string) {
  return (
    pathname === `${root}/add/expense` ||
    pathname === `${root}/add/bill` ||
    pathname === `${root}/add/settlement` ||
    /^\/h\/[^/]+\/expenses\/[^/]+\/edit$/.test(pathname) ||
    /^\/h\/[^/]+\/bills\/[^/]+\/confirm$/.test(pathname) ||
    /^\/h\/[^/]+\/settlements\/[^/]+\/edit$/.test(pathname) ||
    /^\/h\/[^/]+\/settings\/recurring\/[^/]+\/edit$/.test(pathname)
  );
}

function getMobileTitle(pathname: string, root: string) {
  if (pathname === `${root}/add/expense`) return "Add expense";
  if (pathname === `${root}/add/bill`) return "Utility bill";
  if (pathname === `${root}/add/settlement`) return "Record payment";
  if (pathname === `${root}/add`) return "Add";
  if (pathname === `${root}/balances`) return "Group balances";
  if (pathname === `${root}/landlord`) return "Landlord";
  if (pathname === `${root}/settings`) return "Group settings";
  if (/\/settings\/recurring\/[^/]+\/edit$/.test(pathname)) return "Edit recurring";
  if (/\/expenses\/[^/]+\/edit$/.test(pathname)) return "Edit expense";
  if (/\/bills\/[^/]+\/confirm$/.test(pathname)) return "Utility bill";
  if (/\/settlements\/[^/]+\/edit$/.test(pathname)) return "Edit payment";
  if (/\/expenses\/[^/]+$/.test(pathname)) return "Expense";
  if (/\/settlements\/[^/]+$/.test(pathname)) return "Payment";
  if (/\/activity\/[^/]+$/.test(pathname)) return "Activity";
  return "Froskolin";
}
