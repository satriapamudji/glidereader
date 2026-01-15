import { useState, useEffect, useRef, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { initDB, getSettings, updateSettings, db } from './lib/storage/db';
import { createDocument, updateDocumentPosition } from './lib/storage/document-store';
import {
  createSession,
  updateSessionProgress,
  finalizeSession,
  calculateGlideScore,
  formatDuration,
} from './lib/storage/session-store';
import { WordDisplay } from './components/rsvp/WordDisplay';
import { DualProgressBar } from './components/progress/DualProgressBar';
import { SessionSummary } from './components/session/SessionSummary';
import { tokenize } from './lib/rsvp/tokenizer';
import type { Token, UserSettings, Chapter, Session } from './types';
import './styles.css';

// ============================================
// APP SHELL - For Phase 2/3 (Library, PDF, etc)
// ============================================
function AppShell({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Top Navigation - Phase 2/3 ready */}
      <nav className="border-b border-zinc-900 bg-zinc-950/80 backdrop-blur-lg sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-red-500 flex items-center justify-center">
              <span className="text-black font-bold text-sm">G</span>
            </div>
            <h1 className="font-semibold text-lg">Glide Reader</h1>
          </div>

          {/* Navigation tabs - Phase 2/3 */}
          <div className="flex items-center gap-6">
            <button className="text-zinc-300 hover:text-white text-sm transition-colors">
              Library
            </button>
            <button className="text-zinc-500 hover:text-white text-sm transition-colors">
              Stats
            </button>
            <button className="text-zinc-500 hover:text-white text-sm transition-colors">
              Settings
            </button>
          </div>
        </div>
      </nav>

      {/* Main content area */}
      <main className="max-w-6xl mx-auto px-6 py-8">
        {children}
      </main>
    </div>
  );
}

