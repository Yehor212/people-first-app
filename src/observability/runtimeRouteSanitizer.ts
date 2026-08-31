const ALLOWED_RUNTIME_ROUTE_PARAMS: ReadonlyArray<
  readonly [string, ReadonlySet<string>]
> = [
  ["nav", new Set(["v2"])],
  ["navLayout", new Set(["phone", "web", "desktop"])],
] as const;

const RUNTIME_ROUTE_BASE = "https://runtime-route.invalid";

export function sanitizeRuntimeRoute(route: string): string {
  const trimmedRoute = route.trim();
  if (!trimmedRoute || trimmedRoute.startsWith("//")) {
    return "/";
  }

  try {
    const parsed = new URL(trimmedRoute, RUNTIME_ROUTE_BASE);
    const pathname = parsed.pathname.startsWith("/") ? parsed.pathname : "/";
    const safeSearch = new URLSearchParams();

    for (const [key, allowedValues] of ALLOWED_RUNTIME_ROUTE_PARAMS) {
      const value = parsed.searchParams.get(key);
      if (value !== null && allowedValues.has(value)) {
        safeSearch.set(key, value);
      }
    }

    const search = safeSearch.toString();
    return search ? `${pathname}?${search}` : pathname;
  } catch {
    return "/";
  }
}
