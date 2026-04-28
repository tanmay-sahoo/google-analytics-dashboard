import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type SnapshotSource = "ga4" | "ads";

const FRESH_TTL_SEC = Math.max(60, Number(process.env.REPORT_SNAPSHOT_FRESH_TTL_SEC) || 900);

function startOfTodayUtc(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function isHistorical(endDate: Date): boolean {
  return endDate < startOfTodayUtc();
}

export function buildRangeKey(parts: {
  startDate: string;
  endDate: string;
  extra?: Record<string, unknown>;
}): string {
  const { startDate, endDate, extra } = parts;
  if (!extra || Object.keys(extra).length === 0) {
    return `${startDate}:${endDate}`;
  }
  const sortedKeys = Object.keys(extra).sort();
  const tail = sortedKeys.map((k) => `${k}=${String(extra[k])}`).join(":");
  return `${startDate}:${endDate}:${tail}`;
}

export function parseShortDate(value: string): Date {
  // accepts YYYY-MM-DD
  const [y, m, d] = value.split("-").map((n) => Number(n));
  return new Date(Date.UTC(y, (m || 1) - 1, d || 1));
}

const inflight = new Map<string, Promise<unknown>>();

/**
 * Returns cached snapshot from Postgres if available; otherwise fetches via `fetcher`,
 * stores the result, and returns it.
 *
 * - Historical ranges (endDate < today) are cached forever after first fetch.
 * - Active ranges (endDate >= today) refresh after `freshTtlSec` (default 15 min).
 * - Concurrent identical requests coalesce into a single upstream fetch.
 */
export async function getOrFetchSnapshot<T>(args: {
  source: SnapshotSource;
  externalId: string;
  reportType: string;
  rangeKey: string;
  startDate: Date;
  endDate: Date;
  fetcher: () => Promise<T>;
  freshTtlSec?: number;
  forceRefresh?: boolean;
}): Promise<T> {
  const {
    source,
    externalId,
    reportType,
    rangeKey,
    startDate,
    endDate,
    fetcher,
    freshTtlSec = FRESH_TTL_SEC,
    forceRefresh = false
  } = args;

  const dedupeKey = `${source}::${externalId}::${reportType}::${rangeKey}`;

  let existing: Awaited<ReturnType<typeof prisma.reportSnapshot.findUnique>> = null;
  if (!forceRefresh) {
    try {
      existing = await prisma.reportSnapshot.findUnique({
        where: {
          source_externalId_reportType_rangeKey: { source, externalId, reportType, rangeKey }
        }
      });
    } catch (error) {
      console.warn("[report-snapshots] read failed, falling through to live fetch:", error);
    }

    if (existing) {
      if (isHistorical(endDate)) {
        return existing.data as T;
      }
      const ageSec = (Date.now() - existing.fetchedAt.getTime()) / 1000;
      if (ageSec < freshTtlSec) {
        return existing.data as T;
      }
    }
  }

  const inFlight = inflight.get(dedupeKey) as Promise<T> | undefined;
  if (inFlight) return inFlight;

  const promise = (async () => {
    try {
      let data: T;
      try {
        data = await fetcher();
      } catch (fetchError) {
        if (existing) {
          // Live API failed but we have a (stale) snapshot — serve it so the user
          // never sees an error. Background refresh will retry on next request.
          console.warn(
            "[report-snapshots] live fetch failed; serving stale snapshot:",
            fetchError
          );
          return existing.data as T;
        }
        throw fetchError;
      }

      try {
        await prisma.reportSnapshot.upsert({
          where: {
            source_externalId_reportType_rangeKey: { source, externalId, reportType, rangeKey }
          },
          create: {
            source,
            externalId,
            reportType,
            rangeKey,
            startDate,
            endDate,
            data: data as unknown as Prisma.InputJsonValue
          },
          update: {
            data: data as unknown as Prisma.InputJsonValue,
            fetchedAt: new Date(),
            startDate,
            endDate
          }
        });
      } catch (writeError) {
        console.warn("[report-snapshots] upsert failed (returning live data):", writeError);
      }
      return data;
    } finally {
      inflight.delete(dedupeKey);
    }
  })();
  inflight.set(dedupeKey, promise);
  return promise;
}

export async function pruneStaleSnapshots(maxAgeDays = 365) {
  const cutoff = new Date(Date.now() - maxAgeDays * 24 * 60 * 60 * 1000);
  return prisma.reportSnapshot.deleteMany({ where: { fetchedAt: { lt: cutoff } } });
}
