import { CanvasTexture, SRGBColorSpace } from 'three';

/**
 * Canvas sprites for the Trace-the-Trail guide (brief §5.3). Every shape is drawn pointing
 * right (+x), white-on-dark so it reads on any petal colour, and owned by the caller
 * (disposed with the guide: no shared caches, no leaks).
 */
const INK = '#3b2a20';
const SIZE = 128;

function paint(draw: (g: CanvasRenderingContext2D) => void): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = SIZE;
  const g = c.getContext('2d');
  if (g) {
    g.lineJoin = 'round';
    g.lineCap = 'round';
    draw(g);
  }
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** Outline the current path twice (ink, then white) and fill it: a sticker look. */
function sticker(g: CanvasRenderingContext2D, fill: string, ink = 26, white = 13): void {
  g.lineWidth = ink;
  g.strokeStyle = INK;
  g.stroke();
  g.lineWidth = white;
  g.strokeStyle = '#ffffff';
  g.stroke();
  g.fillStyle = fill;
  g.fill();
}

/** "›" chevron: a white stroke with an ink rim. Instance colour tints the white. */
export function chevronTexture(): CanvasTexture {
  return paint((g) => {
    g.beginPath();
    g.moveTo(44, 24);
    g.lineTo(86, 64);
    g.lineTo(44, 104);
    g.lineWidth = 42;
    g.strokeStyle = INK;
    g.stroke();
    g.lineWidth = 25;
    g.strokeStyle = '#ffffff';
    g.stroke();
  });
}

/** Fat green "go" arrow for the start of a stroke. */
export function arrowTexture(fill: string): CanvasTexture {
  return paint((g) => {
    g.beginPath();
    // A classic "→": shaft plus a wide head, unmistakable at any angle.
    g.moveTo(16, 53);
    g.lineTo(62, 53);
    g.lineTo(62, 24);
    g.lineTo(112, 64);
    g.lineTo(62, 104);
    g.lineTo(62, 75);
    g.lineTo(16, 75);
    g.closePath();
    sticker(g, fill);
  });
}

/** Five-point "stop here" star for the end of a stroke. */
export function starTexture(fill: string): CanvasTexture {
  return paint((g) => {
    g.beginPath();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 === 0 ? 50 : 23;
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      g.lineTo(64 + r * Math.cos(a), 66 + r * Math.sin(a));
    }
    g.closePath();
    sticker(g, fill);
    g.beginPath();
    g.arc(56, 56, 7, 0, Math.PI * 2);
    g.fillStyle = 'rgba(255,255,255,0.75)';
    g.fill();
  });
}

/** White ring with ink rims (start badge, ripple and dot target). */
export function ringTexture(): CanvasTexture {
  return paint((g) => {
    g.beginPath();
    g.arc(64, 64, 46, 0, Math.PI * 2);
    g.lineWidth = 22;
    g.strokeStyle = INK;
    g.stroke();
    g.lineWidth = 11;
    g.strokeStyle = '#ffffff';
    g.stroke();
  });
}

/** Soft warm glow with four twinkle rays: the "follow me" sparkle and its trail. */
export function sparkTexture(): CanvasTexture {
  return paint((g) => {
    const grad = g.createRadialGradient(64, 64, 0, 64, 64, 62);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.25, 'rgba(255,250,200,1)');
    grad.addColorStop(0.55, 'rgba(255,200,60,0.55)');
    grad.addColorStop(1, 'rgba(255,170,0,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, SIZE, SIZE);
    g.fillStyle = 'rgba(255,255,255,0.95)';
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2;
      g.beginPath();
      g.moveTo(64 + Math.cos(a) * 62, 64 + Math.sin(a) * 62);
      g.lineTo(64 + Math.cos(a + 0.5) * 10, 64 + Math.sin(a + 0.5) * 10);
      g.lineTo(64 + Math.cos(a - 0.5) * 10, 64 + Math.sin(a - 0.5) * 10);
      g.closePath();
      g.fill();
    }
  });
}
