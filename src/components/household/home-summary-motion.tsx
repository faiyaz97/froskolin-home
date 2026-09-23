"use client";

import { useEffect, useRef, type ReactNode } from "react";

const MOBILE_BREAKPOINT = 768;
const MAX_COLLAPSE_DISTANCE = 96;

export function HomeSummaryMotion({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const style = element.style;
    const dataset = element.dataset;
    let frame = 0;
    function getTargetProgress() {
      if (window.innerWidth >= MOBILE_BREAKPOINT) return 0;

      const availableScroll = document.documentElement.scrollHeight - window.innerHeight;
      const collapseDistance = Math.min(MAX_COLLAPSE_DISTANCE, Math.max(1, availableScroll));
      return Math.min(1, Math.max(0, window.scrollY / collapseDistance));
    }

    function paint(progress: number) {
      const expanded = 1 - progress;
      style.setProperty("--home-head-height", `${126 - 66 * progress}px`);
      style.setProperty("--home-title-size", `${28 - 11 * progress}px`);
      style.setProperty("--home-mascot-width", `${84 - 34 * progress}px`);
      style.setProperty("--home-balance-height", `${68 - 26 * progress}px`);
      style.setProperty("--home-detail-opacity", `${expanded}`);
      style.setProperty("--home-detail-width", `${76 * expanded}px`);
      style.setProperty("--home-detail-height", `${16 * expanded}px`);
      style.setProperty("--home-member-height", `${20 * expanded}px`);
      style.setProperty("--home-summary-gap", `${8 - 4 * progress}px`);
      style.setProperty("--home-header-pad", `${14 - 7 * progress}px`);
      style.setProperty("--home-balances-pad", `${8 - 6 * progress}px`);
      style.setProperty("--home-card-radius", `${15 * expanded}px`);
      style.setProperty("--home-divider-opacity", `${progress}`);
      style.setProperty("--home-divider-height", `${28 * progress}px`);
      style.setProperty("--home-surface-radius", `${14 * progress}px`);
      style.setProperty("--home-group-bg", `rgb(227 242 253 / ${expanded})`);
      style.setProperty("--home-group-border", `rgb(191 222 244 / ${expanded})`);
      style.setProperty("--home-landlord-bg", `rgb(255 240 231 / ${expanded})`);
      style.setProperty("--home-landlord-border", `rgb(247 212 192 / ${expanded})`);
      dataset.collapsed = progress >= 0.98 ? "true" : "false";
    }

    function update() {
      frame = 0;
      paint(getTargetProgress());
    }

    function scheduleUpdate() {
      if (!frame) frame = window.requestAnimationFrame(update);
    }

    paint(getTargetProgress());
    window.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("resize", scheduleUpdate);
    return () => {
      window.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("resize", scheduleUpdate);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div className="home-summary-sticky-frame pointer-events-none sticky top-0 z-[25] w-full max-w-full min-w-0 md:pointer-events-auto md:static">
      <div ref={ref} className="home-summary-motion pointer-events-auto w-full max-w-full min-w-0">
        {children}
      </div>
    </div>
  );
}
