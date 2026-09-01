import { forwardRef, type ReactNode } from "react";
import { AnimatePresence } from "framer-motion";
import { ArrowLeft, SlidersHorizontal } from "lucide-react";
import { ThemeToggleV2 } from "@/components/navigation-v2/ThemeToggleV2";
import { useShouldAnimate } from "@/hooks/useShouldAnimate";
import { V2_NAV_ICONS } from "@/lib/v2IconSystem";
import { cn } from "@/lib/utils";
import type { V2SettingsSectionId } from "../types";
import { SettingsModuleCard, type SettingsModuleCardData } from "./SettingsModuleCard";
import { SettingsMotionSurface } from "./SettingsMotionSurface";

export type { SettingsModuleCardData } from "./SettingsModuleCard";

interface SettingsPageShellProps {
  children: ReactNode;
  controlsWired: boolean;
  labelledBy: string;
  mobileDetailOpen: boolean;
}

interface SettingsHeroCardProps {
  title: string;
  lead: string;
  themeTitle: string;
  themeLabel: string;
  controlsWired: boolean;
}

interface SettingsModuleListProps {
  items: SettingsModuleCardData[];
  expandedId: V2SettingsSectionId | null;
  onOpen: (sectionId: V2SettingsSectionId) => void;
  controlsWired: boolean;
  label: string;
  backLabel: string;
  desktopLayout: boolean;
  mobileDetailOpen: boolean;
  onBack: () => void;
  onMobileSurfaceReady: (
    view: "overview" | "detail",
    sectionId: V2SettingsSectionId,
    element: HTMLElement
  ) => void;
  renderPanel: (item: SettingsModuleCardData) => ReactNode;
}

export const SettingsPageShell = forwardRef<HTMLElement, SettingsPageShellProps>(
  function SettingsPageShell({ children, controlsWired, labelledBy, mobileDetailOpen }, ref) {
    return (
      <main
        ref={ref}
        id="main-content-v2"
        role="main"
        tabIndex={-1}
        className={cn(
          "v2-fullscreen-page v2-readable-page v2-readable-page--standard mx-auto grid min-h-[var(--app-viewport-height)] w-full grid-cols-1 content-start outline-none focus-visible:!outline-none",
          controlsWired
            ? "max-w-[52rem] gap-3 ps-[calc(var(--safe-inline-start)_+_var(--v2-phone-drawer-rail))] pe-[max(var(--v2-phone-content-inline-end),var(--safe-inline-end))] pt-[calc(var(--safe-top)+var(--v2-phone-drawer-top-rail))] pb-[calc(var(--safe-bottom)+var(--v2-phone-content-block-end))] sm:pe-[max(24px,var(--safe-inline-end))] sm:pt-[calc(var(--safe-top)+var(--v2-phone-drawer-top-rail))] md:max-w-6xl md:ps-[max(1.5rem,var(--safe-inline-start))] md:pe-[max(1.5rem,var(--safe-inline-end))] md:pt-[calc(var(--safe-top)+1.75rem)] md:pb-[calc(var(--safe-bottom)+2rem)] lg:gap-3"
            : "max-w-6xl gap-2.5 ps-[calc(var(--safe-inline-start)_+_var(--v2-phone-drawer-rail))] pe-[max(var(--v2-phone-content-inline-end),var(--safe-inline-end))] pt-[calc(var(--safe-top)+var(--v2-phone-drawer-top-rail))] pb-[calc(var(--safe-bottom)+var(--v2-phone-content-block-end))] sm:pe-[max(24px,var(--safe-inline-end))] sm:pt-[calc(var(--safe-top)+var(--v2-phone-drawer-top-rail))] md:ps-[max(1.5rem,var(--safe-inline-start))] md:pe-[max(1.5rem,var(--safe-inline-end))] md:pt-[calc(var(--safe-top)+1.5rem)] md:pb-[calc(var(--safe-bottom)+2rem)] lg:gap-3"
        )}
        aria-labelledby={labelledBy}
        data-testid="settings-page"
        data-v2-readable-page="settings"
        data-visual-role="settings"
        data-controls-wired={controlsWired ? "true" : "false"}
        data-mobile-detail={mobileDetailOpen ? "true" : "false"}
      >
        {children}
      </main>
    );
  }
);

