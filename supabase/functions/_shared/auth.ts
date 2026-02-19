export function secureCompare(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  if (a.length !== b.length) return false;

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

export function extractBearerToken(authHeader: string | null | undefined): string | null {
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  const token = authHeader.slice("Bearer ".length).trim();
  return token.length > 0 ? token : null;
}

export function isAuthorizedRequest(options: {
  authHeader: string | null;
  cronSecretHeader: string | null;
  serviceRoleKey: string;
  cronSecret: string | null;
}): boolean {
  const { authHeader, cronSecretHeader, serviceRoleKey, cronSecret } = options;
  return (
    (cronSecret ? secureCompare(cronSecretHeader, cronSecret) : false) ||
    secureCompare(authHeader, `Bearer ${serviceRoleKey}`)
  );
}
