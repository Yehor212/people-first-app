import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { BookOpen, Lock, ChevronRight, X, Settings } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { cn, getToday } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { useScrollLock } from '@/hooks/useScrollLock';
import { registerModalCloseCallback } from '@/lib/androidBackHandler';
import { useJournal } from './useJournal';
import { useJournalSecurity } from './useJournalSecurity';
import { JournalLockScreen } from './JournalLockScreen';
import { JournalEntryList } from './JournalEntryList';
import { JournalEntryEditor } from './JournalEntryEditor';
import { JournalEntryViewer } from './JournalEntryViewer';
import { JournalCalendar } from './JournalCalendar';
import { getEntryCount } from './journalStorage';
import { useJournalReminder, getDaysSinceLastEntry } from './useJournalReminder';

type ModuleState = 'card' | 'open';

export function JournalModule() {
  const { t, isRTL } = useLanguage();
  const ts = t as unknown as Record<string, string>;
  const [moduleState, setModuleState] = useState<ModuleState>('card');
  const [entryCount, setEntryCount] = useState(0);
  const [showPasswordSettings, setShowPasswordSettings] = useState(false);
  const [showForgotDialog, setShowForgotDialog] = useState(false);

  const journal = useJournal();
  const security = useJournalSecurity();
  const reminder = useJournalReminder({
    reminderTitle: ts.journalReminderNotifTitle || 'Time to Journal',
    reminderBody: ts.journalReminderNotifBody || 'Take a moment to capture your thoughts and feelings.',
  });

  // Undo delete ref
  const deletedEntryRef = useRef<{ id: string; data: typeof journal.entries[0] } | null>(null);

  // Streak calculation from all entry dates
  const streak = useMemo(() => {
    const allDates = [...journal.entryDates.keys()].sort().reverse();
    if (allDates.length === 0) return 0;
    const todayStr = getToday();
    const yesterday = new Date(Date.now() - 86400000);
    const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
    if (allDates[0] !== todayStr && allDates[0] !== yesterdayStr) return 0;
    let count = 1;
    for (let i = 1; i < allDates.length; i++) {
      const prev = new Date(allDates[i - 1] + 'T00:00:00');
      const curr = new Date(allDates[i] + 'T00:00:00');
      const diffDays = Math.round((prev.getTime() - curr.getTime()) / 86400000);
      if (diffDays === 1) { count++; } else { break; }
    }
    return count;
  }, [journal.entryDates]);

  const daysSinceLastEntry = useMemo(() => getDaysSinceLastEntry(journal.entryDates), [journal.entryDates]);

  // Scroll lock when journal is open
  useScrollLock(moduleState === 'open');

  // Load entry count for card preview
  useEffect(() => {
    getEntryCount().then(setEntryCount);
  }, [journal.totalCount]);

  // Android back button handling
  useEffect(() => {
    if (moduleState !== 'open') return;
    if (showForgotDialog) return registerModalCloseCallback(() => { setShowForgotDialog(false); return true; });
    if (showPasswordSettings) return registerModalCloseCallback(() => { setShowPasswordSettings(false); return true; });
    if (journal.view !== 'list') {
      return registerModalCloseCallback(() => { journal.goBack(); return true; });
    }
    return registerModalCloseCallback(() => {
      setModuleState('card');
      security.lock();
      return true;
    });
  }, [moduleState, journal.view, journal.goBack, showForgotDialog, showPasswordSettings, security]);

  // Security touch on interaction
  useEffect(() => {
    if (moduleState === 'open') security.touch();
  }, [moduleState, journal.view, security.touch]);

  const handleOpen = () => {
    setModuleState('open');
  };

  const handleClose = () => {
    journal.goBack();
    setModuleState('card');
    security.lock();
  };

  const handleNewEntry = () => {
    journal.editEntry(null);
  };

  const handleSaveEntry = useCallback(async (data: Parameters<typeof journal.createEntry>[0]) => {
    if (journal.activeEntryId) {
      await journal.updateEntry(journal.activeEntryId, data);
    } else {
      await journal.createEntry(data);
    }
  }, [journal]);

  const handleDeleteEntry = useCallback(async (id: string) => {
    // Find the entry before deleting for undo
    const entry = journal.entries.find(e => e.id === id);

    // Immediately delete
    await journal.deleteEntry(id);

    if (!entry) return;

    deletedEntryRef.current = { id, data: entry };

    // Show undo toast
    toast(ts.journalEntryDeleted || 'Entry deleted', {
      action: {
        label: ts.journalUndo || 'Undo',
        onClick: async () => {
          if (deletedEntryRef.current?.id === id) {
            await journal.createEntry({
              title: entry.title,
              content: entry.content,
              stickers: entry.stickers,
              photoIds: entry.photoIds,
              mood: entry.mood,
              tags: entry.tags,
              date: entry.date,
            });
            deletedEntryRef.current = null;
          }
        },
      },
      duration: 5000,
    });
  }, [journal, ts]);

  const handleForgotPassword = () => {
    setShowForgotDialog(true);
  };

  const handleResetPassword = async () => {
    await security.removePassword();
    setShowForgotDialog(false);
  };

  // ── Card View (collapsed in garden tab) ──
  if (moduleState === 'card') {
    return (
      <motion.button
        whileTap={{ scale: 0.97 }}
        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
        onClick={handleOpen}
        className={cn(
          'w-full rounded-2xl p-4',
          'bg-gradient-to-br from-card/80 to-card/60',
          'backdrop-blur-sm border border-border/30',
          'shadow-[0_2px_20px_rgba(var(--primary-rgb,99,102,241),0.08)]',
          'flex items-center gap-3 text-left',
          'transition-shadow duration-300',
          'hover:shadow-[0_4px_25px_rgba(var(--primary-rgb,99,102,241),0.12)]',
        )}
      >
        <motion.div
          animate={{ scale: [1, 1.05, 1] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-gradient-to-br from-primary/15 to-primary/5"
        >
          {security.hasPassword ? (
            <Lock className="w-5 h-5 text-primary" />
          ) : (
            <BookOpen className="w-5 h-5 text-primary" />
          )}
        </motion.div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-foreground">
            {ts.journalTitle || 'Personal Journal'}
          </h3>
          <p className="text-xs text-muted-foreground">
            {entryCount > 0
              ? streak > 0
                ? `${entryCount} ${ts.journalEntries || 'entries'} \u00B7 ${streak} ${ts.journalDayStreak || 'day streak'} \u{1F525}`
                : `${entryCount} ${ts.journalEntries || 'entries'}`
              : (ts.journalSubtitle || 'Start writing your thoughts')}
          </p>
        </div>
        {entryCount > 0 && (
          <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full flex-shrink-0">
            {entryCount}
          </span>
        )}
        <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
      </motion.button>
    );
  }

  // ── Full-screen overlay ──
  return (
    <div
      className="fixed inset-0 z-[60] bg-background flex flex-col animate-slide-up"
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      {/* Security gate */}
      {security.isLocked && !security.loading && (
        <>
          {/* Header with close */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/30">
            <h2 className="text-base font-bold text-foreground">
              {ts.journalTitle || 'Personal Journal'}
            </h2>
            <button onClick={handleClose} className="p-2 rounded-lg hover:bg-muted/50 min-w-[44px] min-h-[44px] flex items-center justify-center">
              <X className="w-5 h-5 text-foreground" />
            </button>
          </div>
          <JournalLockScreen
            mode="unlock"
            cooldownRemaining={security.cooldownRemaining}
            failedAttempts={security.failedAttempts}
            onUnlock={security.unlock}
            onSetPassword={security.setPassword}
            onForgotPassword={handleForgotPassword}
          />

          {/* Forgot password dialog */}
          {showForgotDialog && (
            <div className="fixed inset-0 z-[70] bg-black/50 flex items-center justify-center animate-fade-in" onClick={() => setShowForgotDialog(false)}>
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-card rounded-2xl p-5 max-w-[300px] mx-4 shadow-xl"
                onClick={e => e.stopPropagation()}
              >
                <h3 className="text-base font-semibold text-foreground mb-2">
                  {ts.journalPasswordForgot || 'Forgot Password?'}
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {ts.journalPasswordForgotInfo || 'Your entries will remain, but the journal lock will be removed.'}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowForgotDialog(false)}
                    className="flex-1 py-2.5 rounded-xl bg-muted text-foreground text-sm font-medium min-h-[44px]"
                  >
                    {ts.cancel || 'Cancel'}
                  </button>
                  <button
                    onClick={handleResetPassword}
                    className="flex-1 py-2.5 rounded-xl bg-destructive text-white text-sm font-medium min-h-[44px]"
                  >
                    {ts.journalPasswordRemove || 'Remove Lock'}
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </>
      )}

      {/* Password setup (first time, no password yet) */}
      {!security.loading && security.hasPassword === false && moduleState === 'open' && !journal.loading && journal.totalCount === 0 && showPasswordSettings && (
        <>
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/30">
            <h2 className="text-base font-bold text-foreground">
              {ts.journalPasswordSetup || 'Set Journal Password'}
            </h2>
            <button onClick={() => setShowPasswordSettings(false)} className="p-2 rounded-lg hover:bg-muted/50 min-w-[44px] min-h-[44px] flex items-center justify-center">
              <X className="w-5 h-5 text-foreground" />
            </button>
          </div>
          <JournalLockScreen
            mode="setup"
            cooldownRemaining={0}
            failedAttempts={0}
            onUnlock={async () => false}
            onSetPassword={security.setPassword}
          />
        </>
      )}

      {/* Main content (unlocked or no password) */}
      {!security.isLocked && !security.loading && !(showPasswordSettings && security.hasPassword === false && journal.totalCount === 0) && (
        <>
          {/* Editor overlays on top with its own fixed positioning */}
          {journal.view === 'editing' && (
            <JournalEntryEditor
              entry={journal.activeEntry}
              onSave={handleSaveEntry}
              onAddPhoto={journal.addPhoto}
              onRemovePhoto={journal.removePhoto}
              onDelete={journal.activeEntryId ? () => handleDeleteEntry(journal.activeEntryId) : undefined}
              onBack={journal.goBack}
            />
          )}

          {/* List / Viewer crossfade (opacity only — no transform to avoid breaking fixed children) */}
          <AnimatePresence mode="wait">
            {journal.view === 'viewing' && journal.activeEntry && (
              <motion.div
                key="viewing"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="flex flex-col flex-1 min-h-0"
              >
                <JournalEntryViewer
                  entry={journal.activeEntry}
                  onEdit={() => journal.editEntry(journal.activeEntryId)}
                  onDelete={() => handleDeleteEntry(journal.activeEntry?.id || '')}
                  onBack={journal.goBack}
                />
              </motion.div>
            )}

            {journal.view === 'list' && (
              <motion.div
                key="list"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="flex flex-col flex-1 min-h-0"
              >
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-border/30 bg-background/80 backdrop-blur-xl">
                  <h2 className="text-base font-bold text-foreground">
                    {ts.journalTitle || 'Personal Journal'}
                  </h2>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setShowPasswordSettings(true)}
                      className="p-2 rounded-lg hover:bg-muted/50 text-muted-foreground min-w-[44px] min-h-[44px] flex items-center justify-center"
                      title={ts.journalSettings || 'Journal settings'}
                    >
                      <Settings className="w-4 h-4" />
                    </button>
                    <button onClick={handleClose} className="p-2 rounded-lg hover:bg-muted/50 min-w-[44px] min-h-[44px] flex items-center justify-center">
                      <X className="w-5 h-5 text-foreground" />
                    </button>
                  </div>
                </div>

                {/* Calendar strip */}
                <div className="px-4 py-2 border-b border-border/10">
                  <JournalCalendar
                    entryDates={journal.entryDates}
                    selectedDate={journal.selectedDate}
                    onSelectDate={journal.setSelectedDate}
                  />
                </div>

                {/* Entry list */}
                <div className="flex-1 overflow-y-auto px-4 py-3">
                  <JournalEntryList
                    groupedEntries={journal.groupedEntries}
                    onOpenEntry={journal.openEntry}
                    onDeleteEntry={handleDeleteEntry}
                    onNewEntry={handleNewEntry}
                    totalCount={journal.totalCount}
                    loading={journal.loading}
                    daysSinceLastEntry={daysSinceLastEntry}
                  />
                </div>

                {/* Password settings bottom sheet */}
                {showPasswordSettings && (
                  <>
                    <div className="fixed inset-0 z-[64] bg-black/30 animate-fade-in" onClick={() => setShowPasswordSettings(false)} />
                    <div
                      className="fixed bottom-0 left-0 right-0 z-[65] animate-slide-up"
                      onClick={e => e.stopPropagation()}
                    >
                      {/* Handle bar */}
                      <div className="flex justify-center pt-2 pb-1 bg-card rounded-t-2xl">
                        <div className="w-10 h-1 rounded-full bg-muted-foreground/20" />
                      </div>
                      <div className="bg-card p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
                        <h3 className="text-base font-semibold text-foreground mb-4">
                          {ts.journalSettings || 'Journal Settings'}
                        </h3>
                        {security.hasPassword ? (
                          <button
                            onClick={async () => { await security.removePassword(); setShowPasswordSettings(false); }}
                            className="w-full py-3 rounded-xl bg-destructive/10 text-destructive text-sm font-medium min-h-[44px]"
                          >
                            {ts.journalPasswordRemove || 'Remove Password Lock'}
                          </button>
                        ) : (
                          <div>
                            <p className="text-sm text-muted-foreground mb-3">
                              {ts.journalPasswordHint || 'Protect your journal with a password'}
                            </p>
                            <JournalLockScreen
                              mode="setup"
                              cooldownRemaining={0}
                              failedAttempts={0}
                              onUnlock={async () => false}
                              onSetPassword={async (pw) => {
                                await security.setPassword(pw);
                                setShowPasswordSettings(false);
                              }}
                            />
                          </div>
                        )}
                        {/* Reminder toggle */}
                        <div className="mt-4 pt-4 border-t border-border/20">
                          <div className="flex items-center justify-between min-h-[44px]">
                            <div>
                              <p className="text-sm font-medium text-foreground">
                                {ts.journalReminderEnabled || 'Daily reminder'}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {ts.journalReminderSubtitle || 'Get reminded to write'}
                              </p>
                            </div>
                            <button
                              onClick={() => reminder.setEnabled(!reminder.enabled)}
                              className={cn(
                                'relative w-11 h-6 rounded-full transition-colors',
                                reminder.enabled ? 'bg-primary' : 'bg-muted-foreground/20',
                              )}
                            >
                              <div className={cn(
                                'absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform',
                                reminder.enabled ? 'translate-x-[22px]' : 'translate-x-0.5',
                              )} />
                            </button>
                          </div>
                          {reminder.enabled && (
                            <div className="flex items-center gap-2 mt-2">
                              <span className="text-xs text-muted-foreground">
                                {ts.journalReminderTime || 'Time'}:
                              </span>
                              <input
                                type="time"
                                value={`${String(reminder.hour).padStart(2, '0')}:${String(reminder.minute).padStart(2, '0')}`}
                                onChange={e => {
                                  const [h, m] = e.target.value.split(':').map(Number);
                                  if (!isNaN(h) && !isNaN(m)) reminder.setTime(h, m);
                                }}
                                className="px-2 py-1 rounded-lg bg-muted/50 border border-border/30 text-sm text-foreground min-h-[36px]"
                              />
                            </div>
                          )}
                        </div>

                        <button
                          onClick={() => setShowPasswordSettings(false)}
                          className="w-full mt-4 py-2.5 text-sm text-muted-foreground min-h-[44px]"
                        >
                          {ts.cancel || 'Cancel'}
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </div>
  );
}
