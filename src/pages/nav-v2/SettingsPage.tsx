import { Suspense, lazy, memo, useCallback, useEffect, useRef, useState } from "react";
import { Bloom } from "@/lib/motion";
import { staggerDelay } from "@/lib/motion/choreography";
import { useLanguage } from "@/contexts/LanguageContext";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { supabase } from "@/lib/supabaseClient";
import { registerModalCloseCallback } from "@/lib/androidBackHandler";
import { isNative } from "@/lib/platform";
import { useThemeStore } from "@/stores/themeStore";
import { DayCosmicBackground } from "./DayCosmicBackground";
import {
  SettingsHeroCard,
  SettingsModuleList,
  SettingsPageShell,
} from "./settings/components/SettingsPageComponents";
import { SettingsEmeraldNightBackdrop } from "./settings/components/SettingsEmeraldNightBackdrop";
import { V2SettingsControlDeck } from "./settings/V2SettingsControlDeck";
import type { V2SettingsControls, V2SettingsSectionId } from "./settings/types";
import {
  readRequestedSettingsSection,
  resolveInitialSettingsSection,
  updateSettingsSectionUrl,
} from "./settings/settingsNavigation";
import { SettingsSupportFooter } from "./settings/V2SettingsAboutPanel";
import { useSettingsOverviewModules } from "./settings/useSettingsOverviewModules";
import { useSettingsBackdropMotion } from "./settings/useSettingsBackdropMotion";

export type { V2SettingsControls };

const SyncHealthCard = lazy(() =>
  import("@/components/sync/SyncHealthCard").then((module) => ({
    default: module.SyncHealthCard,
  }))
);
const DeviceSessionsCard = lazy(() =>
  import("@/components/sync/DeviceSessionsCard").then((module) => ({
    default: module.DeviceSessionsCard,
  }))
);

interface SettingsPageProps {
  controls?: V2SettingsControls;
}

function resolveAvailableSettingsSection(sectionId: V2SettingsSectionId): V2SettingsSectionId {
  return !isNative && sectionId === "notifications" ? "appearance" : sectionId;
}

