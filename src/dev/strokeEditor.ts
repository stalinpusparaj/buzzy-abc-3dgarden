import { glyphBox, parseOutline, type GlyphOutline } from '../core/glyphBox';
import lettersEn from '../data/letters.en.json';
import lettersTa from '../data/letters.ta.json';
import type { Lang, LetterDef, StrokeDef } from '../data/types';
import { outline } from '../entities/Glyph3D';

/**
 * Dev-only Stroke Editor (brief §5.3) at /?dev=strokes[&lang=ta&id=ta_a].
 * Click to place points, Enter ends a stroke, Backspace undoes, Export copies the JSON.
 * Existing stroke files are drawn in grey so you can redraw them.
 */
const existing = import.meta.glob<{ default: StrokeDef }>('../data/strokes/*/*.json', {
  eager: true,
});
const LETTERS: Record<Lang, LetterDef[]> = {
  en: lettersEn as LetterDef[],
  ta: lettersTa as LetterDef[],
};
const SIZE = 560;

function glyphPath2D(o: GlyphOutline): Path2D {
  const { cx, cy, size } = glyphBox(o);
  const X = (v: number): number => ((v - cx) / size + 0.5) * SIZE;
  const Y = (v: number): number => (1 - ((v - cy) / size + 0.5)) * SIZE;
  const p = new Path2D();
  for (const { op, n } of parseOutline(o.d)) {
    const v = (i: number): number => n[i] ?? 0;
    if (op === 'M') p.moveTo(X(v(0)), Y(v(1)));
    else if (op === 'L') p.lineTo(X(v(0)), Y(v(1)));
    else if (op === 'Q') p.quadraticCurveTo(X(v(0)), Y(v(1)), X(v(2)), Y(v(3)));
    else if (op === 'C') p.bezierCurveTo(X(v(0)), Y(v(1)), X(v(2)), Y(v(3)), X(v(4)), Y(v(5)));
    else p.closePath();
  }
  return p;
}

