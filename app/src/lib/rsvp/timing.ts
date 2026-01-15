/**
 * RSVP Timing Engine with Drift Compensation
 *
 * Uses performance.now() for precise timing and compensates for drift
 * caused by setInterval inaccuracy and main thread blocking.
 */

export interface TimingState {
  expectedTime: number;
  lastTickTime: number;
  totalDrift: number;
}

/**
 * Create a new timing state
 */
export function createTimingState(): TimingState {
  return {
    expectedTime: performance.now(),
    lastTickTime: performance.now(),
    totalDrift: 0,
  };
}

/**
 * Calculate the next tick time with drift compensation
 *
 * @param state Current timing state
 * @param intervalMs Target interval in milliseconds
 * @returns The delay to use for setTimeout, or -1 if should run immediately
 */
export function calculateNextTick(state: TimingState, intervalMs: number): number {
  const now = performance.now();
  const expectedNextTime = state.expectedTime + intervalMs;
  const drift = now - expectedNextTime;

  state.totalDrift = drift;
  state.lastTickTime = now;

  // If we're behind, run immediately
  if (drift >= intervalMs) {
    state.expectedTime = now + intervalMs;
    return -1;
  }

  // Calculate delay to get back on track
  const delay = Math.max(0, intervalMs - drift);
  state.expectedTime = expectedNextTime;

  return delay;
}

/**
 * Get a corrected WPM based on actual playback speed vs target
 *
 * @param targetWPM Desired WPM
 * @param actualTokensPerMinute Measured tokens per minute
 * @returns Suggested WPM adjustment
 */
export function calculateWPMCorrection(targetWPM: number, actualTokensPerMinute: number): number {
  if (actualTokensPerMinute === 0) return targetWPM;
  const ratio = targetWPM / actualTokensPerMinute;
  return Math.round(targetWPM * ratio);
}

/**
 * Measure actual WPM from a timing sample
 *
 * @param tokenCount Number of tokens displayed
 * @param startTime Start time in milliseconds
 * @param endTime End time in milliseconds
 * @returns Actual WPM
 */
export function measureActualWPM(tokenCount: number, startTime: number, endTime: number): number {
  const durationMinutes = (endTime - startTime) / 60000;
  if (durationMinutes <= 0) return 0;
  return Math.round(tokenCount / durationMinutes);
}

/**
 * Create a timing callback wrapper that measures actual performance
 */
export function createTimingMeasureCallback() {
  let tokenCount = 0;
  let startTime = performance.now();

  return {
    recordToken: () => {
      tokenCount++;
    },
    getWPM: () => measureActualWPM(tokenCount, startTime, performance.now()),
    reset: () => {
      tokenCount = 0;
      startTime = performance.now();
    },
  };
}

/**
 * Drift-compensated scheduler class
 */
export class DriftCompensatedScheduler {
  private state: TimingState;
  private timerId: number | null = null;
  private isRunning = false;

  constructor() {
    this.state = createTimingState();
  }

  /**
   * Start scheduling ticks
   * @param callback Function to call on each tick
   * @param intervalMs Target interval in milliseconds
   */
  start(callback: () => void, intervalMs: number): void {
    if (this.isRunning) return;

    this.isRunning = true;
    this.state = createTimingState();

    const tick = () => {
      if (!this.isRunning) return;

      callback();

      const delay = calculateNextTick(this.state, intervalMs);
      if (delay >= 0) {
        this.timerId = window.setTimeout(tick, delay);
      } else {
        // Running behind, schedule next tick immediately using requestAnimationFrame
        this.timerId = window.requestAnimationFrame(() => {
          if (this.isRunning) tick();
        });
      }
    };

    // Start immediately
    callback();
    this.timerId = window.setTimeout(tick, intervalMs);
  }

  /**
   * Stop scheduling ticks
   */
  stop(): void {
    this.isRunning = false;
    if (this.timerId !== null) {
      window.clearTimeout(this.timerId);
      window.cancelAnimationFrame(this.timerId);
      this.timerId = null;
    }
  }

  /**
   * Get current drift in milliseconds
   */
  getDrift(): number {
    return this.state.totalDrift;
  }

  /**
   * Check if currently running
   */
  active(): boolean {
    return this.isRunning;
  }
}
