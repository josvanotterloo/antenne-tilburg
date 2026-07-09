import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
} from "crypto";

// Encryption-at-rest for newsletter subscriber emails (AES-256-GCM) plus a
// keyed HMAC-SHA-256 hash for duplicate detection at signup. The key comes from
// EMAIL_ENCRYPTION_KEY (64 hex chars = 32 bytes) and is read lazily per call so
// builds and unrelated tests don't require it. Losing the key makes stored
// addresses unrecoverable — that is the point; guard the key like a password.
//
// Stored format: `v1:<iv b64>:<ciphertext b64>:<auth tag b64>`. The version
// prefix supports future key/algorithm rotation; values without it are treated
// as legacy plaintext (pre-migration rows) and returned as-is by decryptEmail.

const VERSION = "v1";
const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12; // GCM-recommended nonce size

function key(): Buffer {
  const hex = process.env.EMAIL_ENCRYPTION_KEY ?? "";
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw new Error(
      "EMAIL_ENCRYPTION_KEY must be set to 64 hex characters (32 bytes). " +
        "Generate one with: openssl rand -hex 32",
    );
  }
  return Buffer.from(hex, "hex");
}

export function encryptEmail(plain: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(plain, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return [
    VERSION,
    iv.toString("base64"),
    ciphertext.toString("base64"),
    tag.toString("base64"),
  ].join(":");
}

export function decryptEmail(stored: string): string {
  // Legacy plaintext row (not yet migrated): pass through unchanged.
  if (!stored.startsWith(`${VERSION}:`)) return stored;

  const [, ivB64, ciphertextB64, tagB64] = stored.split(":");
  const decipher = createDecipheriv(
    ALGORITHM,
    key(),
    Buffer.from(ivB64, "base64"),
  );
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextB64, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

// Deterministic keyed hash (HMAC-SHA-256) of the normalized address. Unique
// per email under the same key, so it backs the duplicate-detection unique
// constraint without storing anything reversible-by-wordlist.
export function emailHash(plain: string): string {
  return createHmac("sha256", key())
    .update(plain.trim().toLowerCase())
    .digest("hex");
}
