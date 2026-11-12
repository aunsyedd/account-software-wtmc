import { cookies } from "next/headers";
import { getSupabase } from "./supabase";
import { createSessionToken, SESSION_COOKIE, SESSION_MAX_AGE, verifySessionToken } from "./session";

export async function getSessionEmail() {
  const jar = await cookies();
  return verifySessionToken(jar.get(SESSION_COOKIE)?.value);
}

export async function requireSession() {
  return getSessionEmail();
}

function friendlyAuthError(message: string) {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) return "Incorrect email or password.";
  if (m.includes("email not confirmed")) return "Please confirm your email address first, then sign in.";
  if (m.includes("already registered") || m.includes("already been registered"))
    return "An account with this email already exists. Please sign in instead.";
  if (m.includes("password should be at least")) return "Password must be at least 6 characters.";
  if (m.includes("rate limit")) return "Too many attempts. Please wait a minute and try again.";
  return message;
}

export async function signIn(email: string, password: string) {
  if (!email || !password) return { error: "Please enter your email and password." };
  const supabase = getSupabase();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: friendlyAuthError(error.message) };
  const jar = await cookies();
  jar.set(SESSION_COOKIE, await createSessionToken(data.user?.email || email), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  return { error: null };
}

export async function signUp(email: string, password: string) {
  if (!email || !password) return { error: "Please enter your email and password." };
  const supabase = getSupabase();
  const { error } = await supabase.auth.signUp({ email, password });
  if (error) return { error: friendlyAuthError(error.message) };
  return signIn(email, password);
}

export async function signOut() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}
