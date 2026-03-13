import { PrismaClient } from "@prisma/client";
import { decryptSecret, encryptSecret } from "@/lib/crypto";

const globalForPrisma = global as unknown as { prisma: PrismaClient | undefined };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ["error", "warn"]
  });

function encryptField(data: Record<string, unknown>, key: string) {
  const value = data[key];
  if (typeof value === "string") {
    data[key] = encryptSecret(value);
    return;
  }
  if (value && typeof value === "object" && "set" in value) {
    const setValue = (value as { set?: unknown }).set;
    if (typeof setValue === "string") {
      data[key] = { ...(value as Record<string, unknown>), set: encryptSecret(setValue) };
    }
  }
}

function decryptRecord(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string") {
      record[key] = decryptSecret(value);
    }
  }
  return record;
}

prisma.$use(async (params, next) => {
  if (params.model === "IntegrationSetting" && params.args?.data) {
    const data = params.args.data as Record<string, unknown>;
    encryptField(data, "accessToken");
    encryptField(data, "refreshToken");
  }
  if (params.model === "AiConfig" && params.args?.data) {
    const data = params.args.data as Record<string, unknown>;
    encryptField(data, "apiKey");
  }
  if (params.action === "upsert" && params.args) {
    const create = params.args.create as Record<string, unknown> | undefined;
    const update = params.args.update as Record<string, unknown> | undefined;
    if (params.model === "IntegrationSetting") {
      if (create) {
        encryptField(create, "accessToken");
        encryptField(create, "refreshToken");
      }
      if (update) {
        encryptField(update, "accessToken");
        encryptField(update, "refreshToken");
      }
    }
    if (params.model === "AiConfig") {
      if (create) {
        encryptField(create, "apiKey");
      }
      if (update) {
        encryptField(update, "apiKey");
      }
    }
  }

  const result = await next(params);

  if (params.model === "IntegrationSetting") {
    if (Array.isArray(result)) {
      return result.map((item) => decryptRecord(item as Record<string, unknown>, ["accessToken", "refreshToken"]));
    }
    if (result && typeof result === "object") {
      return decryptRecord(result as Record<string, unknown>, ["accessToken", "refreshToken"]);
    }
  }
  if (params.model === "AiConfig") {
    if (Array.isArray(result)) {
      return result.map((item) => decryptRecord(item as Record<string, unknown>, ["apiKey"]));
    }
    if (result && typeof result === "object") {
      return decryptRecord(result as Record<string, unknown>, ["apiKey"]);
    }
  }

  return result;
});

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
