import Link from "next/link";

export function CatBadge({ className = "" }: { className?: string }) {
  return (
    <span
      className={`relative grid size-10 shrink-0 place-items-center overflow-hidden rounded-[14px] bg-gradient-to-br from-[var(--brand)] via-[#0891b2] to-[var(--violet)] shadow-[0_8px_20px_rgb(15_118_110/0.2)] ${className}`}
      aria-hidden="true"
    >
      <svg viewBox="0 0 48 48" className="size-8" fill="none">
        <path
          d="M10.5 17 13 8l8 5h6l8-5 2.5 9v11.5C37.5 36 31.5 41 24 41s-13.5-5-13.5-12.5V17Z"
          fill="white"
        />
        <circle cx="18.5" cy="25" r="2" fill="#0f766e" />
        <circle cx="29.5" cy="25" r="2" fill="#7c3aed" />
        <path
          d="m22 30 2 1.5 2-1.5M24 31.5V34"
          stroke="#172033"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M14 29H7m7.5 3L8 34m26-5h7m-7.5 3 6.5 2"
          stroke="white"
          strokeWidth="1.5"
          strokeLinecap="round"
          opacity=".9"
        />
      </svg>
      <span className="absolute top-0 right-0 size-3 rounded-bl-full bg-[#fb923c]" />
    </span>
  );
}

export function CatMark({ compact = false }: { compact?: boolean }) {
  return (
    <Link
      href="/"
      className="group inline-flex items-center gap-2.5 text-[var(--ink)] no-underline"
      aria-label="Froskolin Home"
    >
      <CatBadge />
      {!compact && (
        <span className="text-[18px] leading-none font-black tracking-[-0.04em]">
          Froskolin<span className="text-[var(--brand)]">.</span>
        </span>
      )}
    </Link>
  );
}
