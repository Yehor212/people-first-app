import { readFile } from "node:fs/promises";

import { validateTelegramAdminIds } from "./activation-doctor";

export type TelegramReadinessStatus = "PASS" | "UNVERIFIED" | "FAIL";

export interface TelegramReadinessCheck {
  name: string;
  status: TelegramReadinessStatus;
  evidence: string;
}

export interface TelegramReadinessOptions {
  live: boolean;
  fetcher?: typeof fetch;
}

interface TelegramApiResponse<T> {
  ok?: boolean;
  description?: string;
  result?: T;
}

interface TelegramBotInfo {
  id?: number;
  is_bot?: boolean;
  username?: string;
}

interface TelegramPhotoSize {
  file_id?: string;
  width?: number;
  height?: number;
  file_size?: number;
}

interface TelegramUserProfilePhotos {
  total_count?: number;
  photos?: TelegramPhotoSize[][];
}

interface TelegramFile {
  file_id?: string;
  file_path?: string;
}

export interface TelegramBotProfilePhotoCheckOptions {
  botToken: string | undefined;
  approvedPhotoPath: string;
  fetcher?: typeof fetch;
  comparePhoto?: (actualBytes: Uint8Array, approvedPhotoPath: string) => Promise<boolean>;
}
export interface TelegramPublicBotProfilePhotoCheckOptions {
  botUsername?: string | undefined;
  approvedPhotoPath: string;
  fetcher?: typeof fetch;
  comparePhoto?: (actualBytes: Uint8Array, approvedPhotoPath: string) => Promise<boolean>;
}

interface TelegramWebhookInfo {
  url?: string;
  pending_update_count?: number;
  last_error_message?: string;
  allowed_updates?: string[];
}

export async function buildTelegramReadinessChecks(
  env: Readonly<Record<string, string | undefined>>,
  options: TelegramReadinessOptions
): Promise<TelegramReadinessCheck[]> {
  const checks = buildLocalTelegramReadinessChecks(env);

  if (!options.live) {
    return checks;
  }

  const botToken = trimmed(env.TELEGRAM_BOT_TOKEN);
  if (!botToken || validateTelegramBotToken(botToken).length > 0) {
    checks.push({
      name: "Telegram getMe",
      status: "UNVERIFIED",
      evidence: "TELEGRAM_BOT_TOKEN is missing or malformed; live token check not run",
    });
    checks.push({
      name: "Telegram getWebhookInfo",
      status: "UNVERIFIED",
      evidence: "TELEGRAM_BOT_TOKEN is missing or malformed; live webhook check not run",
    });
    return checks;
  }

  const fetcher = options.fetcher ?? fetch;
  checks.push(await checkTelegramGetMe(botToken, fetcher));
  checks.push(await checkTelegramWebhookInfo(botToken, env, fetcher));
  return checks;
}

