import crypto from "crypto";

const PREFIX = "enc";

function getKey() {
  const raw = process.env.DATA_ENCRYPTION_KEY ?? "";
  if (!raw) {
    throw new Error("DATA_ENCRYPTION_KEY is not set");
  }
  let key: Buffer;
  if (/^[a-fA-F0-9]{64}$/.test(raw)) {
    key = Buffer.from(raw, "hex");
  } else {
    key = Buffer.from(raw, "base64");
  }
  if (key.length !== 32) {
    throw new Error("DATA_ENCRYPTION_KEY must be 32 bytes (base64 or hex)");
  }
  return key;
}

export function encryptSecret(value: string) {
  if (!value) return value;
  if (value.startsWith(`${PREFIX}:`)) return value;
  const key = getKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}:${iv.toString("base64")}:${tag.toString("base64")}:${encrypted.toString("base64")}`;
}

export function decryptSecret(value: string) {
  if (!value) return value;
  if (!value.startsWith(`${PREFIX}:`)) return value;
  const parts = value.split(":");
  if (parts.length !== 4) {
    throw new Error("Invalid encrypted payload");
  }
  const [, ivB64, tagB64, dataB64] = parts;
  const key = getKey();
  const iv = Buffer.from(ivB64, "base64");
  const tag = Buffer.from(tagB64, "base64");
  const data = Buffer.from(dataB64, "base64");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
  return decrypted.toString("utf8");
}
