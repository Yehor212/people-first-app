import {
  TELEGRAM_OIDC_JWKS_URI,
  buildTelegramOidcDiscovery,
  buildTelegramOidcFunctionBaseUrl,
  filterTelegramJwks,
  isTelegramJwks,
} from "./telegram_oidc.ts";

const CACHE_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "content-type",
  "Cache-Control": "public, max-age=300, stale-while-revalidate=300",
  "Content-Type": "application/json; charset=utf-8",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
};

function jsonResponse(status: number, payload: Record<string, unknown>): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: CACHE_HEADERS,
  });
}

function noContentResponse(): Response {
  return new Response(null, {
    status: 204,
    headers: CACHE_HEADERS,
  });
}

function getRoute(req: Request): string {
  const url = new URL(req.url);
  const marker = "/telegram-oidc";
  const markerIndex = url.pathname.indexOf(marker);

  if (markerIndex === -1) return "/";
  return url.pathname.slice(markerIndex + marker.length) || "/";
}

async function fetchTelegramJwks(): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(TELEGRAM_OIDC_JWKS_URI, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });

    if (!response.ok) {
      return jsonResponse(502, { error: "Telegram JWKS fetch failed" });
    }

    const payload: unknown = await response.json();
    if (!isTelegramJwks(payload)) {
      return jsonResponse(502, { error: "Telegram JWKS response is invalid" });
    }

    return jsonResponse(200, filterTelegramJwks(payload));
  } catch {
    return jsonResponse(502, { error: "Telegram JWKS fetch failed" });
  } finally {
    clearTimeout(timeout);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return noContentResponse();
  if (req.method !== "GET") return jsonResponse(405, { error: "Method not allowed" });

  const route = getRoute(req);
  if (route === "/" || route === "/.well-known/openid-configuration") {
    return jsonResponse(200, buildTelegramOidcDiscovery(buildTelegramOidcFunctionBaseUrl(req.url, req.headers)));
  }

  if (route === "/jwks") {
    return await fetchTelegramJwks();
  }

  return jsonResponse(404, { error: "Not found" });
});