export function buildLocalTelegramReadinessChecks(
  env: Readonly<Record<string, string | undefined>>
): TelegramReadinessCheck[] {
  const botToken = trimmed(env.TELEGRAM_BOT_TOKEN);
  const webhookSecret = trimmed(env.TELEGRAM_WEBHOOK_SECRET);
  const adminIds = trimmed(env.TELEGRAM_ADMIN_IDS);
  const webhookUrl = trimmed(env.TELEGRAM_WEBHOOK_URL);
  const miniAppUrl =
    trimmed(env.TELEGRAM_MINI_APP_URL) ?? miniAppUrlFromControlBase(env.TELEGRAM_CONTROL_BASE_URL);
  const tokenErrors = botToken ? validateTelegramBotToken(botToken) : ["missing from environment"];
  const webhookSecretErrors = webhookSecret
    ? validateTelegramWebhookSecret(webhookSecret)
    : ["missing from environment"];
  const adminIdErrors = validateTelegramAdminIds(adminIds);
  const webhookUrlErrors = webhookUrl
    ? validateTelegramWebhookUrl(webhookUrl)
    : ["missing from environment"];
  const miniAppUrlErrors = miniAppUrl
    ? validateTelegramMiniAppUrl(miniAppUrl)
    : ["set TELEGRAM_MINI_APP_URL or TELEGRAM_CONTROL_BASE_URL"];

  return [
    {
      name: "TELEGRAM_BOT_TOKEN",
      status: statusFromErrors(Boolean(botToken), tokenErrors),
      evidence:
        tokenErrors.length === 0
          ? "present and shape-valid; value not printed"
          : tokenErrors.join("; "),
    },
    {
      name: "TELEGRAM_WEBHOOK_SECRET",
      status: statusFromErrors(Boolean(webhookSecret), webhookSecretErrors),
      evidence:
        webhookSecretErrors.length === 0
          ? "present and compatible with Telegram secret_token rules; value not printed"
          : webhookSecretErrors.join("; "),
    },
    {
      name: "TELEGRAM_ADMIN_IDS",
      status: statusFromErrors(Boolean(adminIds), adminIdErrors),
      evidence:
        adminIdErrors.length === 0
          ? "numeric Telegram admin allowlist present"
          : adminIdErrors.join("; "),
    },
    {
      name: "TELEGRAM_WEBHOOK_URL",
      status: statusFromErrors(Boolean(webhookUrl), webhookUrlErrors),
      evidence:
        webhookUrlErrors.length === 0
          ? "HTTPS /telegram/webhook URL validated"
          : webhookUrlErrors.join("; "),
    },
    {
      name: "TELEGRAM_MINI_APP_URL",
      status: statusFromErrors(Boolean(miniAppUrl), miniAppUrlErrors),
      evidence:
        miniAppUrlErrors.length === 0
          ? "HTTPS Mini App URL validated"
          : miniAppUrlErrors.join("; "),
    },
  ];
}

export function overallTelegramReadinessStatus(
  checks: readonly TelegramReadinessCheck[]
): TelegramReadinessStatus {
  if (checks.some((check) => check.status === "FAIL")) {
    return "FAIL";
  }
  if (checks.some((check) => check.status === "UNVERIFIED")) {
    return "UNVERIFIED";
  }
  return "PASS";
}

export function validateTelegramBotToken(value: string): string[] {
  if (!/^\d+:[A-Za-z0-9_-]{20,}$/.test(value)) {
    return ["TELEGRAM_BOT_TOKEN must look like a BotFather token"];
  }
  return [];
}

export function validateTelegramWebhookSecret(value: string): string[] {
  const errors: string[] = [];
  if (value.length < 1 || value.length > 256) {
    errors.push("TELEGRAM_WEBHOOK_SECRET must be 1-256 characters");
  }
  if (!/^[A-Za-z0-9_-]+$/.test(value)) {
    errors.push("TELEGRAM_WEBHOOK_SECRET may contain only A-Z, a-z, 0-9, underscore, or hyphen");
  }
  return errors;
}

export function validateTelegramWebhookUrl(value: string): string[] {
  return validateHttpsUrl(value, "TELEGRAM_WEBHOOK_URL", "/telegram/webhook");
}

export function validateTelegramMiniAppUrl(value: string): string[] {
  const errors = validateHttpsUrl(value, "TELEGRAM_MINI_APP_URL");
  return errors;
}

