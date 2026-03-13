type Task<T> = () => Promise<T>;

export function createLimiter(maxConcurrent: number) {
  let active = 0;
  const queue: Array<() => void> = [];

  const runNext = () => {
    if (active >= maxConcurrent) return;
    const next = queue.shift();
    if (next) next();
  };

  return function limit<T>(task: Task<T>) {
    return new Promise<T>((resolve, reject) => {
      const run = async () => {
        active += 1;
        try {
          const result = await task();
          resolve(result);
        } catch (error) {
          reject(error);
        } finally {
          active -= 1;
          runNext();
        }
      };
      if (active < maxConcurrent) {
        run();
      } else {
        queue.push(run);
      }
    });
  };
}

function isRetryable(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const anyError = error as { code?: number; response?: { status?: number }; message?: string };
  const status = anyError.code ?? anyError.response?.status;
  if (status && [429, 500, 502, 503, 504].includes(status)) return true;
  const message = anyError.message ?? "";
  return message.includes("quota") || message.includes("rate");
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withRetry<T>(
  task: Task<T>,
  {
    retries = 3,
    baseDelayMs = 500,
    label
  }: { retries?: number; baseDelayMs?: number; label?: string } = {}
) {
  let attempt = 0;
  while (true) {
    try {
      return await task();
    } catch (error) {
      if (!isRetryable(error) || attempt >= retries) {
        throw error;
      }
      const delay = baseDelayMs * Math.pow(2, attempt) + Math.floor(Math.random() * 200);
      if (label) {
        console.warn(`[${label}] retrying after ${delay}ms`);
      }
      await sleep(delay);
      attempt += 1;
    }
  }
}
