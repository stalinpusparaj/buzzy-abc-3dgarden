import type { Page } from '@playwright/test';

export interface Watch {
  errors: string[];
  requests: string[];
}

/** Collect console errors, page errors and every request URL for the page's lifetime. */
export function watch(page: Page): Watch {
  const w: Watch = { errors: [], requests: [] };
  page.on('console', (m) => {
    if (m.type() === 'error') w.errors.push(m.text());
  });
  page.on('pageerror', (e) => w.errors.push(String(e)));
  page.on('request', (r) => w.requests.push(r.url()));
  return w;
}

/** Every request must be same-origin (brief §10.2). data:/blob: URLs never leave the device. */
export function thirdParty(w: Watch, origin: string): string[] {
  return w.requests.filter(
    (u) => !u.startsWith('data:') && !u.startsWith('blob:') && new URL(u).origin !== origin,
  );
}
