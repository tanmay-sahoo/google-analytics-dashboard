// Single source of truth for the app's URL prefix at runtime. The value comes
// from `basepath.config.js` at the project root (read by next.config.js and
// exposed as process.env.NEXT_PUBLIC_BASE_PATH). When the config file is
// missing or empty, BASE_PATH is "" and the app is served at the root.
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export function apiUrl(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${BASE_PATH}${normalized}`;
}
