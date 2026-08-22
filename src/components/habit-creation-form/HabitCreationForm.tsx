import { useRef, useEffect, useState, type ReactNode, type Ref } from "react";
import { motion } from "framer-motion";
import {
  CalendarDays,
  ChevronDown,
  Palette,
  Route,
  Target,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { zenMotion } from "@/lib/animationUtils";
import { isAndroid } from "@/lib/platform";
import { cn } from "@/lib/utils";
import { V2HabitPictogram } from "@/components/habit-pictogram/V2HabitPictogram";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { frequencyPresets } from "@/hooks/useHabitForm";
import { formatHabitQuantity } from "@/lib/habits";
import { resolveHabitColor } from "@/lib/habitColorUtils";
import {
  getHabitTemplateName,
  habitTemplates,
  resolveHabitTemplateSetup,
} from "@/lib/habitTemplates";
import {
  getRoleTone,
  getTemplateCategoryVisualRole,
  type NonOrbVisualRole,
} from "@/lib/nonOrbVisualRoles";
import {
  getV2HabitTemplatePictogramId,
  resolveV2HabitPictogramId,
} from "@/lib/v2HabitPictograms";
import type { useHabitForm } from "@/hooks/useHabitForm";
import type { Habit } from "@/types";
import { TemplatePicker } from "./TemplatePicker";
import { RemindersSection } from "./RemindersSection";
import {
  IconSelector,
  ColorSelector,
  TypeSelector,
  FrequencySelector,
  CategorySelector,
} from "@/components/habit-creation-form/FormSelectors";
import { NumericalTargetSection } from "./NumericalTargetSection";
import { IdentityMappingSection } from "./IdentityMappingSection";
import { HabitDurationSection } from "./HabitDurationSection";

interface HabitCreationFormProps {
  form: ReturnType<typeof useHabitForm>;
  habits: Habit[];
  isPrimaryCTA?: boolean;
  presentation?: "default" | "v2";
}

type HabitLabSectionId = "tracking" | "rhythm" | "appearance" | "identity";

interface HabitLabPanelProps {
  children: ReactNode;
  icon: LucideIcon;
  isActive?: boolean;
  isElevatedForm: boolean;
  isOpen: boolean;
  onToggle: (section: HabitLabSectionId) => void;
  panelRef?: Ref<HTMLElement>;
  section: HabitLabSectionId;
  summary: ReactNode;
  title: string;
  tone: NonOrbVisualRole;
}

function HabitLabPanel({
  children,
  icon: Icon,
  isActive = false,
  isElevatedForm,
  isOpen,
  onToggle,
  panelRef,
  section,
  summary,
  title,
  tone,
}: HabitLabPanelProps) {
  const roleTone = getRoleTone(tone);
  const triggerId = `habit-lab-panel-${section}-trigger`;
  const contentId = `habit-lab-panel-${section}-content`;

  return (
    <section
      ref={panelRef}
      data-elevated-surface={isElevatedForm ? "panel" : undefined}
      className={cn(
        "relative isolate overflow-hidden rounded-[24px] border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--zf-role-energy)/0.62)] focus-visible:ring-offset-2",
        isElevatedForm
          ? "bg-[linear-gradient(155deg,hsl(var(--zf-night-1)/0.86),hsl(var(--zf-night-0)/0.93))] shadow-[inset_0_1px_0_hsl(var(--foreground)/0.10),0_18px_44px_-36px_hsl(var(--zf-role-energy)/0.62)] " +
              roleTone.borderClass
          : "border-border bg-muted/30",
        isActive && isElevatedForm ? "ring-2 ring-[hsl(var(--zf-role-energy)/0.42)]" : null
      )}
      aria-labelledby={triggerId}
      data-settings-panel={section}
      data-visual-role={tone}
      tabIndex={-1}
    >
      {isElevatedForm && (
        <>
          <span
            className={
              "pointer-events-none absolute inset-x-5 top-0 h-[2px] rounded-b-full " +
              roleTone.railClass
            }
            aria-hidden="true"
          />
          <span
            className={
              "pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full opacity-55 blur-2xl " +
              roleTone.bgClass
            }
            aria-hidden="true"
          />
        </>
      )}
      <div className="relative z-[1]" role="heading" aria-level={3}>
        <button
          id={triggerId}
          type="button"
          aria-expanded={isOpen}
          aria-controls={contentId}
          onClick={() => onToggle(section)}
          className={cn(
            "flex min-h-[58px] w-full items-center gap-2 rounded-[22px] px-3 py-3 text-left motion-safe:transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--zf-role-energy)/0.62)] focus-visible:ring-offset-2",
            isElevatedForm ? "hover:bg-[hsl(var(--foreground)/0.055)]" : "hover:bg-muted/50"
          )}
        >
          <span
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-[16px] border",
              isElevatedForm ? roleTone.iconClass : "border-border bg-background text-foreground"
            )}
            aria-hidden="true"
          >
            <Icon className="h-4 w-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span
              className={cn(
                "block whitespace-normal break-words text-xs font-semibold uppercase tracking-[0.14em]",
                isElevatedForm ? "text-[hsl(var(--zf-text-soft))]" : "text-muted-foreground"
              )}
            >
              {title}
            </span>
            <span
              className={cn(
                "mt-1 block whitespace-normal break-words text-xs font-semibold",
                isElevatedForm ? "text-[hsl(var(--zf-text-strong))]" : "text-foreground"
              )}
            >
              {summary}
            </span>
          </span>
          <ChevronDown
            className={cn(
              "h-4 w-4 shrink-0 motion-safe:transition-transform",
              isOpen ? "rotate-180" : "rotate-0",
              isElevatedForm ? roleTone.textClass : "text-muted-foreground"
            )}
            aria-hidden="true"
          />
        </button>
      </div>
      {isOpen && (
        <motion.div
          id={contentId}
          role="region"
          aria-labelledby={triggerId}
          className="relative z-[1] space-y-3 px-3 pb-3"
          data-settings-panel-content={section}
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={zenMotion.snappy}
        >
          {children}
        </motion.div>
      )}
    </section>
  );
}