export function SettingsHeroCard({
  title,
  lead,
  themeTitle,
  themeLabel,
  controlsWired,
}: SettingsHeroCardProps) {
  const SettingsIcon = V2_NAV_ICONS.settings;

  return (
    <section
      className={cn(
        "relative grid w-full min-w-0 gap-2.5 rounded-[8px] border border-[hsl(var(--settings-v2-border)/0.38)] bg-[hsl(var(--settings-v2-card)/0.68)] shadow-[var(--zen-shadow-card)] md:items-center",
        controlsWired
          ? "place-items-center border-transparent bg-transparent px-0 py-1.5 text-center shadow-none min-[360px]:px-8 sm:px-10 md:py-2"
          : "p-3 md:grid-cols-[minmax(0,1fr)_auto] md:p-3.5"
      )}
      data-compact={controlsWired ? "true" : "false"}
      data-testid="settings-page-control-card"
    >
      <div
        className={cn(
          "flex w-full max-w-full min-w-0 items-start gap-3",
          controlsWired && "flex-col items-center justify-center gap-1 text-center"
        )}
      >
        {!controlsWired ? (
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px] border border-[hsl(var(--settings-v2-border)/0.46)] bg-[hsl(var(--settings-v2-panel)/0.58)] text-[hsl(var(--settings-v2-accent))] shadow-[inset_0_1px_0_hsl(var(--settings-v2-rim-light)/0.24)]">
            <SettingsIcon className="h-5 w-5" aria-hidden="true" />
          </span>
        ) : null}
        <div className="w-full max-w-full min-w-0">
          <p className="sr-only">ZENFLOW</p>
          <h1
            id="settings-page-heading"
            data-testid="settings-page-heading"
            className={cn(
              "max-w-full break-words font-display font-semibold leading-tight tracking-normal text-foreground [hyphens:manual] [overflow-wrap:break-word]",
              controlsWired
                ? "text-lg min-[420px]:text-xl sm:text-3xl md:text-4xl"
                : "text-2xl md:text-3xl"
            )}
          >
            {title}
          </h1>
          <p
            className={cn(
              "mt-1 w-full min-w-0 max-w-2xl break-words font-body text-xs leading-relaxed text-muted-foreground [hyphens:manual] [overflow-wrap:break-word] sm:text-sm",
              controlsWired
                ? "mx-auto block max-w-[15rem] min-[360px]:max-w-[24rem]"
                : "hidden sm:block"
            )}
          >
            {lead}
          </p>
        </div>
      </div>

      {!controlsWired ? (
        <div
          className="flex min-h-[46px] min-w-0 items-center justify-between gap-3 rounded-[8px] border border-[hsl(var(--settings-v2-border)/0.34)] bg-[hsl(var(--settings-v2-shell)/0.36)] px-3 py-2 md:mt-0 md:min-w-[17rem]"
          data-testid="settings-theme-strip"
        >
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[6px] bg-[hsl(var(--settings-v2-accent)/0.1)] text-[hsl(var(--settings-v2-accent))]">
              <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <span className="block break-words text-sm font-semibold text-foreground [hyphens:manual] [overflow-wrap:break-word]">
                {themeTitle}
              </span>
              <span className="block break-words text-xs text-muted-foreground [hyphens:manual] [overflow-wrap:break-word]">
                {themeLabel}
              </span>
            </span>
          </div>
          <ThemeToggleV2 collapsed presentation="settings-card" testId="settings-v2-theme-toggle" />
        </div>
      ) : null}
    </section>
  );
}

