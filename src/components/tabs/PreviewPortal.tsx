import { memo, useState, type CSSProperties, type MouseEvent } from "react";
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

const PORTAL_SPARKS = [
  { insetInlineStart: "17%", top: "25%" },
  { insetInlineEnd: "19%", top: "30%" },
  { insetInlineStart: "28%", top: "56%" },
  { insetInlineEnd: "31%", top: "58%" },
] satisfies readonly CSSProperties[];

export function buildV2PortalHref(
  target: V2PortalTarget,
  options: V2PortalHrefOptions = {},
): string {
  const {
    baseUrl = import.meta.env?.BASE_URL || "/",
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
        "v2-preview-portal relative isolate mb-4 overflow-hidden px-4 py-4 sm:px-5 sm:py-5",
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
        className="v2-preview-portal__scan pointer-events-none absolute inset-0"
        aria-hidden="true"
      />
      <span
        className="v2-preview-portal__focus-glow pointer-events-none absolute -top-10 end-8 h-24 w-28 rotate-12 rounded-full blur-2xl"
        aria-hidden="true"
      />
      <span
        className="v2-preview-portal__body-glow pointer-events-none absolute bottom-0 start-8 h-24 w-40 -rotate-6 rounded-full blur-2xl"
        aria-hidden="true"
      />
      <motion.span
        className="v2-preview-portal__top-rail pointer-events-none absolute inset-x-7 top-0 h-[2px] rounded-b-full"
        aria-hidden="true"
        animate={animate ? { x: ["-10%", "10%", "-10%"], opacity: [0.58, 1, 0.58] } : undefined}
        transition={{ duration: 4.8, repeat: Infinity, ease: "easeInOut" }}
      />

      <div className="grid items-center gap-4 md:grid-cols-[minmax(0,0.92fr)_minmax(16rem,0.58fr)]">
        <div className="min-w-0">
          <p className="v2-preview-portal__eyebrow inline-flex min-h-[28px] items-center gap-2 rounded-full border px-3 text-[11px] font-semibold uppercase tracking-[0.14em]">
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            {tx.v2PortalEyebrow}
          </p>
          <div className="mt-3 flex items-start gap-3">
            <span
              className="v2-preview-portal__route-glyph mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center"
              aria-hidden="true"
            >
              <Route className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h3 className="font-display text-xl font-semibold leading-tight sm:text-2xl">
                {tx.v2PortalTitle}
              </h3>
              <p className="v2-preview-portal__body mt-1 max-w-2xl text-sm leading-relaxed">
                {tx.v2PortalBody}
              </p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <a
              href={primaryHref}
              onClick={(event) => handleNavigate(event, "orb")}
              className="v2-preview-portal__cta group inline-flex min-h-[48px] cursor-pointer items-center justify-center gap-2 px-4 py-3 text-sm font-semibold outline-none motion-safe:transition-[transform,box-shadow] focus-visible:ring-2 focus-visible:ring-offset-2 active:scale-[0.98]"
              aria-label={tx.v2PortalAria}
              data-testid="v1-v2-portal-primary"
            >
              {tx.v2PortalCta}
              <ArrowRight
                className="h-4 w-4 shrink-0 motion-safe:transition-transform group-hover:translate-x-0.5 rtl:scale-x-[-1]"
                aria-hidden="true"
              />
            </a>
            <span className="v2-preview-portal__status inline-flex min-h-[36px] items-center gap-2 rounded-full border px-3 text-xs font-medium">
              <ShieldCheck className="h-4 w-4" aria-hidden="true" />
              {tx.v2PortalStatus}
            </span>
          </div>
        </div>

        <div
          className="v2-preview-portal__rift relative overflow-hidden p-3"
          data-testid="v1-v2-portal-rift"
        >
          <span className="v2-preview-portal__chamber-grid pointer-events-none absolute inset-0" aria-hidden="true" />
          <span className="v2-preview-portal__chamber-vignette pointer-events-none absolute inset-0" aria-hidden="true" />
          <span
            className="v2-preview-portal__portal v2-preview-portal__portal--v1 pointer-events-none absolute"
            data-testid="v1-v2-portal-ring-v1"
            aria-hidden="true"
          >
            <span className="v2-preview-portal__portal-core" />
            <span className="v2-preview-portal__portal-slit" />
          </span>
          <span
            className="v2-preview-portal__portal v2-preview-portal__portal--v2 pointer-events-none absolute"
            data-testid="v1-v2-portal-ring-v2"
            aria-hidden="true"
          >
            <span className="v2-preview-portal__portal-core" />
            <span className="v2-preview-portal__portal-slit" />
          </span>
          <span className="v2-preview-portal__bridge-beam pointer-events-none absolute" aria-hidden="true">
            <span className="v2-preview-portal__bridge-pulse" />
          </span>
          <span className="v2-preview-portal__floor-plate pointer-events-none absolute" aria-hidden="true" />
          <span
            className="v2-preview-portal__rift-frame pointer-events-none absolute inset-4 rounded-[24px] border border-dashed"
            aria-hidden="true"
          />
          <span
            className="v2-preview-portal__rift-line pointer-events-none absolute inset-x-5 top-[44%] h-[2px] rounded-full"
            aria-hidden="true"
          />
          <span
            className="v2-preview-portal__rift-label v2-preview-portal__rift-label--v1 pointer-events-none absolute start-5 top-5 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em]"
            aria-hidden="true"
          >
            V1
          </span>
          <span
            className="v2-preview-portal__rift-label v2-preview-portal__rift-label--v2 pointer-events-none absolute end-5 top-5 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em]"
            aria-hidden="true"
          >
            V2
          </span>
          {PORTAL_SPARKS.map((sparkStyle, index) => (
            <motion.span
              key={`${sparkStyle.top}-${index}`}
              className="v2-preview-portal__spark pointer-events-none absolute h-1.5 w-1.5 rounded-full"
              style={sparkStyle}
              aria-hidden="true"
              animate={animate ? { opacity: [0.32, 1, 0.32], scale: [0.72, 1.24, 0.72] } : undefined}
              transition={{ duration: 2.8 + index * 0.35, repeat: Infinity, ease: "easeInOut" }}
            />
          ))}
          <div className="pointer-events-none absolute inset-x-0 top-8 flex justify-center" aria-hidden="true">
            <motion.span
              className="v2-preview-portal__orbit-outer absolute h-32 w-32 rounded-full border"
              animate={animate ? { rotate: 360, scale: [0.96, 1.04, 0.96] } : undefined}
              transition={{ rotate: { duration: 22, repeat: Infinity, ease: "linear" }, scale: { duration: 5.6, repeat: Infinity, ease: "easeInOut" } }}
            />
            <motion.span
              className="v2-preview-portal__orbit-inner absolute h-24 w-24 rounded-full border"
              animate={animate ? { rotate: -360, opacity: [0.42, 0.78, 0.42] } : undefined}
              transition={{ duration: 16, repeat: Infinity, ease: "linear" }}
            />
            <motion.span
              className="v2-preview-portal__orb-core flex h-[72px] w-[72px] items-center justify-center rounded-full border"
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
                  className="v2-preview-portal__target group flex min-h-[76px] cursor-pointer flex-col items-center justify-center gap-1.5 px-2 py-2 text-center text-[11px] font-semibold outline-none motion-safe:transition-[transform,background-color,border-color,box-shadow] hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-offset-2 sm:min-h-[86px] sm:text-xs"
                  data-testid={`v1-v2-portal-${target.page}`}
                  aria-label={`${tx.v2PortalCta}: ${tx[target.labelKey]}`}
                  initial={animate ? { opacity: 0, y: 10 } : false}
                  animate={animate ? { opacity: 1, y: 0 } : undefined}
                  transition={{ duration: 0.24, delay: index * 0.05, ease: "easeOut" }}
                >
                  <span className="v2-preview-portal__target-icon flex h-10 w-10 items-center justify-center motion-safe:transition-transform group-hover:-translate-y-0.5">
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
