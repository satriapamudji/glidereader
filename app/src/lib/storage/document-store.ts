import { v4 as uuidv4 } from 'uuid';
import { db } from './db';
import type { Document, Position, Chapter } from '../../types';
import { tokenize, PAUSE_PROFILES } from '../rsvp';

/**
 * Document Store - CRUD operations for documents
 */

/**
 * Create a new document from text
 */
export async function createDocument(
  title: string,
  text: string,
  sourceType: 'web' | 'paste' | 'pdf',
  sourceUrl?: string
): Promise<Document> {
  const settings = await db.settings.get('default');
  const pauseProfile = PAUSE_PROFILES[settings?.pauseProfile || 'normal'];

  const tokens = tokenize(text, pauseProfile);
  const chapters = detectChapters(text, tokens);

  const doc: Document = {
    id: uuidv4(),
    title,
    sourceType,
    sourceUrl,
    canonicalText: text,
    totalTokens: tokens.length,
    chapters,
    lastPosition: {
      tokenIndex: 0,
      updatedAt: new Date(),
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  await db.documents.add(doc);
  return doc;
}

/**
 * Get document by ID
 */
export async function getDocument(id: string): Promise<Document | undefined> {
  return db.documents.get(id);
}

/**
 * Get all documents
 */
export async function getAllDocuments(): Promise<Document[]> {
  return db.documents.toArray();
}

/**
 * Get in-progress documents
 */
export async function getInProgressDocuments(): Promise<Document[]> {
  return db.documents.filter((doc) => !doc.completedAt).toArray();
}

/**
 * Get completed documents
 */
export async function getCompletedDocuments(): Promise<Document[]> {
  return db.documents.filter((doc) => doc.completedAt !== undefined).toArray();
}

/**
 * Update document last position
 */
export async function updateDocumentPosition(
  id: string,
  tokenIndex: number
): Promise<void> {
  const doc = await db.documents.get(id);
  if (!doc) throw new Error('Document not found');

  const completionRatio = tokenIndex / doc.totalTokens;
  const isComplete = completionRatio >= 0.95;

  await db.documents.update(id, {
    lastPosition: {
      tokenIndex,
      updatedAt: new Date(),
    },
    updatedAt: new Date(),
    completedAt: isComplete ? new Date() : undefined,
  });
}

/**
 * Delete document
 */
export async function deleteDocument(id: string): Promise<void> {
  await db.documents.delete(id);
  // Also delete associated sessions
  await db.sessions.where('documentId').equals(id).delete();
}

/**
 * Simple chapter detection from headings
 * For paste/pdf, uses paragraph breaks or word count segmentation
 */
function detectChapters(text: string, tokens: any[]): Chapter[] {
  const chapters: Chapter[] = [];

  // Try to detect markdown-style headings
  const headingRegex = /^(#{1,3})\s+(.+)$/gm;
  let match;
  const headings: Array<{ index: number; title: string; level: number }> = [];

  while ((match = headingRegex.exec(text)) !== null) {
    const level = match[1].length;
    const title = match[2].trim();
    // Estimate token index (rough approximation)
    const index = text.substring(0, match.index).split(/\s+/).length;
    headings.push({ index, title, level });
  }

  if (headings.length > 0) {
    // Create chapters from headings
    for (let i = 0; i < headings.length; i++) {
      const start = headings[i].index;
      const end = i < headings.length - 1 ? headings[i + 1].index : tokens.length;

      chapters.push({
        id: uuidv4(),
        title: headings[i].title,
        startTokenIndex: start,
        endTokenIndex: end,
      });
    }
  } else {
    // No headings found - segment by word count (~1000 words per chapter)
    const wordsPerChapter = 1000;
    let chapterIndex = 0;

    while (chapterIndex * wordsPerChapter < tokens.length) {
      const start = chapterIndex * wordsPerChapter;
      const end = Math.min((chapterIndex + 1) * wordsPerChapter, tokens.length);

      chapters.push({
        id: uuidv4(),
        title: `Section ${chapterIndex + 1}`,
        startTokenIndex: start,
        endTokenIndex: end,
      });

      chapterIndex++;
    }
  }

  return chapters.length > 0 ? chapters : [
    {
      id: uuidv4(),
      title: 'Full Text',
      startTokenIndex: 0,
      endTokenIndex: tokens.length,
    },
  ];
}
