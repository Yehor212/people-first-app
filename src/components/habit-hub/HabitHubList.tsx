/**
 * HabitHubList — Loop-style main scrollable content for the Habit Hub tab.
 *
 * Layout: Category filter chips → Sort dropdown → Today checklist →
 *         Other (collapsible) → Archived (collapsible) → Overall score bar → FAB.
 *
 * Detail sheet delegated to HabitDetailSheet (Radix Sheet).
 * Deep Space aesthetic with glassmorphism.
 */

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { ModalErrorBoundary } from "@/components/ErrorBoundary";
import { zenMotion, zenTap } from "@/lib/animationUtils";
import { hapticTap, hapticSelection } from "@/lib/haptics";
import { useLanguage } from "@/contexts/LanguageContext";
import { useBackHandler } from "@/hooks/useBackHandler";
import { useHabitHub, type HabitSortOption } from "@/hooks/useHabitHub";
import { habitCategories } from "@/hooks/useHabitForm";
import { HabitDetailSheet } from "./HabitDetailSheet";
import { AddHabitSheet } from "./AddHabitSheet";
import { HabitListSections } from "./HabitListSections";
import type { Habit, HabitCategory } from "@/types";

const CATEGORY_I18N: Record<string, string> = {
  all: "categoryAll",
  health: "categoryHealth",
  mindfulness: "categoryMindfulness",
  productivity: "categoryProductivity",
  social: "categorySocial",
  creativity: "categoryCreativity",
  finance: "categoryFinance",
  "self-care": "categorySelfCare",
  other: "categoryOther",
};

const SORT_I18N: Record<HabitSortOption, string> = {
  score: "sortByScore",
  name: "sortByName",
  status: "sortByStatus",
  color: "sortByColor",
  manual: "sortByManual",
};

interface HabitHubListProps {
  habits: Habit[];
  onToggleHabit: (habitId: string, date: string) => void;
  onAdjustHabit: (habitId: string, date: string, delta: number) => void;
  onAddHabit: (habit: Habit) => void;
  onDeleteHabit: (habitId: string) => void;
  onUpdateHabit: (habit: Habit) => void;
  onArchiveHabit: (habitId: string) => void;
  onUnarchiveHabit: (habitId: string) => void;
  onSkipHabit: (habitId: string, date: string) => void;
  onUnskipHabit: (habitId: string, date: string) => void;
}

