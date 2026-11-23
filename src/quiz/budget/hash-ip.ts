import { createHash } from "node:crypto";

/** sha256(salt + ip) as hex, so raw IPs are never stored. */
export function hashIp(ip: string, salt: string): string {
  return createHash("sha256").update(salt + ip).digest("hex");
}
