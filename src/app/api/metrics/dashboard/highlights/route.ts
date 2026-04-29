import { NextResponse } from "next/server";
import { fetchGa4Highlights } from "@/lib/ga4";
import { formatDateShort } from "@/lib/time";
import { resolveDashboardContext } from "@/lib/dashboard-context";

const EMPTY = {
  events: [],
  sources: [],
  landingPages: [],
  userAcquisition: [],
  sessionAcquisition: [],
  countries: []
};

export async function GET(request: Request) {
  const resolved = await resolveDashboardContext(request);
  if (!resolved.ok) return resolved.response;
  const { ctx } = resolved;

  try {
    const highlights = await fetchGa4Highlights({
      propertyId: ctx.ga4PropertyId,
      refreshToken: ctx.ga4Integration.refreshToken!,
      startDate: formatDateShort(ctx.startDate),
      endDate: formatDateShort(ctx.endDate)
    });
    return NextResponse.json(highlights);
  } catch {
    return NextResponse.json(EMPTY);
  }
}
