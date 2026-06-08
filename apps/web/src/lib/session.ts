import { cookies } from "next/headers";
import { isOwnerEmail } from "@/lib/owner";

export type SessionKind = "user" | "demo";

export interface SessionPayload {
  kind: SessionKind;
  userId?: string;
  name: string;
  email?: string;
  role: string;
  position?: string | null; // position id from the job catalog
  exp: number;
}

const COOKIE_NAME = "axos_session";
const ONE_DAY = 60 * 60 * 24;

function getSecret(): string {
  return (
    process.env.AXOS_SESSION_SECRET ||
    "axos-dev-secret-change-me-in-production"
  );
}

function toBase64Url(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(input: string): Uint8Array {
  const pad = input.length % 4 === 0 ? "" : "=".repeat(4 - (input.length % 4));
  const b64 = input.replace(/-/g, "+").replace(/_/g, "/") + pad;
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function utf8(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

async function importKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    utf8(getSecret()) as BufferSource,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

async function sign(payload: string): Promise<string> {
  const key = await importKey();
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    utf8(payload) as BufferSource,
  );
  return toBase64Url(new Uint8Array(sig));
}

async function verify(payload: string, signature: string): Promise<boolean> {
  const key = await importKey();
  return crypto.subtle.verify(
    "HMAC",
    key,
    fromBase64Url(signature) as BufferSource,
    utf8(payload) as BufferSource,
  );
}

export async function encodeSession(payload: SessionPayload): Promise<string> {
  const body = toBase64Url(utf8(JSON.stringify(payload)));
  const sig = await sign(body);
  return `${body}.${sig}`;
}

export async function decodeSession(
  token: string | undefined,
): Promise<SessionPayload | null> {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const ok = await verify(body, sig);
  if (!ok) return null;
  try {
    const json = new TextDecoder().decode(fromBase64Url(body));
    const parsed = JSON.parse(json) as SessionPayload;
    if (parsed.exp < Math.floor(Date.now() / 1000)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function setSessionCookie(
  payload: Omit<SessionPayload, "exp">,
  maxAgeSeconds: number = ONE_DAY,
): Promise<void> {
  // Normaliza el casing del rol a minúscula (valor canónico que espera el
  // frontend) y, si el email es del owner, fíjalo a 'admin' — derivado del
  // EMAIL, no del rol almacenado, para que nunca se bloquee al dueño.
  const role = isOwnerEmail(payload.email)
    ? "admin"
    : (payload.role || "").toLowerCase();
  const full: SessionPayload = {
    ...payload,
    role,
    exp: Math.floor(Date.now() / 1000) + maxAgeSeconds,
  };
  const token = await encodeSession(full);
  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: maxAgeSeconds,
    secure: process.env.NODE_ENV === "production",
  });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.set(COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  return decodeSession(store.get(COOKIE_NAME)?.value);
}

export const SESSION_COOKIE_NAME = COOKIE_NAME;