export function SettingsModuleList({
  items,
  expandedId,
  onOpen,
  controlsWired,
  label,
  backLabel,
  desktopLayout,
  mobileDetailOpen,
  onBack,
  onMobileSurfaceReady,
  renderPanel,
}: SettingsModuleListProps) {
  const shouldAnimate = useShouldAnimate();
  const detailVisible = desktopLayout || mobileDetailOpen;
  const listVisible = !controlsWired || desktopLayout || !mobileDetailOpen;
  const activeItem = controlsWired
    ? (items.find((item) => item.id === expandedId) ?? items[0])
    : null;
  const activePanelId = activeItem ? `settings-module-panel-${activeItem.id}` : undefined;
  const activeButtonId = activeItem ? `settings-module-card-${activeItem.id}` : undefined;
  const moduleList = listVisible ? (
    <div
      ref={(node) => {
        if (node && !desktopLayout && activeItem) {
          onMobileSurfaceReady("overview", activeItem.id, node);
        }
      }}
      className={cn(
        "order-2 grid min-w-0 rounded-[8px] border border-[hsl(var(--settings-v2-border)/0.52)] bg-[hsl(var(--settings-v2-card)/0.76)] p-1 lg:order-1 lg:sticky lg:top-[calc(var(--safe-top)+1rem)]",
        controlsWired && mobileDetailOpen && "lg:grid"
      )}
      role="list"
      data-containment="group"
      id="settings-module-list"
      data-testid="settings-module-list"
      data-visual-role="settings-group"
    >
      {items.map((item, index) => {
        const expanded = detailVisible && activeItem?.id === item.id;
        const panelId = `settings-module-panel-${item.id}`;
        const buttonId = `settings-module-card-${item.id}`;

        return (
          <SettingsModuleCard
            key={item.id}
            item={item}
            expanded={expanded}
            controlsWired={controlsWired}
            buttonId={buttonId}
            panelId={panelId}
            panelMounted={expanded}
            onOpen={onOpen}
            showSeparator={index > 0}
          />
        );
      })}
    </div>
  ) : null;
  const selectedPanel =
    detailVisible && activeItem && activePanelId && activeButtonId ? (
      <section
        className={cn(
          "order-1 min-w-0 lg:order-2",
          activeItem.id === "appearance" && "w-full justify-self-center lg:justify-self-stretch"
        )}
        data-testid="settings-selected-panel"
        data-selected-section={activeItem.id}
      >
        <button
          type="button"
          onClick={onBack}
          className="mb-2 inline-flex min-h-11 min-w-0 max-w-full items-center gap-2 whitespace-normal break-words rounded-[8px] px-2.5 text-sm font-semibold text-foreground outline-none [hyphens:manual] [overflow-wrap:break-word] transition-colors hover:bg-[hsl(var(--settings-v2-panel)/0.72)] focus-visible:ring-2 focus-visible:ring-[hsl(var(--settings-v2-accent))] focus-visible:ring-offset-2 lg:hidden"
          data-testid="settings-mobile-back"
        >
          <ArrowLeft className="h-4 w-4 shrink-0 rtl:rotate-180" aria-hidden="true" />
          <span className="min-w-0 break-words">{backLabel}</span>
        </button>
        <div
          id={activePanelId}
          role="region"
          aria-labelledby={`settings-module-panel-heading-${activeItem.id}`}
          className="grid min-w-0 scroll-mt-[calc(var(--safe-top)+4rem)] gap-2.5 outline-none sm:scroll-mt-[calc(var(--safe-top)+4rem)] lg:scroll-mt-[calc(var(--safe-top)+1rem)]"
          data-testid={activePanelId}
          data-visual-role="settings-detail-region"
        >
          <h2
            ref={(node) => {
              if (node && !desktopLayout) {
                onMobileSurfaceReady("detail", activeItem.id, node);
              }
            }}
            id={`settings-module-panel-heading-${activeItem.id}`}
            tabIndex={-1}
            className="w-full min-w-0 max-w-full break-words rounded-[6px] px-1 font-display text-sm font-semibold leading-tight text-foreground outline-none [hyphens:manual] [overflow-wrap:break-word] focus-visible:ring-2 focus-visible:ring-[hsl(var(--settings-v2-accent))] focus-visible:ring-offset-2 min-[360px]:text-base min-[420px]:text-lg sm:text-xl"
          >
            {activeItem.label}
          </h2>
          <div
            id="settings-v2-control-deck"
            className="grid min-w-0 gap-2.5"
            data-testid="settings-page-control-deck"
            data-selected-section={activeItem.id}
          >
            {renderPanel(activeItem)}
          </div>
        </div>
      </section>
    ) : null;

  const mobileSurface = mobileDetailOpen && selectedPanel ? selectedPanel : moduleList;

  return (
    <section
      aria-label={label}
      className={cn(
        "grid min-w-0 gap-3",
        controlsWired && "lg:grid-cols-[minmax(15rem,19rem)_minmax(0,1fr)] lg:items-start"
      )}
      data-testid="settings-page-workspace"
      data-layout="control-surface"
      data-mobile-view={mobileDetailOpen ? "detail" : "overview"}
      data-selected-section={activeItem?.id}
    >
      {desktopLayout || !controlsWired ? (
        <>
          {moduleList}
          {selectedPanel}
        </>
      ) : (
        <AnimatePresence initial={false} mode="wait">
          <SettingsMotionSurface
            key={mobileDetailOpen ? `detail-${activeItem?.id ?? "none"}` : "overview"}
            view={mobileDetailOpen ? "detail" : "overview"}
            shouldAnimate={shouldAnimate}
          >
            {mobileSurface}
          </SettingsMotionSurface>
        </AnimatePresence>
      )}
    </section>
  );
}
