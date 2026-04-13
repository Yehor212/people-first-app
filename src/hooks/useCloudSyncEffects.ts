import {
  useEffect,
  useRef,
  type Dispatch,
  type SetStateAction,
  type MutableRefObject,
} from "react";
import { useAppStore, useUserDataStore } from "@/stores";
import { useLanguage } from "@/contexts/LanguageContext";
import { useQuickActions, type QuickActionType } from "@/hooks/useQuickActions";
import { supabase } from "@/lib/supabaseClient";
import { syncReminderSettings } from "@/storage/reminderSync";
import {
  syncChallengesWithCloud,
  syncBadgesWithCloud,
  subscribeToChallengeUpdates,
  subscribeToBadgeUpdates,
} from "@/storage/challengeCloudSync";
import {
  syncTasks,
  syncQuests,
  subscribeToTaskUpdates,
  subscribeToQuestUpdates,
} from "@/storage/tasksCloudSync";
import { logger } from "@/lib/logger";
import { initSyncBroadcast, onRemoteChange, destroySyncBroadcast } from "@/lib/syncBroadcast";
import {
  pullMoodsFromCloud,
  pullFocusFromCloud,
  pullGratitudeFromCloud,
} from "@/storage/realtimeSync";
import { silentSync } from "@/storage/cloudSync";
import { verifySyncIntegrity } from "@/lib/syncIntegrity";
import { isNative } from "@/lib/platform";
import { App } from "@capacitor/app";

interface UseCloudSyncEffectsParams {
  setChallenges: Dispatch<
    SetStateAction<ReturnType<typeof import("@/lib/challengeStorage").getChallenges>>
  >;
  setBadges: Dispatch<
    SetStateAction<ReturnType<typeof import("@/lib/challengeStorage").getBadges>>
  >;
  handleNavigateToSection: (section: "mood" | "habits" | "focus") => void;
  quickActionTimeoutRef: MutableRefObject<ReturnType<typeof setTimeout> | null>;
}

/**
 * Cloud sync effects:
 * - Reminder settings sync to Supabase
 * - Lock screen quick actions
 * - Realtime subscriptions for challenges/badges/tasks/quests
 */
