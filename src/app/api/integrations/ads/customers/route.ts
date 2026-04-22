import { NextResponse } from "next/server";
import { getSessionUser, isAdmin } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { getOAuthClient } from "@/lib/google-oauth";
import { createLimiter, withRetry } from "@/lib/request-limiter";

function cleanCustomerId(id: string) {
  return id.replace(/-/g, "");
}

const adsLimiter = createLimiter(1);

async function runAdsStreamQuery({
  apiVersion,
  customerId,
  headers,
  query
}: {
  apiVersion: string;
  customerId: string;
  headers: Record<string, string>;
  query: string;
}) {
  const response = await withRetry(
    () =>
      fetch(`https://googleads.googleapis.com/${apiVersion}/customers/${customerId}/googleAds:searchStream`, {
        method: "POST",
        headers,
        body: JSON.stringify({ query })
      }),
    { label: "ads-query" }
  );

  if (!response.ok) {
    const raw = await response.text();
    return { ok: false as const, raw };
  }

  const chunks = (await response.json()) as Array<{ results?: Array<Record<string, unknown>> }>;
  return { ok: true as const, chunks };
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
  const apiVersion = process.env.GOOGLE_ADS_API_VERSION ?? "v19";

  if (!developerToken) {
    return NextResponse.json({ error: "Missing GOOGLE_ADS_DEVELOPER_TOKEN" }, { status: 400 });
  }

  const oauthClient = getOAuthClient();
  oauthClient.setCredentials({ refresh_token: integration.refreshToken });
  const accessToken = (await oauthClient.getAccessToken()).token;
  if (!accessToken) {
    console.error("[ads-customers] Failed to get access token (no token returned).");
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
    `https://googleads.googleapis.com/${apiVersion}/customers:listAccessibleCustomers`,
    {
      method: "GET",
      headers: baseHeaders
    }
  );

  if (!listResponse.ok) {
    const raw = await listResponse.text();
    console.error("[ads-customers] listAccessibleCustomers failed", {
      status: listResponse.status,
      statusText: listResponse.statusText,
      body: raw
    });
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
  const connectedEmail = integration.connectedEmail ?? undefined;
  const safeEmail = connectedEmail ? connectedEmail.replace(/'/g, "\\'") : null;

  const customersMap = new Map<
    string,
    { id: string; resourceName: string; name: string; accessRole?: string | null }
  >();

  const managerCustomerId = loginCustomerId ? cleanCustomerId(loginCustomerId) : null;
  if (managerCustomerId) {
    const managerQuery = await adsLimiter(() =>
      runAdsStreamQuery({
        apiVersion,
        customerId: managerCustomerId,
        headers: baseHeaders,
        query:
          "SELECT customer_client.client_customer, customer_client.descriptive_name, customer_client.manager, customer_client.level FROM customer_client"
      })
    );

    if (managerQuery.ok) {
      for (const chunk of managerQuery.chunks) {
        for (const row of chunk.results ?? []) {
          const client = row.customerClient as
            | { clientCustomer?: string; descriptiveName?: string; manager?: boolean; level?: number }
            | undefined;
          if (!client?.clientCustomer) continue;
          if (client.level === 0) continue;
          if (client.manager) continue;
          const id = cleanCustomerId(client.clientCustomer.split("/").pop() ?? client.clientCustomer);
          customersMap.set(id, {
            id,
            resourceName: `customers/${id}`,
            name: client.descriptiveName ?? id,
            accessRole: "ADMIN"
          });
        }
      }
    } else {
      console.error("[ads-customers] manager customer_client query failed", {
        managerCustomerId,
        body: managerQuery.raw
      });
    }
  }

  for (const resource of resourceNames) {
    const id = resource.split("/").pop() ?? resource;
    const customerId = cleanCustomerId(id);
    let name = customerId;
    let isManager = false;
    let accessRole: string | null = null;

    const [nameResult, accessResult] = await Promise.all([
      adsLimiter(async () => {
        try {
          const queryResponse = await runAdsStreamQuery({
            apiVersion,
            customerId,
            headers: baseHeaders,
            query: "SELECT customer.id, customer.descriptive_name, customer.manager FROM customer LIMIT 1"
          });
          if (!queryResponse.ok) return null;
          const first = (queryResponse.chunks?.[0]?.results?.[0]?.customer ?? null) as
            | { descriptiveName?: string; manager?: boolean }
            | null;
          if (first?.manager !== undefined) {
            isManager = Boolean(first.manager);
          }
          return first?.descriptiveName ?? null;
        } catch {
          return null;
        }
      }),
      connectedEmail
        ? adsLimiter(async () => {
            try {
              const queryResponse = await runAdsStreamQuery({
                apiVersion,
                customerId,
                headers: baseHeaders,
                query: `SELECT customer_user_access.access_role, customer_user_access.email_address FROM customer_user_access WHERE customer_user_access.email_address = '${safeEmail}' LIMIT 1`
              });
              if (!queryResponse.ok) return null;
              const first = (queryResponse.chunks?.[0]?.results?.[0]?.customerUserAccess ?? null) as
                | { accessRole?: string }
                | null;
              return first?.accessRole ?? null;
            } catch {
              return null;
            }
          })
        : Promise.resolve(null)
    ]);

    if (nameResult) name = nameResult;
    accessRole = accessResult;

    if (isManager) continue;
    if (connectedEmail && accessRole !== "ADMIN") continue;

    customersMap.set(customerId, {
      id: customerId,
      resourceName: resource,
      name,
      accessRole
    });
  }

  const customers = Array.from(customersMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  return NextResponse.json({ customers });
}
