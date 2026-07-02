import { ArrowLeft, Loader2, Phone } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabaseClient";
import { SHOW_PHONE_AUTH } from "./types";
import type { useAuthHandlers } from "./useAuthHandlers";
import type { useAuthSession } from "./useAuthSession";

type AuthSessionState = ReturnType<typeof useAuthSession>;
type AuthHandlers = ReturnType<typeof useAuthHandlers>;

interface AuthPhoneAuthPanelProps {
  session: AuthSessionState;
  handlers: AuthHandlers;
}

export function AuthPhoneAuthPanel({ session, handlers }: AuthPhoneAuthPanelProps) {
  const { t } = useLanguage();
  const ts = t as unknown as Record<string, string>;

  return (
    <>
      {SHOW_PHONE_AUTH && session.phoneStep === "idle" && (
        <button
          type="button"
          onClick={handlers.handlePhoneStart}
          disabled={session.isLoading || !supabase}
          className="entry-action-tile btn-press mt-2.5 flex min-h-[56px] w-full items-center justify-center gap-3 rounded-2xl border border-primary/30 bg-primary/20 px-4 py-4 text-lg font-semibold text-foreground shadow-lg transition-all hover:bg-primary/25 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Phone className="w-5 h-5" aria-hidden="true" />
          {t.continueWithPhone || "Continue with Phone"}
        </button>
      )}

      {SHOW_PHONE_AUTH && session.phoneStep === "input" && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <button
              type="button"
              onClick={handlers.handlePhoneBack}
              className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg p-1.5 text-muted-foreground hover:bg-muted/50"
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
              "entry-action-tile w-full rounded-xl border border-border/50 bg-muted/50 px-4 py-3.5 text-base text-foreground placeholder:text-muted-foreground/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
              session.error && "input-error"
            )}
          />
          <button
            type="button"
            onClick={() => void handlers.handleSendOtp()}
            disabled={session.loadingProvider === "phone" || !session.phoneNumber.trim()}
            className="btn-press flex min-h-[54px] w-full items-center justify-center gap-3 rounded-2xl bg-primary px-4 py-4 text-lg font-semibold text-primary-foreground shadow-lg transition-all hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
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
              type="button"
              onClick={() => session.setPhoneStep("input")}
              className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg p-1.5 text-muted-foreground hover:bg-muted/50"
              aria-label={t.ariaBack}
            >
              <ArrowLeft className="w-4 h-4 rtl:scale-x-[-1]" />
            </button>
            <span className="text-sm text-muted-foreground">
              {(t.authCodeSentTo || "Code sent to {phone}").replace(
                "{phone}",
                session.phoneNumber
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
              "entry-action-tile w-full rounded-xl border border-border/50 bg-muted/50 px-4 py-3.5 text-center font-mono text-2xl tracking-normal text-foreground placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
              session.error && "input-error"
            )}
          />
          <button
            type="button"
            onClick={() => void handlers.handleVerifyOtp()}
            disabled={session.loadingProvider === "phone" || session.otpCode.length !== 6}
            className="btn-press flex min-h-[54px] w-full items-center justify-center gap-3 rounded-2xl bg-primary px-4 py-4 text-lg font-semibold text-primary-foreground shadow-lg transition-all hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {session.loadingProvider === "phone" ? (
              <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
            ) : (
              t.authVerify || "Verify"
            )}
          </button>
        </div>
      )}
    </>
  );
}
