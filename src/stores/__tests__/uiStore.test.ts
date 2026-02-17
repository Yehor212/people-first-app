import { describe, it, expect, beforeEach } from 'vitest';
import { useUIStore, getModalToggle, selectAnyModalOpen } from '@/stores/uiStore';
import type { ModalName } from '@/stores/uiStore';

const initialState = useUIStore.getState();

beforeEach(() => {
  useUIStore.setState(initialState, true);
});

const ALL_MODALS: ModalName[] = [
  'showWeeklyReport', 'showWidgetSettings', 'showChallenges',
  'showChallengeModal', 'showTimeHelper', 'showTasksPanel',
  'showQuestsPanel', 'showFriendsPanel', 'showWelcomeOverlay',
  'showWelcomeBack', 'showMindfulMoment',
];

const MODAL_CLOSE_PRIORITY: ModalName[] = [
  'showFriendsPanel', 'showTasksPanel', 'showQuestsPanel',
  'showChallenges', 'showChallengeModal', 'showWidgetSettings',
  'showWeeklyReport', 'showTimeHelper', 'showMindfulMoment',
  'showWelcomeBack', 'showWelcomeOverlay',
];

// ─── Initial State ───────────────────────────────────────────

describe('uiStore initial state', () => {
  it.each(ALL_MODALS)('modal "%s" defaults to false', (modal) => {
    expect(useUIStore.getState()[modal]).toBe(false);
  });

  it('challengeInvite defaults to undefined', () => {
    expect(useUIStore.getState().challengeInvite).toBeUndefined();
  });

  it('challengeHabit defaults to undefined', () => {
    expect(useUIStore.getState().challengeHabit).toBeUndefined();
  });

  it('welcomeBackData defaults to null', () => {
    expect(useUIStore.getState().welcomeBackData).toBeNull();
  });

  it('confettiBurst defaults to null', () => {
    expect(useUIStore.getState().confettiBurst).toBeNull();
  });

  it('featureToUnlock defaults to null', () => {
    expect(useUIStore.getState().featureToUnlock).toBeNull();
  });

  it('updateState defaults to null', () => {
    expect(useUIStore.getState().updateState).toBeNull();
  });

  it('journalPromptText defaults to undefined', () => {
    expect(useUIStore.getState().journalPromptText).toBeUndefined();
  });

  it('currentFocusMinutes defaults to undefined', () => {
    expect(useUIStore.getState().currentFocusMinutes).toBeUndefined();
  });
});

// ─── openModal ───────────────────────────────────────────────

describe('openModal', () => {
  it.each(ALL_MODALS)('opens "%s"', (modal) => {
    useUIStore.getState().openModal(modal);
    expect(useUIStore.getState()[modal]).toBe(true);
  });

  it('opening one modal does not affect others', () => {
    useUIStore.getState().openModal('showWeeklyReport');
    for (const modal of ALL_MODALS) {
      if (modal === 'showWeeklyReport') continue;
      expect(useUIStore.getState()[modal]).toBe(false);
    }
  });
});

// ─── closeModal ──────────────────────────────────────────────

describe('closeModal', () => {
  it.each(ALL_MODALS)('closes "%s"', (modal) => {
    useUIStore.getState().openModal(modal);
    useUIStore.getState().closeModal(modal);
    expect(useUIStore.getState()[modal]).toBe(false);
  });
});

// ─── closeAllModals ──────────────────────────────────────────

describe('closeAllModals', () => {
  it('resets all 11 modals to false', () => {
    // Open several modals
    for (const modal of ALL_MODALS) {
      useUIStore.getState().openModal(modal);
    }
    useUIStore.getState().closeAllModals();
    for (const modal of ALL_MODALS) {
      expect(useUIStore.getState()[modal]).toBe(false);
    }
  });

  it('preserves data fields when closing all modals', () => {
    useUIStore.getState().setConfettiBurst({ x: 10, y: 20 });
    useUIStore.getState().setJournalPromptText('Hello');
    useUIStore.getState().setCurrentFocusMinutes(25);

    useUIStore.getState().openModal('showWeeklyReport');
    useUIStore.getState().closeAllModals();

    expect(useUIStore.getState().confettiBurst).toEqual({ x: 10, y: 20 });
    expect(useUIStore.getState().journalPromptText).toBe('Hello');
    expect(useUIStore.getState().currentFocusMinutes).toBe(25);
  });
});

// ─── tryCloseTopModal ────────────────────────────────────────

