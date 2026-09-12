import Image from "next/image";
import peekingCat from "../../../public/assets/froskolin-peeking.png";

export function PeekingFroskolin({ className = "" }: { className?: string }) {
  return <Image src={peekingCat} alt="" preload className={className} aria-hidden="true" />;
}
