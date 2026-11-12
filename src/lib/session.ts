/**
 * Signed session cookie helpers. Runs in both the Node runtime (server actions)
 * and the Edge runtime (middleware), so it only uses Web Crypto.
 *
 * Cookie format: base64url(email).expiresAtSeconds.base64url(hmacSha256)
 * A plain email in the cookie is no longer accepted, so nobody can sign in by
 * hand-writing a cookie.
 */

export const SESSION_COOKIE = "nexora_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

const enc = new TextEncoder();

function secret() {
  const s = process.env.SESSION_SECRET || process.env.SUPABASE_SECRET_KEY;
  if (!s) throw new Error("Missing SESSION_SECRET (or SUPABASE_SECRET_KEY) for session signing");
  return s;
}

function b64url(bytes: Uint8Array) {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64url(s: string) {
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

async function sign(data: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  return b64url(new Uint8Array(sig));
}

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function createSessionToken(email: string) {
  const exp = Math.floor(Date.now() / 1000) + SESSION_MAX_AGE;
  const body = `${b64url(enc.encode(email))}.${exp}`;
  return `${body}.${await sign(body)}`;
}

/** Returns the signed-in email, or null when the token is missing, tampered with or expired. */
export async function verifySessionToken(token: string | undefined | null) {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [emailPart, expPart, sig] = parts;
  try {
    const expected = await sign(`${emailPart}.${expPart}`);
    if (!safeEqual(sig, expected)) return null;
    const exp = Number(expPart);
    if (!Number.isFinite(exp) || exp * 1000 < Date.now()) return null;
    return new TextDecoder().decode(fromB64url(emailPart));
  } catch {
    return null;
  }
}
