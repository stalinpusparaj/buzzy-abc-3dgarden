/**
 * Dev tools entry. Only reachable behind `__DEV_TOOLS__`, so production builds never include it.
 * check-budgets.ts greps dist/ for this marker to prove that.
 */
export const DEV_TOOLS_MARKER = 'BUZZY_DEV_TOOLS_PRESENT';

export type DevMode = 'perf' | 'strokes' | 'cues';

export function readDevMode(search: string): DevMode | null {
  const v = new URLSearchParams(search).get('dev');
  return v === 'perf' || v === 'strokes' || v === 'cues' ? v : null;
}

export { attachPerfOverlay } from './perfOverlay';
