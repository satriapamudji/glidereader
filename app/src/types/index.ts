// Core types for Glide Reader

export interface Token {
  text: string;
  orpIndex: number; // Optimal Recognition Point position
  pauseMultiplier: number;
}

export interface Chapter {
  id: string;
  title: string;
  startTokenIndex: number;
  endTokenIndex: number;
}

export interface Document {
  id: string;
  title: string;
  sourceType: 'web' | 'paste' | 'pdf';
  sourceUrl?: string;
  canonicalText: string;
  totalTokens: number;
  chapters: Chapter[];
  lastPosition: Position;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}

export interface Position {
  tokenIndex: number;
  updatedAt: Date;
}

export interface Session {
  id: string;
  documentId: string;
  startedAt: Date;
  endedAt?: Date;
  durationSeconds: number;
  startWPM: number;
  endWPM: number;
  avgWPM: number;
  bestSustainedWPM60s: number;
  tokensRead: number;
  completionDeltaOverall: number;
  completionDeltaChapter: number;
  pauses: number;
  rewinds: number;
  settingsSnapshot: UserSettings;
}

export interface UserSettings {
  key?: string; // IndexedDB primary key
  defaultWPM: number;
  pauseProfile: 'fast' | 'normal' | 'slow';
  fontSize: 'S' | 'M' | 'L' | 'XL';
  guidesOn: boolean;
  countdownSeconds: 0 | 3 | 5;
  theme: 'dark' | 'light';
  nonLinearPolicy: NonLinearPolicy;
}

export interface NonLinearPolicy {
  tables: 'skip' | 'snapshot' | 'linearize';
  figures: 'skip' | 'snapshot';
  equations: 'skip' | 'snapshot';
  showMarkers: boolean;
  snapshotMs: number;
  linearizeThreshold: number;
}

export interface RSVPState {
  tokens: Token[];
  currentIndex: number;
  isPlaying: boolean;
  wpm: number;
  chapterIndex: number;
}

export interface PauseProfile {
  comma: number;
  semicolon: number;
  colon: number;
  period: number;
  exclamation: number;
  question: number;
  paragraph: number;
}
