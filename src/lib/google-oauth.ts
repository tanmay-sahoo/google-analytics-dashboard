import { OAuth2Client } from "google-auth-library";
import { randomNonce, signState } from "@/lib/oauth-state";

const GA4_SCOPE = "https://www.googleapis.com/auth/analytics.readonly";
const ADS_SCOPE = "https://www.googleapis.com/auth/adwords";

export function getOAuthClient() {
  const clientId = process.env.GOOGLE_CLIENT_ID ?? "";
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET ?? "";
  const redirectUri = process.env.GOOGLE_REDIRECT_URI ?? "";
  return new OAuth2Client({ clientId, clientSecret, redirectUri });
}

export function getScopes(type: "GA4" | "ADS") {
  return type === "GA4" ? [GA4_SCOPE] : [ADS_SCOPE];
}

export function buildAuthUrl(type: "GA4" | "ADS") {
  const client = getOAuthClient();
  const state = signState({
    type,
    nonce: randomNonce(),
    issuedAt: Date.now()
  });

  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: getScopes(type),
    state
  });
}

export async function exchangeCode(code: string) {
  const client = getOAuthClient();
  const { tokens } = await client.getToken(code);
  return tokens;
}

export async function getUserEmail(tokens: { access_token?: string }) {
  const client = getOAuthClient();
  client.setCredentials({ access_token: tokens.access_token ?? "" });
  const url = "https://www.googleapis.com/oauth2/v2/userinfo";
  try {
    const response = await client.request<{ email?: string }>({ url });
    return response.data.email ?? null;
  } catch {
    return null;
  }
}
