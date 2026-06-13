import { Loader2 } from "lucide-react";
import type { SocialAuthProviderConfig } from "@/lib/authProviders";
import { cn } from "@/lib/utils";

interface AuthProviderButtonProps {
  provider: SocialAuthProviderConfig;
  label: string;
  loadingLabel: string;
  isLoading: boolean;
  disabled?: boolean;
  onClick: () => void;
  size?: "default" | "compact" | "large";
  surface?: "default" | "subtle" | "glass";
}

const AUTH_PROVIDER_BUTTON_SIZE_CLASS: Record<
  NonNullable<AuthProviderButtonProps["size"]>,
  string
> = {
  compact: "min-h-[44px] px-4 py-2.5 text-sm",
  default: "min-h-[48px] px-4 py-3.5 text-base",
  large: "min-h-[56px] px-3 py-3.5 text-base sm:px-4 sm:py-4 sm:text-lg",
};

const AUTH_PROVIDER_BUTTON_SURFACE_CLASS: Record<
  NonNullable<AuthProviderButtonProps["surface"]>,
  string
> = {
  default: "bg-card shadow-[var(--zen-shadow-soft)] hover:bg-muted",
  subtle: "bg-[hsl(var(--card)/0.58)] shadow-none hover:bg-muted",
  glass:
    "entry-action-tile bg-[hsl(var(--card)/0.58)] shadow-[inset_0_1px_0_hsl(var(--foreground)/0.06),0_18px_36px_-28px_hsl(var(--primary)/0.78)] hover:bg-[hsl(var(--card)/0.78)]",
};

function AuthProviderIcon({ provider }: { provider: SocialAuthProviderConfig }) {
  if (provider.id === "telegram") {
    return (
      <svg
        className="h-6 w-6 shrink-0"
        viewBox="0 0 24 24"
        aria-hidden="true"
        data-testid={`auth-provider-icon-${provider.id}`}
      >
        <circle cx="12" cy="12" r="12" fill="#2AABEE" />
        <path
          fill="#FFFFFF"
          d="M18.94 6.47 16.91 16c-.15.68-.55.85-1.12.53l-3.08-2.27-1.49 1.44c-.16.16-.3.3-.62.3l.22-3.14 5.71-5.15c.25-.22-.05-.34-.38-.12l-7.06 4.44-3.04-.95c-.66-.21-.68-.66.14-.98l11.9-4.59c.55-.2 1.04.13.85.96Z"
        />
      </svg>
    );
  }

  if (provider.id === "facebook") {
    return (
      <svg
        className="h-6 w-6 shrink-0"
        viewBox="0 0 24 24"
        aria-hidden="true"
        data-testid={`auth-provider-icon-${provider.id}`}
      >
        <circle cx="12" cy="12" r="12" fill="#1877F2" />
        <path
          fill="#FFFFFF"
          d="M15.55 13.5 16 10.58h-2.8V8.69c0-.8.39-1.58 1.65-1.58h1.27V4.62s-1.15-.2-2.26-.2c-2.3 0-3.8 1.39-3.8 3.92v2.24H7.5v2.92h2.56v7.06a10.3 10.3 0 0 0 3.14 0V13.5h2.35Z"
        />
      </svg>
    );
  }

  if (provider.id === "apple") {
    return (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701" />
      </svg>
    );
  }

  return (
    <svg
      className="h-6 w-6 shrink-0"
      viewBox="0 0 24 24"
      aria-hidden="true"
      data-testid={`auth-provider-icon-${provider.id}`}
    >
      <path fill="#4285F4" d="M21.6 12.23c0-.75-.07-1.47-.19-2.16H12v4.09h5.38a4.6 4.6 0 0 1-2 3.02v2.5h3.24c1.89-1.74 2.98-4.3 2.98-7.45Z" />
      <path fill="#34A853" d="M12 22c2.7 0 4.96-.89 6.62-2.42l-3.24-2.5c-.9.6-2.05.95-3.38.95-2.6 0-4.8-1.76-5.59-4.12H3.07v2.58A10 10 0 0 0 12 22Z" />
      <path fill="#FBBC05" d="M6.41 13.91A6 6 0 0 1 6.1 12c0-.66.11-1.31.31-1.91V7.51H3.07A10 10 0 0 0 2 12c0 1.61.39 3.14 1.07 4.49l3.34-2.58Z" />
      <path fill="#EA4335" d="M12 5.97c1.47 0 2.8.51 3.84 1.5l2.86-2.86A9.61 9.61 0 0 0 12 2a10 10 0 0 0-8.93 5.51l3.34 2.58C7.2 7.73 9.4 5.97 12 5.97Z" />
    </svg>
  );
}

export function AuthProviderButton({
  provider,
  label,
  loadingLabel,
  isLoading,
  disabled,
  onClick,
  size = "default",
  surface = "default",
}: AuthProviderButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={isLoading ? loadingLabel : label}
      aria-disabled={disabled}
      className={cn(
        "flex w-full items-center justify-center gap-2.5 rounded-2xl border border-border/60 font-semibold text-foreground motion-safe:transition-all disabled:cursor-not-allowed disabled:opacity-80 sm:gap-3",
        AUTH_PROVIDER_BUTTON_SIZE_CLASS[size],
        AUTH_PROVIDER_BUTTON_SURFACE_CLASS[surface]
      )}
    >
      {isLoading ? (
        <Loader2 className="w-5 h-5 motion-safe:animate-spin" aria-hidden="true" />
      ) : (
        <>
          <AuthProviderIcon provider={provider} />
          <span className="min-w-0 whitespace-nowrap text-center leading-tight">{label}</span>
        </>
      )}
    </button>
  );
}
