/**
 * Safe UUID / unique-ID generator.
 *
 * `crypto.randomUUID()` is only available in secure contexts (HTTPS or
 * localhost).  When testing over a plain HTTP local-network URL
 * (e.g. http://192.168.x.x:3000) the API is absent on many mobile browsers,
 * causing a runtime crash.
 *
 * This helper tries the native API first and falls back to a
 * Date.now() + Math.random() string that is unique enough for our use-case
 * (file IDs, storage paths).  It works in every browser and in Node.js.
 */
export function createId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // Fallback: timestamp (ms) + 8 random base-36 chars ≈ 10^12 combinations
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
