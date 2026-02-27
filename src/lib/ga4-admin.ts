import { google } from "googleapis";
import { getOAuthClient } from "@/lib/google-oauth";

export type Ga4Property = {
  id: string;
  displayName: string;
  accountId?: string;
  accountName?: string;
  timeZone?: string;
  currencyCode?: string;
};

export async function listGa4Properties(refreshToken: string): Promise<Ga4Property[]> {
  const authClient = getOAuthClient();
  authClient.setCredentials({ refresh_token: refreshToken });

  const analyticsAdmin = google.analyticsadmin({ version: "v1beta", auth: authClient });
  const accountsResponse = await analyticsAdmin.accounts.list({ pageSize: 200 });
  const accounts = accountsResponse.data.accounts ?? [];
  const accountMap = new Map(
    accounts
      .map((account) => {
        const accountId = account.name?.split("/").pop();
        if (!accountId) return null;
        return [accountId, account.displayName ?? accountId] as const;
      })
      .filter(Boolean) as Array<readonly [string, string]>
  );

  const properties: Ga4Property[] = [];
  for (const account of accounts) {
    const accountId = account.name?.split("/").pop();
    if (!accountId) continue;

    const propsResponse = await analyticsAdmin.properties.list({
      filter: `parent:accounts/${accountId}`,
      pageSize: 200
    });

    for (const prop of propsResponse.data.properties ?? []) {
      const id = prop.name?.split("/").pop();
      if (!id) continue;
      properties.push({
        id,
        displayName: prop.displayName ?? id,
        accountId,
        accountName: accountMap.get(accountId) ?? accountId,
        timeZone: prop.timeZone ?? undefined,
        currencyCode: prop.currencyCode ?? undefined
      });
    }
  }

  return properties;
}
