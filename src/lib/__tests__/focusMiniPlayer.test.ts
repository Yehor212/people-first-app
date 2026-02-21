import { describe, it, expect, beforeEach } from 'vitest';
import { formatFocusTime } from '@/components/FocusMiniPlayer';
import { useUIStore } from '@/stores/uiStore';

describe('FocusMiniPlayer', () => {
  describe('formatFocusTime', () => {
    it('should format 0 seconds as 0:00', () => {
      expect(formatFocusTime(0)).toBe('0:00');
    });

    it('should format 5 seconds as 0:05', () => {
      expect(formatFocusTime(5)).toBe('0:05');
    });

    it('should format 65 seconds as 1:05', () => {
      expect(formatFocusTime(65)).toBe('1:05');
    });

    it('should format 600 seconds as 10:00', () => {
      expect(formatFocusTime(600)).toBe('10:00');
    });

    it('should format 1500 seconds (25 min) as 25:00', () => {
      expect(formatFocusTime(1500)).toBe('25:00');
    });

    it('should format 3599 seconds as 59:59', () => {
      expect(formatFocusTime(3599)).toBe('59:59');
    });

    it('should format 3600 seconds (60 min) as 60:00', () => {
      expect(formatFocusTime(3600)).toBe('60:00');
    });
  });

  describe('uiStore focus timer bridge', () => {
    beforeEach(() => {
      useUIStore.getState().clearFocusTimerBridge();
    });

    it('should have default focus bridge values', () => {
      const state = useUIStore.getState();
      expect(state.focusEndTime).toBeNull();
      expect(state.focusIsRunning).toBe(false);
      expect(state.focusIsBreak).toBe(false);
      expect(state.focusLabel).toBe('');
    });

    it('should set focus timer bridge state', () => {
      const endTime = Date.now() + 1500000;
      useUIStore.getState().setFocusTimerBridge({
        endTime,
        isRunning: true,
        isBreak: false,
        label: 'Deep Work',
      });

      const state = useUIStore.getState();
      expect(state.focusEndTime).toBe(endTime);
      expect(state.focusIsRunning).toBe(true);
      expect(state.focusIsBreak).toBe(false);
      expect(state.focusLabel).toBe('Deep Work');
    });

    it('should update bridge for pause (endTime null, isRunning false)', () => {
      useUIStore.getState().setFocusTimerBridge({
        endTime: Date.now() + 1000000,
        isRunning: true,
        isBreak: false,
        label: 'Task',
      });
      useUIStore.getState().setFocusTimerBridge({
        endTime: null,
        isRunning: false,
        isBreak: false,
        label: 'Task',
      });

      const state = useUIStore.getState();
      expect(state.focusEndTime).toBeNull();
      expect(state.focusIsRunning).toBe(false);
      expect(state.focusLabel).toBe('Task');
    });

    it('should update bridge for break phase', () => {
      useUIStore.getState().setFocusTimerBridge({
        endTime: null,
        isRunning: false,
        isBreak: true,
        label: 'Task',
      });

      const state = useUIStore.getState();
      expect(state.focusIsBreak).toBe(true);
      expect(state.focusIsRunning).toBe(false);
    });

    it('should clear bridge completely', () => {
      useUIStore.getState().setFocusTimerBridge({
        endTime: Date.now() + 500000,
        isRunning: true,
        isBreak: false,
        label: 'Test',
      });
      useUIStore.getState().clearFocusTimerBridge();

      const state = useUIStore.getState();
      expect(state.focusEndTime).toBeNull();
      expect(state.focusIsRunning).toBe(false);
      expect(state.focusIsBreak).toBe(false);
      expect(state.focusLabel).toBe('');
      expect(state.currentFocusMinutes).toBeUndefined();
    });

    it('should clear currentFocusMinutes when clearing bridge', () => {
      useUIStore.getState().setCurrentFocusMinutes(15);
      useUIStore.getState().clearFocusTimerBridge();

      expect(useUIStore.getState().currentFocusMinutes).toBeUndefined();
    });
  });
});
