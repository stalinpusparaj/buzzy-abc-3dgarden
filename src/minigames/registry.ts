import type { MiniGame } from './MiniGame';

/**
 * Template registry (brief §5.5). Adding a 4th template = one id + one factory here.
 * Factories use dynamic import, so each template is its own lazily-loaded chunk.
 */
export const TEMPLATE_IDS = ['pollenPop', 'traceTrail', 'basketMatch'] as const;
export type TemplateId = (typeof TEMPLATE_IDS)[number];

export const registry: Record<TemplateId, () => Promise<MiniGame>> = {
  pollenPop: () => import('./PollenPop').then((m) => new m.PollenPop()),
  traceTrail: () => import('./TraceTrail').then((m) => new m.TraceTrail()),
  basketMatch: () => import('./BasketMatch').then((m) => new m.BasketMatch()),
};
