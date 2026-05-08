import { memo, useState, type MouseEvent } from "react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  HeartPulse,
  NotebookPen,
  Route,
  ShieldCheck,
  Sparkles,
  Sprout,
  type LucideIcon,
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useShouldAnimate } from "@/hooks/useShouldAnimate";
import { hapticTap } from "@/lib/haptics";
import { cn } from "@/lib/utils";

export type V2PortalTarget = "orb" | "habits" | "diary";

interface V2PortalHrefOptions {
  baseUrl?: string;
  devPreview?: boolean;
  phoneLayout?: boolean;
}

const V2_PORTAL_TARGETS: readonly {
  page: V2PortalTarget;
  labelKey: "v2PortalOrb" | "v2PortalHabits" | "v2PortalDiary";
  icon: LucideIcon;
}[] = [
  { page: "orb", labelKey: "v2PortalOrb", icon: HeartPulse },
  { page: "habits", labelKey: "v2PortalHabits", icon: Sprout },
  { page: "diary", labelKey: "v2PortalDiary", icon: NotebookPen },
];

function getDefaultV2PortalBaseUrl(): string {
  const appBase = import.meta.env?.BASE_URL || "/";
  if (import.meta.env.DEV) {
    return appBase;
  }
  return `${appBase.replace(/\/$/, "")}/v2/`;
}

const PORTAL_SPARKS = [
  "start-[17%] top-[25%]",
  "end-[19%] top-[30%]",
  "start-[28%] top-[56%]",
  "end-[31%] top-[58%]",
] as const;

export function buildV2PortalHref(
  target: V2PortalTarget,
  options: V2PortalHrefOptions = {},
): string {
  const {
    baseUrl = getDefaultV2PortalBaseUrl(),
    devPreview = import.meta.env.DEV,
    phoneLayout = true,
  } = options;
  const base = baseUrl.replace(/\/$/, "");
  const params = new URLSearchParams();
  params.set("nav", "v2");
  if (phoneLayout) {
    params.set("navLayout", "phone");
  }
  if (devPreview) {
    params.set("dev", "true");
  }
  const query = params.toString();
  return `${base}/${target}${query ? `?${query}` : ""}`;
}

function getCurrentV2Href(target: V2PortalTarget): string {
  return buildV2PortalHref(target);
}

interface V2PreviewPortalProps {
  className?: string;
}

