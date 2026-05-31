import type { WorkerEnv } from "./supabase-server";

const KEY_BYTES = 32;
const IV_BYTES = 12;

export async function encryptSecret(value: string, env: WorkerEnv): Promise<string> {
  const key = await importKey(env);
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const encoded = new TextEncoder().encode(value);
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoded));
  return `v1:${base64UrlEncode(iv)}:${base64UrlEncode(cipher)}`;
}

export async function decryptSecret(encrypted: string, env: WorkerEnv): Promise<string> {
  const [version, ivPart, cipherPart] = encrypted.split(":");
  if (version !== "v1" || !ivPart || !cipherPart) {
    throw new Error("Formato de secreto cifrado invalido.");
  }

  const key = await importKey(env);
  const iv = base64UrlDecode(ivPart);
  const cipher = base64UrlDecode(cipherPart);
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, cipher);
  return new TextDecoder().decode(plain);
}

async function importKey(env: WorkerEnv): Promise<CryptoKey> {
  const bytes = parseEncryptionKey(env.ENCRYPTION_KEY);
  return crypto.subtle.importKey("raw", bytes, "AES-GCM", false, ["encrypt", "decrypt"]);
}

function parseEncryptionKey(raw: string | undefined): Uint8Array {
  const value = raw?.trim();
  if (!value) throw new Error("ENCRYPTION_KEY no configurada.");

  if (/^[0-9a-f]{64}$/i.test(value)) {
    const bytes = new Uint8Array(KEY_BYTES);
    for (let i = 0; i < KEY_BYTES; i += 1) {
      bytes[i] = Number.parseInt(value.slice(i * 2, i * 2 + 2), 16);
    }
    return bytes;
  }

  const decoded = base64Decode(value);
  if (decoded.length === KEY_BYTES) return decoded;
  throw new Error("ENCRYPTION_KEY debe tener 32 bytes en hex o base64.");
}

function base64UrlEncode(bytes: Uint8Array): string {
  return base64Encode(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlDecode(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  return base64Decode(padded.padEnd(Math.ceil(padded.length / 4) * 4, "="));
}

function base64Encode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64Decode(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
