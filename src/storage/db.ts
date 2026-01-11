import Dexie, { Table } from 'dexie';
import { MoodEntry, Habit, FocusSession, GratitudeEntry } from '@/types';

// Определяем схему базы данных
export class ZenFlowDB extends Dexie {
  moods!: Table<MoodEntry, string>;
  habits!: Table<Habit, string>;
  focusSessions!: Table<FocusSession, string>;
  gratitudeEntries!: Table<GratitudeEntry, string>;
  settings!: Table<{ key: string; value: any }, string>;

  constructor() {
    super('ZenFlowDB');
    console.log("ZenFlowDB: Конструктор вызван."); // Лог
    this.version(1).stores({
      moods: 'id, timestamp',
      habits: 'id, createdAt',
      focusSessions: 'id, startTime',
      gratitudeEntries: 'id, timestamp',
      settings: 'key',
    });
    console.log("ZenFlowDB: Схема версии 1 определена."); // Лог
  }
}

export const db = new ZenFlowDB();
console.log("ZenFlowDB: Экземпляр базы данных создан."); // Лог

export const moodsRepo = db.moods;
export const habitsRepo = db.habits;
export const focusRepo = db.focusSessions;
export const gratitudeRepo = db.gratitudeEntries;
export const settingsRepo = db.settings;