export const V2PreviewPortal = memo(function V2PreviewPortal({
  className,
}: V2PreviewPortalProps) {
  const { t } = useLanguage();
  const animate = useShouldAnimate();
  const tx = t as unknown as Record<string, string>;
  const [launchingTarget, setLaunchingTarget] = useState<V2PortalTarget | null>(null);
  const primaryHref = getCurrentV2Href("orb");

  const handleNavigate = (event: MouseEvent<HTMLAnchorElement>, target: V2PortalTarget) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) {
      return;
    }
    if (launchingTarget !== null) {
      event.preventDefault();
      return;
    }
    event.preventDefault();
    void hapticTap();
    const href = getCurrentV2Href(target);
    setLaunchingTarget(target);
    window.setTimeout(() => {
      window.location.assign(href);
    }, animate ? 180 : 0);
  };

  return (
    <motion.section
      data-testid="v1-v2-portal"
      aria-label={tx.v2PortalAria}
      className={cn(
        "relative isolate mb-4 overflow-hidden rounded-[30px] border border-[hsl(var(--zf-role-focus)/0.28)]",
        "bg-[radial-gradient(circle_at_13%_4%,hsl(var(--zf-role-body)/0.34),transparent_31%),radial-gradient(circle_at_87%_18%,hsl(var(--zf-role-focus)/0.36),transparent_35%),radial-gradient(circle_at_53%_110%,hsl(var(--primary)/0.18),transparent_46%),linear-gradient(145deg,hsl(var(--card)/0.98),hsl(var(--surface-elevated)/0.88)_45%,hsl(var(--background)/0.78))]",
        "px-4 py-4 text-[hsl(var(--foreground))] shadow-[0_30px_92px_-58px_hsl(var(--zf-role-focus)/0.68),0_16px_46px_-38px_hsl(var(--foreground)/0.46),inset_0_1px_0_hsl(var(--foreground)/0.14)]",
        "[-webkit-backdrop-filter:blur(22px)] backdrop-blur-xl sm:px-5 sm:py-5",
        className,
      )}
      initial={animate ? { opacity: 0, y: 14, scale: 0.985 } : false}
      animate={
        animate
          ? launchingTarget
            ? { opacity: 0.88, y: -8, scale: 0.985 }
            : { opacity: 1, y: 0, scale: 1 }
          : undefined
      }
      transition={{ duration: 0.28, ease: "easeOut" }}
      data-launching={launchingTarget ?? undefined}
    >
      <span
        className="pointer-events-none absolute inset-0 -z-[1] bg-[linear-gradient(112deg,transparent_0_14%,hsl(var(--zf-role-focus)/0.10)_14%_14.45%,transparent_14.45%_42%,hsl(var(--zf-role-body)/0.12)_42%_42.45%,transparent_42.45%_100%)]"
        aria-hidden="true"
      />
      <span
        className="pointer-events-none absolute -top-10 end-8 -z-[1] h-24 w-28 rotate-12 rounded-full bg-[hsl(var(--zf-role-focus)/0.18)] blur-2xl"
        aria-hidden="true"
      />
      <span
        className="pointer-events-none absolute bottom-0 start-8 -z-[1] h-24 w-40 -rotate-6 rounded-full bg-[hsl(var(--zf-role-body)/0.14)] blur-2xl"
        aria-hidden="true"
      />
      <motion.span
        className="pointer-events-none absolute inset-x-7 top-0 h-[2px] rounded-b-full bg-[linear-gradient(90deg,hsl(var(--zf-role-focus)/0),hsl(var(--zf-role-focus)/0.84),hsl(var(--zf-role-body)/0.82),hsl(var(--zf-role-focus)/0))]"
        aria-hidden="true"
        animate={animate ? { x: ["-10%", "10%", "-10%"], opacity: [0.58, 1, 0.58] } : undefined}
        transition={{ duration: 4.8, repeat: Infinity, ease: "easeInOut" }}
      />

      <div className="grid items-center gap-4 md:grid-cols-[minmax(0,0.92fr)_minmax(16rem,0.58fr)]">
        <div className="min-w-0">
          <p className="inline-flex min-h-[28px] items-center gap-2 rounded-full border border-[hsl(var(--zf-role-body)/0.24)] bg-[hsl(var(--zf-role-body)/0.09)] px-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-[hsl(var(--zf-role-body))]">
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            {tx.v2PortalEyebrow}
          </p>
          <div className="mt-3 flex items-start gap-3">
            <span
              className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-[18px] border border-[hsl(var(--zf-role-focus)/0.34)] bg-[hsl(var(--zf-role-focus)/0.10)] text-[hsl(var(--zf-role-focus))]"
              aria-hidden="true"
            >
              <Route className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h3 className="font-display text-xl font-semibold leading-tight text-[hsl(var(--foreground))] sm:text-2xl">
                {tx.v2PortalTitle}
              </h3>
              <p className="mt-1 max-w-2xl text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">
                {tx.v2PortalBody}
              </p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <a
              href={primaryHref}
              onClick={(event) => handleNavigate(event, "orb")}
              className="group inline-flex min-h-[48px] cursor-pointer items-center justify-center gap-2 rounded-[20px] bg-[linear-gradient(135deg,hsl(var(--zf-role-body)/0.98),hsl(var(--zf-role-focus)/0.92))] px-4 py-3 text-sm font-semibold text-[hsl(var(--zf-night-0))] shadow-[0_20px_44px_-26px_hsl(var(--zf-role-focus)/0.86),inset_0_1px_0_hsl(var(--foreground)/0.16)] outline-none motion-safe:transition-[transform,box-shadow] focus-visible:ring-2 focus-visible:ring-[hsl(var(--zf-role-focus)/0.62)] focus-visible:ring-offset-2 hover:shadow-[0_24px_52px_-26px_hsl(var(--zf-role-body)/0.78),inset_0_1px_0_hsl(var(--foreground)/0.18)] active:scale-[0.98]"
              aria-label={tx.v2PortalAria}
              data-testid="v1-v2-portal-primary"
            >
              {tx.v2PortalCta}
              <ArrowRight
                className="h-4 w-4 shrink-0 motion-safe:transition-transform group-hover:translate-x-0.5 rtl:scale-x-[-1]"
                aria-hidden="true"
              />
            </a>
            <span className="inline-flex min-h-[36px] items-center gap-2 rounded-full border border-[hsl(var(--zf-role-body)/0.22)] bg-[hsl(var(--card)/0.76)] px-3 text-xs font-medium text-[hsl(var(--muted-foreground))] shadow-[inset_0_1px_0_hsl(var(--foreground)/0.08)] [-webkit-backdrop-filter:blur(12px)] backdrop-blur-md">
              <ShieldCheck className="h-4 w-4 text-[hsl(var(--zf-role-body))]" aria-hidden="true" />
              {tx.v2PortalStatus}
            </span>
          </div>
        </div>

        <div
          className="relative min-h-[226px] overflow-hidden rounded-[28px] border border-[hsl(var(--zf-role-focus)/0.34)] bg-[radial-gradient(circle_at_50%_36%,hsl(var(--zf-role-focus)/0.34),transparent_31%),radial-gradient(circle_at_48%_82%,hsl(var(--zf-role-body)/0.18),transparent_36%),linear-gradient(145deg,hsl(var(--background)/0.58),hsl(var(--card)/0.88))] p-3 shadow-[0_20px_52px_-38px_hsl(var(--zf-role-focus)/0.52),inset_0_1px_0_hsl(var(--foreground)/0.12)]"
          data-testid="v1-v2-portal-rift"
        >
          <span
            className="pointer-events-none absolute inset-4 rounded-[24px] border border-dashed border-[hsl(var(--zf-role-focus)/0.24)]"
            aria-hidden="true"
          />
          <span
            className="pointer-events-none absolute inset-x-5 top-[44%] h-[2px] rounded-full bg-[linear-gradient(90deg,hsl(var(--zf-role-focus)/0),hsl(var(--zf-role-focus)/0.58),hsl(var(--zf-role-body)/0.78),hsl(var(--zf-role-focus)/0))]"
            aria-hidden="true"
          />
          <span
            className="pointer-events-none absolute start-5 top-5 rounded-full border border-[hsl(var(--border)/0.38)] bg-[hsl(var(--card)/0.72)] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[hsl(var(--muted-foreground))]"
            aria-hidden="true"
          >
            V1
          </span>
          <span
            className="pointer-events-none absolute end-5 top-5 rounded-full border border-[hsl(var(--zf-role-body)/0.36)] bg-[hsl(var(--zf-role-body)/0.12)] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[hsl(var(--zf-role-body))]"
            aria-hidden="true"
          >
            V2
          </span>
          {PORTAL_SPARKS.map((sparkClass, index) => (
            <motion.span
              key={sparkClass}
              className={cn(
                "pointer-events-none absolute h-1.5 w-1.5 rounded-full bg-[hsl(var(--zf-role-body)/0.86)] shadow-[0_0_18px_hsl(var(--zf-role-body)/0.70)]",
                sparkClass,
              )}
              aria-hidden="true"
              animate={animate ? { opacity: [0.32, 1, 0.32], scale: [0.72, 1.24, 0.72] } : undefined}
              transition={{ duration: 2.8 + index * 0.35, repeat: Infinity, ease: "easeInOut" }}
            />
          ))}
          <div className="pointer-events-none absolute inset-x-0 top-8 flex justify-center" aria-hidden="true">
            <motion.span
              className="absolute h-32 w-32 rounded-full border border-[hsl(var(--zf-role-focus)/0.22)] shadow-[0_0_38px_hsl(var(--zf-role-focus)/0.12)]"
              animate={animate ? { rotate: 360, scale: [0.96, 1.04, 0.96] } : undefined}
              transition={{
                rotate: { duration: 22, repeat: Infinity, ease: "linear" },
                scale: { duration: 5.6, repeat: Infinity, ease: "easeInOut" },
              }}
            />
            <motion.span
              className="absolute h-24 w-24 rounded-full border border-[hsl(var(--zf-role-body)/0.34)] bg-[hsl(var(--zf-role-body)/0.05)]"
              animate={animate ? { rotate: -360, opacity: [0.42, 0.78, 0.42] } : undefined}
              transition={{ duration: 16, repeat: Infinity, ease: "linear" }}
            />
            <motion.span
              className="flex h-[72px] w-[72px] items-center justify-center rounded-full border border-[hsl(var(--zf-role-focus)/0.48)] bg-[radial-gradient(circle_at_34%_28%,hsl(var(--zf-role-body)/0.96),hsl(var(--zf-role-focus)/0.52)_46%,hsl(var(--card)/0.76))] text-[hsl(var(--zf-night-0))] shadow-[0_0_50px_hsl(var(--zf-role-focus)/0.44),0_0_26px_hsl(var(--zf-role-body)/0.24),inset_0_1px_0_hsl(var(--foreground)/0.22)]"
              data-testid="v1-v2-portal-orb-core"
              animate={animate ? { scale: launchingTarget ? 1.12 : [1, 1.05, 1] } : undefined}
              transition={{ duration: 2.8, repeat: launchingTarget ? 0 : Infinity, ease: "easeInOut" }}
            >
              <Sparkles className="h-6 w-6" />
            </motion.span>
          </div>

          <div className="relative z-[1] grid h-full grid-cols-3 items-end gap-2 pt-32">
            {V2_PORTAL_TARGETS.map((target, index) => {
              const Icon = target.icon;
              const href = getCurrentV2Href(target.page);
              return (
                <motion.a
                  key={target.page}
                  href={href}
                  onClick={(event) => handleNavigate(event, target.page)}
                  className="group flex min-h-[76px] cursor-pointer flex-col items-center justify-center gap-1.5 rounded-[21px] border border-[hsl(var(--zf-role-focus)/0.24)] bg-[linear-gradient(160deg,hsl(var(--card)/0.84),hsl(var(--zf-role-focus)/0.08))] px-2 py-2 text-center text-[11px] font-semibold text-[hsl(var(--foreground))] shadow-[0_18px_38px_-28px_hsl(var(--zf-role-focus)/0.48),inset_0_1px_0_hsl(var(--foreground)/0.12)] outline-none [-webkit-backdrop-filter:blur(18px)] backdrop-blur-md motion-safe:transition-[transform,background-color,border-color,box-shadow] hover:-translate-y-0.5 hover:border-[hsl(var(--zf-role-body)/0.42)] hover:bg-[hsl(var(--zf-role-body)/0.10)] hover:shadow-[0_20px_42px_-26px_hsl(var(--zf-role-body)/0.50),inset_0_1px_0_hsl(var(--foreground)/0.14)] focus-visible:ring-2 focus-visible:ring-[hsl(var(--zf-role-focus)/0.62)] focus-visible:ring-offset-2 sm:min-h-[86px] sm:text-xs"
                  data-testid={`v1-v2-portal-${target.page}`}
                  aria-label={`${tx.v2PortalCta}: ${tx[target.labelKey]}`}
                  initial={animate ? { opacity: 0, y: 10 } : false}
                  animate={animate ? { opacity: 1, y: 0 } : undefined}
                  transition={{ duration: 0.24, delay: index * 0.05, ease: "easeOut" }}
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-[16px] border border-[hsl(var(--zf-role-body)/0.34)] bg-[radial-gradient(circle_at_35%_25%,hsl(var(--zf-role-body)/0.24),hsl(var(--card)/0.72))] text-[hsl(var(--zf-role-body))] shadow-[0_0_30px_hsl(var(--zf-role-body)/0.22),inset_0_1px_0_hsl(var(--foreground)/0.12)] motion-safe:transition-transform group-hover:-translate-y-0.5">
                    <Icon className="h-[18px] w-[18px] sm:h-5 sm:w-5" aria-hidden="true" />
                  </span>
                  <span className="max-w-full truncate">{tx[target.labelKey]}</span>
                </motion.a>
              );
            })}
          </div>
        </div>
      </div>
    </motion.section>
  );
});
