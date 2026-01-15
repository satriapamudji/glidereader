import type { Token, PauseProfile } from '../../types';

// Pause profiles - multipliers for base word duration
export const PAUSE_PROFILES: Record<string, PauseProfile> = {
  fast: {
    comma: 0.3,
    semicolon: 0.3,
    colon: 0.3,
    period: 0.8,
    exclamation: 0.8,
    question: 0.8,
    paragraph: 1.5,
  },
  normal: {
    comma: 0.4,
    semicolon: 0.4,
    colon: 0.4,
    period: 1.2,
    exclamation: 1.2,
    question: 1.2,
    paragraph: 2.0,
  },
  slow: {
    comma: 0.6,
    semicolon: 0.6,
    colon: 0.6,
    period: 1.8,
    exclamation: 1.8,
    question: 1.8,
    paragraph: 3.0,
  },
};

/**
 * Calculate ORP (Optimal Recognition Point) index for a word
 * Based on Spritz patent algorithm
 */
export function calculateORPIndex(word: string): number {
  const len = word.length;
  if (len <= 2) return 0;
  if (len <= 5) return 1;
  if (len <= 9) return 2;
  if (len <= 13) return 3;
  return 4;
}

/**
 * Calculate pause multiplier based on trailing punctuation
 */
export function calculatePauseMultiplier(text: string, profile: PauseProfile = PAUSE_PROFILES.normal): number {
  const trimmed = text.trim();

  // Check for paragraph break (multiple newlines)
  if (/\n\s*\n/.test(text)) return profile.paragraph;

  // Check for sentence-ending punctuation
  const lastChar = trimmed.at(-1);
  if (lastChar === '.' || lastChar === '!' || lastChar === '?') {
    return Math.max(profile.period, profile.exclamation, profile.question);
  }

  // Check for clause punctuation
  if (lastChar === ',' || lastChar === ';') return profile.comma;
  if (lastChar === ':') return profile.colon;

  // Default: no extra pause
  return 0;
}

/**
 * Tokenize text into RSVP tokens with ORP and pause info
 */
export function tokenize(text: string, profile: PauseProfile = PAUSE_PROFILES.normal): Token[] {
  const lines = text.split(/\r?\n/);
  const tokens: Token[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const words = line.split(/\s+/);

    for (let j = 0; j < words.length; j++) {
      const word = words[j];
      if (!word) continue;

      // Check if this is end of sentence/paragraph
      const isEndOfSentence = /[.!?]$/.test(word);
      const isEndOfParagraph = j === words.length - 1 && i < lines.length - 1;

      let pauseMultiplier = calculatePauseMultiplier(word, profile);

      // Add paragraph break pause if this is end of paragraph
      if (isEndOfParagraph) {
        pauseMultiplier = Math.max(pauseMultiplier, profile.paragraph);
      }

      tokens.push({
        text: word,
        orpIndex: calculateORPIndex(word),
        pauseMultiplier,
      });
    }
  }

  return tokens;
}

/**
 * Calculate display time for a token in milliseconds
 */
export function getTokenDuration(wpm: number, pauseMultiplier: number): number {
  const baseMsPerWord = 60000 / wpm;
  return baseMsPerWord * (1 + pauseMultiplier);
}
