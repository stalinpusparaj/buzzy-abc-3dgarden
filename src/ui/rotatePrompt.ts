import { icons } from './icons';

/** Full-screen "rotate your phone" picture, shown by CSS in portrait (brief §4, no text). */
export function mountRotatePrompt(root: HTMLElement): void {
  const el = document.createElement('div');
  el.id = 'rotate-prompt';
  el.setAttribute('role', 'img');
  el.setAttribute('aria-label', 'Turn the device sideways');
  el.innerHTML = `<div class="rp-phone">${icons.phone}</div><div class="rp-arrow">${icons.rotateArrow}</div>`;
  root.appendChild(el);
}
