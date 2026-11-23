import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { refreshOnLayoutChange } from "./refresh-on-layout";

let callback: ResizeObserverCallback | null = null;
const disconnect = vi.fn();

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(cb: ResizeObserverCallback) {
        callback = cb;
      }
      observe() {}
      disconnect = disconnect;
    },
  );
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  callback = null;
  disconnect.mockReset();
});

function target(height: { value: number }) {
  const el = document.createElement("main");
  el.getBoundingClientRect = () => ({ height: height.value }) as DOMRect;
  return el;
}

const fire = () => callback!([], {} as ResizeObserver);

describe("refreshOnLayoutChange", () => {
  it("refreshes once, after the height settles", () => {
    const h = { value: 1000 };
    const refresh = vi.fn();
    refreshOnLayoutChange(target(h), refresh);
    h.value = 1400;
    fire();
    h.value = 1600;
    fire();
    vi.advanceTimersByTime(149);
    expect(refresh).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("ignores observations without a height change (including the initial one)", () => {
    const refresh = vi.fn();
    refreshOnLayoutChange(target({ value: 1000 }), refresh);
    fire();
    window.dispatchEvent(new Event("scroll"));
    vi.runAllTimers();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("waits for scrolling to settle, so a refresh never cuts off a smooth scroll", () => {
    const h = { value: 1000 };
    const refresh = vi.fn();
    refreshOnLayoutChange(target(h), refresh);
    h.value = 1400;
    fire();
    vi.advanceTimersByTime(100);
    window.dispatchEvent(new Event("scroll"));
    vi.advanceTimersByTime(100);
    window.dispatchEvent(new Event("scroll"));
    vi.advanceTimersByTime(149);
    expect(refresh).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("disconnects, stops listening and cancels a pending refresh on cleanup", () => {
    const h = { value: 1000 };
    const refresh = vi.fn();
    const stop = refreshOnLayoutChange(target(h), refresh);
    h.value = 500;
    fire();
    stop();
    window.dispatchEvent(new Event("scroll"));
    vi.runAllTimers();
    expect(refresh).not.toHaveBeenCalled();
    expect(disconnect).toHaveBeenCalled();
  });
});
