// @vitest-environment jsdom

import React from "react";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { HomeSummaryMotion } from "@/components/household/home-summary-motion";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  Reflect.deleteProperty(document.documentElement, "scrollHeight");
});

describe("HomeSummaryMotion", () => {
  it("follows fast scrolling in one frame and expands with the reverse scroll", () => {
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal("innerWidth", 320);
    vi.stubGlobal("innerHeight", 640);
    vi.stubGlobal("scrollY", 0);
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      frames.push(callback);
      return frames.length;
    });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    Object.defineProperty(document.documentElement, "scrollHeight", {
      configurable: true,
      value: 1000,
    });

    const { container } = render(
      React.createElement(HomeSummaryMotion, null, React.createElement("span", null, "Home")),
    );
    const summary = container.querySelector<HTMLElement>(".home-summary-motion")!;
    expect(summary.style.getPropertyValue("--home-detail-opacity")).toBe("1");

    vi.stubGlobal("scrollY", 48);
    fireEvent.scroll(window);
    expect(frames).toHaveLength(1);
    frames.shift()!(0);
    expect(Number(summary.style.getPropertyValue("--home-detail-opacity"))).toBeCloseTo(0.5);

    vi.stubGlobal("scrollY", 96);
    fireEvent.scroll(window);
    frames.shift()!(16);
    expect(summary.dataset.collapsed).toBe("true");
    expect(summary.style.getPropertyValue("--home-detail-opacity")).toBe("0");
    expect(frames).toHaveLength(0);

    vi.stubGlobal("scrollY", 0);
    fireEvent.scroll(window);
    frames.shift()!(32);
    expect(summary.dataset.collapsed).toBe("false");
    expect(summary.style.getPropertyValue("--home-detail-opacity")).toBe("1");

    vi.stubGlobal("innerWidth", 1024);
    vi.stubGlobal("scrollY", 96);
    fireEvent.resize(window);
    frames.shift()!(48);
    expect(summary.style.getPropertyValue("--home-detail-opacity")).toBe("1");
  });
});
