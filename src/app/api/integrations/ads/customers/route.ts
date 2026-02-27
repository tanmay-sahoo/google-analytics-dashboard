import { NextResponse } from "next/server";
import { getSessionUser, isAdmin } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { getOAuthClient } from "@/lib/google-oauth";

function cleanCustomerId(id: string) {
  return id.replace(/-/g, "");
}

export async function GET() {
  const user = await getSessionUser();
  if (!user || !isAdmin(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const integration = await prisma.integrationSetting.findUnique({
    where: { type: "ADS" }
  });

  if (!integration?.refreshToken) {
    return NextResponse.json({ error: "Ads not connected" }, { status: 400 });
  }

  const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN ?? "";
  const loginCustomerId = process.env.GOOGLE_ADS_MANAGER_CUSTOMER_ID ?? undefined;

  if (!developerToken) {
    return NextResponse.json({ error: "Missing GOOGLE_ADS_DEVELOPER_TOKEN" }, { status: 400 });
  }

  const oauthClient = getOAuthClient();
  oauthClient.setCredentials({ refresh_token: integration.refreshToken });
  const accessToken = (await oauthClient.getAccessToken()).token;
  if (!accessToken) {
    return NextResponse.json({ error: "Failed to get access token" }, { status: 500 });
  }

  const baseHeaders: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    "developer-token": developerToken,
    "content-type": "application/json"
  };
  if (loginCustomerId) {
    baseHeaders["login-customer-id"] = cleanCustomerId(loginCustomerId);
  }

  const listResponse = await fetch(
    "https://googleads.googleapis.com/v14/customers:listAccessibleCustomers",
    {
      method: "POST",
      headers: baseHeaders,
      body: JSON.stringify({})
    }
  );

  if (!listResponse.ok) {
    const raw = await listResponse.text();
    let message = raw;
    try {
      const parsed = JSON.parse(raw) as { error?: { message?: string } };
      if (parsed?.error?.message) message = parsed.error.message;
    } catch {
      // Keep raw text.
    }
    return NextResponse.json(
      { error: message, status: listResponse.status, statusText: listResponse.statusText },
      { status: listResponse.status }
    );
  }

  const listData = (await listResponse.json()) as { resourceNames?: string[] };
  const resourceNames = listData.resourceNames ?? [];

  const customers = await Promise.all(
    resourceNames.map(async (resource) => {
      const id = resource.split("/").pop() ?? resource;
      const customerId = cleanCustomerId(id);
      let name = customerId;

      try {
        const queryResponse = await fetch(
          `https://googleads.googleapis.com/v14/customers/${customerId}/googleAds:searchStream`,
          {
            method: "POST",
            headers: {
              ...baseHeaders
            },
            body: JSON.stringify({
              query: "SELECT customer.id, customer.descriptive_name FROM customer LIMIT 1"
            })
          }
        );

        if (queryResponse.ok) {
          const chunks = (await queryResponse.json()) as Array<{
            results?: Array<{ customer?: { descriptive_name?: string } }>;
          }>;
          const first = chunks?.[0]?.results?.[0]?.customer?.descriptive_name;
          if (first) name = first;
        }
      } catch {
        // Keep fallback name.
      }

      return { id: customerId, resourceName: resource, name };
    })
  );

  return NextResponse.json({ customers });
}
