// Single source of truth for the app's URL prefix. Must match the
// `basePath` value in next.config.js. Used by client-side fetch calls
// (which Next does NOT auto-prefix) and by NextAuth's SessionProvider.
export const BASE_PATH = "/analytics-app";

export function apiUrl(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${BASE_PATH}${normalized}`;
}