interface HabitLabSpecChipProps {
  icon: LucideIcon;
  isElevatedForm: boolean;
  label: string;
  onActivate?: (section: HabitLabSectionId) => void;
  section: HabitLabSectionId;
  tone: NonOrbVisualRole;
  value: string;
}

function HabitLabSpecChip({
  icon: Icon,
  isElevatedForm,
  label,
  onActivate,
  section,
  tone,
  value,
}: HabitLabSpecChipProps) {
  const roleTone = getRoleTone(tone);

  return (
    <button
      type="button"
      onClick={() => onActivate?.(section)}
      data-elevated-surface={isElevatedForm ? "spec" : undefined}
      className={cn(
        "min-h-[44px] min-w-0 rounded-[16px] border px-2.5 py-2 text-left motion-safe:transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--zf-role-energy)/0.62)] focus-visible:ring-offset-2",
        isElevatedForm
          ? "bg-[hsl(var(--zf-night-0)/0.34)] hover:bg-[hsl(var(--zf-night-0)/0.48)] " +
              roleTone.borderClass
          : "border-border bg-background hover:bg-muted/50"
      )}
      aria-label={`${label}: ${value}`}
      aria-controls={`habit-lab-panel-${section}-content`}
      data-advanced-spec={label}
      data-advanced-jump={section}
    >
      <div className="flex items-start gap-1.5">
        <Icon
          className={cn(
            "h-3.5 w-3.5 shrink-0",
            isElevatedForm ? roleTone.textClass : "text-muted-foreground"
          )}
          aria-hidden="true"
        />
        <span
          className={cn(
            "min-w-0 whitespace-normal break-words text-xs font-semibold uppercase tracking-[0.12em]",
            isElevatedForm ? "text-[hsl(var(--zf-text-soft))]" : "text-muted-foreground"
          )}
        >
          {label}
        </span>
      </div>
      <p
        className={cn(
          "mt-1 whitespace-normal break-words text-xs font-semibold [overflow-wrap:anywhere]",
          isElevatedForm ? "text-[hsl(var(--zf-text-strong))]" : "text-foreground"
        )}
      >
        {value}
      </p>
    </button>
  );
}