describe('tryCloseTopModal', () => {
  it('returns false when no modals are open', () => {
    const result = useUIStore.getState().tryCloseTopModal();
    expect(result).toBe(false);
  });

  it('closes highest-priority modal (showFriendsPanel) first', () => {
    useUIStore.getState().openModal('showWeeklyReport');
    useUIStore.getState().openModal('showFriendsPanel');

    const result = useUIStore.getState().tryCloseTopModal();
    expect(result).toBe(true);
    expect(useUIStore.getState().showFriendsPanel).toBe(false);
    expect(useUIStore.getState().showWeeklyReport).toBe(true);
  });

  it('only closes one modal per call', () => {
    useUIStore.getState().openModal('showFriendsPanel');
    useUIStore.getState().openModal('showTasksPanel');
    useUIStore.getState().openModal('showQuestsPanel');

    useUIStore.getState().tryCloseTopModal();

    // Only showFriendsPanel should be closed
    expect(useUIStore.getState().showFriendsPanel).toBe(false);
    expect(useUIStore.getState().showTasksPanel).toBe(true);
    expect(useUIStore.getState().showQuestsPanel).toBe(true);
  });

  it('returns true when a modal was closed', () => {
    useUIStore.getState().openModal('showTimeHelper');
    const result = useUIStore.getState().tryCloseTopModal();
    expect(result).toBe(true);
  });

  it('follows full priority order for sequential closes', () => {
    // Open all modals
    for (const modal of ALL_MODALS) {
      useUIStore.getState().openModal(modal);
    }

    // Close them one by one and verify order
    const closedOrder: ModalName[] = [];
    for (let i = 0; i < ALL_MODALS.length; i++) {
      // Find which modal is still open in priority order
      const state = useUIStore.getState();
      const nextToClose = MODAL_CLOSE_PRIORITY.find((m) => state[m]);
      useUIStore.getState().tryCloseTopModal();
      if (nextToClose) closedOrder.push(nextToClose);
    }

    expect(closedOrder).toEqual(MODAL_CLOSE_PRIORITY);
  });

  it('closes showTasksPanel before showWeeklyReport', () => {
    useUIStore.getState().openModal('showWeeklyReport');
    useUIStore.getState().openModal('showTasksPanel');

    useUIStore.getState().tryCloseTopModal();

    expect(useUIStore.getState().showTasksPanel).toBe(false);
    expect(useUIStore.getState().showWeeklyReport).toBe(true);
  });

  it('closes showChallenges before showWidgetSettings', () => {
    useUIStore.getState().openModal('showWidgetSettings');
    useUIStore.getState().openModal('showChallenges');

    useUIStore.getState().tryCloseTopModal();

    expect(useUIStore.getState().showChallenges).toBe(false);
    expect(useUIStore.getState().showWidgetSettings).toBe(true);
  });
});

// ─── Data Setters ────────────────────────────────────────────

describe('setConfettiBurst', () => {
  it('sets position', () => {
    useUIStore.getState().setConfettiBurst({ x: 100, y: 200 });
    expect(useUIStore.getState().confettiBurst).toEqual({ x: 100, y: 200 });
  });

  it('clears to null', () => {
    useUIStore.getState().setConfettiBurst({ x: 100, y: 200 });
    useUIStore.getState().setConfettiBurst(null);
    expect(useUIStore.getState().confettiBurst).toBeNull();
  });
});

describe('setFeatureToUnlock', () => {
  it('sets a feature ID', () => {
    useUIStore.getState().setFeatureToUnlock('garden' as any);
    expect(useUIStore.getState().featureToUnlock).toBe('garden');
  });

  it('clears to null', () => {
    useUIStore.getState().setFeatureToUnlock('garden' as any);
    useUIStore.getState().setFeatureToUnlock(null);
    expect(useUIStore.getState().featureToUnlock).toBeNull();
  });
});

describe('setUpdateState', () => {
  it('sets update state object', () => {
    const state = { available: true, version: '2.0.0' } as any;
    useUIStore.getState().setUpdateState(state);
    expect(useUIStore.getState().updateState).toEqual(state);
  });

  it('clears to null', () => {
    useUIStore.getState().setUpdateState({ available: true } as any);
    useUIStore.getState().setUpdateState(null);
    expect(useUIStore.getState().updateState).toBeNull();
  });
});

