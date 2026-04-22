import { prisma } from "@/lib/prisma";

function isSameDay(left: Date, right: Date) {
  return left.toISOString().slice(0, 10) === right.toISOString().slice(0, 10);
}

function normalizeDay(value: Date) {
  const normalized = new Date(value);
  normalized.setHours(0, 0, 0, 0);
  return normalized;
}

export async function getOrRefreshReport<T>({
  projectId,
  reportKey,
  rangeStart,
  rangeEnd,
  fetcher,
  force = false
}: {
  projectId: string;
  reportKey: string;
  rangeStart: Date;
  rangeEnd: Date;
  fetcher: () => Promise<T>;
  force?: boolean;
}): Promise<T> {
  const normalizedStart = normalizeDay(rangeStart);
  const normalizedEnd = normalizeDay(rangeEnd);

  const cached = await prisma.reportCache.findUnique({
    where: {
      projectId_reportKey_rangeStart_rangeEnd: {
        projectId,
        reportKey,
        rangeStart: normalizedStart,
        rangeEnd: normalizedEnd
      }
    }
  });

  const now = new Date();
  if (!force && cached && isSameDay(cached.updatedAt, now)) {
    return cached.data as T;
  }

  const data = await fetcher();
  await prisma.reportCache.upsert({
    where: {
      projectId_reportKey_rangeStart_rangeEnd: {
        projectId,
        reportKey,
        rangeStart: normalizedStart,
        rangeEnd: normalizedEnd
      }
    },
    update: { data },
    create: {
      projectId,
      reportKey,
      rangeStart: normalizedStart,
      rangeEnd: normalizedEnd,
      data
    }
  });

  return data;
}
