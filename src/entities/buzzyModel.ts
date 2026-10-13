import {
  BufferAttribute,
  CircleGeometry,
  Color,
  CylinderGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  SphereGeometry,
  TorusGeometry,
  type BufferGeometry,
} from 'three';
import { markShared } from '../core/dispose';
import { mat, mergeColored, type Part } from '../core/geometry';
import { toon } from '../core/materials';
import { palette } from '../core/theme';

/** Body radius before the (1, 0.9, 1.1) squash from the brief. */
export const BODY_R = 0.9;

/** Sphere with two crisp stripe bands, coloured per triangle so the edges stay sharp. */
function stripedBody(): BufferGeometry {
  const g = new SphereGeometry(1, 24, 16).toNonIndexed();
  const pos = g.getAttribute('position');
  const col = new Float32Array(pos.count * 3);
  const yellow = new Color(palette.buzzyBody);
  const brown = new Color(palette.buzzyStripe);
  for (let i = 0; i < pos.count; i += 3) {
    const cy = (pos.getY(i) + pos.getY(i + 1) + pos.getY(i + 2)) / 3;
    const stripe = (cy < -0.2 && cy > -0.38) || (cy < -0.56 && cy > -0.71);
    const c = stripe ? brown : yellow;
    for (let v = 0; v < 3; v++) col.set([c.r, c.g, c.b], (i + v) * 3);
  }
  g.setAttribute('color', new BufferAttribute(col, 3));
  g.applyMatrix4(mat(0, 0, 0, 0, 0, 0, BODY_R, BODY_R * 0.9, BODY_R * 1.1));
  return g;
}

export interface BuzzyParts {
  body: Mesh;
  eyes: Group; // whites (blink by scaling y)
  pupils: Mesh; // moves to track the camera
  wingL: Group;
  wingR: Group;
}

let cache: {
  body: BufferGeometry;
  whites: BufferGeometry;
  pupils: BufferGeometry;
  wing: BufferGeometry;
} | null = null;

function geometries(): NonNullable<typeof cache> {
  if (cache) return cache;
  const extras = mergeColored([
    // cheeks, smile, antennae, little arms
    {
      geo: new SphereGeometry(0.17, 10, 6),
      color: palette.buzzyCheek,
      matrix: mat(0.5, -0.02, 0.78, 0, 0, 0, 1, 0.6, 0.4),
    },
    {
      geo: new SphereGeometry(0.17, 10, 6),
      color: palette.buzzyCheek,
      matrix: mat(-0.5, -0.02, 0.78, 0, 0, 0, 1, 0.6, 0.4),
    },
    {
      geo: new TorusGeometry(0.13, 0.035, 6, 12, Math.PI),
      color: palette.buzzyStripe,
      matrix: mat(0, 0.03, 0.96, 0, 0, Math.PI),
    },
    ...antenna(1),
    ...antenna(-1),
    {
      geo: new SphereGeometry(0.16, 8, 6),
      color: palette.buzzyBody,
      matrix: mat(0.85, -0.25, 0.25),
    },
    {
      geo: new SphereGeometry(0.16, 8, 6),
      color: palette.buzzyBody,
      matrix: mat(-0.85, -0.25, 0.25),
    },
  ]);
  const body = mergeBodies(stripedBody(), extras);
  const whites = mergeColored([
    {
      geo: new SphereGeometry(0.25, 14, 10),
      color: palette.eyeWhite,
      matrix: mat(0.28, 0.3, 0.78, 0, 0, 0, 1, 1.2, 0.6),
    },
    {
      geo: new SphereGeometry(0.25, 14, 10),
      color: palette.eyeWhite,
      matrix: mat(-0.28, 0.3, 0.78, 0, 0, 0, 1, 1.2, 0.6),
    },
  ]);
  const pupils = mergeColored([
    {
      geo: new SphereGeometry(0.12, 10, 8),
      color: palette.pupil,
      matrix: mat(0.28, 0.3, 0.9, 0, 0, 0, 1, 1.2, 0.6),
    },
    {
      geo: new SphereGeometry(0.12, 10, 8),
      color: palette.pupil,
      matrix: mat(-0.28, 0.3, 0.9, 0, 0, 0, 1, 1.2, 0.6),
    },
    { geo: new SphereGeometry(0.04, 6, 4), color: 0xffffff, matrix: mat(0.31, 0.36, 0.97) },
    { geo: new SphereGeometry(0.04, 6, 4), color: 0xffffff, matrix: mat(-0.25, 0.36, 0.97) },
  ]);
  const wing = new CircleGeometry(0.5, 16);
  wing.applyMatrix4(mat(0.55, 0.25, 0, 0, 0, 0.2, 1.25, 0.8, 1)); // pivot at the wing root
  cache = {
    body: markShared(body),
    whites: markShared(whites),
    pupils: markShared(pupils),
    wing: markShared(wing),
  };
  return cache;
}

function antenna(side: number): Part[] {
  return [
    {
      geo: new CylinderGeometry(0.03, 0.035, 0.45, 5),
      color: palette.buzzyStripe,
      matrix: mat(side * 0.22, 0.95, 0.25, 0.3, 0, side * -0.35),
    },
    {
      geo: new SphereGeometry(0.09, 8, 6),
      color: palette.buzzyStripe,
      matrix: mat(side * 0.31, 1.16, 0.33),
    },
  ];
}

function mergeBodies(a: BufferGeometry, b: BufferGeometry): BufferGeometry {
  const cat = (name: string): Float32Array => {
    const x = a.getAttribute(name).array as Float32Array;
    const y = b.getAttribute(name).array as Float32Array;
    const out = new Float32Array(x.length + y.length);
    out.set(x);
    out.set(y, x.length);
    return out;
  };
  const g = a.clone();
  for (const n of ['position', 'normal', 'color'])
    g.setAttribute(n, new BufferAttribute(cat(n), 3));
  g.deleteAttribute('uv');
  g.computeBoundingSphere();
  a.dispose();
  b.dispose();
  return g;
}

const wingMaterial = markShared(
  new MeshBasicMaterial({
    color: palette.buzzyWing,
    transparent: true,
    opacity: palette.buzzyWingOpacity,
    side: DoubleSide,
    depthWrite: false,
  }),
);

/** Placeholder Buzzy (brief §4): 5 draw calls (body, eye whites, pupils, 2 wings). */
export function buildBuzzy(): BuzzyParts {
  const g = geometries();
  const body = new Mesh(g.body, toon('vertex'));
  body.castShadow = true;
  const eyes = new Group();
  eyes.add(new Mesh(g.whites, toon('vertex')));
  const pupils = new Mesh(g.pupils, toon('vertex'));
  const wing = (side: number): Group => {
    const pivot = new Group();
    pivot.position.set(side * 0.25, 0.55, -0.45);
    const m = new Mesh(g.wing, wingMaterial);
    m.scale.x = side;
    m.rotation.y = side * -0.5;
    pivot.add(m);
    return pivot;
  };
  return { body, eyes, pupils, wingL: wing(-1), wingR: wing(1) };
}
