import type { RedisLike } from "@/quiz/budget/budget-guard";

/** In-memory stand-in for the Upstash client (tests only). `fail` makes every call reject. */
export function fakeRedis() {
  const store = new Map<string, number | string>();
  const calls: Array<{ op: "incrby" | "expire"; key: string; arg: number }> = [];
  const markers: Array<{ key: string; value: string; nx: boolean; ex: number }> = [];
  const state = { fail: false };
  const guardFail = () => {
    if (state.fail) throw new Error("redis down");
  };
  const redis: RedisLike = {
    async get(key) {
      guardFail();
      return store.get(key) ?? null;
    },
    async set(key, value, { nx = false, ex }) {
      guardFail();
      markers.push({ key, value, nx, ex });
      if (nx && store.has(key)) return null;
      store.set(key, value);
      return "OK";
    },
    async incrby(key, by) {
      guardFail();
      calls.push({ op: "incrby", key, arg: by });
      const next = Number(store.get(key) ?? 0) + by;
      store.set(key, next);
      return next;
    },
    async expire(key, seconds) {
      guardFail();
      calls.push({ op: "expire", key, arg: seconds });
      return 1;
    },
  };
  return { redis, store, calls, markers, state };
}