export function startStrokeEditor(root: HTMLElement): void {
  const q = new URLSearchParams(location.search);
  let lang: Lang = q.get('lang') === 'ta' ? 'ta' : 'en';
  let id = q.get('id') ?? LETTERS[lang][0]?.id ?? 'A';
  let strokes: [number, number][][] = [];
  let cur: [number, number][] = [];

  root.innerHTML = `
    <div id="stroke-editor" class="devtool">
      <canvas width="${SIZE}" height="${SIZE}"></canvas>
      <div class="panel">
        <strong>Stroke editor (dev only)</strong>
        <label>Language <select id="se-lang"><option value="en">English</option><option value="ta">தமிழ்</option></select></label>
        <label>Letter <select id="se-id"></select></label>
        <p>Click to add points. <b>Enter</b> ends the stroke. <b>Backspace</b> undoes.
        Strokes are numbered in order; the green dot is each start. Box is 0–1, y up.</p>
        <div class="row"><button id="se-clear">Clear</button><button id="se-load">Load saved</button><button id="se-export">Export JSON</button></div>
        <textarea id="se-out" rows="12"></textarea>
        <span id="se-msg"></span>
      </div>
    </div>`;
  const canvas = root.querySelector('canvas') as HTMLCanvasElement;
  const g = canvas.getContext('2d') as CanvasRenderingContext2D;
  const langSel = root.querySelector('#se-lang') as HTMLSelectElement;
  const idSel = root.querySelector('#se-id') as HTMLSelectElement;
  const out = root.querySelector('#se-out') as HTMLTextAreaElement;
  const msg = root.querySelector('#se-msg') as HTMLElement;

  const saved = (): StrokeDef | undefined =>
    existing[`../data/strokes/${lang}/${id}.json`]?.default;
  const letter = (): LetterDef | undefined => LETTERS[lang].find((l) => l.id === id);
  const toPx = ([u, v]: [number, number]): [number, number] => [u * SIZE, (1 - v) * SIZE];

  const drawStroke = (pts: [number, number][], color: string, n: number | null): void => {
    if (!pts.length) return;
    g.strokeStyle = color;
    g.lineWidth = 6;
    g.lineCap = g.lineJoin = 'round';
    g.beginPath();
    pts.forEach((p, i) => (i ? g.lineTo(...toPx(p)) : g.moveTo(...toPx(p))));
    g.stroke();
    const [sx, sy] = toPx(pts[0] as [number, number]);
    g.fillStyle = '#3ccf4e';
    g.beginPath();
    g.arc(sx, sy, 10, 0, Math.PI * 2);
    g.fill();
    if (n !== null) {
      g.fillStyle = '#fff';
      g.font = 'bold 13px system-ui';
      g.fillText(String(n), sx - 4, sy + 5);
    }
  };

  const draw = (): void => {
    g.clearRect(0, 0, SIZE, SIZE);
    g.strokeStyle = '#e4dccb';
    g.strokeRect(0.05 * SIZE, 0.05 * SIZE, 0.9 * SIZE, 0.9 * SIZE);
    const l = letter();
    const o = l ? outline(lang, l.glyph) : undefined;
    if (o) {
      g.fillStyle = '#f2d7a1';
      g.fill(glyphPath2D(o), 'nonzero');
    }
    saved()?.strokes.forEach((s, i) =>
      drawStroke(s as [number, number][], 'rgba(0,0,0,0.18)', i + 1),
    );
    strokes.forEach((s, i) => drawStroke(s, '#ff6b6b', i + 1));
    drawStroke(cur, '#2f6fd6', null);
  };

  const fillIds = (): void => {
    idSel.innerHTML = LETTERS[lang]
      .map((l) => `<option value="${l.id}">${l.id} ${l.glyph}</option>`)
      .join('');
    if (!LETTERS[lang].some((l) => l.id === id)) id = LETTERS[lang][0]?.id ?? '';
    idSel.value = id;
  };

  langSel.value = lang;
  langSel.onchange = () => {
    lang = langSel.value === 'ta' ? 'ta' : 'en';
    fillIds();
    strokes = [];
    cur = [];
    draw();
  };
  idSel.onchange = () => {
    id = idSel.value;
    strokes = [];
    cur = [];
    draw();
  };
  canvas.addEventListener('pointerdown', (e) => {
    const r = canvas.getBoundingClientRect();
    const u = Math.round(((e.clientX - r.left) / r.width) * 1000) / 1000;
    const v = Math.round((1 - (e.clientY - r.top) / r.height) * 1000) / 1000;
    cur.push([Math.min(1, Math.max(0, u)), Math.min(1, Math.max(0, v))]);
    draw();
  });
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && cur.length >= 2) {
      strokes.push(cur);
      cur = [];
    } else if (e.key === 'Backspace' && e.target === document.body) {
      if (cur.length) cur.pop();
      else strokes.pop();
    } else return;
    e.preventDefault();
    draw();
  });
  (root.querySelector('#se-clear') as HTMLButtonElement).onclick = () => {
    strokes = [];
    cur = [];
    draw();
  };
  (root.querySelector('#se-load') as HTMLButtonElement).onclick = () => {
    strokes = saved()?.strokes.map((s) => s.map((p) => [p[0], p[1]] as [number, number])) ?? [];
    draw();
  };
  (root.querySelector('#se-export') as HTMLButtonElement).onclick = () => {
    const all = cur.length >= 2 ? [...strokes, cur] : strokes;
    const json = JSON.stringify({ id, strokes: all });
    out.value = json;
    void navigator.clipboard?.writeText(json).then(
      () => (msg.textContent = `Copied. Save as src/data/strokes/${lang}/${id}.json`),
      () => (msg.textContent = `Save as src/data/strokes/${lang}/${id}.json`),
    );
  };
  fillIds();
  draw();
}
