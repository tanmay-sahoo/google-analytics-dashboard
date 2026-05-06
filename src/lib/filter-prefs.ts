import { z } from "zod";
import { prisma } from "@/lib/prisma";

export const RANGE_KEYS = ["last7", "last30", "last90", "month", "custom"] as const;
export type FilterRangeKey = (typeof RANGE_KEYS)[number];

export const filterPrefsSchema = z
  .object({
    projectId: z.string().min(1).optional(),
    dateRange: z
      .object({
        range: z.enum(RANGE_KEYS),
        start: z.string().optional(),
        end: z.string().optional()
      })
      .optional()
  })
  .strict();

export type FilterPrefs = z.infer<typeof filterPrefsSchema>;

export function parseFilterPrefs(raw: unknown): FilterPrefs {
  if (!raw || typeof raw !== "object") return {};
  const parsed = filterPrefsSchema.safeParse(raw);
  return parsed.success ? parsed.data : {};
}

export async function readUserFilterPrefs(userId: string): Promise<FilterPrefs> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { filterPrefs: true }
  });
  return parseFilterPrefs(user?.filterPrefs);
}

export async function mergeUserFilterPrefs(
  userId: string,
  patch: FilterPrefs
): Promise<FilterPrefs> {
  const current = await readUserFilterPrefs(userId);
  const next: FilterPrefs = {
    ...current,
    ...patch,
    dateRange: patch.dateRange ?? current.dateRange
  };
  await prisma.user.update({
    where: { id: userId },
    data: { filterPrefs: next as object }
  });
  return next;
}
