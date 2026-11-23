import { afterEach, describe, expect, it, vi } from "vitest";
import { getRedis } from "./redis";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("getRedis", () => {
  it("is null when either variable is missing", () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://example.upstash.io");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
    expect(getRedis()).toBeNull();
  });

  it("builds a client from valid config", () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://example.upstash.io");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "token");
    expect(getRedis()).not.toBeNull();
  });

  // A quoted value pasted into a host's env settings must not take the page down.
  it("is null, with a warning, when the URL is invalid", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubEnv("UPSTASH_REDIS_REST_URL", '"https://example.upstash.io"');
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "token");
    expect(getRedis()).toBeNull();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("UPSTASH_REDIS_REST_URL"));
  });
});
