import crypto from "node:crypto";

// used for refresh tokens etc. — we store hashes not raw tokens
export function sha256(value: string): string {
  const hash = crypto.createHash("sha256");
  hash.update(value);
  return hash.digest("hex");
}