export async function checkTelegramBotProfilePhoto({
  botToken: rawBotToken,
  approvedPhotoPath,
  fetcher = fetch,
  comparePhoto = compareTelegramProfilePhotoToApproved,
}: TelegramBotProfilePhotoCheckOptions): Promise<TelegramReadinessCheck> {
  const botToken = trimmed(rawBotToken);
  if (!botToken) {
    return {
      name: "Telegram bot profile photo",
      status: "UNVERIFIED",
      evidence: "TELEGRAM_BOT_TOKEN is missing; live bot profile photo check not run",
    };
  }

  const tokenErrors = validateTelegramBotToken(botToken);
  if (tokenErrors.length > 0) {
    return {
      name: "Telegram bot profile photo",
      status: "FAIL",
      evidence: tokenErrors.join("; "),
    };
  }

  const botInfo = await callTelegram<TelegramBotInfo>(botToken, "getMe", fetcher);
  if (!botInfo.ok || !botInfo.result?.is_bot || !botInfo.result.id) {
    return {
      name: "Telegram bot profile photo",
      status: "FAIL",
      evidence: `Telegram getMe did not return a bot id: ${redactTelegramToken(botInfo.description ?? "unknown error", botToken)}`,
    };
  }

  const photos = await callTelegram<TelegramUserProfilePhotos>(
    botToken,
    "getUserProfilePhotos",
    fetcher,
    {
      user_id: botInfo.result.id,
      limit: 1,
    }
  );
  if (!photos.ok || !photos.result) {
    return {
      name: "Telegram bot profile photo",
      status: "FAIL",
      evidence: `Telegram getUserProfilePhotos failed: ${redactTelegramToken(photos.description ?? "unknown error", botToken)}`,
    };
  }

  const photo = photos.result.photos?.[0]?.at(-1);
  if (!photo?.file_id) {
    return {
      name: "Telegram bot profile photo",
      status: "FAIL",
      evidence:
        "Telegram bot has no profile photo; upload the approved ZenFlow userpic before public OAuth checks",
    };
  }

  const file = await callTelegram<TelegramFile>(botToken, "getFile", fetcher, {
    file_id: photo.file_id,
  });
  if (!file.ok || !file.result?.file_path) {
    return {
      name: "Telegram bot profile photo",
      status: "FAIL",
      evidence: `Telegram getFile failed: ${redactTelegramToken(file.description ?? "unknown error", botToken)}`,
    };
  }

  const fileUrl = buildTelegramFileUrl(botToken, file.result.file_path);
  if (!fileUrl) {
    return {
      name: "Telegram bot profile photo",
      status: "FAIL",
      evidence: "Telegram returned an unsafe profile photo file path",
    };
  }

  try {
    const response = await fetcher(fileUrl);
    if (!response.ok) {
      return {
        name: "Telegram bot profile photo",
        status: "UNVERIFIED",
        evidence: `Telegram profile photo download returned HTTP ${response.status}`,
      };
    }

    const actualBytes = new Uint8Array(await response.arrayBuffer());
    const matchesApproved = await comparePhoto(actualBytes, approvedPhotoPath);
    if (!matchesApproved) {
      return {
        name: "Telegram bot profile photo",
        status: "FAIL",
        evidence: "Telegram bot profile photo does not match the approved ZenFlow logo asset",
      };
    }
  } catch (error) {
    return {
      name: "Telegram bot profile photo",
      status: "UNVERIFIED",
      evidence: `Telegram bot profile photo check could not be completed: ${redactTelegramToken(error instanceof Error ? error.message : String(error), botToken)}`,
    };
  }

  const username = botInfo.result.username
    ? `@${botInfo.result.username}`
    : "bot username unavailable";
  return {
    name: "Telegram bot profile photo",
    status: "PASS",
    evidence: `${username} profile photo matches the approved ZenFlow logo; token value not printed`,
  };
}

const DEFAULT_TELEGRAM_PUBLIC_BOT_USERNAME = "ZenFlowAuthBot";
const TELEGRAM_PUBLIC_IMAGE_HOST_SUFFIXES = [
  "telesco.pe",
  "telegram.org",
  "telegram-cdn.org",
  "t.me",
] as const;

