// Android tactile vibration feedback helper

export type HapticPattern = 'tap' | 'switch' | 'boost' | 'fire' | 'impact';

const PATTERNS: Record<HapticPattern, number | number[]> = {
  tap: 12,
  switch: 18,
  boost: [16, 20, 28],
  fire: [24, 15, 16],
  impact: [35, 20, 35],
};

export function triggerHaptic(pattern: HapticPattern, enabled = true): void {
  if (!enabled || typeof navigator === 'undefined' || !('vibrate' in navigator)) {
    return;
  }
  try {
    navigator.vibrate(PATTERNS[pattern]);
  } catch {
    // Ignore vibration errors in restricted browser contexts
  }
}
