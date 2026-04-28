import crypto from "crypto";

const STATE_TTL_MS = 10 * 60 * 1000;

function getStateSecret() {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("NEXTAUTH_SECRET must be set (min 16 chars) for OAuth state signing");
  }
  return secret;
}

export type OAuthState = {
  type: "GA4" | "ADS" | "MERCHANT";
  nonce: string;
  issuedAt: number;
};

export function signState(data: OAuthState) {
  const payload = Buffer.from(JSON.stringify(data)).toString("base64url");
  const signature = crypto
    .createHmac("sha256", getStateSecret())
    .update(payload)
    .digest("base64url");
  return `${payload}.${signature}`;
}

export function verifyState(state: string): OAuthState | null {
  const [payload, signature] = state.split(".");
  if (!payload || !signature) return null;
  const expected = crypto
    .createHmac("sha256", getStateSecret())
    .update(payload)
    .digest("base64url");
  const sigBuf = Buffer.from(signature);
  const expectedBuf = Buffer.from(expected);
  if (sigBuf.length !== expectedBuf.length) {
    return null;
  }
  if (!crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as OAuthState;
    if (
      !parsed ||
      typeof parsed !== "object" ||
      typeof parsed.nonce !== "string" ||
      typeof parsed.issuedAt !== "number" ||
      (parsed.type !== "GA4" && parsed.type !== "ADS" && parsed.type !== "MERCHANT")
    ) {
      return null;
    }
    if (!Number.isFinite(parsed.issuedAt)) return null;
    const age = Date.now() - parsed.issuedAt;
    if (age < 0 || age > STATE_TTL_MS) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function randomNonce() {
  return crypto.randomBytes(12).toString("hex");
}