export async function checkTelegramPublicBotProfilePhoto({
  botUsername = DEFAULT_TELEGRAM_PUBLIC_BOT_USERNAME,
  approvedPhotoPath,
  fetcher = fetch,
  comparePhoto = compareTelegramProfilePhotoToApproved,
}: TelegramPublicBotProfilePhotoCheckOptions): Promise<TelegramReadinessCheck> {
  const username = normalizeTelegramPublicBotUsername(botUsername);
  if (!username) {
    return {
      name: "Telegram public bot profile photo",
      status: "FAIL",
      evidence:
        "Telegram bot username must be 5-32 characters and contain only letters, numbers, or underscores",
    };
  }

  const profileUrl = new URL("/" + encodeURIComponent(username), "https://t.me").toString();
  try {
    const profileResponse = await fetcher(profileUrl);
    if (!profileResponse.ok) {
      return {
        name: "Telegram public bot profile photo",
        status: "UNVERIFIED",
        evidence:
          "Telegram public profile returned HTTP " + profileResponse.status + " for @" + username,
      };
    }

    const profileHtml = await profileResponse.text();
    const imageUrl = extractTelegramPublicOgImageUrl(profileHtml);
    if (!imageUrl) {
      return {
        name: "Telegram public bot profile photo",
        status: "FAIL",
        evidence:
          "Telegram public profile for @" + username + " does not expose a safe og:image avatar",
      };
    }

    const imageResponse = await fetcher(imageUrl);
    if (!imageResponse.ok) {
      return {
        name: "Telegram public bot profile photo",
        status: "UNVERIFIED",
        evidence:
          "Telegram public profile avatar returned HTTP " +
          imageResponse.status +
          " for @" +
          username,
      };
    }

    const actualBytes = new Uint8Array(await imageResponse.arrayBuffer());
    const matchesApproved = await comparePhoto(actualBytes, approvedPhotoPath);
    if (!matchesApproved) {
      return {
        name: "Telegram public bot profile photo",
        status: "FAIL",
        evidence:
          "Telegram public profile photo for @" +
          username +
          " does not match the approved ZenFlow logo asset",
      };
    }
  } catch (error) {
    return {
      name: "Telegram public bot profile photo",
      status: "UNVERIFIED",
      evidence:
        "Telegram public bot profile photo check could not be completed for @" +
        username +
        ": " +
        (error instanceof Error ? error.message : String(error)),
    };
  }

  return {
    name: "Telegram public bot profile photo",
    status: "PASS",
    evidence:
      "@" +
      username +
      " public profile photo matches the approved ZenFlow logo; no bot token required",
  };
}

const TELEGRAM_PROFILE_PHOTO_DISTANCE_THRESHOLD = 0.08;
const APPROVED_PROFILE_PHOTO_CROP_RATIOS = [1, 0.94, 0.88, 0.84, 0.8, 0.76, 0.72, 0.68] as const;

export async function compareTelegramProfilePhotoToApproved(
  actualBytes: Uint8Array,
  approvedPhotoPath: string
): Promise<boolean> {
  const [{ default: sharp }, approvedBytes] = await Promise.all([
    import("sharp"),
    readFile(approvedPhotoPath),
  ]);
  const [actualRaw, approvedCandidates] = await Promise.all([
    sharp(Buffer.from(actualBytes))
      .resize(64, 64, { fit: "cover" })
      .flatten()
      .removeAlpha()
      .raw()
      .toBuffer(),
    buildApprovedProfilePhotoCandidates(approvedBytes),
  ]);

  if (actualRaw.length === 0) {
    return false;
  }

  return approvedCandidates.some((approvedRaw) => {
    if (actualRaw.length !== approvedRaw.length || approvedRaw.length === 0) {
      return false;
    }

    return (
      meanNormalizedPixelDistance(actualRaw, approvedRaw) <=
      TELEGRAM_PROFILE_PHOTO_DISTANCE_THRESHOLD
    );
  });
}

