import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ error: "Deprecated. Use /api/admin/ai-configs instead." }, { status: 410 });
}

export async function PUT() {
  return NextResponse.json({ error: "Deprecated. Use /api/admin/ai-configs instead." }, { status: 410 });
}
