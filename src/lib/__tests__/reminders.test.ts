/**
 * Unit tests for reminders — default settings, time constants, data shape
 */
import { describe, it, expect } from 'vitest';
import { defaultReminderSettings } from '../reminders';

describe('reminders', () => {
  describe('defaultReminderSettings', () => {
    it('has enabled set to false by default', () => {
      expect(defaultReminderSettings.enabled).toBe(false);
    });

    it('has morning mood time at 09:00', () => {
      expect(defaultReminderSettings.moodTimeMorning).toBe('09:00');
    });

    it('has afternoon mood time at 14:00', () => {
      expect(defaultReminderSettings.moodTimeAfternoon).toBe('14:00');
    });

    it('has evening mood time at 20:00', () => {
      expect(defaultReminderSettings.moodTimeEvening).toBe('20:00');
    });

    it('has habit time at 21:00', () => {
      expect(defaultReminderSettings.habitTime).toBe('21:00');
    });

    it('has focus time at 10:00', () => {
      expect(defaultReminderSettings.focusTime).toBe('10:00');
    });

    it('defaults to weekdays (Monday through Friday)', () => {
      expect(defaultReminderSettings.days).toEqual([1, 2, 3, 4, 5]);
    });

    it('has exactly 5 days', () => {
      expect(defaultReminderSettings.days).toHaveLength(5);
    });

    it('does not include weekends (0 = Sunday, 6 = Saturday)', () => {
      expect(defaultReminderSettings.days).not.toContain(0);
      expect(defaultReminderSettings.days).not.toContain(6);
    });

    it('has quiet hours from 22:00 to 08:00', () => {
      expect(defaultReminderSettings.quietHours).toEqual({
        start: '22:00',
        end: '08:00',
      });
    });

    it('has empty habitIds array', () => {
      expect(defaultReminderSettings.habitIds).toEqual([]);
      expect(Array.isArray(defaultReminderSettings.habitIds)).toBe(true);
    });

    it('all time fields use HH:MM format', () => {
      const timeRegex = /^\d{2}:\d{2}$/;
      expect(defaultReminderSettings.moodTimeMorning).toMatch(timeRegex);
      expect(defaultReminderSettings.moodTimeAfternoon).toMatch(timeRegex);
      expect(defaultReminderSettings.moodTimeEvening).toMatch(timeRegex);
      expect(defaultReminderSettings.habitTime).toMatch(timeRegex);
      expect(defaultReminderSettings.focusTime).toMatch(timeRegex);
      expect(defaultReminderSettings.quietHours.start).toMatch(timeRegex);
      expect(defaultReminderSettings.quietHours.end).toMatch(timeRegex);
    });

    it('mood times are in chronological order', () => {
      const morning = defaultReminderSettings.moodTimeMorning;
      const afternoon = defaultReminderSettings.moodTimeAfternoon;
      const evening = defaultReminderSettings.moodTimeEvening;
      expect(morning < afternoon).toBe(true);
      expect(afternoon < evening).toBe(true);
    });

    it('quiet hours start is after evening mood time', () => {
      expect(defaultReminderSettings.quietHours.start > defaultReminderSettings.moodTimeEvening).toBe(true);
    });

    it('quiet hours end is before morning mood time', () => {
      expect(defaultReminderSettings.quietHours.end < defaultReminderSettings.moodTimeMorning).toBe(true);
    });
  });
});
