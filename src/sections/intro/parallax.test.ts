import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { requestTiltAccess, requestTiltPermission } from "./parallax";

/** Installs an iOS-style DeviceOrientationEvent whose permission prompt behaves as given. */
function stubOrientation(requestPermission?: () => Promise<string>) {
  const ctor = Object.assign(function DeviceOrientationEvent() {}, requestPermission ? { requestPermission } : {});
  vi.stubGlobal("DeviceOrientationEvent", ctor);
}

describe("requestTiltPermission", () => {
  let consoleError: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    expect(consoleError).not.toHaveBeenCalled();
    consoleError.mockRestore();
    vi.unstubAllGlobals();
  });

  it("resolves false when the permission prompt rejects", async () => {
    stubOrientation(() => Promise.reject(new Error("NotAllowedError")));
    await expect(requestTiltPermission()).resolves.toBe(false);
  });

  it("resolves false when the user denies the prompt", async () => {
    stubOrientation(() => Promise.resolve("denied"));
    await expect(requestTiltPermission()).resolves.toBe(false);
  });

  it("resolves false when the browser has no DeviceOrientationEvent", async () => {
    vi.stubGlobal("DeviceOrientationEvent", undefined);
    await expect(requestTiltPermission()).resolves.toBe(false);
  });

  it("resolves true when the user grants the prompt", async () => {
    stubOrientation(() => Promise.resolve("granted"));
    await expect(requestTiltPermission()).resolves.toBe(true);
  });

  it("resolves true where orientation events need no prompt", async () => {
    stubOrientation();
    await expect(requestTiltPermission()).resolves.toBe(true);
  });
});

describe("requestTiltAccess", () => {
  let consoleError: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    expect(consoleError).not.toHaveBeenCalled();
    consoleError.mockRestore();
    vi.unstubAllGlobals();
  });

  it("reports a rejected prompt as failed, so a later gesture may ask again", async () => {
    stubOrientation(() => Promise.reject(new Error("NotAllowedError")));
    await expect(requestTiltAccess()).resolves.toBe("failed");
  });

  it("reports a refusal as denied (final)", async () => {
    stubOrientation(() => Promise.resolve("denied"));
    await expect(requestTiltAccess()).resolves.toBe("denied");
  });

  it("reports a missing sensor API as unsupported (final)", async () => {
    vi.stubGlobal("DeviceOrientationEvent", undefined);
    await expect(requestTiltAccess()).resolves.toBe("unsupported");
  });

  it("reports granted", async () => {
    stubOrientation(() => Promise.resolve("granted"));
    await expect(requestTiltAccess()).resolves.toBe("granted");
  });
});
