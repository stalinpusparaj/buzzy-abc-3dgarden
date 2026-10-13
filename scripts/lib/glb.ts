/** Minimal GLB inspection for budgets: triangle count and embedded image sizes. No deps. */
interface GltfJson {
  meshes?: {
    primitives: { indices?: number; attributes: Record<string, number>; mode?: number }[];
  }[];
  accessors?: { count: number }[];
  images?: { bufferView?: number; uri?: string; mimeType?: string }[];
  bufferViews?: { byteOffset?: number; byteLength: number }[];
}

export interface GlbInfo {
  triangles: number;
  images: { width: number; height: number; mime: string }[];
}

export function inspectGlb(buf: Buffer): GlbInfo {
  if (buf.readUInt32LE(0) !== 0x46546c67) throw new Error('not a GLB');
  const jsonLen = buf.readUInt32LE(12);
  const json = JSON.parse(buf.subarray(20, 20 + jsonLen).toString('utf8')) as GltfJson;
  const binStart = 20 + jsonLen + 8;
  let triangles = 0;
  for (const mesh of json.meshes ?? []) {
    for (const p of mesh.primitives) {
      if (p.mode !== undefined && p.mode !== 4) continue;
      const acc =
        p.indices !== undefined
          ? json.accessors?.[p.indices]
          : json.accessors?.[p.attributes.POSITION ?? -1];
      triangles += Math.floor((acc?.count ?? 0) / 3);
    }
  }
  const images: GlbInfo['images'] = [];
  for (const img of json.images ?? []) {
    if (img.bufferView === undefined) continue;
    const bv = json.bufferViews?.[img.bufferView];
    if (!bv) continue;
    const start = binStart + (bv.byteOffset ?? 0);
    const dims = imageSize(buf.subarray(start, start + bv.byteLength));
    if (dims) images.push(dims);
  }
  return { triangles, images };
}

/** Width/height from PNG, JPEG, WebP or KTX2 headers. */
export function imageSize(b: Buffer): { width: number; height: number; mime: string } | null {
  if (b.length > 24 && b.readUInt32BE(0) === 0x89504e47) {
    return { width: b.readUInt32BE(16), height: b.readUInt32BE(20), mime: 'image/png' };
  }
  if (b.length > 4 && b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i < b.length - 9) {
      if (b[i] !== 0xff) return null;
      const marker = b[i + 1] ?? 0;
      const len = b.readUInt16BE(i + 2);
      if (
        marker >= 0xc0 &&
        marker <= 0xcf &&
        marker !== 0xc4 &&
        marker !== 0xc8 &&
        marker !== 0xcc
      ) {
        return { height: b.readUInt16BE(i + 5), width: b.readUInt16BE(i + 7), mime: 'image/jpeg' };
      }
      i += 2 + len;
    }
    return null;
  }
  if (
    b.length > 30 &&
    b.toString('ascii', 0, 4) === 'RIFF' &&
    b.toString('ascii', 8, 12) === 'WEBP'
  ) {
    const kind = b.toString('ascii', 12, 16);
    if (kind === 'VP8X')
      return {
        width: 1 + b.readUIntLE(24, 3),
        height: 1 + b.readUIntLE(27, 3),
        mime: 'image/webp',
      };
    if (kind === 'VP8L') {
      const bits = b.readUInt32LE(21);
      return {
        width: (bits & 0x3fff) + 1,
        height: ((bits >> 14) & 0x3fff) + 1,
        mime: 'image/webp',
      };
    }
    return {
      width: b.readUInt16LE(26) & 0x3fff,
      height: b.readUInt16LE(28) & 0x3fff,
      mime: 'image/webp',
    };
  }
  if (b.length > 28 && b[0] === 0xab && b.toString('ascii', 1, 4) === 'KTX') {
    return { width: b.readUInt32LE(20), height: b.readUInt32LE(24), mime: 'image/ktx2' };
  }
  return null;
}
