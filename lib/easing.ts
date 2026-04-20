/**
 * Easing functions for prototype transitions.
 * Maps EasingType to CSS cubic-bezier strings.
 */

import { EasingType } from '@/lib/types';

export const EASING_MAP: Record<EasingType, string> = {
  'ease': 'cubic-bezier(0.4, 0, 0.2, 1)',
  'easeIn': 'cubic-bezier(0.4, 0, 1, 1)',
  'easeOut': 'cubic-bezier(0, 0, 0.2, 1)',
  'easeInOut': 'cubic-bezier(0.4, 0, 0.2, 1)',
  'linear': 'linear',
  'spring': 'cubic-bezier(0.175, 0.885, 0.32, 1.275)',
  'bounce': 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
  'elastic': 'cubic-bezier(0.68, -0.6, 0.32, 1.6)',
};

export function getEasingCss(easing?: EasingType): string {
  return easing ? EASING_MAP[easing] : EASING_MAP['ease'];
}

/**
 * Get CSS transition string for a given duration and easing.
 */
export function getTransitionCss(
  duration: number,
  easing?: EasingType,
  properties: string[] = ['all']
): string {
  return `${properties.join(', ')} ${duration}ms ${getEasingCss(easing)}`;
}
