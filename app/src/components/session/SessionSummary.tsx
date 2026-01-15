import React from 'react';
import type { Session } from '../../types';
import { calculateGlideScore, formatDuration } from '../../lib/storage/session-store';

interface SessionSummaryProps {
  session: Session;
  onRestart?: () => void;
  onExit?: () => void;
}

/**
 * MetricCard - Simple metric display card
 */
const MetricCard: React.FC<{
  label: string;
  value: string | number;
  color?: 'amber' | 'zinc' | 'white';
}> = ({ label, value, color = 'zinc' }) => {
  const colorClasses = {
    amber: 'text-amber-400',
    zinc: 'text-zinc-300',
    white: 'text-white',
  };

  return (
    <div className="bg-zinc-800/30 rounded-lg p-3 text-center">
      <div className={`text-xl font-light ${colorClasses[color]}`}>{value}</div>
      <div className="text-xs text-zinc-500 uppercase tracking-wider">{label}</div>
    </div>
  );
};

/**
 * ProgressBar - Visual progress bar
 */
const ProgressBar: React.FC<{
  label: string;
  value: number;
  color: 'amber' | 'orange' | 'red';
}> = ({ label, value, color }) => {
  const colorClasses = {
    amber: 'from-amber-600 to-amber-500',
    orange: 'from-orange-600 to-orange-500',
    red: 'from-red-600 to-red-500',
  };

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-zinc-400">{label}</span>
        <span className="text-zinc-300">{Math.round(value)}%</span>
      </div>
      <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
        <div
          className={`h-full bg-gradient-to-r ${colorClasses[color]} ease-out`}
          style={{ width: `${Math.min(100, value)}%` }}
        />
      </div>
    </div>
  );
};

/**
 * SessionSummary - Enhanced completion screen with Glide Score
 *
 * Displays:
 * - Glide Score (hero metric)
 * - Best sustained 60s WPM
 * - Detailed metrics grid (avg WPM, pauses, rewinds, duration)
 * - Progress bars for overall + chapter completion
 */
export const SessionSummary: React.FC<SessionSummaryProps> = ({
  session,
  onRestart,
  onExit,
}) => {
  const glideScore = calculateGlideScore(session);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="relative max-w-md w-full mx-4 animate-in fade-in duration-300">
        {/* Ambient glow */}
        <div
          className="absolute inset-0 -z-10 blur-3xl opacity-40"
          style={{
            background: 'radial-gradient(ellipse at center, rgba(251, 146, 60, 0.4) 0%, transparent 70%)',
          }}
        />

        {/* Card */}
        <div className="relative bg-zinc-900/90 border border-zinc-800 rounded-3xl p-8 shadow-2xl">
          {/* Checkmark icon */}
          <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-gradient-to-br from-amber-500 to-red-500 flex items-center justify-center shadow-lg shadow-orange-500/30">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </div>

          {/* Title */}
          <h2 className="text-2xl font-semibold text-white mb-1 text-center">
            Reading Complete!
          </h2>
          <p className="text-zinc-400 text-center mb-8">
            Great job maintaining your reading flow
          </p>

          {/* Glide Score - Hero metric */}
          <div className="text-center mb-8">
            <div className="text-zinc-500 text-sm uppercase tracking-wider mb-2">
              Glide Score
            </div>
            <div className="text-6xl font-light bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 bg-clip-text text-transparent">
              {glideScore}
            </div>
            <div className="text-zinc-500 text-xs mt-2">
              {session.avgWPM} avg WPM · {formatDuration(session.durationSeconds)}
            </div>
          </div>

          {/* Best Sustained WPM */}
          {session.bestSustainedWPM60s > 0 && (
            <div className="bg-zinc-800/50 rounded-xl p-4 mb-6">
              <div className="flex items-center justify-between">
                <span className="text-zinc-400 text-sm">Best Sustained (60s)</span>
                <span className="text-2xl font-light text-amber-400">
                  {session.bestSustainedWPM60s}
                </span>
              </div>
            </div>
          )}

          {/* Detailed metrics grid */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            <MetricCard label="Avg WPM" value={session.avgWPM} color="white" />
            <MetricCard label="End WPM" value={session.endWPM} />
            <MetricCard label="Pauses" value={session.pauses} />
            <MetricCard label="Rewinds" value={session.rewinds} />
          </div>

          {/* Progress bars */}
          <div className="space-y-3 mb-8">
            <ProgressBar
              label="Overall Progress"
              value={session.completionDeltaOverall * 100}
              color="amber"
            />
            <ProgressBar
              label="Chapter Progress"
              value={session.completionDeltaChapter * 100}
              color="orange"
            />
          </div>

          {/* Action buttons */}
          <div className="flex gap-3">
            {onRestart && (
              <button
                onClick={onRestart}
                className="flex-1 bg-gradient-to-r from-amber-600 to-orange-500 hover:from-amber-500 hover:to-orange-400 text-black font-semibold py-3 px-6 rounded-xl transition-all shadow-lg shadow-orange-500/20"
              >
                Read Again
              </button>
            )}
            {onExit && (
              <button
                onClick={onExit}
                className="px-6 py-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl transition-colors border border-zinc-700"
              >
                Exit
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
