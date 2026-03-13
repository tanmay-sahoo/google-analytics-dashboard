import { google } from "googleapis";
import { getOAuthClient } from "@/lib/google-oauth";
import { createLimiter, withRetry } from "@/lib/request-limiter";

export type MerchantAccount = {
  id: string;
  name: string;
};

export type MerchantProduct = {
  offerId: string;
  title: string;
  link?: string;
  imageLink?: string;
  availability?: string;
  priceValue?: number;
  priceCurrency?: string;
};

const merchantLimiter = createLimiter(1);

export async function listMerchantAccounts(refreshToken: string): Promise<MerchantAccount[]> {
  const authClient = getOAuthClient();
  authClient.setCredentials({ refresh_token: refreshToken });
  const content = google.content({ version: "v2.1", auth: authClient });

  const authInfo = await merchantLimiter(() =>
    withRetry(() => content.accounts.authinfo(), { label: "merchant" })
  );
  const accounts = authInfo.data.accountIdentifiers ?? [];
  const results: MerchantAccount[] = [];
  for (const account of accounts) {
    const merchantId = String(account.merchantId ?? "");
    if (!merchantId) continue;
    try {
      const detail = await merchantLimiter(() =>
        withRetry(
          () =>
            content.accounts.get({
              merchantId,
              accountId: merchantId
            }),
          { label: "merchant" }
        )
      );
      results.push({
        id: merchantId,
        name: detail.data.name ?? `Account ${merchantId}`
      });
    } catch {
      results.push({
        id: merchantId,
        name: `Account ${merchantId}`
      });
    }
  }
  return results;
}

export async function listMerchantProducts({
  merchantId,
  refreshToken,
  pageToken,
  maxResults = 250
}: {
  merchantId: string;
  refreshToken: string;
  pageToken?: string;
  maxResults?: number;
}): Promise<{ products: MerchantProduct[]; nextPageToken?: string }> {
  const authClient = getOAuthClient();
  authClient.setCredentials({ refresh_token: refreshToken });
  const content = google.content({ version: "v2.1", auth: authClient });

  const response = await merchantLimiter(() =>
    withRetry(
      () =>
        content.products.list({
          merchantId,
          maxResults,
          pageToken
        }),
      { label: "merchant" }
    )
  );

  const resources = response.data.resources ?? [];
  const products = resources.map((item) => ({
    offerId: item.offerId ?? "",
    title: item.title ?? "",
    link: item.link ?? undefined,
    imageLink: item.imageLink ?? undefined,
    availability: item.availability ?? undefined,
    priceValue: item.price?.value ? Number(item.price.value) : undefined,
    priceCurrency: item.price?.currency ?? undefined
  }));

  return { products, nextPageToken: response.data.nextPageToken ?? undefined };
}
