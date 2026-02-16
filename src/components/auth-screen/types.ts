// Temporarily disabled auth providers (not production-ready)
export const SHOW_APPLE_AUTH = false;
export const SHOW_FACEBOOK_AUTH = false;
export const SHOW_PHONE_AUTH = false;

// Phone number validation: E.164 format (+7-15 digits)
export const PHONE_REGEX = /^\+\d{7,15}$/;

export interface AuthScreenProps {
  onComplete: (userData: { name: string; email: string }) => void;
  webOAuthError?: string | null;
  onClearError?: () => void;
}

// Track which provider is currently loading
export type AuthProvider = 'google' | 'apple' | 'facebook' | 'phone' | null;

// Phone auth flow steps
export type PhoneStep = 'idle' | 'input' | 'otp';
