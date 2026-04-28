type Entry<T> = { value: T; expiresAt: number };

const cache = new Map<string, Entry<unknown>>();
const inflight = new Map<string, Promise<unknown>>();
const MAX_ENTRIES = 2000;
const SWEEP_INTERVAL_MS = 60_000;

let sweepTimer: ReturnType<typeof setInterval> | null = null;
function ensureSweeper() {
  if (sweepTimer) return;
  sweepTimer = setInterval(sweepExpired, SWEEP_INTERVAL_MS);
  if (typeof sweepTimer.unref === "function") sweepTimer.unref();
}

function sweepExpired() {
  const now = Date.now();
  for (const [k, v] of cache) {
    if (v.expiresAt <= now) cache.delete(k);
  }
}

function evictIfFull() {
  if (cache.size <= MAX_ENTRIES) return;
  sweepExpired();
  while (cache.size > MAX_ENTRIES) {
    const firstKey = cache.keys().next().value;
    if (firstKey === undefined) break;
    cache.delete(firstKey);
  }
}

function stableKey(prefix: string, params: Record<string, unknown>): string {
  const filtered: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(params)) {
    if (k === "refreshToken" || k === "accessToken" || k === "password") continue;
    filtered[k] = v;
  }
  const sortedKeys = Object.keys(filtered).sort();
  const canonical: Record<string, unknown> = {};
  for (const k of sortedKeys) canonical[k] = filtered[k];
  return `${prefix}::${JSON.stringify(canonical)}`;
}

export async function cached<T>(
  key: string,
  ttlSeconds: number,
  loader: () => Promise<T>
): Promise<T> {
  ensureSweeper();
  const now = Date.now();
  const entry = cache.get(key) as Entry<T> | undefined;
  if (entry && entry.expiresAt > now) {
    return entry.value;
  }
  const existing = inflight.get(key) as Promise<T> | undefined;
  if (existing) return existing;

  const promise = (async () => {
    try {
      const value = await loader();
      cache.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
      evictIfFull();
      return value;
    } finally {
      inflight.delete(key);
    }
  })();
  inflight.set(key, promise);
  return promise;
}

export async function cachedWithKeys<T>(
  prefix: string,
  params: Record<string, unknown>,
  ttlSeconds: number,
  loader: () => Promise<T>
): Promise<T> {
  return cached(stableKey(prefix, params), ttlSeconds, loader);
}

export function invalidateCacheKey(key: string): void {
  cache.delete(key);
}

export function invalidateCachePrefix(prefix: string): void {
  const needle = `${prefix}::`;
  for (const k of cache.keys()) {
    if (k.startsWith(needle)) cache.delete(k);
  }
}

export function clearApiCache(): void {
  cache.clear();
  inflight.clear();
}

export function apiCacheStats() {
  return { size: cache.size, inflight: inflight.size };
}
