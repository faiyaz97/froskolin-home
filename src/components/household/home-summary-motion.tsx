"use client";

import { useEffect, useRef, type ReactNode } from "react";

const MOBILE_BREAKPOINT = 768;
const MAX_COLLAPSE_DISTANCE = 96;
const MOTION_FOLLOW_RATE = 0.1;

export function HomeSummaryMotion({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const style = element.style;
    const dataset = element.dataset;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    function getTargetProgress() {
      if (window.innerWidth >= MOBILE_BREAKPOINT) return 0;

      const availableScroll = document.documentElement.scrollHeight - window.innerHeight;
      const collapseDistance = Math.min(MAX_COLLAPSE_DISTANCE, Math.max(1, availableScroll));
      return Math.min(1, Math.max(0, window.scrollY / collapseDistance));
    }

    let displayedProgress = getTargetProgress();

    function paint(progress: number) {
      // Reduced-motion users still get a scroll-linked layout change, but without
      // the delayed follow animation. Never turn a 1px scroll into a full collapse.
      const eased = progress * progress * (3 - 2 * progress);
      const expanded = 1 - eased;
      style.setProperty("--home-head-height", `${126 - 66 * eased}px`);
      style.setProperty("--home-title-size", `${28 - 11 * eased}px`);
      style.setProperty("--home-mascot-width", `${84 - 34 * eased}px`);
      style.setProperty("--home-balance-height", `${68 - 26 * eased}px`);
      style.setProperty("--home-detail-opacity", `${expanded}`);
      style.setProperty("--home-detail-width", `${76 * expanded}px`);
      style.setProperty("--home-member-height", `${20 * expanded}px`);
      style.setProperty("--home-summary-gap", `${8 - 4 * eased}px`);
      style.setProperty("--home-header-pad", `${14 - 7 * eased}px`);
      style.setProperty("--home-balances-pad", `${8 - 6 * eased}px`);
      style.setProperty("--home-card-radius", `${15 * expanded}px`);
      style.setProperty("--home-divider-opacity", `${eased}`);
      style.setProperty("--home-divider-height", `${28 * eased}px`);
      style.setProperty("--home-surface-radius", `${14 * eased}px`);
      style.setProperty("--home-group-bg", `rgb(227 245 239 / ${expanded})`);
      style.setProperty("--home-group-border", `rgb(188 229 216 / ${expanded})`);
      style.setProperty("--home-landlord-bg", `rgb(255 240 231 / ${expanded})`);
      style.setProperty("--home-landlord-border", `rgb(247 212 192 / ${expanded})`);
      dataset.collapsed = progress >= 0.98 ? "true" : "false";
    }

    function update() {
      const isMobile = window.innerWidth < MOBILE_BREAKPOINT;
      const targetProgress = getTargetProgress();

      if (!isMobile || reducedMotion.matches) {
        displayedProgress = targetProgress;
      } else {
        displayedProgress += (targetProgress - displayedProgress) * MOTION_FOLLOW_RATE;
      }

      if (Math.abs(targetProgress - displayedProgress) < 0.001) {
        displayedProgress = targetProgress;
      }

      paint(displayedProgress);

      if (displayedProgress !== targetProgress) {
        frame = window.requestAnimationFrame(update);
      } else {
        frame = 0;
      }
    }

    function scheduleUpdate() {
      if (!frame) frame = window.requestAnimationFrame(update);
    }

    paint(displayedProgress);
    window.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("resize", scheduleUpdate);
    reducedMotion.addEventListener("change", scheduleUpdate);
    return () => {
      window.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("resize", scheduleUpdate);
      reducedMotion.removeEventListener("change", scheduleUpdate);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div className="home-summary-sticky-frame pointer-events-none sticky top-0 z-[25] md:pointer-events-auto md:static">
      <div ref={ref} className="home-summary-motion pointer-events-auto">
        {children}
      </div>
    </div>
  );
}
