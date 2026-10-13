import {
  BufferAttribute,
  BufferGeometry,
  Color,
  Euler,
  Matrix4,
  Quaternion,
  Vector3,
  type Curve,
} from 'three';

/** One primitive in a merged, vertex-coloured mesh. `geo` is consumed (disposed) by the merge. */
export interface Part {
  geo: BufferGeometry;
  color: number;
  matrix?: Matrix4;
}

const tmpColor = new Color();

/** Build a transform matrix: position, euler rotation (radians), scale. */
export function mat(
  x = 0,
  y = 0,
  z = 0,
  rx = 0,
  ry = 0,
  rz = 0,
  sx = 1,
  sy = sx,
  sz = sx,
): Matrix4 {
  return new Matrix4().compose(
    new Vector3(x, y, z),
    new Quaternion().setFromEuler(new Euler(rx, ry, rz)),
    new Vector3(sx, sy, sz),
  );
}

/**
 * Merge primitives into one non-indexed geometry with a per-vertex `color` attribute so a
 * whole prop or the whole static garden costs one draw call (brief §7.4: ≤ 80 calls).
 */
export function mergeColored(parts: Part[]): BufferGeometry {
  const chunks: { pos: ArrayLike<number>; nor: ArrayLike<number>; color: Color }[] = [];
  let count = 0;
  for (const p of parts) {
    const g = p.geo.index ? p.geo.toNonIndexed() : p.geo;
    if (p.matrix) g.applyMatrix4(p.matrix);
    if (!g.getAttribute('normal')) g.computeVertexNormals();
    chunks.push({
      pos: g.getAttribute('position').array,
      nor: g.getAttribute('normal').array,
      color: tmpColor.setHex(p.color).clone(),
    });
    count += g.getAttribute('position').count;
    if (g !== p.geo) g.dispose();
    p.geo.dispose();
  }
  const pos = new Float32Array(count * 3);
  const nor = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  let o = 0;
  for (const c of chunks) {
    pos.set(c.pos, o);
    nor.set(c.nor, o);
    for (let i = 0; i < c.pos.length; i += 3) {
      col[o + i] = c.color.r;
      col[o + i + 1] = c.color.g;
      col[o + i + 2] = c.color.b;
    }
    o += c.pos.length;
  }
  const out = new BufferGeometry();
  out.setAttribute('position', new BufferAttribute(pos, 3));
  out.setAttribute('normal', new BufferAttribute(nor, 3));
  out.setAttribute('color', new BufferAttribute(col, 3));
  out.computeBoundingSphere();
  out.computeBoundingBox();
  return out;
}

/** Flat ribbon (e.g. the garden path) following `curve` at height `y`. */
export function ribbon(
  curve: Curve<Vector3>,
  width: number,
  segments: number,
  y: number,
): BufferGeometry {
  const pts = curve.getSpacedPoints(segments);
  const pos: number[] = [];
  const side = new Vector3();
  const up = new Vector3(0, 1, 0);
  const edge = (i: number): [Vector3, Vector3] => {
    const p = pts[i] ?? new Vector3();
    const t = curve.getTangentAt(i / segments);
    side
      .crossVectors(t, up)
      .normalize()
      .multiplyScalar(width / 2);
    return [new Vector3(p.x + side.x, y, p.z + side.z), new Vector3(p.x - side.x, y, p.z - side.z)];
  };
  let [a0, b0] = edge(0);
  for (let i = 1; i <= segments; i++) {
    const [a1, b1] = edge(i);
    pos.push(a0.x, a0.y, a0.z, a1.x, a1.y, a1.z, b0.x, b0.y, b0.z);
    pos.push(b0.x, b0.y, b0.z, a1.x, a1.y, a1.z, b1.x, b1.y, b1.z);
    a0 = a1;
    b0 = b1;
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  const nor = new Float32Array(pos.length);
  for (let i = 1; i < nor.length; i += 3) nor[i] = 1;
  g.setAttribute('normal', new BufferAttribute(nor, 3));
  return g;
}
