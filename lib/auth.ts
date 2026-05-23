import crypto from "crypto";
import { cookies } from "next/headers";

const COOKIE_NAME = "wedding_admin_session";
const SESSION_DURATION_MS = 8 * 60 * 60 * 1000; // 8 hours

// Create a stateless signed session token
// Format: timestamp.HMAC(timestamp, ADMIN_PASSWORD)
export function createSessionToken(): string {
  const timestamp = Date.now().toString();
  const secret = process.env.ADMIN_PASSWORD ?? "";
  const signature = crypto
    .createHmac("sha256", secret)
    .update(timestamp)
    .digest("hex");
  return `${timestamp}.${signature}`;
}

// Verify the session token
export function verifySessionToken(token: string): boolean {
  const parts = token.split(".");
  if (parts.length !== 2) return false;

  const [timestamp, signature] = parts;
  const ts = parseInt(timestamp, 10);
  if (isNaN(ts)) return false;

  // Check expiry
  if (Date.now() - ts > SESSION_DURATION_MS) return false;

  // Verify signature
  const secret = process.env.ADMIN_PASSWORD ?? "";
  const expected = crypto
    .createHmac("sha256", secret)
    .update(timestamp)
    .digest("hex");

  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature, "hex"),
      Buffer.from(expected, "hex")
    );
  } catch {
    return false;
  }
}

// Check if the current request has a valid admin session cookie
export async function isAdminAuthenticated(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return false;
  return verifySessionToken(token);
}

// Set the admin session cookie
export async function setAdminCookie(): Promise<void> {
  const token = createSessionToken();
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_DURATION_MS / 1000,
    path: "/",
  });
}

// Clear the admin session cookie
export async function clearAdminCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}