describe('setChallengeInvite', () => {
  it('sets an invite object', () => {
    const invite = { id: 'inv1', from: 'user1' } as any;
    useUIStore.getState().setChallengeInvite(invite);
    expect(useUIStore.getState().challengeInvite).toEqual(invite);
  });

  it('clears to undefined', () => {
    useUIStore.getState().setChallengeInvite({ id: 'inv1' } as any);
    useUIStore.getState().setChallengeInvite(undefined);
    expect(useUIStore.getState().challengeInvite).toBeUndefined();
  });
});

describe('setChallengeHabit', () => {
  it('sets a habit object', () => {
    const habit = { id: 'h1', name: 'Exercise' } as any;
    useUIStore.getState().setChallengeHabit(habit);
    expect(useUIStore.getState().challengeHabit).toEqual(habit);
  });

  it('clears to undefined', () => {
    useUIStore.getState().setChallengeHabit({ id: 'h1' } as any);
    useUIStore.getState().setChallengeHabit(undefined);
    expect(useUIStore.getState().challengeHabit).toBeUndefined();
  });
});

describe('setWelcomeBackData', () => {
  it('sets welcome back data', () => {
    const data = {
      daysAway: 5,
      streakBroken: true,
      currentStreak: 0,
      topHabits: [],
    };
    useUIStore.getState().setWelcomeBackData(data);
    expect(useUIStore.getState().welcomeBackData).toEqual(data);
  });

  it('clears to null', () => {
    useUIStore.getState().setWelcomeBackData({
      daysAway: 3,
      streakBroken: false,
      currentStreak: 10,
      topHabits: [],
    });
    useUIStore.getState().setWelcomeBackData(null);
    expect(useUIStore.getState().welcomeBackData).toBeNull();
  });
});

describe('setJournalPromptText', () => {
  it('sets prompt text', () => {
    useUIStore.getState().setJournalPromptText('How are you feeling?');
    expect(useUIStore.getState().journalPromptText).toBe('How are you feeling?');
  });

  it('clears to undefined', () => {
    useUIStore.getState().setJournalPromptText('text');
    useUIStore.getState().setJournalPromptText(undefined);
    expect(useUIStore.getState().journalPromptText).toBeUndefined();
  });
});

describe('setCurrentFocusMinutes', () => {
  it('sets minutes', () => {
    useUIStore.getState().setCurrentFocusMinutes(25);
    expect(useUIStore.getState().currentFocusMinutes).toBe(25);
  });

  it('clears to undefined', () => {
    useUIStore.getState().setCurrentFocusMinutes(25);
    useUIStore.getState().setCurrentFocusMinutes(undefined);
    expect(useUIStore.getState().currentFocusMinutes).toBeUndefined();
  });
});

// ─── getModalToggle ──────────────────────────────────────────

describe('getModalToggle', () => {
  it('returns a function', () => {
    const toggle = getModalToggle('showWeeklyReport');
    expect(typeof toggle).toBe('function');
  });

  it('calling with true opens the modal', () => {
    const toggle = getModalToggle('showWeeklyReport');
    toggle(true);
    expect(useUIStore.getState().showWeeklyReport).toBe(true);
  });

  it('calling with false closes the modal', () => {
    useUIStore.getState().openModal('showWeeklyReport');
    const toggle = getModalToggle('showWeeklyReport');
    toggle(false);
    expect(useUIStore.getState().showWeeklyReport).toBe(false);
  });

  it('returns cached reference (same function for same modal)', () => {
    const toggle1 = getModalToggle('showChallenges');
    const toggle2 = getModalToggle('showChallenges');
    expect(toggle1).toBe(toggle2);
  });

  it('returns different functions for different modals', () => {
    const toggle1 = getModalToggle('showChallenges');
    const toggle2 = getModalToggle('showTimeHelper');
    expect(toggle1).not.toBe(toggle2);
  });
});

// ─── selectAnyModalOpen ──────────────────────────────────────

describe('selectAnyModalOpen', () => {
  it('returns false when no modals are open', () => {
    expect(selectAnyModalOpen(useUIStore.getState())).toBe(false);
  });

  it.each(ALL_MODALS)('returns true when "%s" is open', (modal) => {
    useUIStore.getState().openModal(modal);
    expect(selectAnyModalOpen(useUIStore.getState())).toBe(true);
  });

  it('returns false after closing the only open modal', () => {
    useUIStore.getState().openModal('showTimeHelper');
    useUIStore.getState().closeModal('showTimeHelper');
    expect(selectAnyModalOpen(useUIStore.getState())).toBe(false);
  });
});