export function HabitCreationForm({
  form,
  habits,
  isPrimaryCTA = false,
  presentation = "default",
}: HabitCreationFormProps) {
  const { t, language } = useLanguage();
  const ts = t as unknown as Record<string, string>;
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const trackingPanelRef = useRef<HTMLElement | null>(null);
  const rhythmPanelRef = useRef<HTMLElement | null>(null);
  const appearancePanelRef = useRef<HTMLElement | null>(null);
  const identityPanelRef = useRef<HTMLElement | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [activeAdvancedSection, setActiveAdvancedSection] = useState<HabitLabSectionId | null>(
    "tracking"
  );
  const isV2Presentation = presentation === "v2";
  const isElevatedForm = isPrimaryCTA || isV2Presentation;

  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    };
  }, []);

  const {
    isAdding,
    showCustomForm,
    editingHabit,
    selectedTemplateId,
    settingsMode,
    newHabitName,
    selectedIcon,
    selectedColorIndex,
    selectedCategory,
    habitType,
    frequency,
    scheduleMode,
    scheduleDueDays,
    question,
    description,
    targetValue,
    targetType,
    unit,
    targetStep,
    quickEntryMode,
    hasDurationLimit,
    durationDays,
    reminders,
    identityCluster,
    identityVerb,
    identityIcon,
    setShowCustomForm,
    setSettingsMode,
    setNewHabitName,
    setSelectedIcon,
    setSelectedColorIndex,
    setSelectedCategory,
    setHabitType,
    setFrequency,
    setScheduleMode,
    setScheduleDueDays,
    setQuestion,
    setDescription,
    setTargetValue,
    setTargetType,
    setUnit,
    setQuickEntryMode,
    setHasDurationLimit,
    setDurationDays,
    setIdentityCluster,
    setIdentityVerb,
    resetForm,
    handleAddHabit,
    handleQuickAdd,
    handleTemplateUnitChange,
    handleAddReminder,
    handleRemoveReminder,
    handleReminderChange,
  } = form;

  const activeTemplate = selectedTemplateId
    ? (habitTemplates.find((template) => template.id === selectedTemplateId) ?? null)
    : null;
  const templateName = activeTemplate ? getHabitTemplateName(activeTemplate.id, language) : null;
  const templateRole = activeTemplate?.category
    ? getTemplateCategoryVisualRole(activeTemplate.category)
    : "space";
  const templateTone = getRoleTone(templateRole);
  const templateIconValue = activeTemplate
    ? getV2HabitTemplatePictogramId(activeTemplate.id)
    : selectedIcon;
  const templateSymbol = activeTemplate ? activeTemplate.icon : selectedIcon;
  const recommendedQuickEntryMode =
    activeTemplate?.habitType === "numerical"
      ? resolveHabitTemplateSetup(activeTemplate, unit || undefined).quickEntryMode
      : targetType === "atMost"
        ? "limitCheck"
        : undefined;
  const previewIconValue = selectedIcon || templateIconValue;
  const previewSymbol = selectedIcon || templateSymbol;

  const existingClusters = [
    ...new Set(habits.map((h) => h.identityCluster).filter((c): c is string => !!c)),
  ];

  const activePresetIndex = frequencyPresets.findIndex(
    (p) =>
      p.ratio.numerator === frequency.numerator && p.ratio.denominator === frequency.denominator
  );

  if (!isAdding) return null;

  if (!showCustomForm) {
    return (
      <TemplatePicker
        isPrimaryCTA={isElevatedForm}
        presentation={presentation}
        habits={habits}
        language={language}
        t={ts}
        handleQuickAdd={handleQuickAdd}
        setShowCustomForm={setShowCustomForm}
      />
    );
  }

  const freqText =
    activePresetIndex >= 0
      ? ts[frequencyPresets[activePresetIndex].translationId]
      : `${frequency.numerator}x / ${frequency.denominator}${ts.daysAbbr}`;
  const targetPreviewText =
    habitType === "boolean"
      ? ts.habitTypeBoolean
      : targetType === "atMost"
        ? `${ts.atMost} ${formatHabitQuantity(targetValue, unit, language)}`
        : formatHabitQuantity(targetValue, unit, language);
  const effectiveQuickEntryPreviewMode =
    targetType === "atMost"
      ? "limitCheck"
      : quickEntryMode === "limitCheck"
        ? recommendedQuickEntryMode && recommendedQuickEntryMode !== "limitCheck"
          ? recommendedQuickEntryMode
          : "completeTarget"
        : quickEntryMode;
  const quickEntryPreviewText =
    habitType === "numerical"
      ? effectiveQuickEntryPreviewMode === "completeTarget"
        ? ts.habitQuickEntryCompleteTarget || "Mark the target"
        : effectiveQuickEntryPreviewMode === "incrementStep"
          ? ts.habitQuickEntryIncrementStep || "Add one portion"
          : ts.habitQuickEntryLimitCheck || "Stayed within the limit"
      : ts.habitTypeBoolean;
  const durationDayLabel = ts.habitDurationDaysLabel;
  const durationPreviewText = hasDurationLimit
    ? `${durationDays} ${durationDayLabel}`
    : ts.habitDurationOngoing;
  const reminderPreviewText =
    reminders.length > 0
      ? `${reminders.length} ${ts.reminders || "reminders"}`
      : ts.noReminders || "No reminders";
  const appearancePreviewIcon = isElevatedForm
    ? resolveV2HabitPictogramId(selectedIcon)
    : selectedIcon;
  const appearancePreviewText = `${appearancePreviewIcon} · ${ts[selectedCategory] ?? selectedCategory}`;
  const optionalPreviewText = ts.optional
    ? `${ts.optional.charAt(0).toUpperCase()}${ts.optional.slice(1)}`
    : "Optional";
  const identityPreviewText =
    identityCluster || identityVerb
      ? `${identityIcon || selectedIcon || "✦"} ${identityVerb || identityCluster}`
      : optionalPreviewText;

  const showTypeSelector = settingsMode === "advanced" || !selectedTemplateId;
  const showLivePreview = !templateName || settingsMode === "advanced";
  const showTrackingSection = showTypeSelector || habitType === "numerical";
  const settingsSectionClass = cn(
    "relative mb-4 space-y-3 border-l pl-3",
    isElevatedForm ? "border-[hsl(var(--zf-role-energy)/0.26)]" : "border-border"
  );
  const advancedSectionRefs = {
    tracking: trackingPanelRef,
    rhythm: rhythmPanelRef,
    appearance: appearancePanelRef,
    identity: identityPanelRef,
  };
  const handleAdvancedSectionToggle = (section: HabitLabSectionId) => {
    setActiveAdvancedSection((current) => (current === section ? null : section));
  };
  const handleAdvancedSectionJump = (section: HabitLabSectionId) => {
    const target = advancedSectionRefs[section].current;
    if (!target) return;

    setActiveAdvancedSection(section);
    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.requestAnimationFrame(() => {
      target.scrollIntoView({
        behavior: prefersReducedMotion ? "auto" : "smooth",
        block: "start",
      });
      target.focus({ preventScroll: true });
    });
  };
  const advancedFlowItems = [
    {
      icon: Target,
      label: ts.habitType,
      section: "tracking" as HabitLabSectionId,
      tone: "focus" as NonOrbVisualRole,
    },
    {
      icon: CalendarDays,
      label: ts.habitFrequency,
      section: "rhythm" as HabitLabSectionId,
      tone: "body" as NonOrbVisualRole,
    },
    {
      icon: Palette,
      label: ts.appearance,
      section: "appearance" as HabitLabSectionId,
      tone: "energy" as NonOrbVisualRole,
    },
    {
      icon: UserRound,
      label: ts.identityMapping,
      section: "identity" as HabitLabSectionId,
      tone: "rest" as NonOrbVisualRole,
    },
  ];

  return (
    <motion.div
      data-surface={isElevatedForm ? "habit-form" : undefined}
      className={cn(
        "mb-4 p-4 rounded-2xl relative overflow-hidden",
        isElevatedForm
          ? "border border-[hsl(var(--zf-role-energy)/0.28)] bg-[radial-gradient(circle_at_16%_0%,hsl(var(--zf-role-energy)/0.11),transparent_34%),radial-gradient(circle_at_86%_4%,hsl(var(--zf-role-release)/0.09),transparent_30%),linear-gradient(155deg,hsl(var(--zf-night-0)/0.99)_0%,hsl(var(--zf-night-1)/0.97)_58%,hsl(var(--zf-night-0)/0.99)_100%)] shadow-[0_24px_80px_-56px_hsl(var(--zf-role-energy)/0.68)]"
          : "bg-secondary",
        isElevatedForm && !isAndroid
          ? "backdrop-blur-xl [-webkit-backdrop-filter:blur(16px)]"
          : null
      )}
      initial={isAndroid ? false : { opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={zenMotion.gentle}
      onTouchStart={(e) => e.stopPropagation()}
      onTouchMove={(e) => e.stopPropagation()}
      onTouchEnd={(e) => e.stopPropagation()}
    >
      {isElevatedForm && (
        <div className="zf-habit-form-aura pointer-events-none absolute inset-0" />
      )}

      <motion.button
        onClick={() => {
          if (editingHabit) {
            resetForm();
          } else {
            setShowCustomForm(false);
          }
        }}
        className={cn(
          "relative text-sm mb-3 flex items-center gap-1 motion-safe:transition-colors",
          isElevatedForm
            ? "text-[hsl(var(--zf-text-soft))] hover:text-[hsl(var(--zf-text-strong))]"
            : "text-muted-foreground hover:text-foreground"
        )}
        whileHover={{ x: -2 }}
      >
        <span className="inline-block rtl:rotate-180">←</span> {editingHabit ? t.cancel : t.back}
      </motion.button>

      {editingHabit && (
        <div
          className={cn(
            "mb-3 pb-2 border-b",
            isElevatedForm ? "border-foreground/20" : "border-border"
          )}
        >
          <p
            className={cn(
              "text-sm font-medium",
              isElevatedForm ? "text-[hsl(var(--zf-text-strong))]" : "text-foreground"
            )}
          >
            {t.editHabit}
          </p>
        </div>
      )}

      <div className="mb-4 space-y-3">
        {templateName && (
          <div
            data-elevated-surface="template-preview"
            className={cn(
              "relative isolate overflow-hidden rounded-[22px] border px-3 py-3",
              isElevatedForm
                ? "bg-[linear-gradient(155deg,hsl(var(--zf-night-1)/0.84),hsl(var(--zf-night-0)/0.92))] text-[hsl(var(--zf-text-strong))] shadow-[inset_0_1px_0_hsl(var(--foreground)/0.10)] " +
                    templateTone.borderClass
                : "border-border bg-muted/40 text-foreground"
            )}
            data-card="ritual-template-preview"
          >
            {isElevatedForm && (
              <span
                className={
                  "pointer-events-none absolute inset-x-4 top-0 h-[2px] rounded-b-full " +
                  templateTone.railClass
                }
                aria-hidden="true"
              />
            )}
            <div className="relative z-[1] flex items-start gap-3">
              <span
                className={cn(
                  "flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px] border text-[1.7rem]",
                  isElevatedForm
                    ? "bg-[hsl(var(--zf-night-0)/0.46)] " + templateTone.borderClass
                    : "bg-muted/60 border-border"
                )}
                aria-hidden="true"
              >
                {isElevatedForm ? (
                  <V2HabitPictogram value={previewIconValue} className="h-8 w-8" />
                ) : (
                  previewSymbol
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p className="whitespace-normal break-words text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  {ts.habitTemplateBadge}
                </p>
                <p className="mt-1 whitespace-normal break-words text-sm font-semibold leading-tight">
                  {templateName}
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <span
                    className={cn(
                      "max-w-full whitespace-normal break-words rounded-full border px-2 py-1 text-xs font-semibold leading-snug",
                      isElevatedForm
                        ? templateTone.borderClass + " " + templateTone.textClass
                        : "border-border text-muted-foreground"
                    )}
                  >
                    {targetPreviewText}
                  </span>
                  <span
                    className={cn(
                      "max-w-full whitespace-normal break-words rounded-full border px-2 py-1 text-xs font-semibold leading-snug",
                      isElevatedForm
                        ? "border-[hsl(var(--foreground)/0.12)] text-[hsl(var(--zf-text-soft))]"
                        : "border-border text-muted-foreground"
                    )}
                  >
                    {freqText}
                  </span>
                </div>
              </div>
            </div>
            {settingsMode === "simple" && (
              <p className="relative z-[1] mt-3 text-xs leading-snug text-muted-foreground">
                {ts.habitSetupHint}
              </p>
            )}
          </div>
        )}

        <div
          data-elevated-surface={isElevatedForm ? "mode-tabs" : undefined}
          className={cn(
            "inline-flex w-full rounded-2xl p-1",
            isElevatedForm ? "bg-foreground/5 border border-foreground/10" : "bg-muted/50"
          )}
          role="tablist"
          aria-label={ts.settings}
        >
          {(
            [
              ["simple", ts.habitFormSimple],
              ["advanced", ts.habitFormAdvanced],
            ] as const
          ).map(([mode, label]) => {
            const active = settingsMode === mode;
            return (
              <button
                key={mode}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setSettingsMode(mode)}
                className={cn(
                  "min-h-[44px] flex-1 rounded-xl px-3 py-2 text-sm font-medium motion-safe:transition-colors",
                  active
                    ? isElevatedForm
                      ? "border border-[hsl(var(--zf-role-energy)/0.22)] bg-[hsl(var(--zf-role-energy)/0.18)] text-[hsl(var(--zf-text-strong))] shadow-sm"
                      : "bg-background text-foreground shadow-sm"
                    : isElevatedForm
                      ? "text-[hsl(var(--zf-text-soft))] hover:text-[hsl(var(--zf-text-strong))]"
                      : "text-muted-foreground hover:text-foreground"
                )}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {showLivePreview && (
        <motion.div
          data-elevated-surface={isElevatedForm ? "live-preview" : undefined}
          className={cn(
            "relative mb-4 overflow-hidden rounded-[22px] p-4",
            settingsMode === "advanced" && isElevatedForm
              ? "border border-[hsl(var(--zf-role-body)/0.30)] bg-[radial-gradient(circle_at_16%_0%,hsl(var(--zf-role-body)/0.16),transparent_34%),linear-gradient(155deg,hsl(var(--zf-night-1)/0.82),hsl(var(--zf-night-0)/0.93))]"
              : isElevatedForm
                ? "bg-[linear-gradient(135deg,hsl(var(--zf-night-1)/0.74),hsl(var(--zf-role-energy)/0.10)_52%,hsl(var(--zf-night-0)/0.72))] backdrop-blur-sm border border-[hsl(var(--zf-role-energy)/0.24)]"
                : "bg-gradient-to-br from-card/90 to-card/70 backdrop-blur-sm border border-border/50"
          )}
          style={
            isElevatedForm
              ? {
                  boxShadow:
                    "0 0 20px hsl(var(--cosmic-nebula-purple) / 0.1), inset 0 1px 0 hsl(0 0% 100% / 0.05)",
                }
              : {
                  boxShadow: "0 4px 12px -2px hsl(var(--foreground)/0.05)",
                }
          }
          data-preview-mode={settingsMode === "advanced" ? "habit-lab" : "default"}
        >
          {isElevatedForm && (
            <div className="zf-habit-form-shimmer pointer-events-none absolute inset-0 [animation:form-shimmer_3s_linear_2s_infinite]" />
          )}
          <p
            className={cn(
              "relative z-[1] mb-2 text-xs",
              isElevatedForm ? "text-muted-foreground" : "text-muted-foreground"
            )}
          >
            {t.preview}
          </p>
          <div className="relative z-[1] flex items-start gap-3">
            <div
              className="flex h-12 w-12 items-center justify-center rounded-xl text-xl motion-safe:transition-all motion-safe:duration-300"
              style={{ backgroundColor: `${resolveHabitColor(selectedColorIndex)}33` }}
            >
              {isElevatedForm ? (
                <V2HabitPictogram value={selectedIcon} className="h-8 w-8" />
              ) : (
                selectedIcon
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p
                className={cn(
                  "whitespace-normal break-words text-base font-semibold [overflow-wrap:anywhere]",
                  isElevatedForm ? "text-[hsl(var(--zf-text-strong))]" : "text-foreground"
                )}
              >
                {newHabitName || ts.habitNamePlaceholder}
              </p>
              <p
                className={cn(
                  "text-xs",
                  isElevatedForm ? "text-[hsl(var(--zf-text-soft))]" : "text-muted-foreground"
                )}
              >
                {targetPreviewText}
                {" · "}
                {freqText}
                {" · "}
                {durationPreviewText}
              </p>
            </div>
          </div>
          {settingsMode === "advanced" && (
            <div
              className="relative z-[1] mt-3 grid grid-cols-[repeat(auto-fit,minmax(min(100%,calc(9rem*var(--font-scale,1))),1fr))] gap-2"
              data-advanced-preview="habit-spec"
            >
              <HabitLabSpecChip
                icon={Target}
                isElevatedForm={isElevatedForm}
                label={ts.habitType}
                onActivate={handleAdvancedSectionJump}
                section="tracking"
                tone="focus"
                value={targetPreviewText}
              />
              <HabitLabSpecChip
                icon={CalendarDays}
                isElevatedForm={isElevatedForm}
                label={ts.habitFrequency}
                onActivate={handleAdvancedSectionJump}
                section="rhythm"
                tone="body"
                value={freqText}
              />
              <HabitLabSpecChip
                icon={Route}
                isElevatedForm={isElevatedForm}
                label={habitType === "numerical" ? ts.habitQuickEntryMode : ts.duration}
                onActivate={handleAdvancedSectionJump}
                section={habitType === "numerical" ? "tracking" : "rhythm"}
                tone="rest"
                value={habitType === "numerical" ? quickEntryPreviewText : durationPreviewText}
              />
            </div>
          )}
        </motion.div>
      )}

      <input
        type="text"
        value={newHabitName}
        onChange={(e) => setNewHabitName(e.target.value)}
        maxLength={100}
        placeholder={ts.habitName}
        aria-label={ts.habitName}
        className={cn(
          "relative w-full p-3 rounded-xl mb-3 motion-safe:transition-all",
          "focus:outline-none focus:ring-2",
          isElevatedForm
            ? "bg-[hsl(var(--zf-role-body)/0.12)] backdrop-blur-sm border border-[hsl(var(--zf-role-body)/0.34)] text-[hsl(var(--zf-text-strong))] placeholder:text-[hsl(var(--zf-text-soft))] focus:ring-[hsl(var(--zf-role-body)/0.62)] focus:border-[hsl(var(--zf-role-body)/0.48)]"
            : "bg-background text-foreground placeholder:text-muted-foreground focus:ring-primary/30"
        )}
        style={isElevatedForm ? { boxShadow: "inset 0 1px 0 hsl(0 0% 100% / 0.05)" } : undefined}
        autoFocus
        onFocus={(e) => {
          if (isV2Presentation) return;
          const el = e.target;
          if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
          scrollTimeoutRef.current = setTimeout(
            () => el.scrollIntoView({ behavior: "smooth", block: "center" }),
            300
          );
        }}
      />

      {settingsMode === "simple" && (
        <div className={settingsSectionClass} data-settings-section="appearance-basic">
          <IconSelector
            selectedIcon={selectedIcon}
            setSelectedIcon={setSelectedIcon}
            isPrimaryCTA={isElevatedForm}
            ts={ts}
          />
        </div>
      )}

      {settingsMode === "advanced" ? (
        <div className="relative mb-4 space-y-3" data-advanced-layout="habit-lab">
          <div
            data-elevated-surface="advanced-rail"
            className={cn(
              "grid grid-cols-[repeat(auto-fit,minmax(min(100%,calc(7.5rem*var(--font-scale,1))),1fr))] gap-1.5 rounded-[20px] border p-1.5",
              isElevatedForm
                ? "border-[hsl(var(--foreground)/0.10)] bg-[hsl(var(--zf-night-0)/0.38)]"
                : "border-border bg-muted/30"
            )}
            data-advanced-rail="true"
          >
            {advancedFlowItems.map(({ icon: Icon, label, section, tone }) => {
              const roleTone = getRoleTone(tone);
              const isActive = activeAdvancedSection === section;
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => handleAdvancedSectionJump(section)}
                  data-elevated-surface="advanced-rail-item"
                  className={cn(
                    "min-h-[52px] min-w-0 rounded-[16px] border px-2 py-2 text-center motion-safe:transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--zf-role-energy)/0.62)] focus-visible:ring-offset-2",
                    isElevatedForm
                      ? "bg-[hsl(var(--zf-night-1)/0.58)] hover:bg-[hsl(var(--zf-night-1)/0.72)] " +
                          roleTone.borderClass
                      : "border-border bg-background hover:bg-muted/50",
                    isActive && isElevatedForm
                      ? "ring-2 ring-[hsl(var(--zf-role-energy)/0.46)]"
                      : null
                  )}
                  data-advanced-rail-item={tone}
                  data-advanced-jump={section}
                  aria-label={label}
                  aria-controls={`habit-lab-panel-${section}-content`}
                  aria-expanded={isActive}
                >
                  <Icon
                    className={cn(
                      "mx-auto h-4 w-4",
                      isElevatedForm ? roleTone.textClass : "text-muted-foreground"
                    )}
                    aria-hidden="true"
                  />
                  <span
                    className={cn(
                      "mt-1 block whitespace-normal break-words text-xs font-semibold uppercase tracking-[0.08em]",
                      isElevatedForm ? "text-[hsl(var(--zf-text-soft))]" : "text-muted-foreground"
                    )}
                  >
                    {label}
                  </span>
                </button>
              );
            })}
          </div>

          <HabitLabPanel
            icon={Target}
            isActive={activeAdvancedSection === "tracking"}
            isElevatedForm={isElevatedForm}
            isOpen={activeAdvancedSection === "tracking"}
            onToggle={handleAdvancedSectionToggle}
            panelRef={trackingPanelRef}
            section="tracking"
            summary={
              habitType === "numerical"
                ? `${targetPreviewText} · ${quickEntryPreviewText}`
                : targetPreviewText
            }
            title={ts.habitType}
            tone="focus"
          >
            <TypeSelector
              habitType={habitType}
              setHabitType={setHabitType}
              isPrimaryCTA={isElevatedForm}
              ts={ts}
            />
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder={ts.habitQuestion}
              maxLength={200}
              aria-label={ts.habitQuestion}
              className={cn(
                "relative w-full rounded-[16px] p-3 motion-safe:transition-all",
                "focus:outline-none focus:ring-2",
                isElevatedForm
                  ? "bg-[hsl(var(--zf-role-focus)/0.12)] backdrop-blur-sm border border-[hsl(var(--zf-role-focus)/0.34)] text-[hsl(var(--zf-text-strong))] placeholder:text-[hsl(var(--zf-text-soft))] focus:ring-[hsl(var(--zf-role-focus)/0.62)]"
                  : "bg-background text-foreground placeholder:text-muted-foreground focus:ring-primary/30"
              )}
            />
            {habitType === "numerical" && (
              <NumericalTargetSection
                isPrimaryCTA={isElevatedForm}
                ts={ts}
                targetValue={targetValue}
                targetStep={targetStep}
                setTargetValue={setTargetValue}
                targetType={targetType}
                setTargetType={setTargetType}
                quickEntryMode={quickEntryMode}
                setQuickEntryMode={setQuickEntryMode}
                unit={unit}
                setUnit={setUnit}
                recommendedQuickEntryMode={recommendedQuickEntryMode}
                unitOptions={activeTemplate?.setup?.unitOptions}
                onTemplateUnitChange={activeTemplate ? handleTemplateUnitChange : undefined}
              />
            )}
          </HabitLabPanel>

          <HabitLabPanel
            icon={CalendarDays}
            isActive={activeAdvancedSection === "rhythm"}
            isElevatedForm={isElevatedForm}
            isOpen={activeAdvancedSection === "rhythm"}
            onToggle={handleAdvancedSectionToggle}
            panelRef={rhythmPanelRef}
            section="rhythm"
            summary={`${freqText} · ${durationPreviewText} · ${reminderPreviewText}`}
            title={ts.habitFrequency}
            tone="body"
          >
            <FrequencySelector
              frequency={frequency}
              setFrequency={setFrequency}
              scheduleMode={scheduleMode}
              setScheduleMode={setScheduleMode}
              scheduleDueDays={scheduleDueDays}
              setScheduleDueDays={setScheduleDueDays}
              isPrimaryCTA={isElevatedForm}
              ts={ts}
            />
            <HabitDurationSection
              isPrimaryCTA={isElevatedForm}
              ts={ts}
              hasDurationLimit={hasDurationLimit}
              setHasDurationLimit={setHasDurationLimit}
              durationDays={durationDays}
              setDurationDays={setDurationDays}
            />
            <RemindersSection
              isPrimaryCTA={isElevatedForm}
              t={ts}
              reminders={reminders}
              handleAddReminder={handleAddReminder}
              handleRemoveReminder={handleRemoveReminder}
              handleReminderChange={handleReminderChange}
            />
          </HabitLabPanel>

          <HabitLabPanel
            icon={Palette}
            isActive={activeAdvancedSection === "appearance"}
            isElevatedForm={isElevatedForm}
            isOpen={activeAdvancedSection === "appearance"}
            onToggle={handleAdvancedSectionToggle}
            panelRef={appearancePanelRef}
            section="appearance"
            summary={appearancePreviewText}
            title={ts.appearance}
            tone="energy"
          >
            <IconSelector
              selectedIcon={selectedIcon}
              setSelectedIcon={setSelectedIcon}
              isPrimaryCTA={isElevatedForm}
              ts={ts}
            />
            <ColorSelector
              selectedColorIndex={selectedColorIndex}
              setSelectedColorIndex={setSelectedColorIndex}
              isPrimaryCTA={isElevatedForm}
              ts={ts}
            />
            <CategorySelector
              selectedCategory={selectedCategory}
              setSelectedCategory={setSelectedCategory}
              isPrimaryCTA={isElevatedForm}
              ts={ts}
            />
          </HabitLabPanel>

          <HabitLabPanel
            icon={UserRound}
            isActive={activeAdvancedSection === "identity"}
            isElevatedForm={isElevatedForm}
            isOpen={activeAdvancedSection === "identity"}
            onToggle={handleAdvancedSectionToggle}
            panelRef={identityPanelRef}
            section="identity"
            summary={identityPreviewText}
            title={ts.identityMapping}
            tone="rest"
          >
            <IdentityMappingSection
              isPrimaryCTA={isElevatedForm}
              ts={ts}
              identityCluster={identityCluster}
              setIdentityCluster={setIdentityCluster}
              identityVerb={identityVerb}
              setIdentityVerb={setIdentityVerb}
              identityIcon={identityIcon}
              habitIcon={selectedIcon}
              existingClusters={existingClusters}
            />

            <div className="relative">
              <label
                className={cn(
                  "text-sm mb-2 block",
                  isElevatedForm ? "text-[hsl(var(--zf-text-soft))]" : "text-muted-foreground"
                )}
              >
                {ts.habitDescription}:
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={ts.habitDescriptionPlaceholder}
                rows={2}
                className={cn(
                  "w-full resize-none rounded-[16px] p-3 text-sm motion-safe:transition-all",
                  "focus:outline-none focus:ring-2",
                  isElevatedForm
                    ? "bg-foreground/10 border border-foreground/20 text-[hsl(var(--zf-text-strong))] placeholder:text-[hsl(var(--zf-text-soft))] focus:ring-[hsl(var(--zf-role-energy)/0.62)]"
                    : "bg-background text-foreground placeholder:text-muted-foreground focus:ring-primary/30"
                )}
              />
            </div>
          </HabitLabPanel>
        </div>
      ) : (
        <>
          {showTrackingSection && (
            <div className={settingsSectionClass} data-settings-section="tracking">
              {showTypeSelector && (
                <TypeSelector
                  habitType={habitType}
                  setHabitType={setHabitType}
                  isPrimaryCTA={isElevatedForm}
                  ts={ts}
                />
              )}

              {habitType === "numerical" && (
                <NumericalTargetSection
                  isPrimaryCTA={isElevatedForm}
                  ts={ts}
                  targetValue={targetValue}
                  targetStep={targetStep}
                  setTargetValue={setTargetValue}
                  targetType={targetType}
                  setTargetType={setTargetType}
                  quickEntryMode={quickEntryMode}
                  setQuickEntryMode={setQuickEntryMode}
                  unit={unit}
                  setUnit={setUnit}
                  recommendedQuickEntryMode={recommendedQuickEntryMode}
                  unitOptions={activeTemplate?.setup?.unitOptions}
                  onTemplateUnitChange={activeTemplate ? handleTemplateUnitChange : undefined}
                />
              )}
            </div>
          )}

          <div className={settingsSectionClass} data-settings-section="schedule">
            <FrequencySelector
              frequency={frequency}
              setFrequency={setFrequency}
              scheduleMode={scheduleMode}
              setScheduleMode={setScheduleMode}
              scheduleDueDays={scheduleDueDays}
              setScheduleDueDays={setScheduleDueDays}
              isPrimaryCTA={isElevatedForm}
              ts={ts}
            />

            <HabitDurationSection
              isPrimaryCTA={isElevatedForm}
              ts={ts}
              hasDurationLimit={hasDurationLimit}
              setHasDurationLimit={setHasDurationLimit}
              durationDays={durationDays}
              setDurationDays={setDurationDays}
            />
          </div>
        </>
      )}

      {isElevatedForm ? (
        <motion.button
          onClick={(e) => {
            e.preventDefault();
            if (isSaving) return;
            setIsSaving(true);
            handleAddHabit();
          }}
          disabled={!newHabitName.trim() || isSaving}
          className={cn(
            "relative w-full py-3.5 rounded-xl font-semibold motion-safe:transition-all overflow-hidden",
            newHabitName.trim() && !isSaving
              ? "bg-[linear-gradient(135deg,hsl(var(--zf-role-energy)/0.96),hsl(var(--zf-role-body)/0.88))] text-[hsl(var(--zf-night-0))] shadow-[0_18px_42px_-28px_hsl(var(--zf-role-energy)/0.86)]"
              : "bg-foreground/10 text-foreground/60 cursor-not-allowed"
          )}
          whileHover={newHabitName.trim() ? { scale: 1.02 } : {}}
          whileTap={newHabitName.trim() ? { scale: 0.98 } : {}}
        >
          {newHabitName.trim() && (
            <div
              className={cn(
                "absolute inset-0 rounded-xl border-2 [animation:submit-pulse-ring_1.5s_ease-in-out_infinite]",
                editingHabit ? "border-indigo-400/30" : "border-emerald-400/30"
              )}
            />
          )}
          <span className="relative z-10">{editingHabit ? t.saveChanges : t.addHabit}</span>
        </motion.button>
      ) : (
        <Button
          variant={editingHabit ? "default" : "gradient"}
          size="lg"
          onClick={(e) => {
            e.preventDefault();
            if (isSaving) return;
            setIsSaving(true);
            handleAddHabit();
          }}
          disabled={!newHabitName.trim() || isSaving}
          className="w-full"
        >
          {editingHabit ? t.saveChanges : t.addHabit}
        </Button>
      )}
    </motion.div>
  );
}