export const SettingsPage = memo(function SettingsPage({ controls }: SettingsPageProps) {
  const { t } = useLanguage();
  const tx = t as unknown as Record<string, string>;
  const mainRef = useRef<HTMLElement>(null);
  const pendingMobileFocusRef = useRef<{
    view: "overview" | "detail";
    sectionId: V2SettingsSectionId;
    scrollToTop: boolean;
  } | null>(null);
  const detailPushedRef = useRef(false);
  const requestedSectionAtMountRef = useRef(readRequestedSettingsSection());
  const [selectedSectionId, setSelectedSectionId] = useState<V2SettingsSectionId>(() => {
    return resolveAvailableSettingsSection(
      requestedSectionAtMountRef.current ||
        resolveInitialSettingsSection(controls?.initialOpenSection)
    );
  });
  const [mobileDetailOpen, setMobileDetailOpen] = useState(() =>
    Boolean(requestedSectionAtMountRef.current || controls?.initialOpenSection)
  );
  const desktopLayout = useMediaQuery("(min-width: 1024px)");
  const appliedTheme = useThemeStore((state) => state.appliedTheme);
  const backdropMotionEnabled = useSettingsBackdropMotion(appliedTheme !== "oled");
  const { accountAuth, accountViewState, modules, settingsLead, themeLabel } =
    useSettingsOverviewModules(controls);
  const activeModuleId =
    modules.find((module) => module.id === selectedSectionId)?.id ?? modules[0]?.id;
  const pageHeadingId =
    !desktopLayout && mobileDetailOpen && activeModuleId
      ? `settings-page-heading settings-module-panel-heading-${activeModuleId}`
      : "settings-page-heading";

  useEffect(() => {
    const requestedSection = requestedSectionAtMountRef.current;
    if (!requestedSection) return;

    const availableSection = resolveAvailableSettingsSection(requestedSection);
    if (availableSection !== requestedSection) {
      updateSettingsSectionUrl(availableSection, "replaceState");
    }
  }, []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const activeElement = document.activeElement;
      if (activeElement instanceof HTMLElement && activeElement !== document.body) return;
      mainRef.current?.focus({ preventScroll: true });
    });

    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!controls?.initialOpenSection) return;
    const sectionId = resolveAvailableSettingsSection(
      resolveInitialSettingsSection(controls.initialOpenSection)
    );
    setSelectedSectionId(sectionId);
    setMobileDetailOpen(true);
    updateSettingsSectionUrl(sectionId, "replaceState");
  }, [controls?.initialOpenSection]);

  useEffect(() => {
    const handlePopState = () => {
      const requestedSection = readRequestedSettingsSection();
      if (requestedSection) {
        const availableSection = resolveAvailableSettingsSection(requestedSection);
        if (availableSection !== requestedSection) {
          updateSettingsSectionUrl(availableSection, "replaceState");
        }
        detailPushedRef.current = Boolean(window.history.state?.zenflowSettingsDetail);
        pendingMobileFocusRef.current = {
          view: "detail",
          sectionId: availableSection,
          scrollToTop: true,
        };
        setSelectedSectionId(availableSection);
        setMobileDetailOpen(true);
      } else {
        const sectionToRestore: V2SettingsSectionId = desktopLayout
          ? "appearance"
          : selectedSectionId;
        detailPushedRef.current = false;
        if (desktopLayout) {
          setSelectedSectionId(sectionToRestore);
          window.requestAnimationFrame(() => {
            document.getElementById(`settings-module-card-${sectionToRestore}`)?.focus({
              preventScroll: true,
            });
          });
        } else {
          pendingMobileFocusRef.current = {
            view: "overview",
            sectionId: sectionToRestore,
            scrollToTop: false,
          };
        }
        setMobileDetailOpen(false);
      }
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [desktopLayout, selectedSectionId]);

  function openSection(sectionId: V2SettingsSectionId) {
    if (sectionId === selectedSectionId && (desktopLayout || mobileDetailOpen)) return;

    pendingMobileFocusRef.current = {
      view: "detail",
      sectionId,
      scrollToTop: true,
    };
    setSelectedSectionId(sectionId);
    setMobileDetailOpen(true);
    detailPushedRef.current = true;
    updateSettingsSectionUrl(sectionId, "pushState");
  }

  const closeSection = useCallback(() => {
    if (detailPushedRef.current) {
      window.history.back();
      return;
    }

    pendingMobileFocusRef.current = {
      view: "overview",
      sectionId: selectedSectionId,
      scrollToTop: false,
    };
    setMobileDetailOpen(false);
    updateSettingsSectionUrl(null, "replaceState");
  }, [selectedSectionId]);

  useEffect(() => {
    if (desktopLayout || !mobileDetailOpen) return;
    return registerModalCloseCallback(() => {
      closeSection();
      return true;
    });
  }, [closeSection, desktopLayout, mobileDetailOpen]);

  const handleMobileSurfaceReady = useCallback(
    (view: "overview" | "detail", sectionId: V2SettingsSectionId, element: HTMLElement) => {
      const pending = pendingMobileFocusRef.current;
      if (!pending || pending.view !== view || pending.sectionId !== sectionId) return;
      pendingMobileFocusRef.current = null;

      window.requestAnimationFrame(() => {
        const isMobileWorkspace =
          typeof window.matchMedia !== "function" ||
          window.matchMedia("(max-width: 1023px)").matches;
        if (!isMobileWorkspace || !element.isConnected) return;

        if (view === "detail") {
          if (pending.scrollToTop) window.scrollTo({ top: 0, left: 0, behavior: "auto" });
          element.focus({ preventScroll: true });
          return;
        }

        document.getElementById(`settings-module-card-${sectionId}`)?.focus({
          preventScroll: true,
        });
      });
    },
    []
  );

  return (
    <>
      {appliedTheme === "paper" ? (
        <div
          aria-hidden="true"
          className="settings-day-cosmic-backdrop"
          data-animated={backdropMotionEnabled ? "true" : "false"}
          data-mobile-detail={mobileDetailOpen ? "true" : "false"}
          data-testid="settings-day-cosmic-backdrop"
        >
          <DayCosmicBackground presentation="settings" motionEnabled={backdropMotionEnabled} />
        </div>
      ) : null}
      {appliedTheme === "ink" ? (
        <SettingsEmeraldNightBackdrop
          mobileDetailOpen={mobileDetailOpen}
          motionEnabled={backdropMotionEnabled}
        />
      ) : null}
      <Bloom
        key="settings-page"
        className="relative z-10"
        initial={{ opacity: 0, scale: 1, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 1, y: 8 }}
        transition={staggerDelay("primary")}
      >
        <SettingsPageShell
          ref={mainRef}
          labelledBy={pageHeadingId}
          controlsWired={Boolean(controls)}
          mobileDetailOpen={mobileDetailOpen}
        >
          {desktopLayout || !mobileDetailOpen ? (
            <SettingsHeroCard
              title={tx.navV2Settings}
              lead={settingsLead}
              themeTitle={tx.navV2Theme}
              themeLabel={themeLabel}
              controlsWired={Boolean(controls)}
            />
          ) : (
            <h1 id="settings-page-heading" className="sr-only">
              {tx.navV2Settings}
            </h1>
          )}

          {controls ? (
            <>
              <SettingsModuleList
                items={modules}
                expandedId={selectedSectionId}
                controlsWired={true}
                onOpen={openSection}
                onBack={closeSection}
                backLabel={tx.back}
                desktopLayout={desktopLayout}
                mobileDetailOpen={mobileDetailOpen}
                onMobileSurfaceReady={handleMobileSurfaceReady}
                renderPanel={(item) => (
                  <>
                    <V2SettingsControlDeck
                      controls={controls}
                      selectedSectionId={item.id}
                      accountAuth={accountAuth}
                      accountViewState={accountViewState}
                    />
                    {item.id === "account" && supabase && accountViewState === "signed-in" && (
                      <Suspense fallback={null}>
                        <section
                          aria-label={tx.settingsAccountBackupTitle || "Account & backup"}
                          className="grid min-w-0 gap-3"
                          data-testid="settings-status-overview"
                        >
                          <SyncHealthCard
                            compact
                            dense
                            showHeader
                            allowManualRetry={false}
                            surface="settings-space"
                            quietWhenIdle
                          />
                          <DeviceSessionsCard dense surface="settings" />
                        </section>
                      </Suspense>
                    )}
                  </>
                )}
                label={tx.settings || tx.navV2Settings}
              />
            </>
          ) : (
            <SettingsModuleList
              items={modules}
              expandedId={null}
              controlsWired={false}
              onOpen={openSection}
              onBack={closeSection}
              backLabel={tx.back}
              desktopLayout={desktopLayout}
              mobileDetailOpen={false}
              onMobileSurfaceReady={handleMobileSurfaceReady}
              label={tx.settings || tx.navV2Settings}
              renderPanel={() => null}
            />
          )}
          <SettingsSupportFooter />
        </SettingsPageShell>
      </Bloom>
    </>
  );
});