export function useCloudSyncEffects({
  setChallenges,
  setBadges,
  handleNavigateToSection,
  quickActionTimeoutRef,
}: UseCloudSyncEffectsParams): void {
  const { language } = useLanguage();
  const reminders = useUserDataStore((s) => s.reminders);
  const setActiveTab = useAppStore((s) => s.setActiveTab);
  const { onAction: onQuickAction } = useQuickActions();

  // Guard against concurrent reminder syncs (prevents infinite loop on 400 error)
  const reminderSyncPendingRef = useRef(false);
  // Prevent duplicate syncs when Zustand emits a new object reference without actual data change
  const prevRemindersRef = useRef<string>("");

  // Reminder sync to cloud
  useEffect(() => {
    const serialized = JSON.stringify(reminders) + "|" + language;
    if (serialized === prevRemindersRef.current) return;
    prevRemindersRef.current = serialized;

    if (!supabase || reminderSyncPendingRef.current) return;

    reminderSyncPendingRef.current = true;
    const timeoutId = window.setTimeout(() => {
      syncReminderSettings(reminders, language)
        .catch((error) => {
          logger.error("Failed to sync reminder settings:", error);
        })
        .finally(() => {
          reminderSyncPendingRef.current = false;
        });
    }, 500);

    return () => {
      window.clearTimeout(timeoutId);
      // Don't reset pending flag here - let the promise complete
    };
  }, [reminders, language]);

  // Lock screen quick actions handler
  useEffect(() => {
    onQuickAction((action: QuickActionType) => {
      logger.log("[Index] Quick action triggered:", action);

      // Switch to home tab first
      setActiveTab("home");

      // Small delay to ensure tab switch is complete before scrolling
      quickActionTimeoutRef.current = setTimeout(() => {
        switch (action) {
          case "mood":
            handleNavigateToSection("mood");
            break;
          case "focus":
            handleNavigateToSection("focus");
            break;
          case "habits":
            handleNavigateToSection("habits");
            break;
        }
      }, 100);
    });

    return () => {
      if (quickActionTimeoutRef.current) {
        clearTimeout(quickActionTimeoutRef.current);
      }
    };
  }, [onQuickAction, handleNavigateToSection, setActiveTab, quickActionTimeoutRef]);

  // Cloud sync for challenges and badges + realtime subscriptions
  useEffect(() => {
    let active = true;
    let challengeSub: (() => void) | null = null;
    let badgeSub: (() => void) | null = null;
    let taskSub: (() => void) | null = null;
    let questSub: (() => void) | null = null;

    const syncWithCloudIfLoggedIn = async () => {
      // Guard: skip if Supabase is not available (local mode)
      if (!supabase) return;

      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!active) return;

        if (session?.user) {
          const user = session.user;
          // Sync challenges
          const { challenges: syncedChallenges } = await syncChallengesWithCloud(user.id);
          if (active && syncedChallenges) {
            setChallenges(syncedChallenges);
          }

          // Sync badges
          const { badges: syncedBadges } = await syncBadgesWithCloud(user.id);
          if (active && syncedBadges) {
            setBadges(syncedBadges);
          }

          if (!active) return;

          // Sync tasks and quests (updates localStorage for Panels to read)
          await syncTasks();
          await syncQuests();

          if (!active) return;

          // Subscribe to real-time updates
          challengeSub = subscribeToChallengeUpdates(user.id, (updatedChallenge) => {
            if (!active) return;
            setChallenges((prev) => {
              const index = prev.findIndex((c) => c.id === updatedChallenge.id);
              if (index !== -1) {
                const updated = [...prev];
                updated[index] = updatedChallenge;
                return updated;
              }
              return [...prev, updatedChallenge];
            });
          });

          badgeSub = subscribeToBadgeUpdates(user.id, (updatedBadge) => {
            if (!active) return;
            setBadges((prev) => {
              const index = prev.findIndex((b) => b.id === updatedBadge.id);
              if (index !== -1) {
                const updated = [...prev];
                updated[index] = updatedBadge;
                return updated;
              }
              return prev;
            });
          });

          // Subscribe to tasks/quests updates to keep localStorage fresh
          taskSub = subscribeToTaskUpdates(user.id, () => {
            if (!active) return;
            logger.log("[Index] Tasks updated from cloud");
          });

          questSub = subscribeToQuestUpdates(user.id, () => {
            if (!active) return;
            logger.log("[Index] Quests updated from cloud");
          });
        }
      } catch (error) {
        logger.error("[Index] Cloud sync error:", error);
      }
    };

    void syncWithCloudIfLoggedIn();

    return () => {
      active = false;
      challengeSub?.();
      badgeSub?.();
      taskSub?.();
      questSub?.();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- mount-only: set up sync subscriptions once

  // Cross-device sync broadcast: instant notification when other device changes data
  useEffect(() => {
    if (!supabase) return;

    let unsubRemote: (() => void) | null = null;

    const initBroadcast = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session?.user) return;

        initSyncBroadcast(session.user.id);

        unsubRemote = onRemoteChange((signal) => {
          logger.sync("[Broadcast] Pulling " + signal.entity + " from remote change");
          switch (signal.entity) {
            case "moods":
              void pullMoodsFromCloud();
              break;
            case "focus":
              void pullFocusFromCloud();
              break;
            case "gratitude":
              void pullGratitudeFromCloud();
              break;
            case "habits":
            case "journal":
            default:
              void silentSync().then(() => verifySyncIntegrity());
              break;
          }
        });
      } catch (err) {
        logger.warn("[Broadcast] Init failed:", err);
      }
    };

    void initBroadcast();

    return () => {
      unsubRemote?.();
      destroySyncBroadcast(true);
    };
  }, []);

  // Capacitor: sync immediately when app resumes from background
  useEffect(() => {
    if (!isNative) return;

    let listenerHandle: { remove: () => void } | null = null;

    App.addListener("appStateChange", ({ isActive }) => {
      if (isActive) {
        logger.sync("[AppState] Resumed — triggering sync");
        void silentSync();
      }
    })
      .then((handle) => {
        listenerHandle = handle;
      })
      .catch((err) => {
        logger.warn("[AppState] Listener setup failed:", err);
      });

    return () => {
      listenerHandle?.remove();
    };
  }, []);
}
