import { Loader2 } from "lucide-react";
import { useId } from "react";
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

function TelegramProviderIcon({ testId }: { testId: string }) {
  const gradientId = `auth-provider-telegram-gradient-${useId().replace(/:/g, "")}`;

  return (
    <svg
      className="h-6 w-6 shrink-0"
      viewBox="0 0 128 128"
      aria-hidden="true"
      data-testid={testId}
    >
      <defs>
        <linearGradient id={gradientId} x1="50%" x2="50%" y1="0%" y2="99.258%">
          <stop offset="0%" stopColor="#2AABEE" />
          <stop offset="100%" stopColor="#229ED9" />
        </linearGradient>
      </defs>
      <circle cx="64" cy="64" r="64" fill={`url(#${gradientId})`} />
      <path
        fill="#FFFFFF"
        fillRule="nonzero"
        d="M28.9700376 63.3244248C47.6273373 55.1957357 60.0684594 49.8368063 66.2934036 47.2476366 84.0668845 39.855031 87.7600616 38.5708563 90.1672227 38.528c.5294328-.0088742 1.7132047.1223351 2.4800024.7445385.6474689.5253764.8256136 1.2350852.9108614 1.7331996.085248.4981144.191402 1.6328319.1070176 2.5194671-.9631512 10.119913-5.1306908 34.6782731-7.2508984 46.012749-.8971395 4.7960416-2.6636347 6.4041299-4.3738066 6.5615026-3.7165995.3420073-6.5388164-2.4561883-10.1385248-4.8158425-5.6328329-3.6923931-8.8150251-5.9909191-14.2826648-9.5940126-6.3188037-4.1639979-2.2225863-6.4526036 1.3784816-10.1928256.9424165-.978834 17.3178391-15.8735468 17.634786-17.2247307.0396394-.1689881.0764268-.7988958-.2977904-1.1315102-.3742172-.3326144-.9265294-.2188732-1.3250934-.1284139-.5649523.1282234-9.5634758 6.0759138-26.9955705 17.8430709-2.554201 1.7539115-4.8677169 2.608476-6.9405467 2.5636937-2.2851298-.049369-6.6808026-1.2920471-9.9485335-2.3542577-4.008005-1.3028444-7.1934876-1.9916677-6.9161036-4.2043006.1444787-1.1524762 1.7315452-2.3311104 4.7611996-3.5359028Z"
      />
    </svg>
  );
}

function AuthProviderIcon({ provider }: { provider: SocialAuthProviderConfig }) {
  if (provider.id === "telegram") {
    return <TelegramProviderIcon testId={`auth-provider-icon-${provider.id}`} />;
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
      <svg
        className="h-6 w-6 shrink-0"
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden="true"
        data-testid={`auth-provider-icon-${provider.id}`}
      >
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
        "flex w-full min-w-0 items-center justify-center whitespace-normal rounded-2xl border border-border/60 font-semibold text-foreground motion-safe:transition-all disabled:cursor-not-allowed disabled:opacity-80",
        AUTH_PROVIDER_BUTTON_SIZE_CLASS[size],
        AUTH_PROVIDER_BUTTON_SURFACE_CLASS[surface]
      )}
    >
      {isLoading ? (
        <Loader2 className="w-5 h-5 motion-safe:animate-spin" aria-hidden="true" />
      ) : (
        <span
          className="grid w-full min-w-0 max-w-[22rem] grid-cols-1 items-center gap-2.5 min-[420px]:grid-cols-[2rem_minmax(0,1fr)_2rem] sm:gap-3"
          data-testid={`auth-provider-content-${provider.id}`}
        >
          <span
            className="col-start-1 row-start-1 flex h-8 w-8 items-center justify-center justify-self-center"
            data-testid={`auth-provider-icon-rail-${provider.id}`}
          >
            <AuthProviderIcon provider={provider} />
          </span>
          <span className="col-start-1 row-start-2 min-w-0 whitespace-normal break-words text-center leading-tight [hyphens:manual] [overflow-wrap:break-word] min-[420px]:col-start-2 min-[420px]:row-start-1">
            {label}
          </span>
          <span
            className="hidden h-8 w-8 justify-self-center min-[420px]:col-start-3 min-[420px]:row-start-1 min-[420px]:block"
            aria-hidden="true"
          />
        </span>
      )}
    </button>
  );
}
