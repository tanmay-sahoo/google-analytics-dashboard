import { NextResponse } from "next/server";
import { fetchGa4Realtime } from "@/lib/ga4";
import { resolveDashboardContext } from "@/lib/dashboard-context";

export async function GET(request: Request) {
  const resolved = await resolveDashboardContext(request);
  if (!resolved.ok) return resolved.response;
  const { ctx } = resolved;

  try {
    const realtime = await fetchGa4Realtime({
      propertyId: ctx.ga4PropertyId,
      refreshToken: ctx.ga4Integration.refreshToken!
    });
    return NextResponse.json(realtime);
  } catch {
    return NextResponse.json({ activeUsers: 0, countries: [] });
  }
}
