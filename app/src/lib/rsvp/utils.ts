/**
 * RSVP Utility Functions
 */

/**
 * Measure text width using canvas for accurate display measurements
 */
export function measureTextWidth(
  text: string,
  fontSize: number,
  fontFamily: string = 'system-ui, -apple-system, sans-serif',
  fontWeight: number = 400
): number {
  if (!text) return 0;

  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) return 0;

  context.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
  return context.measureText(text).width;
}

/**
 * Calculate balanced ORP position for visual centering
 *
 * The goal is to position the ORP character such that there's equal
 * visual space on both sides of it.
 */
export function calculateBalancedOrpPosition(
  text: string,
  orpIndex: number,
  fontSize: number,
  fontFamily: string = 'system-ui, -apple-system, sans-serif',
  fontWeight: number = 400
): {
  orpPosition: number;
  prefixWidth: number;
  suffixWidth: number;
  totalWidth: number;
} {
  const prefix = text.slice(0, orpIndex);
  const orpChar = text[orpIndex] || '';
  const suffix = text.slice(orpIndex + 1);

  const prefixWidth = measureTextWidth(prefix, fontSize, fontFamily, fontWeight);
  const orpCharWidth = measureTextWidth(orpChar, fontSize, fontFamily, fontWeight);
  const suffixWidth = measureTextWidth(suffix, fontSize, fontFamily, fontWeight);
  const totalWidth = prefixWidth + orpCharWidth + suffixWidth;

  // Calculate ORP position from left edge for visual balance
  // ORP should be positioned so that (left_space) == (right_space)
  // left_space = orpPosition
  // right_space = totalWidth - orpPosition - orpCharWidth
  // For balance: orpPosition = totalWidth - orpPosition - orpCharWidth
  // 2 * orpPosition = totalWidth - orpCharWidth
  // orpPosition = (totalWidth - orpCharWidth) / 2
  const orpPosition = (totalWidth - orpCharWidth) / 2;

  return {
    orpPosition,
    prefixWidth,
    suffixWidth,
    totalWidth,
  };
}
