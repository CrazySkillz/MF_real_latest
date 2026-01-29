import { createHash, createHmac, randomBytes, timingSafeEqual, createCipheriv, createDecipheriv } from "crypto";

type EncryptedBlobV1 = {
  v: 1;
  iv: string; // base64url
  tag: string; // base64url
  data: string; // base64url
};

export type EncryptedTokens = {
  v: 1;
  accessToken?: EncryptedBlobV1 | null;
  refreshToken?: EncryptedBlobV1 | null;
  clientSecret?: EncryptedBlobV1 | null;
};

const base64Url = {
  enc: (buf: Buffer) => buf.toString("base64url"),
  dec: (s: string) => Buffer.from(String(s || ""), "base64url"),
};

function deriveKeyFromSecret(secret: string): Buffer {
  return createHash("sha256").update(secret, "utf8").digest(); // 32 bytes
}

function getKey(): Buffer {
  // Preferred: explicit 32-byte key, base64 or hex. Fallback: derive from SESSION_SECRET/APP_SECRET.
  const raw =
    process.env.TOKEN_ENCRYPTION_KEY ||
    process.env.ENCRYPTION_KEY ||
    process.env.SESSION_SECRET ||
    process.env.APP_SECRET ||
    "dev-token-encryption-key-change-me";

  const trimmed = String(raw).trim();

  // Try base64url/base64
  try {
    const b = Buffer.from(trimmed, "base64");
    if (b.length === 32) return b;
  } catch {
    // ignore
  }

  // Try hex
  try {
    const b = Buffer.from(trimmed, "hex");
    if (b.length === 32) return b;
  } catch {
    // ignore
  }

  return deriveKeyFromSecret(trimmed);
}

export function encryptString(plain: string): EncryptedBlobV1 {
  const key = getKey();
  const iv = randomBytes(12); // recommended for GCM
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(String(plain || ""), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return { v: 1, iv: base64Url.enc(iv), tag: base64Url.enc(tag), data: base64Url.enc(ciphertext) };
}

export function decryptString(blob: EncryptedBlobV1): string {
  const key = getKey();
  const iv = base64Url.dec(blob.iv);
  const tag = base64Url.dec(blob.tag);
  const data = base64Url.dec(blob.data);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const plain = Buffer.concat([decipher.update(data), decipher.final()]);
  return plain.toString("utf8");
}

export function buildEncryptedTokens(input: {
  accessToken?: string | null | undefined;
  refreshToken?: string | null | undefined;
  clientSecret?: string | null | undefined;
  prev?: EncryptedTokens | null | undefined;
}): EncryptedTokens {
  const prev = (input.prev && (input.prev as any).v === 1 ? (input.prev as EncryptedTokens) : undefined) || undefined;
  const out: EncryptedTokens = { v: 1 };

  const pick = (key: keyof Omit<EncryptedTokens, "v">, plain?: string | null | undefined) => {
    if (plain === undefined) {
      // not provided -> preserve previous if present
      (out as any)[key] = prev ? (prev as any)[key] ?? null : null;
      return;
    }
    if (plain === null || String(plain) === "") {
      (out as any)[key] = null;
      return;
    }
    (out as any)[key] = encryptString(String(plain));
  };

  pick("accessToken", input.accessToken);
  pick("refreshToken", input.refreshToken);
  pick("clientSecret", input.clientSecret);
  return out;
}

export function decryptTokens(tokens: unknown): { accessToken?: string | null; refreshToken?: string | null; clientSecret?: string | null } {
  const t = tokens as any;
  if (!t || t.v !== 1) return {};
  const read = (blob: any): string | null => {
    if (!blob) return null;
    if (blob.v !== 1) return null;
    try {
      return decryptString(blob as EncryptedBlobV1);
    } catch {
      return null;
    }
  };
  return {
    accessToken: read(t.accessToken),
    refreshToken: read(t.refreshToken),
    clientSecret: read(t.clientSecret),
  };
}

// Optional: a short signature helper you can use later for key rotation validation/debug (not required for encryption).
export function signText(text: string): string {
  const secret = String(process.env.TOKEN_ENCRYPTION_SIGNING_SECRET || process.env.SESSION_SECRET || "dev-signing-secret");
  const sig = createHmac("sha256", secret).update(String(text || "")).digest();
  return base64Url.enc(sig);
}

export function verifyTextSignature(text: string, signature: string): boolean {
  const secret = String(process.env.TOKEN_ENCRYPTION_SIGNING_SECRET || process.env.SESSION_SECRET || "dev-signing-secret");
  const expected = createHmac("sha256", secret).update(String(text || "")).digest();
  const provided = base64Url.dec(signature);
  return provided.length === expected.length && timingSafeEqual(provided, expected);
}