// ============================================
// CINEMATIC READING MODE - Toggleable overlay
// ============================================
function ReadingMode({
  tokens,
  chapters,
  currentIndex,
  isPlaying,
  isComplete,
  wpm,
  fontSize,
  completedSession,
  onPlayPause,
  onRestart,
  onSkip,
  onWpmChange,
  onScrubStart,
  onScrubMove,
  onScrubEnd,
  onExit,
}: {
  tokens: Token[];
  chapters: Chapter[];
  currentIndex: number;
  isPlaying: boolean;
  isComplete: boolean;
  wpm: number;
  fontSize: 'S' | 'M' | 'L' | 'XL';
  completedSession: Session | null;
  onPlayPause: () => void;
  onRestart: () => void;
  onSkip: (delta: number) => void;
  onWpmChange: (wpm: number) => void;
  onScrubStart?: () => void;
  onScrubMove?: (index: number) => void;
  onScrubEnd?: () => void;
  onExit: () => void;
}) {
  const progress = tokens.length > 0 ? (currentIndex / tokens.length) * 100 : 0;
  const currentToken = tokens[currentIndex] || null;

  // Calculate transition duration to match word display time for smooth progress
  const baseMs = 60000 / wpm;
  const transitionMs = isPlaying && currentToken
    ? baseMs * (1 + currentToken.pauseMultiplier)
    : 75;

  // Keyboard shortcuts for reading mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input/textarea
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (e.key) {
        case 'Escape':
          e.preventDefault();
          onExit();
          break;
        case ' ':
          e.preventDefault();
          if (!isComplete) {
            onPlayPause();
          }
          break;
        case 'ArrowLeft':
          e.preventDefault();
          onSkip(-10);
          break;
        case 'ArrowRight':
          e.preventDefault();
          onSkip(10);
          break;
        case 'ArrowUp':
          e.preventDefault();
          onWpmChange(Math.min(900, wpm + 10));
          break;
        case 'ArrowDown':
          e.preventDefault();
          onWpmChange(Math.max(200, wpm - 10));
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onExit, onPlayPause, onSkip, onWpmChange, wpm, isComplete]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col overflow-hidden">
      {/* === CINEMATIC BACKGROUND LAYERS === */}
      {/* Base: very dark warm gradient */}
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'linear-gradient(135deg, #0c0a09 0%, #0a0a0a 40%, #0f0806 70%, #0c0a09 100%)',
        }}
      />
      {/* Ember wash: subtle warm radial in center */}
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse 80% 50% at 50% 50%, rgba(180, 83, 9, 0.06) 0%, transparent 60%)',
        }}
      />
      {/* Secondary ember accent: lower, wider */}
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse 120% 40% at 50% 80%, rgba(239, 68, 68, 0.04) 0%, transparent 50%)',
        }}
      />
      {/* Vignette: dark edges */}
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse 70% 60% at 50% 50%, transparent 0%, rgba(0,0,0,0.4) 100%)',
        }}
      />

      {/* === TOP PROGRESS BAR === */}
      <div className="relative z-10 px-4 pt-4 bg-zinc-950/80 backdrop-blur-sm border-b border-white/5">
        {/* Subtle top highlight line */}
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
        <DualProgressBar
          chapters={chapters}
          currentIndex={currentIndex}
          totalTokens={tokens.length}
          wpm={wpm}
          tokens={tokens}
          onScrubStart={onScrubStart}
          onScrubMove={onScrubMove}
          onScrubEnd={onScrubEnd}
        />
      </div>

      {/* === EXIT BUTTON (glass pill) === */}
      <button
        onClick={onExit}
        className="absolute top-5 right-5 w-10 h-10 rounded-full bg-white/5 border border-white/10 backdrop-blur-md flex items-center justify-center transition-all z-20 hover:bg-white/10 hover:border-amber-500/30 hover:ring-1 hover:ring-amber-500/20"
      >
        <svg className="w-4 h-4 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      {/* === READING STAGE === */}
      <div className="flex-1 flex items-center justify-center relative z-10">
        {/* === FOCUS GUIDE LINES === */}
        {/* Top horizontal line */}
        <div className="absolute top-[15%] left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent pointer-events-none" />
        {/* Bottom horizontal line */}
        <div className="absolute bottom-[15%] left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent pointer-events-none" />
        
        {/* Vertical guide from top line downward (stops before word area) */}
        <div 
          className="absolute left-1/2 -translate-x-1/2 w-px pointer-events-none"
          style={{
            top: '15%',
            height: '20%',
            background: 'linear-gradient(to bottom, rgba(255,255,255,0.15) 0%, rgba(239,68,68,0.08) 100%)',
          }}
        />
        {/* Vertical guide from bottom line upward (stops before word area) */}
        <div 
          className="absolute left-1/2 -translate-x-1/2 w-px pointer-events-none"
          style={{
            bottom: '15%',
            height: '20%',
            background: 'linear-gradient(to top, rgba(255,255,255,0.15) 0%, rgba(239,68,68,0.08) 100%)',
          }}
        />

        {/* Centered lane for word display (allows overflow) */}
        <div className="w-full max-w-5xl px-8 flex items-center justify-center">
          <WordDisplay token={currentToken} fontSize={fontSize} />
        </div>

        {/* Progress info - premium design (shown when paused and not complete) */}
        {!isPlaying && !isComplete && tokens.length > 0 && (
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-center">
            <div className="bg-gradient-to-r from-amber-500 to-red-500 bg-clip-text text-transparent text-2xl font-bold mb-1">
              {Math.round(progress)}%
            </div>
            <div className="text-zinc-300 text-sm font-medium">
              {tokens.length - currentIndex} words remaining
            </div>
          </div>
        )}

        {/* Completion screen with stats and actions */}
        {isComplete && completedSession && (
          <SessionSummary
            session={completedSession}
            onRestart={onRestart}
            onExit={onExit}
          />
        )}
      </div>

      {/* === CONTROLS DOCK (glass floating panel) === */}
      {!isComplete && (
        <div className={`${isPlaying ? 'opacity-0 pointer-events-none' : 'opacity-100'} transition-opacity duration-300 relative z-10`}>
          {/* Glass dock container */}
          <div className="bg-zinc-950/60 backdrop-blur-xl border-t border-white/5">
            {/* Subtle top glow line */}
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-500/20 to-transparent" />
            
            <div className="max-w-3xl mx-auto px-8 py-6">
              {/* WPM control row */}
              <div className="flex items-center justify-center gap-6 mb-6">
                <button
                  onClick={() => onWpmChange(Math.max(200, wpm - 50))}
                  className="w-10 h-10 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 hover:border-amber-500/30 flex items-center justify-center transition-all"
                  disabled={isPlaying}
                >
                  <span className="text-zinc-400 text-lg font-light">−</span>
                </button>

                <div className="text-center min-w-[180px]">
                  <div className="text-3xl font-light tracking-tight mb-2">
                    <span className="text-white font-medium">{wpm}</span>
                    <span className="text-sm text-amber-500/80 ml-2 font-medium tracking-wide">WPM</span>
                  </div>
                  <input
                    type="range"
                    min="200"
                    max="900"
                    step="10"
                    value={wpm}
                    onChange={(e) => onWpmChange(parseInt(e.target.value, 10))}
                    className="w-full h-1.5 bg-white/5 rounded-full appearance-none cursor-pointer slider"
                    style={{
                      background: `linear-gradient(to right, #d97706 0%, #ef4444 ${((wpm - 200) / 700) * 100}%, rgba(255,255,255,0.05) ${((wpm - 200) / 700) * 100}%, rgba(255,255,255,0.05) 100%)`,
                    }}
                    disabled={isPlaying}
                  />
                  <div className="flex justify-between text-xs text-zinc-600 mt-1.5">
                    <span>200</span>
                    <span>550</span>
                    <span>900</span>
                  </div>
                </div>

                <button
                  onClick={() => onWpmChange(Math.min(900, wpm + 50))}
                  className="w-10 h-10 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 hover:border-amber-500/30 flex items-center justify-center transition-all"
                  disabled={isPlaying}
                >
                  <span className="text-zinc-400 text-lg font-light">+</span>
                </button>
              </div>

              {/* Playback controls row */}
              <div className="flex items-center justify-center gap-4">
                {/* Skip back */}
                <button
                  onClick={() => onSkip(-10)}
                  className="px-3 py-2 text-zinc-500 hover:text-zinc-300 hover:bg-white/5 rounded-lg transition-all text-sm font-medium border border-transparent hover:border-white/10"
                  disabled={isPlaying}
                >
                  ← 10
                </button>

                {/* Restart */}
                <button
                  onClick={onRestart}
                  className="w-10 h-10 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 hover:border-amber-500/30 flex items-center justify-center transition-all"
                  disabled={isPlaying}
                >
                  <svg className="w-4 h-4 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>

                {/* Play/Pause - primary action */}
                <button
                  onClick={onPlayPause}
                  className="w-14 h-14 rounded-full bg-gradient-to-r from-amber-500 to-red-500 hover:from-amber-400 hover:to-red-400 flex items-center justify-center transition-all hover:scale-105 shadow-lg shadow-amber-500/20"
                >
                  {isPlaying ? (
                    <svg className="w-5 h-5 text-black" fill="currentColor" viewBox="0 0 24 24">
                      <rect x="6" y="4" width="4" height="16" rx="1" />
                      <rect x="14" y="4" width="4" height="16" rx="1" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5 text-black ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  )}
                </button>

                {/* Skip forward */}
                <button
                  onClick={() => onSkip(10)}
                  className="px-3 py-2 text-zinc-500 hover:text-zinc-300 hover:bg-white/5 rounded-lg transition-all text-sm font-medium border border-transparent hover:border-white/10"
                  disabled={isPlaying}
                >
                  10 →
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================
// MAIN APP - Orchestrates shell + reading mode
// ============================================
function App() {
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [sampleText, setSampleText] = useState(
    'Glide Reader transforms any text into an immersive speed reading experience. ' +
    'Each word appears with a red anchor letter that stays fixed in the center. ' +
    'Your eyes never need to move, eliminating saccades and reducing fatigue. ' +
    'Adjust the speed to find your optimal reading flow. ' +
    'This is the fastest way to consume articles, PDFs, and documents.'
  );
  const [tokens, setTokens] = useState<Token[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([
    { id: 'default', title: 'Full Text', startTokenIndex: 0, endTokenIndex: 0 }
  ]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [wpm, setWpm] = useState(300);
  const [isInReadingMode, setIsInReadingMode] = useState(false);
  const [wasPlayingBeforeScrub, setWasPlayingBeforeScrub] = useState(false);

  // Session state
  const [currentDocumentId, setCurrentDocumentId] = useState<string | null>(null);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [previousIndex, setPreviousIndex] = useState(0);
  const [completedSession, setCompletedSession] = useState<Session | null>(null);

  // WPM history for best sustained 60s calculation
  const wpmHistory = useRef<{ timestamp: number; wpm: number }[]>([]);

  // Timer ref for clean playback control
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    initDB().then(() => {
      getSettings().then(setSettings);
    });
  }, []); // Only run once on mount

  useEffect(() => {
    const initDocument = async () => {
      const sampleTokens = tokenize(sampleText);
      setTokens(sampleTokens);
      setCurrentIndex(0);
      setIsPlaying(false);
      setIsComplete(false);

      // Generate chapters from text
      const detectedChapters = detectChaptersFromText(sampleText, sampleTokens);
      setChapters(detectedChapters);

      // Create document and session in IndexedDB
      const doc = await createDocument('Pasted Text', sampleText, 'paste');
      setCurrentDocumentId(doc.id);

      const session = await createSession(doc.id);
      setCurrentSessionId(session.id);
      setPreviousIndex(0);
    };

    initDocument();
  }, [sampleText]);

  // Simple chapter detection (will be replaced by document-store in Phase 3)
  const detectChaptersFromText = (text: string, tokens: Token[]): Chapter[] => {
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
  };

  // Clean playback loop with proper timer management
  useEffect(() => {
    // Clear any existing timer first
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    // Don't schedule if not playing, no tokens, or already complete
    if (!isPlaying || tokens.length === 0 || isComplete) {
      return;
    }

    // Check if we've reached the end
    if (currentIndex >= tokens.length - 1) {
      // Show the last word, then mark complete
      const token = tokens[currentIndex];
      const baseMs = 60000 / wpm;
      const delay = baseMs * (1 + token.pauseMultiplier);
      
      timerRef.current = window.setTimeout(() => {
        setIsPlaying(false);
        setIsComplete(true);
      }, delay);
      return;
    }

    // Normal playback: advance to next word
    const token = tokens[currentIndex];
    const baseMs = 60000 / wpm;
    const delay = baseMs * (1 + token.pauseMultiplier);

    timerRef.current = window.setTimeout(() => {
      setCurrentIndex((prev) => prev + 1);
    }, delay);

    // Cleanup on unmount or dependency change
    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isPlaying, currentIndex, tokens, wpm, isComplete]);

  // Track WPM history for best sustained 60s calculation
  useEffect(() => {
    wpmHistory.current.push({ timestamp: Date.now(), wpm });

    // Clean old entries (> 60s ago)
    const cutoff = Date.now() - 60000;
    wpmHistory.current = wpmHistory.current.filter(e => e.timestamp > cutoff);
  }, [wpm]);

  // Auto-save every 3 seconds during playback
  useEffect(() => {
    if (!currentSessionId || !currentDocumentId || !isPlaying) return;

    const interval = setInterval(async () => {
      if (currentSessionId && currentDocumentId) {
        const isRewind = currentIndex < previousIndex;

        await updateSessionProgress(
          currentSessionId,
          currentIndex,
          wpm,
          false, // Pauses tracked separately
          isRewind
        );

        await updateDocumentPosition(currentDocumentId, currentIndex);
        setPreviousIndex(currentIndex);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [currentSessionId, currentDocumentId, isPlaying, currentIndex, wpm, previousIndex]);

  // Track pauses
  useEffect(() => {
    if (!currentSessionId || previousIndex === currentIndex) return;

    const wasPlaying = previousIndex !== currentIndex && !isComplete;
    const nowPaused = !isPlaying && wasPlaying;

    if (nowPaused && currentSessionId) {
      updateSessionProgress(currentSessionId, currentIndex, wpm, true, false);
    }
  }, [isPlaying, currentIndex, previousIndex, currentSessionId, isComplete, wpm]);

  // Handle session completion
  useEffect(() => {
    if (!currentSessionId || !isComplete) return;

    const finalize = async () => {
      // Calculate best sustained 60s WPM
      let bestSustainedWPM = wpm;
      if (wpmHistory.current.length > 1) {
        let maxAvgWPM = 0;
        const windowMs = 60000;

        for (let i = 0; i < wpmHistory.current.length; i++) {
          const start = wpmHistory.current[i].timestamp;
          const windowEntries = wpmHistory.current.filter(e =>
            e.timestamp >= start && e.timestamp <= start + windowMs
          );

          if (windowEntries.length > 1) {
            const avgWPM = windowEntries.reduce((sum, e) => sum + e.wpm, 0) / windowEntries.length;
            maxAvgWPM = Math.max(maxAvgWPM, avgWPM);
          }
        }

        bestSustainedWPM = Math.round(maxAvgWPM);
      }

      await finalizeSession(currentSessionId, bestSustainedWPM, tokens.length);
      await updateDocumentPosition(currentDocumentId!, tokens.length);

      // Get the finalized session for display
      const finalized = await db.sessions.get(currentSessionId);
      if (finalized) {
        setCompletedSession(finalized);
      }
    };

    finalize();
  }, [currentSessionId, isComplete, tokens.length, currentDocumentId]);

  const handlePlayPause = useCallback(() => {
    if (isPlaying) {
      setIsPlaying(false);
    } else if (!isComplete && currentIndex < tokens.length) {
      setIsPlaying(true);
    }
  }, [isPlaying, isComplete, currentIndex, tokens.length]);

  const handleRestart = useCallback(() => {
    setCurrentIndex(0);
    setIsPlaying(false);
    setIsComplete(false);
  }, []);

  const handleSkip = useCallback((delta: number) => {
    setCurrentIndex((prev) => Math.max(0, Math.min(tokens.length - 1, prev + delta)));
    // If we were complete and skip back, we're no longer complete
    if (delta < 0 && isComplete) {
      setIsComplete(false);
    }
  }, [tokens.length, isComplete]);

  const handleEnterReadingMode = useCallback(() => {
    setIsInReadingMode(true);
  }, []);

  const handleExitReadingMode = useCallback(() => {
    setIsInReadingMode(false);
    setIsPlaying(false);
  }, []);

  // Scrub handlers
  const handleScrubStart = useCallback(() => {
    setWasPlayingBeforeScrub(isPlaying);
    setIsPlaying(false);
  }, [isPlaying]);

  const handleScrubMove = useCallback((index: number) => {
    setCurrentIndex(index);
  }, []);

  const handleScrubEnd = useCallback(() => {
    if (wasPlayingBeforeScrub) {
      setIsPlaying(true);
    }
  }, [wasPlayingBeforeScrub]);

  // Show reading mode overlay when active
  if (isInReadingMode) {
    return (
      <ReadingMode
        tokens={tokens}
        chapters={chapters}
        currentIndex={currentIndex}
        isPlaying={isPlaying}
        isComplete={isComplete}
        wpm={wpm}
        fontSize={settings?.fontSize || 'M'}
        completedSession={completedSession}
        onPlayPause={handlePlayPause}
        onRestart={handleRestart}
        onSkip={handleSkip}
        onWpmChange={setWpm}
        onScrubStart={handleScrubStart}
        onScrubMove={handleScrubMove}
        onScrubEnd={handleScrubEnd}
        onExit={handleExitReadingMode}
      />
    );
  }

  // Show app shell with content
  return (
    <AppShell>
      {/* Welcome / Demo section - Phase 1 */}
      <div className="mb-12">
        <h2 className="text-3xl font-semibold mb-3">Speed Reading Demo</h2>
        <p className="text-zinc-400 max-w-2xl">
          Paste your text below and click "Start Reading" to enter cinematic mode.
          The red anchor letter stays fixed while words flow around it.
        </p>
      </div>

      {/* Text input card */}
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 mb-8">
        <label className="block text-zinc-500 text-sm font-medium mb-3">
          PASTE YOUR TEXT
        </label>
        <textarea
          value={sampleText}
          onChange={(e) => {
            setSampleText(e.target.value);
            setCurrentIndex(0);
            setIsPlaying(false);
            setTokens(tokenize(e.target.value));
          }}
          className="w-full h-40 bg-zinc-950/50 border border-zinc-800 rounded-lg p-4 text-zinc-300 placeholder-zinc-600 resize-none focus:outline-none focus:border-zinc-700 transition-colors"
          placeholder="Paste your text here..."
        />
        <div className="flex items-center justify-between mt-4">
          <div className="text-sm text-zinc-500">
            {tokens.length} words · ~{(() => {
              const seconds = (tokens.length / wpm) * 60;
              if (seconds < 60) return `${Math.round(seconds)} sec`;
              return `${Math.round(seconds / 60)} min`;
            })()} at {wpm} WPM
          </div>
          <button
            onClick={handleEnterReadingMode}
            className="px-6 py-3 bg-gradient-to-r from-amber-500 to-red-500 hover:from-amber-600 hover:to-red-600 rounded-lg font-medium transition-all hover:scale-105"
            disabled={tokens.length === 0}
          >
            Start Reading
          </button>
        </div>
      </div>

      {/* Quick settings - Phase 1 */}
      <div className="grid grid-cols-2 gap-4">
        {/* WPM Control */}
        <div className="bg-zinc-900/30 border border-zinc-800/50 rounded-lg p-4">
          <div className="text-zinc-500 text-sm mb-2">Starting Speed</div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setWpm(Math.max(100, wpm - 50))}
              className="w-8 h-8 rounded-full bg-zinc-800/50 hover:bg-zinc-700/50 border border-zinc-700/50 text-zinc-400 hover:text-white transition-colors flex items-center justify-center text-lg"
            >
              −
            </button>
            <div className="text-2xl font-light flex-1 text-center">{wpm}</div>
            <button
              onClick={() => setWpm(Math.min(900, wpm + 50))}
              className="w-8 h-8 rounded-full bg-zinc-800/50 hover:bg-zinc-700/50 border border-zinc-700/50 text-zinc-400 hover:text-white transition-colors flex items-center justify-center text-lg"
            >
              +
            </button>
          </div>
          <div className="text-zinc-600 text-xs text-center mt-1">WPM</div>
        </div>

        {/* Font Size Control */}
        <div className="bg-zinc-900/30 border border-zinc-800/50 rounded-lg p-4">
          <div className="text-zinc-500 text-sm mb-2">Font Size</div>
          <div className="flex items-center justify-center gap-1">
            {(['S', 'M', 'L', 'XL'] as const).map((size) => (
              <button
                key={size}
                onClick={async () => {
                  await updateSettings({ fontSize: size });
                  setSettings(prev => prev ? { ...prev, fontSize: size } : prev);
                }}
                className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                  (settings?.fontSize || 'M') === size
                    ? 'bg-amber-600/80 text-white'
                    : 'bg-zinc-800/50 text-zinc-400 hover:bg-zinc-700/50 hover:text-white border border-zinc-700/50'
                }`}
              >
                {size}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Phase 2/3 placeholders - showing the structure */}
      <div className="mt-12 pt-8 border-t border-zinc-900">
        <h3 className="text-lg font-semibold mb-4 text-zinc-400">Coming Soon</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-zinc-900/20 border border-dashed border-zinc-800 rounded-lg p-6 text-center">
            <div className="text-zinc-600 text-sm">📚 Library View</div>
            <div className="text-zinc-700 text-xs mt-1">Phase 2</div>
          </div>
          <div className="bg-zinc-900/20 border border-dashed border-zinc-800 rounded-lg p-6 text-center">
            <div className="text-zinc-600 text-sm">📊 Stats & Training</div>
            <div className="text-zinc-700 text-xs mt-1">Phase 3</div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

export default App;
