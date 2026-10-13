import { BackSide, Color, Mesh, ShaderMaterial, SphereGeometry } from 'three';
import { palette } from '../core/theme';

/** Vertical gradient on a large inverted sphere (brief §4: no skybox texture). */
export function createSky(radius = 300): Mesh {
  const material = new ShaderMaterial({
    side: BackSide,
    depthWrite: false,
    uniforms: {
      top: { value: new Color(palette.skyTop) },
      bottom: { value: new Color(palette.skyBottom) },
    },
    vertexShader: /* glsl */ `
      varying float vH;
      void main() {
        vH = normalize(position).y;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 top;
      uniform vec3 bottom;
      varying float vH;
      void main() {
        float k = smoothstep(-0.15, 0.6, vH);
        gl_FragColor = vec4(mix(bottom, top, k), 1.0);
        #include <colorspace_fragment>
      }`,
  });
  const sky = new Mesh(new SphereGeometry(radius, 24, 12), material);
  sky.name = 'sky';
  sky.renderOrder = -1;
  sky.frustumCulled = false;
  return sky;
}
