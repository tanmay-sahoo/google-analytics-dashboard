import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export async function logActivity({
  userId,
  action,
  entityType,
  entityId,
  message,
  metadata
}: {
  userId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  message?: string | null;
  metadata?: Prisma.InputJsonValue | null;
}) {
  try {
    await prisma.activityLog.create({
      data: {
        userId: userId ?? null,
        action,
        entityType,
        entityId: entityId ?? null,
        message: message ?? null,
        metadata: metadata ?? undefined
      }
    });
  } catch {
    // Avoid breaking primary flows if logging fails.
  }
}
