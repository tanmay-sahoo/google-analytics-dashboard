import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth-helpers";

function buildPrompt(title: string) {
  return [
    "You are a product optimization assistant for Google Shopping.",
    "Rewrite the product title to improve clarity and search relevance.",
    "Provide 5 keyword suggestions.",
    "Return exactly two lines:",
    "Title: <improved title>",
    "Keywords: <comma-separated keywords>",
    `Product title: ${title}`
  ].join("\n");
}

async function callOpenAiLike({
  url,
  key,
  model,
  prompt
}: {
  url: string;
  key: string;
  model: string;
  prompt: string;
}) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.4
    })
  });
  if (!response.ok) {
    throw new Error("AI request failed.");
  }
  const data = await response.json().catch(() => ({}));
  const content = data?.choices?.[0]?.message?.content;
  return typeof content === "string" ? content.trim() : "";
}

async function callGemini({
  key,
  model,
  prompt
}: {
  key: string;
  model: string;
  prompt: string;
}) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      })
    }
  );
  if (!response.ok) {
    throw new Error("Gemini request failed.");
  }
  const data = await response.json().catch(() => ({}));
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  return typeof text === "string" ? text.trim() : "";
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await request.json().catch(() => ({}));
  const title = typeof body.title === "string" ? body.title : "";
  if (!title) {
    return NextResponse.json({ error: "Title is required." }, { status: 400 });
  }

  const config = await prisma.aiConfig.findFirst({ where: { isDefault: true } });
  if (!config) {
    return NextResponse.json({ error: "AI is not configured yet." }, { status: 400 });
  }

  const prompt = buildPrompt(title);

  try {
    if (config.provider === "gemini") {
      const suggestion = await callGemini({ key: config.apiKey, model: config.model, prompt });
      return NextResponse.json({ suggestion });
    }

    if (config.provider === "openai") {
      const suggestion = await callOpenAiLike({
        url: "https://api.openai.com/v1/chat/completions",
        key: config.apiKey,
        model: config.model,
        prompt
      });
      return NextResponse.json({ suggestion });
    }

    if (config.provider === "openrouter") {
      const suggestion = await callOpenAiLike({
        url: "https://openrouter.ai/api/v1/chat/completions",
        key: config.apiKey,
        model: config.model,
        prompt
      });
      return NextResponse.json({ suggestion });
    }

    if (config.provider === "groq") {
      const suggestion = await callOpenAiLike({
        url: "https://api.groq.com/openai/v1/chat/completions",
        key: config.apiKey,
        model: config.model,
        prompt
      });
      return NextResponse.json({ suggestion });
    }
  } catch {
    return NextResponse.json({ error: "AI suggestion failed." }, { status: 500 });
  }

  return NextResponse.json({ error: "Unsupported provider." }, { status: 400 });
}
