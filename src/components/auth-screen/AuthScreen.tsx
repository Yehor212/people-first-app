import { Leaf, Loader2, AlertCircle, Phone, ArrowLeft } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import type { AuthScreenProps } from "./types";
import { SHOW_APPLE_AUTH, SHOW_FACEBOOK_AUTH, SHOW_PHONE_AUTH } from "./types";
import { useAuthSession } from "./useAuthSession";
import { useAuthHandlers } from "./useAuthHandlers";

export function AuthScreen({
  onComplete,
  webOAuthError,
  onClearError,
}: AuthScreenProps) {
  const { t } = useLanguage();

  const session = useAuthSession({ onComplete, webOAuthError, onClearError });
  const handlers = useAuthHandlers(
    session,
    t as unknown as Record<string, string>,
  );

  return (
    <div
      className="min-h-screen zen-gradient-hero flex items-center justify-center p-4"
      role="main"
      aria-labelledby="auth-title"
    >
      <div className="w-full max-w-md motion-safe:animate-fade-in">
        {/* Logo */}
        <header className="text-center mb-8">
          <div
            className="inline-flex items-center gap-3 mb-4"
            aria-hidden="true"
          >
            <div className="p-3 zen-gradient rounded-2xl zen-shadow-glow">
              <Leaf className="w-8 h-8 text-primary-foreground" />
            </div>
          </div>
          <h1
            id="auth-title"
            className="text-3xl font-bold zen-text-gradient mb-2"
          >
            {t.authWelcomeTitle}
          </h1>
          <p className="text-muted-foreground">{t.authWelcomeSubtitle}</p>
        </header>

        {/* Auth Card */}
        <section
          className="bg-card rounded-2xl p-6 zen-shadow-card mb-4 space-y-3"
          aria-labelledby="auth-methods-title"
          aria-busy={session.isLoading}
        >
          <h2
            id="auth-methods-title"
            className="text-lg font-semibold text-foreground text-center mb-4"
          >
            {t.authContinueWith}
          </h2>

          {/* Google Sign In Button */}
          <button
            onClick={handlers.handleGoogleSignIn}
            disabled={session.isLoading || !supabase}
            aria-label={
              session.loadingProvider === "google"
                ? t.authSigningInGoogle
                : t.continueWithGoogle
            }
            aria-disabled={session.isLoading || !supabase}
            className="w-full py-4 bg-card hover:bg-muted text-foreground font-semibold rounded-2xl transition-all zen-shadow-soft text-lg flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {session.loadingProvider === "google" ? (
              <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
            ) : (
              <>
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                {t.continueWithGoogle}
              </>
            )}
          </button>

          {/* Apple Sign In Button — temporarily hidden */}
          {SHOW_APPLE_AUTH && (
            <button
              onClick={handlers.handleAppleSignIn}
              disabled={session.isLoading || !supabase}
              aria-label={
                session.loadingProvider === "apple"
                  ? t.authSigningIn
                  : t.continueWithApple
              }
              aria-disabled={session.isLoading || !supabase}
              className="w-full py-4 bg-black hover:bg-gray-900 text-white font-semibold rounded-2xl transition-all zen-shadow-soft text-lg flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {session.loadingProvider === "apple" ? (
                <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
              ) : (
                <>
                  <svg
                    className="w-5 h-5"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701" />
                  </svg>
                  {t.continueWithApple}
                </>
              )}
            </button>
          )}

          {/* Facebook Sign In Button — temporarily hidden */}
          {SHOW_FACEBOOK_AUTH && (
            <button
              onClick={handlers.handleFacebookSignIn}
              disabled={session.isLoading || !supabase}
              aria-label={
                session.loadingProvider === "facebook"
                  ? t.authSigningIn
                  : t.continueWithFacebook
              }
              aria-disabled={session.isLoading || !supabase}
              className="w-full py-4 bg-[#1877F2] hover:bg-[#166FE5] text-white font-semibold rounded-2xl transition-all zen-shadow-soft text-lg flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {session.loadingProvider === "facebook" ? (
                <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
              ) : (
                <>
                  <svg
                    className="w-5 h-5"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                  </svg>
                  {t.continueWithFacebook}
                </>
              )}
            </button>
          )}

          {/* Phone Sign In */}
          {SHOW_PHONE_AUTH && session.phoneStep === "idle" && (
            <button
              onClick={handlers.handlePhoneStart}
              disabled={session.isLoading || !supabase}
              className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-2xl transition-all zen-shadow-soft text-lg flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Phone className="w-5 h-5" />
              {t.continueWithPhone || "Continue with Phone"}
            </button>
          )}

          {/* Phone number input */}
          {SHOW_PHONE_AUTH && session.phoneStep === "input" && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <button
                  onClick={handlers.handlePhoneBack}
                  className="p-1.5 rounded-lg hover:bg-muted/50 text-muted-foreground min-w-[44px] min-h-[44px] flex items-center justify-center"
                  aria-label="Back"
                >
                  <ArrowLeft className="w-4 h-4 rtl:scale-x-[-1]" />
                </button>
                <span className="text-sm font-medium text-foreground">
                  {t.authEnterPhone || "Enter your phone number"}
                </span>
              </div>
              <input
                type="tel"
                value={session.phoneNumber}
                onChange={(e) => {
                  session.setPhoneNumber(e.target.value);
                  session.setError(null);
                }}
                placeholder="+1234567890"
                autoFocus
                aria-label={t.phoneNumberLabel || "Phone number"}
                className={cn(
                  "w-full px-4 py-3.5 rounded-xl text-base bg-muted/50 border border-border/50 focus:outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground/50",
                  session.error && "input-error",
                )}
              />
              <button
                onClick={() => void handlers.handleSendOtp()}
                disabled={
                  session.loadingProvider === "phone" ||
                  !session.phoneNumber.trim()
                }
                className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-2xl transition-all zen-shadow-soft text-lg flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {session.loadingProvider === "phone" ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  t.authSendCode || "Send code"
                )}
              </button>
            </div>
          )}

          {/* OTP verification */}
          {SHOW_PHONE_AUTH && session.phoneStep === "otp" && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <button
                  onClick={() => session.setPhoneStep("input")}
                  className="p-1.5 rounded-lg hover:bg-muted/50 text-muted-foreground min-w-[44px] min-h-[44px] flex items-center justify-center"
                  aria-label="Back"
                >
                  <ArrowLeft className="w-4 h-4 rtl:scale-x-[-1]" />
                </button>
                <span className="text-sm text-muted-foreground">
                  {(t.authCodeSentTo || "Code sent to {phone}").replace(
                    "{phone}",
                    session.phoneNumber,
                  )}
                </span>
              </div>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={session.otpCode}
                onChange={(e) => {
                  session.setOtpCode(
                    e.target.value.replace(/\D/g, "").slice(0, 6),
                  );
                  session.setError(null);
                }}
                placeholder="000000"
                autoFocus
                aria-label={t.otpCodeLabel || "Verification code"}
                className={cn(
                  "w-full px-4 py-3.5 rounded-xl text-center text-2xl tracking-[0.5em] font-mono bg-muted/50 border border-border/50 focus:outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground/30",
                  session.error && "input-error",
                )}
              />
              <button
                onClick={() => void handlers.handleVerifyOtp()}
                disabled={
                  session.loadingProvider === "phone" ||
                  session.otpCode.length !== 6
                }
                className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-2xl transition-all zen-shadow-soft text-lg flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {session.loadingProvider === "phone" ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  t.authVerify || "Verify"
                )}
              </button>
            </div>
          )}

          {!supabase && (
            <div
              role="alert"
              className="p-3 bg-destructive/10 rounded-xl flex items-start gap-2"
            >
              <AlertCircle
                className="w-5 h-5 text-destructive mt-0.5 flex-shrink-0"
                aria-hidden="true"
              />
              <p className="text-sm text-destructive">
                {t.authNotConfiguredMessage}
              </p>
            </div>
          )}

          {session.error && (
            <div
              role="alert"
              aria-live="polite"
              className="p-3 bg-destructive/10 rounded-xl flex items-start gap-2"
            >
              <AlertCircle
                className="w-5 h-5 text-destructive mt-0.5 flex-shrink-0"
                aria-hidden="true"
              />
              <div className="flex-1">
                <p className="text-sm text-destructive whitespace-pre-wrap">
                  {session.error}
                </p>
                {session.debugInfo && (
                  <p className="text-xs text-muted-foreground mt-2">
                    {session.debugInfo}
                  </p>
                )}
                <button
                  onClick={handlers.exportDebugInfo}
                  aria-label={t.authExportDebugInfo}
                  className="text-xs text-primary underline mt-2"
                >
                  {t.authExportDebugInfo}
                </button>
              </div>
            </div>
          )}
        </section>

        {/* Privacy Note */}
        <p className="text-center text-xs text-muted-foreground mt-4">
          {t.authPrivacyNote}
        </p>

        {/* Legal Consent Footer */}
        <p className="text-center text-xs text-muted-foreground/70 mt-2">
          {t.legalAgreePrefix}{" "}
          <a
            href="https://yehor212.github.io/people-first-app/privacy.html"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-foreground transition-colors"
          >
            {t.privacyPolicy}
          </a>{" "}
          {t.legalAnd}{" "}
          <a
            href="https://yehor212.github.io/people-first-app/terms.html"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-foreground transition-colors"
          >
            {t.termsOfService}
          </a>
        </p>
      </div>
    </div>
  );
}

// Export for backwards compatibility
export { AuthScreen as GoogleAuthScreen };
