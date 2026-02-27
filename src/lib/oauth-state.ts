import crypto from "crypto";

const STATE_SECRET = process.env.NEXTAUTH_SECRET ?? "state-secret";

export type OAuthState = {
  type: "GA4" | "ADS";
  nonce: string;
  issuedAt: number;
};

export function signState(data: OAuthState) {
  const payload = Buffer.from(JSON.stringify(data)).toString("base64url");
  const signature = crypto
    .createHmac("sha256", STATE_SECRET)
    .update(payload)
    .digest("base64url");
  return `${payload}.${signature}`;
}

export function verifyState(state: string): OAuthState | null {
  const [payload, signature] = state.split(".");
  if (!payload || !signature) return null;
  const expected = crypto
    .createHmac("sha256", STATE_SECRET)
    .update(payload)
    .digest("base64url");
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    return null;
  }
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return parsed as OAuthState;
  } catch {
    return null;
  }
}

export function randomNonce() {
  return crypto.randomBytes(12).toString("hex");
}
