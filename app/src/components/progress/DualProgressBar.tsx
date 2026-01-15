import React, { useState, useRef, useEffect } from 'react';
import type { Chapter } from '../../types';

interface DualProgressBarProps {
  chapters: Chapter[];
  currentIndex: number;
  totalTokens: number;
  wpm: number;
  tokens: Array<{ text: string }>;
  onScrubStart?: () => void;
  onScrubMove?: (index: number) => void;
  onScrubEnd?: () => void;
}

/**
 * DualProgressBar - Layered progress display with chapter + overall progress
 *
 * Features:
 * - Background layer: Overall progress (faint)
 * - Foreground layer: Current chapter progress (full opacity gradient)
 * - Milestone ticks at chapter boundaries
 * - Interactive scrubbing with hover preview
 * - Drag to seek with snippet preview
 */
export const DualProgressBar: React.FC<DualProgressBarProps> = ({
  chapters,
  currentIndex,
  totalTokens,
  wpm,
  tokens,
  onScrubStart,
  onScrubMove,
  onScrubEnd,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [hoverPosition, setHoverPosition] = useState<number | null>(null);
  const [dragPosition, setDragPosition] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  // Measure container width on mount and resize
  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.offsetWidth);
      }
    };

    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  // Find current chapter
  const currentChapter = chapters.find(ch =>
    currentIndex >= ch.startTokenIndex && currentIndex < ch.endTokenIndex
  );

  // Calculate chapter progress
  const chapterProgress = currentChapter
    ? ((currentIndex - currentChapter.startTokenIndex) /
       (currentChapter.endTokenIndex - currentChapter.startTokenIndex)) * 100
    : 0;

  // Calculate overall progress
  const overallProgress = totalTokens > 0 ? (currentIndex / totalTokens) * 100 : 0;

  // Generate ticks for chapter boundaries
  const ticks = chapters.map((ch, idx) => ({
    position: (ch.startTokenIndex / totalTokens) * 100,
    isCurrent: ch === currentChapter,
    title: ch.title,
  }));

  // Calculate chapter info from position
  const getChapterInfo = (positionPx: number) => {
    if (containerWidth === 0) return null;

    const percent = Math.max(0, Math.min(1, positionPx / containerWidth));
    const tokenIndex = Math.floor(percent * totalTokens);
    const chapter = chapters.find(ch =>
      tokenIndex >= ch.startTokenIndex && tokenIndex < ch.endTokenIndex
    );

    // Calculate time remaining
    const tokensRemaining = totalTokens - tokenIndex;
    const secondsRemaining = (tokensRemaining / wpm) * 60;

    // Format time
    const formatTime = (seconds: number): string => {
      if (seconds < 60) return `${Math.round(seconds)}s`;
      const minutes = Math.floor(seconds / 60);
      const secs = Math.round(seconds % 60);
      return `${minutes}m ${secs}s`;
    };

    return {
      chapterTitle: chapter?.title || 'Unknown',
      chapterNum: chapter ? chapters.indexOf(chapter) + 1 : 0,
      percent: Math.round(percent * 100),
      timeRemaining: formatTime(secondsRemaining),
      tokenIndex,
    };
  };

  // Get text snippet for preview
  const getSnippet = (tokenIndex: number, windowSize: number = 5): string => {
    const start = Math.max(0, tokenIndex - windowSize);
    const end = Math.min(tokens.length, tokenIndex + windowSize);
    const snippetTokens = tokens.slice(start, end);
    return snippetTokens.map(t => t.text).join(' ');
  };

  // Get current display info (hover or drag)
  const displayPosition = dragPosition ?? hoverPosition;
  const chapterInfo = displayPosition !== null ? getChapterInfo(displayPosition) : null;

  // Handle mouse events
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const position = e.clientX - rect.left;

    if (isDragging) {
      setDragPosition(position);
      if (chapterInfo) {
        onScrubMove?.(chapterInfo.tokenIndex);
      }
    } else {
      setHoverPosition(position);
    }
  };

  const handleMouseLeave = () => {
    if (!isDragging) {
      setHoverPosition(null);
    }
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const position = e.clientX - rect.left;

    setIsDragging(true);
    setDragPosition(position);
    onScrubStart?.();

    if (chapterInfo) {
      onScrubMove?.(chapterInfo.tokenIndex);
    }
  };

  const handleMouseUp = () => {
    if (isDragging) {
      setIsDragging(false);
      setDragPosition(null);
      onScrubEnd?.();
    }
  };

  // Global mouse up to handle drag release outside component
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (isDragging) {
        setIsDragging(false);
        setDragPosition(null);
        onScrubEnd?.();
      }
    };

    if (isDragging) {
      window.addEventListener('mouseup', handleGlobalMouseUp);
      return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
    }
  }, [isDragging, onScrubEnd]);

  // Graceful degradation for single chapter
  const isSingleChapter = chapters.length <= 1;

  return (
    <div className="relative w-full">
      {/* Progress Bar Container */}
      <div
        ref={containerRef}
        className={`relative h-2 cursor-${isDragging ? 'grabbing' : 'grab'} select-none`}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
      >
        {/* Single chapter: Show orange gradient bar only */}
        {isSingleChapter ? (
          <div
            className="absolute top-0 bottom-0 left-0 bg-gradient-to-r from-amber-600 via-orange-500 to-red-500 ease-linear rounded-full"
            style={{
              width: `${overallProgress}%`,
              transition: isDragging ? 'none' : `width ${60000 / wpm}ms linear`,
            }}
          />
        ) : (
          <>
            {/* Multiple chapters: Background (overall progress, faint) */}
            <div className="absolute inset-0 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-white/20 ease-linear"
                style={{
                  width: `${overallProgress}%`,
                  transition: isDragging ? 'none' : `width ${60000 / wpm}ms linear`,
                }}
              />
            </div>

            {/* Foreground: Chapter progress (gradient) */}
            <div
              className="absolute top-0 bottom-0 left-0 bg-gradient-to-r from-amber-600 via-orange-500 to-red-500 ease-linear rounded-full"
              style={{
                width: `${chapterProgress}%`,
                transition: isDragging ? 'none' : `width ${60000 / wpm}ms linear`,
              }}
            />
          </>
        )}

        {/* Ticks */}
        {ticks.map((tick, idx) => (
          <div
            key={idx}
            className={`absolute top-0 bottom-0 w-px ${
              tick.isCurrent ? 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.6)]' : 'bg-white/30'
            }`}
            style={{
              left: `${tick.position}%`,
            }}
            title={tick.title}
          />
        ))}

        {/* Scrub handle (visible on hover/drag) */}
        {(hoverPosition !== null || isDragging) && (
          <div
            className="absolute top-0 bottom-0 w-1 bg-white rounded-full shadow-lg"
            style={{
              left: chapterInfo ? `${(chapterInfo.tokenIndex / totalTokens) * 100}%` : `${overallProgress}%`,
              transform: 'translateX(-50%)',
            }}
          />
        )}
      </div>

      {/* Scrub Preview Tooltip - positioned below progress bar */}
      {chapterInfo && displayPosition !== null && (
        <div
          className="absolute top-full mt-2 pointer-events-none z-30"
          style={{
            left: `${Math.min(100, Math.max(0, (displayPosition / containerWidth) * 100))}%`,
            transform: 'translateX(-50%)',
          }}
        >
          {/* Small triangle pointing up */}
          <div className="w-0 h-0 border-l-4 border-r-4 border-b-4 border-l-transparent border-r-transparent border-b-zinc-700 mx-auto mb-[-1px]" />
          <div className="bg-zinc-900/95 backdrop-blur-xl border border-zinc-700 rounded-lg px-3 py-2 shadow-xl whitespace-nowrap">
            <div className="text-amber-400 text-sm font-medium">
              {isSingleChapter
                ? (chapterInfo.chapterTitle.startsWith('Section') ? 'Full Text' : chapterInfo.chapterTitle)
                : `Chapter ${chapterInfo.chapterNum}`} · {chapterInfo.percent}%
            </div>
            <div className="text-zinc-400 text-xs">
              {chapterInfo.timeRemaining} left
            </div>
            {isDragging && (
              <>
                <div className="my-2 border-t border-zinc-700" />
                <div className="text-zinc-300 text-xs italic truncate max-w-xs">
                  "{getSnippet(chapterInfo.tokenIndex, 5)}"
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Chapter indicator below progress bar */}
      {!isSingleChapter && currentChapter && (
        <div className="mt-8 text-center">
          <span className="text-xs text-zinc-500 uppercase tracking-wider">
            {currentChapter.title}
          </span>
        </div>
      )}
    </div>
  );
};
