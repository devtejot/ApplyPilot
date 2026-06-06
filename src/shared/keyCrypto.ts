// Optional API-key encryption at rest (DESIGN.md §12 — Phase 5). PBKDF2-derived
// AES-GCM. The passphrase is never stored — only salt + iv + ciphertext are. A
// wrong passphrase fails the GCM auth tag on decrypt, so there's no oracle.

export interface EncryptedKey {
  ciphertext: string; // base64
  iv: string; // base64
  salt: string; // base64
}

const PBKDF2_ITERATIONS = 200_000;

function toB64(buf: ArrayBufferLike): string {
  let bin = '';
  for (const b of new Uint8Array(buf)) bin += String.fromCharCode(b);
  return btoa(bin);
}

function fromB64(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// TS's DOM lib narrows BufferSource to ArrayBuffer-backed views; our base64 and
// random byte arrays are plain Uint8Arrays, so coerce at the WebCrypto boundary.
const buf = (u: Uint8Array): BufferSource => u as unknown as BufferSource;

async function deriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey(
    'raw',
    buf(new TextEncoder().encode(passphrase)),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: buf(salt), iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function encryptKey(plaintext: string, passphrase: string): Promise<EncryptedKey> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passphrase, salt);
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: buf(iv) }, key, buf(new TextEncoder().encode(plaintext)));
  return { ciphertext: toB64(ct), iv: toB64(iv.buffer), salt: toB64(salt.buffer) };
}

/** Decrypt the key; throws if the passphrase is wrong (GCM auth failure). */
export async function decryptKey(enc: EncryptedKey, passphrase: string): Promise<string> {
  const key = await deriveKey(passphrase, fromB64(enc.salt));
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: buf(fromB64(enc.iv)) }, key, buf(fromB64(enc.ciphertext)));
  return new TextDecoder().decode(pt);
}
