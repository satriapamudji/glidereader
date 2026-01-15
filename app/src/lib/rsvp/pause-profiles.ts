import type { PauseProfile } from '../../types';

/**
 * Pause profiles for RSVP reading
 * Multipliers for base word duration (60000 / WPM ms)
 */

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

export default PAUSE_PROFILES;
