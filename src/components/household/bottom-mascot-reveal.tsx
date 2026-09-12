"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";
import sleepingCat from "../../../public/assets/froskolin-sleeping.png";

export function BottomMascotReveal() {
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    const image = imageRef.current;
    if (!container || !image) return;
    const containerElement = container;
    const imageElement = image;
    let frame = 0;

    function update() {
      frame = 0;
      const navigation = document.querySelector<HTMLElement>('nav[aria-label="Primary"]');
      const navigationTop = navigation?.getBoundingClientRect().top ?? window.innerHeight;
      const availableSpace = navigationTop - containerElement.getBoundingClientRect().top;
      const imageHeight = imageElement.getBoundingClientRect().height;
      const revealStart = imageHeight;
      const revealEnd = imageHeight + 80;
      const progress = Math.min(
        1,
        Math.max(0, (availableSpace - revealStart) / (revealEnd - revealStart)),
      );
      const eased = progress * progress * (3 - 2 * progress);

      imageElement.style.opacity = String(eased);
      imageElement.style.transform = `translateY(${14 * (1 - eased)}px) scale(${0.96 + 0.04 * eased})`;
    }

    function scheduleUpdate() {
      if (!frame) frame = window.requestAnimationFrame(update);
    }

    update();
    window.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("resize", scheduleUpdate);
    return () => {
      window.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("resize", scheduleUpdate);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative flex h-36 items-end justify-start px-5 md:justify-center"
    >
      <Image
        ref={imageRef}
        src={sleepingCat}
        sizes="(max-width: 767px) 108px, 120px"
        alt=""
        aria-hidden="true"
        className="bottom-mascot-image pointer-events-none h-auto w-[108px] opacity-0 will-change-transform md:mb-1 md:w-30"
      />
    </div>
  );
}