async function buildApprovedProfilePhotoCandidates(approvedBytes: Buffer): Promise<Buffer[]> {
  const { default: sharp } = await import("sharp");
  const metadata = await sharp(approvedBytes).metadata();
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;
  const minSide = Math.min(width, height);

  return Promise.all(
    APPROVED_PROFILE_PHOTO_CROP_RATIOS.map((ratio) => {
      let pipeline = sharp(approvedBytes);

      if (ratio < 1 && minSide > 0) {
        const cropSide = Math.max(1, Math.round(minSide * ratio));
        const left = Math.max(0, Math.floor((width - cropSide) / 2));
        const top = Math.max(0, Math.floor((height - cropSide) / 2));
        pipeline = pipeline.extract({ left, top, width: cropSide, height: cropSide });
      }

      return pipeline.resize(64, 64, { fit: "cover" }).flatten().removeAlpha().raw().toBuffer();
    })
  );
}

function meanNormalizedPixelDistance(actualRaw: Buffer, approvedRaw: Buffer): number {
  let totalDistance = 0;
  for (let index = 0; index < actualRaw.length; index += 1) {
    totalDistance += Math.abs(actualRaw[index] - approvedRaw[index]);
  }
  return totalDistance / actualRaw.length / 255;
}
function normalizeTelegramPublicBotUsername(value: string): string | null {
  const username = value.trim().replace(/^@/, "");
  if (!/^[A-Za-z0-9_]{5,32}$/.test(username)) {
    return null;
  }
  return username;
}

function extractTelegramPublicOgImageUrl(html: string): string | null {
  const metaTags = html.match(/<meta\b[^>]*>/gi) ?? [];
  for (const tag of metaTags) {
    if (!/(?:property|name)\s*=\s*["\']og:image["\']/i.test(tag)) {
      continue;
    }

    const contentMatch = tag.match(/\bcontent\s*=\s*(?:"([^"]*)"|\'([^\']*)\'|([^\s>]+))/i);
    const rawContent = contentMatch?.[1] ?? contentMatch?.[2] ?? contentMatch?.[3];
    if (!rawContent) {
      continue;
    }

    const imageUrl = normalizeTelegramPublicImageUrl(decodeHtmlAttributeValue(rawContent));
    if (imageUrl) {
      return imageUrl;
    }
  }
  return null;
}

function normalizeTelegramPublicImageUrl(value: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return null;
  }

  if (parsed.protocol !== "https:") {
    return null;
  }
  if (!isAllowedTelegramPublicImageHost(parsed.hostname)) {
    return null;
  }
  if (parsed.username || parsed.password) {
    return null;
  }
  return parsed.toString();
}

function isAllowedTelegramPublicImageHost(hostname: string): boolean {
  const normalizedHost = hostname.toLowerCase();
  return TELEGRAM_PUBLIC_IMAGE_HOST_SUFFIXES.some(
    (suffix) => normalizedHost === suffix || normalizedHost.endsWith("." + suffix)
  );
}

