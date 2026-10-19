// Credential encryption at rest. AES-256-GCM with the workspace and provider
// bound as additional authenticated data, the same scheme SocialBrewery uses
// (src/secure.js there): a ciphertext copied to another workspace's row fails
// to decrypt. Secrets never leave the server and are never logged.

import { InputError } from "./auth";

const enc = new TextEncoder();
const dec = new TextDecoder();

let cached: { raw: string; key: Promise<CryptoKey> } | null = null;

function masterKey(): Promise<CryptoKey> {
  let raw = process.env.PRODUCTROOT_MASTER_KEY?.trim() ?? "";
  if (!raw) {
    if (process.env.NODE_ENV === "production") throw new InputError("Connections are disabled: set the PRODUCTROOT_MASTER_KEY secret.", 503);
    raw = "productroot-local-development-key"; // dev only; production refuses above
  }
  if (cached?.raw !== raw) {
    // Any string works as input; SHA-256 stretches/normalises it to 32 bytes.
    const key = crypto.subtle.digest("SHA-256", enc.encode(raw)).then((d) => crypto.subtle.importKey("raw", d, "AES-GCM", false, ["encrypt", "decrypt"]));
    cached = { raw, key };
  }
  return cached.key;
}

const b64 = (b: Uint8Array) => btoa(String.fromCharCode(...b));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

export async function seal(plaintext: string, aad: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: enc.encode(aad) }, await masterKey(), enc.encode(plaintext)));
  const out = new Uint8Array(iv.length + ct.length);
  out.set(iv);
  out.set(ct, iv.length);
  return `v1.${b64(out)}`;
}

export async function open(sealed: string, aad: string): Promise<string> {
  if (!sealed.startsWith("v1.")) throw new Error("Unknown secret format.");
  const raw = unb64(sealed.slice(3));
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: raw.slice(0, 12), additionalData: enc.encode(aad) }, await masterKey(), raw.slice(12));
  return dec.decode(pt);
}
