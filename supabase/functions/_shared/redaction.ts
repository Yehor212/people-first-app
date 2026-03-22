export function redactEmail(email: string | null | undefined): string {
  if (!email) return "email:redacted";
  const parts = email.split("@");
  if (parts.length < 2) return "email:redacted";
  const domain = parts[parts.length - 1];
  // Security fix: show only first char (was 2 chars + full domain → deanonymizable)
  const visible = parts[0].slice(0, 1);
  return `${visible}***@${domain}`;
}

export function redactUserRef(userId: string | null | undefined): string {
  if (!userId) return "user:redacted";
  return `user:${userId.slice(0, 8)}`;
}

export function redactError(error: unknown): string {
  if (error instanceof Error) {
    return "error:redacted";
  }
  return "error:redacted";
}
