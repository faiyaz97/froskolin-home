import Link from "next/link";
import Image from "next/image";
import appLogo from "../../../public/assets/froskolin-tab-logo.png";
import headerLogo from "../../../public/assets/froskolin-header-logo.png";

export function CatBadge({ className = "" }: { className?: string }) {
  return (
    <span
      className={`relative grid size-10 shrink-0 place-items-center ${className}`}
      aria-hidden="true"
    >
      <Image src={appLogo} alt="" fill sizes="40px" className="object-contain" />
    </span>
  );
}

export function CatMark({ compact = false }: { compact?: boolean }) {
  return (
    <Link
      href="/"
      className="group inline-flex items-center gap-2.5 text-[var(--ink)] no-underline"
      aria-label="Froskolin"
    >
      {compact ? (
        <CatBadge />
      ) : (
        <Image src={headerLogo} alt="" className="h-12 w-auto" sizes="144px" priority />
      )}
    </Link>
  );
}
