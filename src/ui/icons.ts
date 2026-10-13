/** Inline SVG icons (brief P1: buttons are icons only). Attributes only: CSP-safe, no style=. */
const svg = (body: string, vb = '0 0 64 64'): string =>
  `<svg viewBox="${vb}" aria-hidden="true" focusable="false">${body}</svg>`;

export const icons = {
  home: svg(
    '<path d="M32 10 8 30h7v22h13V38h8v14h13V30h7z" fill="#fff" stroke="#3b2a20" stroke-width="3" stroke-linejoin="round"/><circle cx="32" cy="26" r="4" fill="#ff8fa3"/>',
  ),
  soundOn: svg(
    '<path d="M10 24h10l14-11v38L20 40H10z" fill="#fff" stroke="#3b2a20" stroke-width="3" stroke-linejoin="round"/><path d="M42 22c5 5 5 15 0 20M48 16c9 9 9 23 0 32" fill="none" stroke="#3b2a20" stroke-width="4" stroke-linecap="round"/>',
  ),
  soundOff: svg(
    '<path d="M10 24h10l14-11v38L20 40H10z" fill="#fff" stroke="#3b2a20" stroke-width="3" stroke-linejoin="round"/><path d="m42 24 14 16M56 24 42 40" stroke="#3b2a20" stroke-width="4" stroke-linecap="round"/>',
  ),
  play: svg(
    '<circle cx="32" cy="32" r="29" fill="#ffd23f" stroke="#3b2a20" stroke-width="3"/><path d="M25 18v28l22-14z" fill="#3b2a20" stroke="#3b2a20" stroke-width="3" stroke-linejoin="round"/>',
  ),
  skip: svg(
    '<path d="M12 14v36l20-18zM32 14v36l20-18z" fill="#fff" stroke="#3b2a20" stroke-width="3" stroke-linejoin="round"/>',
  ),
  parent: svg(
    '<circle cx="24" cy="22" r="8" fill="#fff" stroke="#3b2a20" stroke-width="3"/><circle cx="43" cy="26" r="6" fill="#fff" stroke="#3b2a20" stroke-width="3"/><path d="M10 50c0-10 6-16 14-16s14 6 14 16zM34 50c0-7 4-12 9-12s9 5 9 12z" fill="#fff" stroke="#3b2a20" stroke-width="3" stroke-linejoin="round"/>',
  ),
  finger: svg(
    '<path d="M26 8c3 0 5 2 5 5v17l3-1c3-1 5 0 6 2l1 2 3-1c3 0 5 1 5 4v1l3-1c3 0 5 2 5 5v8c0 9-7 15-16 15h-4c-6 0-10-3-13-8L12 41c-2-3 0-6 3-6 2 0 3 1 5 3l1 1V13c0-3 2-5 5-5z" fill="#fff" stroke="#3b2a20" stroke-width="3" stroke-linejoin="round"/>',
  ),
  phone: svg(
    '<rect x="20" y="6" width="24" height="52" rx="5" fill="#fff" stroke="#3b2a20" stroke-width="3"/><circle cx="32" cy="51" r="2.5" fill="#3b2a20"/><rect x="24" y="12" width="16" height="33" rx="2" fill="#8ed1fc"/>',
  ),
  rotateArrow: svg(
    '<path d="M50 20A22 22 0 0 0 14 22" fill="none" stroke="#ff8fa3" stroke-width="5" stroke-linecap="round"/><path d="m8 14 6 9 9-6" fill="none" stroke="#ff8fa3" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>',
  ),
  bee: svg(
    '<ellipse cx="22" cy="22" rx="9" ry="12" fill="#fff" opacity=".8" transform="rotate(-25 22 22)"/><ellipse cx="42" cy="22" rx="9" ry="12" fill="#fff" opacity=".8" transform="rotate(25 42 22)"/><circle cx="32" cy="38" r="20" fill="#ffd23f" stroke="#3b2a20" stroke-width="2"/><path d="M14 44h36M16 52h32" stroke="#3b2a20" stroke-width="5"/><circle cx="25" cy="33" r="5" fill="#fff"/><circle cx="39" cy="33" r="5" fill="#fff"/><circle cx="26" cy="34" r="2.5" fill="#1d1720"/><circle cx="40" cy="34" r="2.5" fill="#1d1720"/><circle cx="19" cy="40" r="3" fill="#ff8fa3"/><circle cx="45" cy="40" r="3" fill="#ff8fa3"/>',
  ),
};

/** Icon-only button with an accessible label for screen readers and parents. */
export function iconButton(id: string, icon: string, label: string): HTMLButtonElement {
  const b = document.createElement('button');
  b.id = id;
  b.type = 'button';
  b.className = 'icon-btn';
  b.setAttribute('aria-label', label);
  b.innerHTML = icon;
  return b;
}
