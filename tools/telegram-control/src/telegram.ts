import type { ControlJob, Env } from "./types";

export interface TelegramUser {
  id: number;
  username?: string;
}

export interface TelegramCallback {
  id: string;
  data: string;
  from: TelegramUser;
  message?: {
    chat?: {
      id: number | string;
    };
  };
}

export interface TelegramUpdate {
  update_id?: number;
  message?: {
    text?: string;
    chat?: {
      id: number | string;
    };
    from?: TelegramUser;
  };
  callback_query?: TelegramCallback;
}

export function getTelegramUser(update: TelegramUpdate): TelegramUser | null {
  return update.message?.from ?? update.callback_query?.from ?? null;
}

export function getTelegramChatId(update: TelegramUpdate): number | string | null {
  return update.message?.chat?.id ?? update.callback_query?.message?.chat?.id ?? null;
}

export function getTelegramText(update: TelegramUpdate): string {
  return update.message?.text ?? "";
}

export function parseCallbackData(data: string):
  | { action: "approve" | "deny" | "cancel"; jobId: string; nonce: string }
  | null {
  const [action, jobId, nonce] = data.split(":");
  if ((action === "approve" || action === "deny" || action === "cancel") && jobId && nonce) {
    return { action, jobId, nonce };
  }

  return null;
}

export function approvalKeyboard(job: ControlJob): { inline_keyboard: Array<Array<{ text: string; callback_data: string }>> } {
  const nonce = job.approvalNonce ?? "";
  return {
    inline_keyboard: [
      [
        { text: "Approve", callback_data: `approve:${job.id}:${nonce}` },
        { text: "Deny", callback_data: `deny:${job.id}:${nonce}` },
      ],
      [{ text: "Cancel", callback_data: `cancel:${job.id}:${nonce}` }],
    ],
  };
}

export async function sendTelegramMessage(
  env: Env,
  chatId: number | string,
  text: string,
  replyMarkup?: unknown,
): Promise<{ ok: boolean; status: number; error?: string }> {
  if (!env.TELEGRAM_BOT_TOKEN) {
    return { ok: false, status: 0, error: "TELEGRAM_BOT_TOKEN is not configured" };
  }

  const response = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      disable_web_page_preview: true,
      ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
    }),
  });

  if (response.ok) {
    return { ok: true, status: response.status };
  }

  const error = await boundedText(response);
  return { ok: false, status: response.status, error };
}

export async function answerCallbackQuery(
  env: Env,
  callbackQueryId: string,
  text: string,
): Promise<{ ok: boolean; status: number; error?: string }> {
  if (!env.TELEGRAM_BOT_TOKEN) {
    return { ok: false, status: 0, error: "TELEGRAM_BOT_TOKEN is not configured" };
  }

  const response = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ callback_query_id: callbackQueryId, text }),
  });

  if (response.ok) {
    return { ok: true, status: response.status };
  }

  const error = await boundedText(response);
  return { ok: false, status: response.status, error };
}

async function boundedText(response: Response): Promise<string> {
  const text = await response.text();
  return text.slice(0, 500);
}
