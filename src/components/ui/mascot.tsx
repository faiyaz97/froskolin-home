import Image from "next/image";

export function PeekingFroskolin({ className = "" }: { className?: string }) {
  return (
    <Image
      src="/assets/froskolin-peeking.png"
      width={1180}
      height={769}
      alt=""
      preload
      className={className}
      aria-hidden="true"
    />
  );
}
