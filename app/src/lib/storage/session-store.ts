import { v4 as uuidv4 } from 'uuid';
import { db } from './db';
import type { Session } from '../../types';

/**
 * Session Store - CRUD operations for reading sessions
 */

/**
 * Create a new session for a document
 */
export async function createSession(documentId: string): Promise<Session> {
  const settings = await db.settings.get('default');

  const session: Session = {
    id: uuidv4(),
    documentId,
    startedAt: new Date(),
    durationSeconds: 0,
    startWPM: settings?.defaultWPM || 300,
    endWPM: settings?.defaultWPM || 300,
    avgWPM: settings?.defaultWPM || 300,
    bestSustainedWPM60s: 0,
    tokensRead: 0,
    completionDeltaOverall: 0,
    completionDeltaChapter: 0,
    pauses: 0,
    rewinds: 0,
    settingsSnapshot: settings || {
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
  };

  await db.sessions.add(session);
  return session;
}

/**
 * Update session progress during playback
 */
export async function updateSessionProgress(
  sessionId: string,
  tokenIndex: number,
  wpm: number,
  isPause: boolean,
  isRewind: boolean
): Promise<void> {
  const session = await db.sessions.get(sessionId);
  if (!session) return;

  const doc = await db.documents.get(session.documentId);
  if (!doc) return;

  const currentChapter = doc.chapters.find(
    ch => tokenIndex >= ch.startTokenIndex && tokenIndex < ch.endTokenIndex
  );

  // Calculate running average WPM
  const totalTokensRead = tokenIndex;
  const newAvgWPM = session.avgWPM > 0
    ? ((session.avgWPM * session.tokensRead) + wpm) / (session.tokensRead + 1)
    : wpm;

  await db.sessions.update(sessionId, {
    durationSeconds: Math.floor(
      (Date.now() - new Date(session.startedAt).getTime()) / 1000
    ),
    endWPM: wpm,
    avgWPM: Math.round(newAvgWPM),
    tokensRead: tokenIndex,
    completionDeltaOverall: tokenIndex / doc.totalTokens,
    completionDeltaChapter: currentChapter
      ? (tokenIndex - currentChapter.startTokenIndex) /
        (currentChapter.endTokenIndex - currentChapter.startTokenIndex)
      : 0,
    pauses: isPause ? session.pauses + 1 : session.pauses,
    rewinds: isRewind ? session.rewinds + 1 : session.rewinds,
  });
}

/**
 * Update session with best sustained WPM and completion data
 */
export async function finalizeSession(
  sessionId: string,
  bestSustainedWPM60s: number,
  finalTokenIndex: number
): Promise<void> {
  const session = await db.sessions.get(sessionId);
  if (!session) return;

  const doc = await db.documents.get(session.documentId);
  if (!doc) return;

  // Find the final chapter to calculate chapter progress
  const finalChapter = doc.chapters.find(
    ch => finalTokenIndex >= ch.startTokenIndex && finalTokenIndex < ch.endTokenIndex
  );

  await db.sessions.update(sessionId, {
    endedAt: new Date(),
    bestSustainedWPM60s,
    tokensRead: finalTokenIndex,
    completionDeltaOverall: finalTokenIndex / doc.totalTokens,
    completionDeltaChapter: finalChapter
      ? (finalTokenIndex - finalChapter.startTokenIndex) /
        (finalChapter.endTokenIndex - finalChapter.startTokenIndex)
      : 1.0, // If no chapter found, mark as complete
  });
}

/**
 * Get latest session for a document
 */
export async function getLatestSession(documentId: string): Promise<Session | undefined> {
  return await db.sessions
    .where('documentId')
    .equals(documentId)
    .reverse()
    .first();
}

/**
 * Get all sessions for a document
 */
export async function getDocumentSessions(documentId: string): Promise<Session[]> {
  return await db.sessions
    .where('documentId')
    .equals(documentId)
    .toArray();
}

/**
 * Calculate Glide Score for a session
 */
export function calculateGlideScore(session: Session): number {
  // Efficiency: speed score (0-100 based on avg WPM, 600 = perfect)
  const efficiencyScore = Math.min(100, (session.avgWPM / 600) * 100);

  // Consistency: best sustained vs average (0-100)
  const consistencyScore = session.avgWPM > 0
    ? Math.min(100, (session.bestSustainedWPM60s / session.avgWPM) * 100)
    : 0;

  // Completion: percentage of document completed (0-100)
  const completionScore = session.completionDeltaOverall * 100;

  // Weighted average
  return Math.round(
    efficiencyScore * 0.4 +
    consistencyScore * 0.3 +
    completionScore * 0.3
  );
}

/**
 * Format duration in seconds to human-readable string
 */
export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (minutes < 60) return secs > 0 ? `${minutes}m ${secs}s` : `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

/**
 * Format time remaining as readable string
 */
export function formatTimeRemaining(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const minutes = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${minutes}m ${secs}s`;
}