export function HabitHubList({
  habits,
  onToggleHabit,
  onAdjustHabit,
  onAddHabit,
  onDeleteHabit,
  onUpdateHabit,
  onSkipHabit,
  onUnskipHabit,
}: HabitHubListProps) {
  const { t } = useLanguage();
  const ts = t as unknown as Record<string, string>;
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null);
  const [showSortMenu, setShowSortMenu] = useState(false);
  const closeSortMenu = useCallback(() => setShowSortMenu(false), []);

  // P0: Android hardware back must close sort dropdown
  useBackHandler(showSortMenu, closeSortMenu);

  const {
    todayHabits,
    otherHabits,
    archivedHabits,
    scoresMap,
    overallScore,
    categoryFilter,
    setCategoryFilter,
    sortOption,
    setSortOption,
    selectedHabit,
    setSelectedHabit,
  } = useHabitHub(habits);

  const handleSelect = useCallback(
    (habit: Habit) => {
      setShowAddForm(false);
      setSelectedHabit(habit);
    },
    [setSelectedHabit]
  );

  const handleCloseSheet = useCallback(() => {
    setSelectedHabit(null);
  }, [setSelectedHabit]);

  const handleEdit = useCallback(
    (habit: Habit) => {
      setSelectedHabit(null);
      setEditingHabit(habit);
      setShowAddForm(true);
    },
    [setSelectedHabit]
  );

  const handleSortSelect = useCallback(
    (opt: HabitSortOption) => {
      setSortOption(opt);
      setShowSortMenu(false);
    },
    [setSortOption]
  );

  const overallPercent = Math.round(overallScore * 100);

  const categoryChips: Array<{ id: HabitCategory | "all"; icon: string }> = [
    { id: "all", icon: "✦" },
    ...habitCategories,
  ];

  const sortOptions: HabitSortOption[] = ["manual", "score", "name", "status", "color"];
  const sortLabels: Record<HabitSortOption, string> = {
    manual: ts[SORT_I18N.manual] || "Manual",
    score: ts[SORT_I18N.score] || "Score",
    name: ts[SORT_I18N.name] || "Name",
    status: ts[SORT_I18N.status] || "Status",
    color: ts[SORT_I18N.color] || "Color",
  };

  return (
    <div className="space-y-4 pb-32">
      {/* ═══ CATEGORY FILTER CHIPS ═══ */}
      <div className="flex gap-2 overflow-x-auto lg:overflow-x-visible lg:flex-wrap pb-1 -mx-1 px-1 scrollbar-hide">
        {categoryChips.map((cat) => (
          <motion.button
            key={cat.id}
            onClick={() => {
              void hapticSelection();
              setCategoryFilter(cat.id);
            }}
            whileTap={zenTap.button}
            aria-pressed={categoryFilter === cat.id}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap motion-safe:transition-colors",
              "border min-h-[44px]",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50",
              categoryFilter === cat.id
                ? "bg-violet-500/20 border-violet-500/40 text-violet-300"
                : "bg-foreground/[0.03] border-foreground/[0.06] text-muted-foreground hover:bg-foreground/[0.06]"
            )}
          >
            <span>{cat.icon}</span>
            <span>{ts[CATEGORY_I18N[cat.id]] || cat.id}</span>
          </motion.button>
        ))}
      </div>

      {/* ═══ SORT DROPDOWN ═══ */}
      <div className="relative flex justify-end">
        <button
          onClick={() => {
            void hapticTap();
            setShowSortMenu(!showSortMenu);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape" && showSortMenu) {
              e.stopPropagation();
              setShowSortMenu(false);
            }
          }}
          aria-expanded={showSortMenu}
          aria-haspopup="listbox"
          className="flex min-h-[44px] min-w-[44px] max-w-full items-center gap-1.5 whitespace-normal break-words text-start text-xs text-muted-foreground hover:text-muted-foreground motion-safe:transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50"
        >
          <ArrowUpDown className="w-3 h-3" aria-hidden="true" />
          <span>{sortLabels[sortOption]}</span>
        </button>
        <AnimatePresence>
          {showSortMenu && (
            <>
              <div
                className="fixed inset-0 z-[50]"
                aria-hidden="true"
                onClick={() => setShowSortMenu(false)}
              />
              <motion.div
                role="listbox"
                initial={{ opacity: 0, scale: 0.92, y: -4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -2 }}
                transition={zenMotion.snappy}
                className={cn(
                  "absolute end-0 top-full z-[50] max-w-[calc(100vw-2rem)] min-w-[min(12rem,calc(100vw-2rem))] overflow-hidden rounded-xl",
                  "bg-popover border border-border shadow-xl",
                  "ltr:origin-top-right rtl:origin-top-left"
                )}
                onKeyDown={(e) => {
                  if (e.key === "Escape") setShowSortMenu(false);
                }}
              >
                {sortOptions.map((opt) => (
                  <button
                    key={opt}
                    role="option"
                    aria-selected={sortOption === opt}
                    onClick={() => handleSortSelect(opt)}
                    className={cn(
                      "flex min-h-[44px] w-full items-center whitespace-normal break-words px-3 py-2 text-start text-xs motion-safe:transition-colors",
                      sortOption === opt
                        ? "text-violet-300 bg-violet-500/10"
                        : "text-muted-foreground hover:bg-foreground/[0.05]"
                    )}
                  >
                    {sortLabels[opt]}
                  </button>
                ))}
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>

      {/* ═══ HABIT LIST SECTIONS ═══ */}
      <HabitListSections
        todayHabits={todayHabits}
        otherHabits={otherHabits}
        archivedHabits={archivedHabits}
        scoresMap={scoresMap}
        categoryFilter={categoryFilter}
        onToggleHabit={onToggleHabit}
        onAdjustHabit={onAdjustHabit}
        onSelect={handleSelect}
        onAddClick={() => {
          setSelectedHabit(null);
          setShowAddForm(true);
        }}
        onClearFilter={() => setCategoryFilter("all")}
        ts={ts}
      />

      {/* ═══ OVERALL SCORE BAR ═══ */}
      {(todayHabits.length > 0 || otherHabits.length > 0) && (
        <div className="px-1">
          <div className="mb-1 flex items-start justify-between gap-2">
            <span className="min-w-0 whitespace-normal break-words text-xs text-muted-foreground">
              {ts.overallScore || "Overall Score"}
            </span>
            <span
              className={cn(
                "text-xs font-bold tabular-nums",
                overallPercent >= 60
                  ? "text-emerald-400"
                  : overallPercent >= 30
                    ? "text-amber-400"
                    : "text-muted-foreground"
              )}
            >
              {overallPercent}%
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-foreground/[0.06] overflow-hidden">
            <div
              className="h-full rounded-full motion-safe:transition-all motion-safe:duration-500"
              style={{
                width: `${overallPercent}%`,
                backgroundColor:
                  overallPercent >= 60
                    ? "hsl(var(--mood-great))"
                    : overallPercent >= 30
                      ? "hsl(var(--mood-good))"
                      : "hsl(var(--muted-foreground))",
              }}
            />
          </div>
        </div>
      )}

      {/* ═══ FAB — Add Habit ═══ */}
      <div className="fixed end-[max(1.25rem,var(--safe-inline-end))] bottom-[calc(7rem+var(--safe-bottom))] z-[45]">
        <motion.button
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ ...zenMotion.bouncy, delay: 0.3 }}
          whileTap={zenTap.button}
          whileHover={{ scale: 1.05 }}
          // A11Y-OK: aria-label is set below via ts.addHabit fallback
          onClick={() => {
            void hapticTap();
            setSelectedHabit(null);
            setShowAddForm(true);
          }}
          className={cn(
            "w-14 h-14 rounded-2xl flex items-center justify-center",
            "bg-primary shadow-zen-lg shadow-primary/20",
            "hover:shadow-primary/40",
            "text-primary-foreground"
          )}
          aria-label={ts.addHabit || "Add habit"}
        >
          <Plus className="w-6 h-6" strokeWidth={2.5} />
        </motion.button>
      </div>

      {/* ═══ Detail Sheet (Radix-based) ═══ */}
      <HabitDetailSheet
        habit={selectedHabit}
        onClose={handleCloseSheet}
        onEdit={handleEdit}
        onUpdate={onUpdateHabit}
        onSkip={onSkipHabit}
        onUnskip={onUnskipHabit}
        onDelete={onDeleteHabit}
      />

      {/* ═══ Add / Edit Habit Sheet ═══ */}
      <ModalErrorBoundary fallbackTitle={ts.addHabitError || "Add Habit Error"}>
        <AddHabitSheet
          open={showAddForm}
          onClose={() => {
            setShowAddForm(false);
            setEditingHabit(null);
          }}
          onAdd={onAddHabit}
          onUpdate={onUpdateHabit}
          editingHabit={editingHabit}
          activeHabitCount={habits.filter((h) => !h.isArchived).length}
        />
      </ModalErrorBoundary>
    </div>
  );
}
