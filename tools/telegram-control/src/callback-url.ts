export function callbackUrlFromBase(baseUrl: string): string {
  const parsed = parseHttpsUrl(baseUrl);
  parsed.pathname = "/github/webhook";
  parsed.search = "";
  parsed.hash = "";
  return parsed.toString();
}

export function validateCallbackUrl(callbackUrl: string): string[] {
  const errors: string[] = [];
  let parsed: URL;

  try {
    parsed = new URL(callbackUrl);
  } catch {
    return ["TELEGRAM_CONTROL_CALLBACK_URL must be a valid URL"];
  }

  if (parsed.protocol !== "https:") {
    errors.push("TELEGRAM_CONTROL_CALLBACK_URL must use HTTPS");
  }
  if (parsed.pathname !== "/github/webhook") {
    errors.push("TELEGRAM_CONTROL_CALLBACK_URL must end with /github/webhook");
  }
  if (parsed.username || parsed.password) {
    errors.push("TELEGRAM_CONTROL_CALLBACK_URL must not include credentials");
  }
  if (parsed.search || parsed.hash) {
    errors.push("TELEGRAM_CONTROL_CALLBACK_URL must not include query strings or fragments");
  }

  return errors;
}

function parseHttpsUrl(value: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error("TELEGRAM_CONTROL_BASE_URL must be a valid URL");
  }

  if (parsed.protocol !== "https:") {
    throw new Error("TELEGRAM_CONTROL_BASE_URL must use HTTPS");
  }
  if (parsed.username || parsed.password) {
    throw new Error("TELEGRAM_CONTROL_BASE_URL must not include credentials");
  }

  return parsed;
}
