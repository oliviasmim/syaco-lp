import {
  MeshPhysicalMaterial,
  Shape,
  ExtrudeGeometry,
  DirectionalLight,
  HemisphereLight,
} from 'three';
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js';

/* ============================================================
   Os dois corpos da marca.

   A esfera saiu. Uma esfera é a única forma que é igual de todo
   ângulo: girar não comunica nada, o parallax não comunica nada, e
   o material vira brilho de bola de bilhar. Ela também não era a
   marca — era um objeto de starter kit.

   O logo `S.` foi separado nas duas peças de verdade:

     mark — o `S` extrudado, de public/syaco-s.svg (mesmo viewBox de
            syaco-mark.svg, sem o ponto);
     disc — o ponto: um disco biselado que, de frente, é um círculo
            chapado, ou seja, já é o ponto final.

   Encaixados (MARK_DOT), os dois são o logo inteiro. Soltos, o `S`
   sai de cena e o disco segue sozinho pela página.

   CONVENÇÃO DE ESCALA: as geometrias são normalizadas para ALTURA 1.
   `mark.scale` é a altura do logo inteiro; `disc.scale` é o diâmetro.
   ============================================================ */

/* Onde o ponto encaixa no `S`, em unidades da geometria (altura do
   logo = 1). Medido no traçado de syaco-mark.svg: círculo de centro
   (1670.8, 1511.25) e raio 299.8 no viewBox.
     x, y — deslocamento do centro do ponto;
     d    — diâmetro, com bisel;
     z    — quanto engrossar o disco para ter a espessura do `S`. */
export const MARK_DOT = { x: 0.37096, y: -0.32546, d: 0.3433, z: 1.51 };

/* Caixa do logo inteiro, com o bisel: é ela que dá altura 1, para o
   `S` sem o ponto continuar no mesmo lugar e no mesmo tamanho. */
const MARK_BOX = { cx: 984, cy: 908.7, h: 1851.4, depth: 95 };

const NAVY = '#13273F';

/* Tinta, não verniz: rugosidade alta, clearcoat quase nulo e um
   sheen creme de leve. O que uma Pantone coated parece na mão. */
export function createInkMaterial() {
  const m = new MeshPhysicalMaterial({
    color: NAVY,
    roughness: 0.62,
    metalness: 0,
    clearcoat: 0.08,
    clearcoatRoughness: 0.8,
  });
  /* Sem sheen. Testado com sheenColor creme a 0.45: o lobo
     retrorreflexivo espalhava calor pela superfície inteira e o
     Mystic Navy saía em (45,51,62) — cinza-ardósia, não a cor da
     marca. A rugosidade sozinha já dá o aspecto de tinta. */
  return m;
}

export function createDiscGeometry({ depth = 0.34, segments = 96 } = {}) {
  const s = new Shape();
  s.absarc(0, 0, 1, 0, Math.PI * 2, false);
  const g = new ExtrudeGeometry(s, {
    depth,
    curveSegments: segments,
    bevelEnabled: true,
    bevelThickness: 0.1,
    bevelSize: 0.09,
    bevelSegments: 10,
  });
  g.center();
  g.scale(0.5, 0.5, 0.5); // altura 1
  g.computeVertexNormals();
  return g;
}

export async function createMarkGeometry(url = '/syaco-s.svg') {
  const txt = await fetch(url).then((r) => r.text());
  const data = new SVGLoader().parse(txt.replaceAll('currentColor', NAVY));

  const shapes = [];
  for (const path of data.paths) {
    for (const sh of SVGLoader.createShapes(path)) shapes.push(sh);
  }
  if (!shapes.length) return null;

  const g = new ExtrudeGeometry(shapes, {
    depth: 190,
    bevelEnabled: true,
    bevelThickness: 24,
    bevelSize: 18,
    bevelSegments: 6,
    curveSegments: 24,
  });
  g.translate(-MARK_BOX.cx, -MARK_BOX.cy, -MARK_BOX.depth);
  /* O Y do SVG cresce para baixo: o -1 desvira a marca. O Z também
     inverte para o sólido não ficar espelhado, com as faces do avesso. */
  const k = 1 / MARK_BOX.h;
  g.scale(k, -k, -k);
  g.computeVertexNormals();
  return g;
}

/* Três luzes. Sem shadow map: a sombra de contato é uma <div> com
   radial-gradient posicionada por projeção — muito mais barata e
   melhor sobre creme. */
export function createLights() {
  const key = new DirectionalLight('#FFFAF2', 1.05);
  key.position.set(-2.2, 2.8, 3.0);

  // Contraluz fria pelo lado oposto: desenha a borda e a espessura
  // do bisel sem criar um segundo brilho especular.
  const fill = new DirectionalLight('#CFE2F5', 0.5);
  fill.position.set(2.8, -0.9, -1.4);

  // Ambiente alto porque o Mystic Navy tem L* 17: sem isso ele lê
  // como carvão, não como a cor da marca.
  /* Chão frio, não marrom: o hemisfério quente por baixo tirava azul
     do navy pelo mesmo motivo que o sheen. */
  const ambient = new HemisphereLight('#FFFFFF', '#3C4A5E', 2.9);

  return { key, fill, ambient, all: [key, fill, ambient] };
}

/* A sombra segue o corpo em coordenadas de tela. */
export function createShadowController(el) {
  let last = '';
  let lastOpacity = '';
  return {
    update(screenX, screenY, radiusPx, strength) {
      if (!el) return;
      const w = radiusPx * 2.7;
      const h = radiusPx * 0.72;
      const next = `translate3d(${(screenX - w / 2).toFixed(1)}px, ${(
        screenY +
        radiusPx * 0.82
      ).toFixed(1)}px, 0) scale(${w.toFixed(1)}, ${h.toFixed(1)})`;
      if (next !== last) {
        el.style.transform = next;
        last = next;
      }
      const o = strength.toFixed(3);
      if (o !== lastOpacity) {
        el.style.opacity = o;
        lastOpacity = o;
      }
    },
    hide() {
      if (el && lastOpacity !== '0') {
        el.style.opacity = '0';
        lastOpacity = '0';
      }
    },
  };
}
