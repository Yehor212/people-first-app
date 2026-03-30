// Single source of truth for CORS origins (consolidated from all edge functions)
export const ALLOWED_ORIGINS = [
  "https://yehor212.github.io",
  "capacitor://localhost", // Capacitor iOS
  "http://localhost", // Capacitor Android WebView
  "https://localhost", // Capacitor Android HTTPS
  "http://localhost:5173", // Vite dev server
  "http://localhost:8100", // Ionic dev server
  // Security note: "null" origin required for Android WebView (Capacitor) which sends
  // Origin: null for same-origin requests. Risk accepted: edge functions require auth token.
  "null",
];

export function getCorsHeaders(origin: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-cron-secret",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "X-XSS-Protection": "1; mode=block",
    "Referrer-Policy": "strict-origin-when-cross-origin",
  };
  // Only set ACAO for known origins — omit for unknown (OWASP recommendation)
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }
  return headers;
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

const MAX_BODY_SIZE = 512 * 1024; // 512 KB — prevents memory exhaustion (CWE-400)

/**
 * Parse JSON body with size limit and error handling.
 * Returns [body, null] on success or [null, Response] on failure.
 */
export async function parseJsonBody<T = unknown>(
  req: Request,
  origin: string | null,
  maxSize = MAX_BODY_SIZE,
): Promise<[T, null] | [null, Response]> {
  const contentLength = req.headers.get("content-length");
  if (contentLength && parseInt(contentLength, 10) > maxSize) {
    return [
      null,
      createJsonResponse(origin, 413, { error: "Request body too large" }),
    ];
  }
  try {
    const body = (await req.json()) as T;
    return [body, null];
  } catch {
    return [
      null,
      createJsonResponse(origin, 400, { error: "Invalid JSON body" }),
    ];
  }
}

export function createNoContentResponse(origin: string | null): Response {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(origin),
  });
}
