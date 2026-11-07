import {
  BufferGeometry,
  BufferAttribute,
  Points,
  ShaderMaterial,
  AdditiveBlending,
  NormalBlending,
  Color,
} from 'three';

/* Um único Points. O buffer nunca é recriado: dois atributos de
   posição (aFrom / aTo) e um uniform uMorph fazem toda a morfose no
   vertex shader. Cada forma-alvo é um Float32Array pré-computado. */

const VERT = /* glsl */ `
  attribute vec3 aFrom;
  attribute vec3 aTo;
  attribute float aSeed;

  uniform float uMorph;
  uniform float uTime;
  uniform float uSize;
  uniform float uScale;

  varying float vFade;

  void main() {
    float t = uMorph * uMorph * (3.0 - 2.0 * uMorph);
    vec3 p = mix(aFrom, aTo, t);

    // deriva lenta, para a nuvem nunca parecer congelada
    float w = uTime * 0.18 + aSeed * 6.2831;
    p += vec3(sin(w), cos(w * 0.87), sin(w * 1.13)) * 0.022;
    p *= uScale;

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = uSize * (1.0 / -mv.z) * (0.65 + aSeed * 0.7);
    vFade = 0.45 + aSeed * 0.55;
  }
`;

const FRAG = /* glsl */ `
  precision mediump float;
  uniform vec3 uColor;
  uniform float uOpacity;
  varying float vFade;

  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = dot(c, c);
    if (d > 0.25) discard;
    float a = smoothstep(0.25, 0.04, d);
    gl_FragColor = vec4(uColor, a * vFade * uOpacity);
  }
`;

/* ---------- formas-alvo ---------- */

function sphere(count, r = 1.6) {
  const a = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    // distribuição de Fibonacci: sem acúmulo nos polos
    const y = 1 - (i / (count - 1)) * 2;
    const rad = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = i * 2.399963229728653;
    a[i * 3] = Math.cos(theta) * rad * r;
    a[i * 3 + 1] = y * r;
    a[i * 3 + 2] = Math.sin(theta) * rad * r;
  }
  return a;
}

function ring(count, r = 2.3, thickness = 0.24) {
  const a = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const t = (i / count) * Math.PI * 2;
    const rr = r + (Math.random() - 0.5) * thickness * 2;
    a[i * 3] = Math.cos(t) * rr;
    a[i * 3 + 1] = (Math.random() - 0.5) * thickness;
    a[i * 3 + 2] = Math.sin(t) * rr * 0.34;
  }
  return a;
}

/* Um satélite por métrica. */
function clusters(count, centers, spread = 0.42) {
  const a = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const c = centers[i % centers.length];
    const u = Math.random() ** 0.5 * spread;
    const th = Math.random() * Math.PI * 2;
    const ph = Math.acos(2 * Math.random() - 1);
    a[i * 3] = c[0] + u * Math.sin(ph) * Math.cos(th);
    a[i * 3 + 1] = c[1] + u * Math.sin(ph) * Math.sin(th);
    a[i * 3 + 2] = c[2] + u * Math.cos(ph) * 0.6;
  }
  return a;
}

/* A lente que passa sobre os prints dos cases. */
function disc(count, r = 2.1) {
  const a = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const u = Math.sqrt((i + 0.5) / count) * r;
    const th = i * 2.399963229728653;
    a[i * 3] = Math.cos(th) * u;
    a[i * 3 + 1] = Math.sin(th) * u;
    a[i * 3 + 2] = (Math.random() - 0.5) * 0.06;
  }
  return a;
}

export const SHAPES = { sphere, ring, clusters, disc };

export function createParticles({ count = 3000 } = {}) {
  const base = sphere(count);

  const geometry = new BufferGeometry();
  const seeds = new Float32Array(count);
  for (let i = 0; i < count; i++) seeds[i] = Math.random();

  const from = new BufferAttribute(base.slice(), 3);
  const to = new BufferAttribute(base.slice(), 3);
  from.setUsage(35048); // DynamicDrawUsage
  to.setUsage(35048);

  geometry.setAttribute('position', new BufferAttribute(base.slice(), 3));
  geometry.setAttribute('aFrom', from);
  geometry.setAttribute('aTo', to);
  geometry.setAttribute('aSeed', new BufferAttribute(seeds, 1));

  const material = new ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: true,
    depthWrite: false,
    blending: NormalBlending,
    uniforms: {
      uMorph: { value: 1 },
      uTime: { value: 0 },
      uSize: { value: 90 },
      uScale: { value: 1 },
      uColor: { value: new Color('#13273F') },
      uOpacity: { value: 0 },
    },
  });

  const points = new Points(geometry, material);
  points.frustumCulled = false;

  let current = base.slice();

  /* Morfose interrompível: as posições de agora viram o novo aFrom,
     então nada salta se o scroll mudar de ideia no meio. */
  function morphTo(next) {
    const t = material.uniforms.uMorph.value;
    const e = t * t * (3 - 2 * t);
    const a = from.array;
    const b = to.array;
    for (let i = 0; i < current.length; i++) {
      current[i] = a[i] + (b[i] - a[i]) * e;
    }
    a.set(current);
    b.set(next);
    from.needsUpdate = true;
    to.needsUpdate = true;
    material.uniforms.uMorph.value = 0;
  }

  return { points, geometry, material, morphTo, count };
}
