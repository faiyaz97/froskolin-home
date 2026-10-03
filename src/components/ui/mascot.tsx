import Image from "next/image";
import peekingAnimation from "../../../public/assets/animations/froskolin-peeking.webp";
import peekingCat from "../../../public/assets/froskolin-peeking.png";

export function PeekingFroskolin({ className = "" }: { className?: string }) {
  return (
    <picture className="contents">
      <source
        srcSet={peekingAnimation.src}
        type="image/webp"
        width={peekingAnimation.width}
        height={peekingAnimation.height}
      />
      <Image
        src={peekingCat}
        alt=""
        unoptimized
        loading="eager"
        className={className}
        aria-hidden="true"
      />
    </picture>
  );
}
