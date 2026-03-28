// Single source of truth for CORS origins (consolidated from all edge functions)
export const ALLOWED_ORIGINS = [
  "https://yehor212.github.io",
  "capacitor://localhost", // Capacitor iOS
  "http://localhost", // Capacitor Android WebView
  "https://localhost", // Capacitor Android HTTPS
  "http://localhost:5173", // Vite dev server
  "http://localhost:8100", // Ionic dev server
  "null", // Some Android WebViews send null origin
];

export function getCorsHeaders(origin: string | null): Record<string, string> {
  // Security: only allow known origins, reject unknown
  const allowedOrigin =
    origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-cron-secret",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "X-XSS-Protection": "1; mode=block",
    "Referrer-Policy": "strict-origin-when-cross-origin",
  };
}

export function createJsonResponse(
  origin: string | null,
  status: number,
  payload: Record<string, unknown>,
): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...getCorsHeaders(origin),
      "Content-Type": "application/json",
    },
  });
}

export function createNoContentResponse(origin: string | null): Response {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(origin),
  });
}
