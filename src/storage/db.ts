import Dexie, { Table } from 'dexie';
import { MoodEntry, Habit, FocusSession, GratitudeEntry } from '@/types';

// Определяем схему базы данных
export class ZenFlowDB extends Dexie {
  moods!: Table<MoodEntry, string>;
  habits!: Table<Habit, string>;
  focusSessions!: Table<FocusSession, string>;
  gratitudeEntries!: Table<GratitudeEntry, string>;
  settings!: Table<{ key: string; value: unknown }, string>;

  constructor() {
    super('ZenFlowDB');

    // Version 1: Initial schema
    this.version(1).stores({
      moods: 'id, timestamp',
      habits: 'id, createdAt',
      focusSessions: 'id, startTime',
      gratitudeEntries: 'id, timestamp',
      settings: 'key',
    });

    // Future migrations can be added here:
    // this.version(2).stores({ ... }).upgrade(tx => { ... });
  }
}

export const db = new ZenFlowDB();

export const moodsRepo = db.moods;
export const habitsRepo = db.habits;
export const focusRepo = db.focusSessions;
export const gratitudeRepo = db.gratitudeEntries;
export const settingsRepo = db.settings;
