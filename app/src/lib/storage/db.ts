import Dexie, { type Table } from 'dexie';
import type { Document, Session, UserSettings } from '../../types';

/**
 * Glide Reader Database - IndexedDB via Dexie
 */
export class GlideDatabase extends Dexie {
  documents!: Table<Document>;
  sessions!: Table<Session>;
  settings!: Table<UserSettings>;

  constructor() {
    super('GlideReaderDB');

    // Define schema
    this.version(1).stores({
      documents: 'id, sourceType, sourceUrl, createdAt, updatedAt, completedAt',
      sessions: 'id, documentId, startedAt, endedAt',
      settings: 'key',
    });
  }
}

// Singleton instance
export const db = new GlideDatabase();

/**
 * Initialize database and set default settings if not present
 */
export async function initDB(): Promise<void> {
  await db.open();

  const settingsCount = await db.settings.count();
  if (settingsCount === 0) {
    await db.settings.bulkPut([
      {
        key: 'default',
        defaultWPM: 300,
        pauseProfile: 'normal',
        fontSize: 'M',
        guidesOn: true,
        countdownSeconds: 0,
        theme: 'dark',
        nonLinearPolicy: {
          tables: 'skip',
          figures: 'skip',
          equations: 'skip',
          showMarkers: true,
          snapshotMs: 1200,
          linearizeThreshold: 0.7,
        },
      },
    ]);
  }
}

/**
 * Get current user settings
 */
export async function getSettings(): Promise<UserSettings> {
  const settings = await db.settings.get('default');
  if (!settings) {
    throw new Error('Settings not found. DB not initialized?');
  }
  return settings;
}

/**
 * Update user settings
 */
export async function updateSettings(updates: Partial<UserSettings>): Promise<void> {
  const current = await getSettings();
  await db.settings.put({ ...current, ...updates });
}

// Export Dexie types for use in other modules
export type { Document, Session, UserSettings };
