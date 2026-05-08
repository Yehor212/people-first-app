import { memo, useEffect, useMemo, useRef } from "react";
import {
  Bell,
  DatabaseBackup,
  Globe2,
  Info,
  Palette,
  ShieldCheck,
  SlidersHorizontal,
  type LucideIcon,
} from "lucide-react";
import { Bloom } from "@/lib/motion";
import { staggerDelay } from "@/lib/motion/choreography";
import { useLanguage } from "@/contexts/LanguageContext";
import { getRoleTone, type NonOrbVisualRole } from "@/lib/nonOrbVisualRoles";
import { V2_NAV_ICONS } from "@/lib/v2IconSystem";
import { ThemeToggleV2 } from "@/components/navigation-v2/ThemeToggleV2";
import { useThemeStore } from "@/stores/themeStore";
import { cn } from "@/lib/utils";
import { APP_VERSION } from "@/lib/appVersion";

interface SettingsSection {
  id: string;
  icon: LucideIcon;
  label: string;
  description: string;
  role: NonOrbVisualRole;
}

export const SettingsPage = memo(function SettingsPage() {
  const { t } = useLanguage();
  const tx = t as unknown as Record<string, string>;
  const mainRef = useRef<HTMLElement>(null);
  const appliedTheme = useThemeStore((s) => s.appliedTheme);
  const settingsTone = getRoleTone("settings");
  const SettingsIcon = V2_NAV_ICONS.settings;

  useEffect(() => {
    mainRef.current?.focus();
  }, []);

  const themeLabel = appliedTheme === "paper" ? tx.themeLight : tx.themeDark;
  const sections = useMemo<SettingsSection[]>(
    () => [
      {
        id: "appearance",
        icon: Palette,
        label: tx.appearance,
        description: `${tx.navV2Theme}: ${themeLabel}`,
        role: "mind",
      },
      {
        id: "notifications",
        icon: Bell,
        label: tx.notifications,
        description: tx.remindersDescription,
        role: "focus",
      },
      {
        id: "language",
        icon: Globe2,
        label: tx.language,
        description: tx.selectLanguage,
        role: "diary",
      },
      {
        id: "privacy",
        icon: ShieldCheck,
        label: tx.settingsGroupSecurity,
        description: tx.settingsSecurityDesc,
        role: "rest",
      },
      {
        id: "data",
        icon: DatabaseBackup,
        label: tx.settingsSectionData,
        description: tx.settingsExportDescription,
        role: "space",
      },
      {
        id: "about",
        icon: Info,
        label: tx.settingsGroupAbout,
        description: `ZenFlow ${APP_VERSION}`,
        role: "settings",
      },
    ],
    [
      themeLabel,
      tx.appearance,
      tx.language,
      tx.navV2Theme,
      tx.notifications,
      tx.remindersDescription,
      tx.selectLanguage,
      tx.settingsExportDescription,
      tx.settingsGroupAbout,
      tx.settingsGroupSecurity,
      tx.settingsSectionData,
      tx.settingsSecurityDesc,
    ],
  );

  return (
    <Bloom key="settings-page" transition={staggerDelay("primary")}>
      <main
        ref={mainRef}
        id="main-content-v2"
        role="main"
        tabIndex={-1}
        className="mx-auto flex min-h-[100svh] max-w-3xl flex-col gap-4 px-4 py-6 outline-none md:px-6 md:py-10"
        aria-labelledby="settings-page-heading"
        data-testid="settings-page"
        data-visual-role="settings"
      >
        <section
          className="relative overflow-hidden rounded-[2rem] border border-[hsl(var(--zf-role-settings)/0.24)] bg-[linear-gradient(145deg,hsl(var(--card)/0.92),hsl(var(--surface-elevated)/0.88)_52%,hsl(var(--zf-role-space)/0.08))] p-5 shadow-[var(--zen-shadow-soft)] backdrop-blur-xl md:p-7"
          data-testid="settings-page-control-card"
        >
          <div
            aria-hidden="true"
            className="absolute -right-16 -top-20 h-44 w-44 rounded-full bg-[hsl(var(--zf-role-settings)/0.12)] blur-3xl"
          />
          <div
            aria-hidden="true"
            className="absolute -bottom-24 left-10 h-56 w-56 rounded-full bg-[hsl(var(--zf-role-rest)/0.10)] blur-3xl"
          />

          <div className="relative flex items-start gap-4">
            <span
              className={cn(
                "flex h-14 w-14 shrink-0 items-center justify-center rounded-3xl border shadow-sm",
                settingsTone.iconClass,
              )}
            >
              <SettingsIcon className="h-6 w-6" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[hsl(var(--zf-role-settings)/0.76)]">
                ZENFLOW
              </p>
              <h1
                id="settings-page-heading"
                className="mt-1 font-display text-3xl font-semibold tracking-tight text-foreground"
              >
                {tx.navV2Settings}
              </h1>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground font-body">
                {tx.navV2SettingsPlaceholder}
              </p>
            </div>
          </div>

          <div className="relative mt-5 rounded-3xl border border-[hsl(var(--border)/0.58)] bg-[hsl(var(--card)/0.72)] p-3 shadow-inner">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[hsl(var(--zf-role-mind)/0.12)] text-[hsl(var(--zf-role-mind))]">
                  <SlidersHorizontal className="h-5 w-5" aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-foreground">
                    {tx.navV2Theme}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {themeLabel}
                  </span>
                </span>
              </div>
              <ThemeToggleV2
                collapsed
                className="rounded-full border border-[hsl(var(--border)/0.55)] bg-[hsl(var(--card)/0.72)] px-2"
                testId="settings-v2-theme-toggle"
              />
            </div>
          </div>
        </section>

        <section
          className="grid gap-3 min-[520px]:grid-cols-2"
          aria-label={tx.navV2Settings}
          data-testid="settings-page-sections"
        >
          {sections.map((item) => {
            const tone = getRoleTone(item.role);
            const Icon = item.icon;
            return (
              <article
                key={item.id}
                className={cn(
                  "relative min-h-[116px] overflow-hidden rounded-3xl border bg-[hsl(var(--card)/0.76)] p-4 shadow-[var(--zen-shadow-card)]",
                  tone.borderClass,
                )}
                data-testid={`settings-section-${item.id}`}
                data-visual-role={item.role}
              >
                <span
                  aria-hidden="true"
                  className={cn("absolute inset-x-5 top-0 h-[2px] rounded-b-full", tone.railClass)}
                />
                <div className="flex items-start gap-3">
                  <span
                    className={cn(
                      "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border",
                      tone.iconClass,
                    )}
                  >
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-foreground">
                      {item.label}
                    </span>
                    <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                      {item.description}
                    </span>
                  </span>
                </div>
              </article>
            );
          })}
        </section>
      </main>
    </Bloom>
  );
});
