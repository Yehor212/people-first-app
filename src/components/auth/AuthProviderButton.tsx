import { Loader2, Send } from "lucide-react";
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
  surface?: "default" | "subtle";
}

const AUTH_PROVIDER_BUTTON_SIZE_CLASS: Record<
  NonNullable<AuthProviderButtonProps["size"]>,
  string
> = {
  compact: "min-h-[44px] px-4 py-2.5 text-sm",
  default: "min-h-[48px] px-4 py-3.5 text-base",
  large: "min-h-[56px] px-4 py-4 text-lg",
};

const AUTH_PROVIDER_BUTTON_SURFACE_CLASS: Record<
  NonNullable<AuthProviderButtonProps["surface"]>,
  string
> = {
  default: "bg-card shadow-[var(--zen-shadow-soft)] hover:bg-muted",
  subtle: "bg-[hsl(var(--card)/0.58)] shadow-none hover:bg-muted",
};

function AuthProviderIcon({ provider }: { provider: SocialAuthProviderConfig }) {
  if (provider.id === "telegram") {
    return <Send className="w-5 h-5 text-primary" aria-hidden="true" />;
  }

  if (provider.id === "facebook") {
    return (
      <span
        className="flex h-5 w-5 items-center justify-center font-bold text-primary"
        aria-hidden="true"
      >
        f
      </span>
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
    <span
      className="flex h-5 w-5 items-center justify-center font-semibold text-primary"
      aria-hidden="true"
    >
      G
    </span>
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
      onClick={onClick}
      disabled={disabled}
      aria-label={isLoading ? loadingLabel : label}
      aria-disabled={disabled}
      className={cn(
        "flex w-full items-center justify-center gap-3 rounded-2xl border border-border/60 font-semibold text-foreground motion-safe:transition-all disabled:cursor-not-allowed disabled:opacity-50",
        AUTH_PROVIDER_BUTTON_SIZE_CLASS[size],
        AUTH_PROVIDER_BUTTON_SURFACE_CLASS[surface],
      )}
    >
      {isLoading ? (
        <Loader2 className="w-5 h-5 motion-safe:animate-spin" aria-hidden="true" />
      ) : (
        <>
          <AuthProviderIcon provider={provider} />
          <span>{label}</span>
        </>
      )}
    </button>
  );
}
