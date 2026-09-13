import type { SVGProps } from "react";

// Brand marks are kept local; the installed Lucide version has no brand icons.
export function InstagramIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function FacebookIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M14 22v-9h3l.5-4H14V7c0-1 .3-1.5 1.7-1.5H18V2.2c-.4-.1-1.8-.2-3.2-.2C11.6 2 10 4 10 7v2H7v4h3v9z" />
    </svg>
  );
}

export function WhatsAppIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M20.5 11.7a8.5 8.5 0 0 1-12.7 7.4L3 21l1.7-4.9a8.5 8.5 0 1 1 15.8-4.4Z" />
      <path
        d="m8.1 7.1 1.7-.1 1 2.4-1.1 1.1c.8 1.7 1.8 2.7 3.5 3.5l1.1-1.1 2.4 1-.1 1.7c-.1 1-1.1 1.7-2.1 1.4-4.2-1-6.7-3.5-7.7-7.7-.3-1 .4-2 1.3-2.2Z"
        strokeWidth="1.3"
      />
    </svg>
  );
}
