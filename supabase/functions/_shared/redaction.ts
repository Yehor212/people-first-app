export function redactEmail(email: string | null | undefined): string {
  if (!email) return "email:redacted";
  const [local, domain] = email.split("@");
  if (!domain) return "email:redacted";
  const visible = local.slice(0, 2);
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
