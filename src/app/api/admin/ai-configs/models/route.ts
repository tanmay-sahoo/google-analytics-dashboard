import { NextResponse } from "next/server";
import { getSessionUser, isAdmin } from "@/lib/auth-helpers";

const endpoints: Record<string, { url: string; header: string }> = {
  openai: { url: "https://api.openai.com/v1/models", header: "Authorization" },
  openrouter: { url: "https://openrouter.ai/api/v1/models", header: "Authorization" },
  groq: { url: "https://api.groq.com/openai/v1/models", header: "Authorization" }
};

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user || !isAdmin(user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await request.json().catch(() => ({}));
  const provider = typeof body.provider === "string" ? body.provider : "";
  const apiKey = typeof body.apiKey === "string" ? body.apiKey : "";
  if (!provider || !apiKey) {
    return NextResponse.json({ error: "Provider and apiKey are required." }, { status: 400 });
  }

  if (provider === "gemini") {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
      { cache: "no-store" }
    );
    if (!response.ok) {
      return NextResponse.json({ error: "Failed to load Gemini models." }, { status: 500 });
    }
    const data = await response.json().catch(() => ({}));
    const models = Array.isArray(data.models)
      ? data.models.map((item: { name?: string }) => item.name).filter(Boolean)
      : [];
    return NextResponse.json({ models });
  }

  const config = endpoints[provider];
  if (!config) {
    return NextResponse.json({ error: "Unsupported provider." }, { status: 400 });
  }

  const response = await fetch(config.url, {
    headers: { [config.header]: `Bearer ${apiKey}` },
    cache: "no-store"
  });
  if (!response.ok) {
    return NextResponse.json({ error: "Failed to load models." }, { status: 500 });
  }
  const data = await response.json().catch(() => ({}));
  const models = Array.isArray(data.data)
    ? data.data.map((item: { id?: string }) => item.id).filter(Boolean)
    : [];
  return NextResponse.json({ models });
}
