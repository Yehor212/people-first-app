export interface AccountSectionProps {
  userName: string;
  onNameChange: (name: string) => void;
  onResetData: () => void | Promise<void>;
}

/** Format an unknown error into a readable string */
export function formatError(error: unknown): string {
  if (error && typeof error === 'object') {
    const errObj = error as {
      message?: string;
      code?: string;
      details?: string;
      hint?: string;
    };
    const parts = [errObj.code, errObj.message, errObj.details, errObj.hint].filter(Boolean);
    if (parts.length) {
      return parts.join(' | ');
    }
    try {
      return JSON.stringify(error);
    } catch {
      return '[Unserializable error object]';
    }
  }
  return typeof error === 'string'
    ? error
    : typeof error === 'number' || typeof error === 'boolean'
      ? String(error)
      : 'Unknown error';
}