function decodeHtmlAttributeValue(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

async function checkTelegramGetMe(
  botToken: string,
  fetcher: typeof fetch
): Promise<TelegramReadinessCheck> {
  const response = await callTelegram<TelegramBotInfo>(botToken, "getMe", fetcher);
  if (!response.ok || !response.result?.is_bot) {
    return {
      name: "Telegram getMe",
      status: "FAIL",
      evidence: `Telegram getMe did not confirm a bot: ${response.description ?? "unknown error"}`,
    };
  }
  const username = response.result.username
    ? `@${response.result.username}`
    : "bot username unavailable";
  return {
    name: "Telegram getMe",
    status: "PASS",
    evidence: `Bot API authenticated ${username}; token value not printed`,
  };
}

async function checkTelegramWebhookInfo(
  botToken: string,
  env: Readonly<Record<string, string | undefined>>,
  fetcher: typeof fetch
): Promise<TelegramReadinessCheck> {
  const response = await callTelegram<TelegramWebhookInfo>(botToken, "getWebhookInfo", fetcher);
  if (!response.ok || !response.result) {
    return {
      name: "Telegram getWebhookInfo",
      status: "FAIL",
      evidence: `Telegram getWebhookInfo failed: ${response.description ?? "unknown error"}`,
    };
  }

  const webhookUrl = response.result.url?.trim();
  if (!webhookUrl) {
    return {
      name: "Telegram getWebhookInfo",
      status: "UNVERIFIED",
      evidence: "Telegram reports no webhook URL; run set-webhook after Worker deploy",
    };
  }

  const expectedUrl = trimmed(env.TELEGRAM_WEBHOOK_URL);
  if (expectedUrl && normalizeUrl(expectedUrl) !== normalizeUrl(webhookUrl)) {
    return {
      name: "Telegram getWebhookInfo",
      status: "FAIL",
      evidence: `Telegram webhook target differs from TELEGRAM_WEBHOOK_URL: ${redactUrl(webhookUrl)}`,
    };
  }

  if (response.result.last_error_message) {
    return {
      name: "Telegram getWebhookInfo",
      status: "UNVERIFIED",
      evidence: `Telegram reports a recent webhook delivery error at ${redactUrl(webhookUrl)}`,
    };
  }

  return {
    name: "Telegram getWebhookInfo",
    status: "PASS",
    evidence: `Telegram webhook is configured at ${redactUrl(webhookUrl)}; pending updates ${
      response.result.pending_update_count ?? 0
    }`,
  };
}

async function callTelegram<T>(
  botToken: string,
  method: string,
  fetcher: typeof fetch,
  body?: Record<string, unknown>
): Promise<TelegramApiResponse<T>> {
  try {
    const response = await fetcher(`https://api.telegram.org/bot${botToken}/${method}`, {
      method: "POST",
      ...(body
        ? {
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          }
        : {}),
    });
    return (await response.json()) as TelegramApiResponse<T>;
  } catch (error) {
    return {
      ok: false,
      description: error instanceof Error ? error.message : String(error),
    };
  }
}

function buildTelegramFileUrl(botToken: string, filePath: string): string | null {
  if (
    !filePath ||
    filePath.startsWith("/") ||
    filePath.includes("..") ||
    /^[a-z][a-z0-9+.-]*:/i.test(filePath)
  ) {
    return null;
  }
  return new URL(`/file/bot${botToken}/${filePath}`, "https://api.telegram.org").toString();
}

function redactTelegramToken(value: string, botToken: string): string {
  return value.split(botToken).join("[redacted-telegram-token]");
}

function statusFromErrors(hasValue: boolean, errors: readonly string[]): TelegramReadinessStatus {
  if (errors.length === 0) {
    return "PASS";
  }
  return hasValue ? "FAIL" : "UNVERIFIED";
}

function validateHttpsUrl(value: string, label: string, requiredPath?: string): string[] {
  const errors: string[] = [];
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return [`${label} must be a valid URL`];
  }

  if (parsed.protocol !== "https:") {
    errors.push(`${label} must use HTTPS`);
  }
  if (parsed.username || parsed.password) {
    errors.push(`${label} must not include credentials`);
  }
  if (parsed.search || parsed.hash) {
    errors.push(`${label} must not include query strings or fragments`);
  }
  if (requiredPath && parsed.pathname !== requiredPath) {
    errors.push(`${label} must end with ${requiredPath}`);
  }
  return errors;
}

function miniAppUrlFromControlBase(value: string | undefined): string | undefined {
  const base = trimmed(value);
  if (!base) {
    return undefined;
  }
  try {
    const parsed = new URL(base);
    parsed.pathname = "/miniapp";
    parsed.search = "";
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return base;
  }
}

function normalizeUrl(value: string): string {
  return new URL(value).toString();
}

function redactUrl(value: string): string {
  const parsed = new URL(value);
  return `${parsed.protocol}//${parsed.host}${parsed.pathname}`;
}

function trimmed(value: string | undefined): string | undefined {
  const next = value?.trim();
  return next ? next : undefined;
}
