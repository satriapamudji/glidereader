import React from 'react';
import type { Token } from '../../types';

interface WordDisplayProps {
  token: Token | null;
  fontSize?: 'S' | 'M' | 'L' | 'XL';
}

const FONT_SIZE_MAP = {
  S: 'clamp(24px, 4vw, 56px)',
  M: 'clamp(32px, 6vw, 88px)',
  L: 'clamp(40px, 8vw, 112px)',
  XL: 'clamp(48px, 10vw, 144px)',
} as const;

/**
 * WordDisplay - RSVP reading with ORP anchor (Option A: grid layout)
 *
 * The pivot (ORP) letter is centered using a 3-column CSS grid.
 * No measuring, no transforms, no animations — pivot stays dead center.
 * Font size scales with viewport width via clamp().
 * 
 * Cinematic styling: warm ember theme with subtle text shadows for depth.
 */
export const WordDisplay: React.FC<WordDisplayProps> = ({ token, fontSize = 'M' }) => {
  if (!token) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="text-zinc-500 text-2xl font-light tracking-wide mb-2">
            Ready to glide
          </div>
          <div className="text-zinc-600 text-sm">
            Press play to begin reading
          </div>
        </div>
      </div>
    );
  }

  const { text, orpIndex } = token;
  const prefix = text.slice(0, orpIndex);
  const pivot = text[orpIndex] || '';
  const suffix = text.slice(orpIndex + 1);

  return (
    <div className="flex items-center justify-center w-full">
      {/* 
        3-column grid: 1fr | auto | 1fr
        - Left column (1fr): prefix, right-aligned
        - Center column (auto): pivot letter, centered
        - Right column (1fr): suffix, left-aligned
        
        This ensures the pivot glyph stays at the exact center regardless of word length.
      */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr auto 1fr',
          alignItems: 'baseline',
          width: '100%',
          overflow: 'visible',
          whiteSpace: 'nowrap',
          /* Responsive font size based on user preference */
          fontSize: FONT_SIZE_MAP[fontSize],
          lineHeight: 1.1,
          fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
          fontWeight: 300,
          fontVariantLigatures: 'none',
          letterSpacing: '-0.02em',
          /* Subtle text shadow for depth against dark background */
          textShadow: '0 2px 8px rgba(0, 0, 0, 0.5)',
        }}
      >
        {/* Prefix (left of pivot) */}
        <span
          style={{
            justifySelf: 'end',
            textAlign: 'right',
            overflow: 'visible',
            color: '#d4d4d8', /* zinc-300 for better contrast */
          }}
        >
          {prefix}
        </span>

        {/* Pivot (ORP character) - ember red, centered */}
        <span
          style={{
            justifySelf: 'center',
            overflow: 'visible',
            color: '#ef4444', /* red-500 */
            fontWeight: 500, /* slightly bolder for emphasis */
            textShadow: '0 0 20px rgba(239, 68, 68, 0.4), 0 2px 8px rgba(0, 0, 0, 0.5)',
          }}
        >
          {pivot}
        </span>

        {/* Suffix (right of pivot) */}
        <span
          style={{
            justifySelf: 'start',
            textAlign: 'left',
            overflow: 'visible',
            color: '#d4d4d8', /* zinc-300 for better contrast */
          }}
        >
          {suffix}
        </span>
      </div>
    </div>
  );
};
