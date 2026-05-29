import { Leaf, Loader2, AlertCircle, Phone, ArrowLeft } from "lucide-react";
import { AuthProviderButton } from "@/components/auth/AuthProviderButton";
import { useLanguage } from "@/contexts/LanguageContext";
import { IS_DEV } from "@/lib/env";
import { getEnabledAuthScreenProviders } from "@/lib/authProviders";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabaseClient";
import type { AuthScreenProps } from "./types";
import { SHOW_PHONE_AUTH } from "./types";
import { useAuthHandlers } from "./useAuthHandlers";
import { useAuthSession } from "./useAuthSession";

export function AuthScreen({ onComplete, webOAuthError, onClearError }: AuthScreenProps) {
  const { t } = useLanguage();
  const ts = t as unknown as Record<string, string>;

  const session = useAuthSession({ onComplete, webOAuthError, onClearError });
  const handlers = useAuthHandlers(session, t as unknown as Record<string, string>);
  const socialProviders = getEnabledAuthScreenProviders();

  return (
    <div
      className="min-h-screen zen-gradient-hero flex items-center justify-center p-4"
      role="main"
      aria-labelledby="auth-title"
    >
      <div className="w-full max-w-md motion-safe:animate-fade-in">
        <header className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-4" aria-hidden="true">
            <div className="p-3 zen-gradient rounded-2xl zen-shadow-glow">
              <Leaf className="w-8 h-8 text-primary-foreground" />
            </div>
          </div>
          <h1 id="auth-title" className="text-3xl font-bold zen-text-gradient mb-2">
            {t.authWelcomeTitle}
          </h1>
          <p className="text-muted-foreground">{t.authWelcomeSubtitle}</p>
        </header>

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

          {socialProviders.map((provider) => (
            <AuthProviderButton
              key={provider.id}
              provider={provider}
              label={ts[provider.labelKey] || provider.fallbackLabel}
              loadingLabel={ts[provider.loadingLabelKey] || provider.fallbackLoadingLabel}
              isLoading={session.loadingProvider === provider.id}
              disabled={session.isLoading || !supabase}
              onClick={() => handlers.handleProviderSignIn(provider.id)}
              className="py-4 text-lg"
            />
          ))}

          {SHOW_PHONE_AUTH && session.phoneStep === "idle" && (
            <button
              onClick={handlers.handlePhoneStart}
              disabled={session.isLoading || !supabase}
              className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-2xl motion-safe:transition-all zen-shadow-soft text-lg flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Phone className="w-5 h-5" aria-hidden="true" />
              {t.continueWithPhone || "Continue with Phone"}
            </button>
          )}

          {SHOW_PHONE_AUTH && session.phoneStep === "input" && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <button
                  onClick={handlers.handlePhoneBack}
                  className="p-1.5 rounded-lg hover:bg-muted/50 text-muted-foreground min-w-[44px] min-h-[44px] flex items-center justify-center"
                  aria-label={t.ariaBack}
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
                autoComplete="tel"
                aria-label={ts.phoneNumberLabel || "Phone number"}
                aria-describedby={session.error ? "auth-error" : undefined}
                className={cn(
                  "w-full px-4 py-3.5 rounded-xl text-base bg-muted/50 border border-border/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 placeholder:text-muted-foreground/50",
                  session.error && "input-error",
                )}
              />
              <button
                onClick={() => void handlers.handleSendOtp()}
                disabled={session.loadingProvider === "phone" || !session.phoneNumber.trim()}
                className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-2xl motion-safe:transition-all zen-shadow-soft text-lg flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {session.loadingProvider === "phone" ? (
                  <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
                ) : (
                  t.authSendCode || "Send code"
                )}
              </button>
            </div>
          )}

          {SHOW_PHONE_AUTH && session.phoneStep === "otp" && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <button
                  onClick={() => session.setPhoneStep("input")}
                  className="p-1.5 rounded-lg hover:bg-muted/50 text-muted-foreground min-w-[44px] min-h-[44px] flex items-center justify-center"
                  aria-label={t.ariaBack}
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
                  session.setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6));
                  session.setError(null);
                }}
                placeholder="000000"
                autoFocus
                aria-label={ts.otpCodeLabel || "Verification code"}
                aria-describedby={session.error ? "auth-error" : undefined}
                className={cn(
                  "w-full px-4 py-3.5 rounded-xl text-center text-2xl tracking-[0.5em] font-mono bg-muted/50 border border-border/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 placeholder:text-muted-foreground/60",
                  session.error && "input-error",
                )}
              />
              <button
                onClick={() => void handlers.handleVerifyOtp()}
                disabled={session.loadingProvider === "phone" || session.otpCode.length !== 6}
                className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-2xl motion-safe:transition-all zen-shadow-soft text-lg flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {session.loadingProvider === "phone" ? (
                  <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
                ) : (
                  t.authVerify || "Verify"
                )}
              </button>
            </div>
          )}

          {!supabase && (
            <div role="alert" className="p-3 bg-destructive/10 rounded-xl flex items-start gap-2">
              <AlertCircle
                className="w-5 h-5 text-destructive mt-0.5 flex-shrink-0"
                aria-hidden="true"
              />
              <p className="text-sm text-destructive">{t.authNotConfiguredMessage}</p>
            </div>
          )}

          {session.error && (
            <div
              id="auth-error"
              role="alert"
              aria-live="polite"
              className="p-3 bg-destructive/10 rounded-xl flex items-start gap-2"
            >
              <AlertCircle
                className="w-5 h-5 text-destructive mt-0.5 flex-shrink-0"
                aria-hidden="true"
              />
              <div className="flex-1">
                <p className="text-sm text-destructive whitespace-pre-wrap">{session.error}</p>
                {IS_DEV && session.debugInfo && (
                  <p className="text-xs text-muted-foreground mt-2">{session.debugInfo}</p>
                )}
                {IS_DEV && (
                  <button
                    onClick={handlers.exportDebugInfo}
                    aria-label={t.authExportDebugInfo}
                    className="text-xs text-primary underline mt-2"
                  >
                    {t.authExportDebugInfo}
                  </button>
                )}
              </div>
            </div>
          )}
        </section>

        <p className="text-center text-xs text-muted-foreground mt-4">{t.authPrivacyNote}</p>

        <p className="text-center text-xs text-muted-foreground/70 mt-2">
          {t.legalAgreePrefix}{" "}
          <a
            href="https://yehor212.github.io/people-first-app/privacy.html"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-[44px] items-center underline hover:text-foreground motion-safe:transition-colors"
          >
            {t.privacyPolicy}
          </a>{" "}
          {t.legalAnd}{" "}
          <a
            href="https://yehor212.github.io/people-first-app/terms.html"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-[44px] items-center underline hover:text-foreground motion-safe:transition-colors"
          >
            {t.termsOfService}
          </a>
        </p>
      </div>
    </div>
  );
}

export { AuthScreen as GoogleAuthScreen };
