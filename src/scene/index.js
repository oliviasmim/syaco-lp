import { WebGLRenderer, Scene, PerspectiveCamera, Mesh } from 'three';
import { scheduleRefresh } from '../lib/refresh.js';

import {
  createInkMaterial,
  createDiscGeometry,
  createMarkGeometry,
  createLights,
  createShadowController,
} from './dot.js';
import { createParticles } from './particles.js';
import { createDirector } from './timeline.js';
import { watchFrameRate, isTouch } from './capabilities.js';
import { onTheme } from '../sections/theme.js';
import { mixOklabRgb } from '../lib/color.js';
import { sharpen } from '../lib/dom.js';

/* ============================================================
   Um canvas, um renderer, uma cena, uma câmera — para a página
   inteira. Um canvas por seção mata o mobile.

   Render sob demanda: o loop só desenha quando há motivo (scroll,
   ponteiro, tween ativo, ou um ato ainda se acomodando). Sai do ar
   quando o canvas não está visível e quando a aba está oculta.

   Sem EffectComposer, sem bloom. Sobre fundo creme o bloom vira
   lama e o passe custa caro no celular. O grão é uma <div>.
   ============================================================ */

const DOT_LIGHT = '#13273F'; // navy, nas seções claras
const DOT_DARK = '#E8D4C3';  // cream, nas seções navy

/* ------------------------------------------------------------------
   PARTÍCULAS: DESLIGADAS — e isso é uma decisão, não um esquecimento.

   O sistema está pronto e funciona (scene/particles.js: um único
   Points, aFrom/aTo + uMorph no vertex shader, formas pré-computadas).
   Foi montado, ligado e olhado em tela nos quatro atos previstos:

     hero   → um halo de pontos em volta da esfera. Virou uma nuvem
              cinza do tamanho da tela por cima da headline.
     números→ três nuvens de poeira atrás dos algarismos. Pareciam
              manchas de café, não satélites.
     cases  → o "disco-lente" sobre os prints. Leu como ruído estático.
     CTA    → halo em volta do ponto pousado. Anel de pontinhos.

   Em todos, o resultado caiu exatamente na lista de "não faça" do
   briefing. O ponto sozinho, bem coreografado, é mais forte — e a
   ideia da marca é o ponto, não a poeira. Os três satélites da seção
   de números viraram três ESFERAS sólidas (createSatellites), que é
   o mesmo desenho do logo.

   Para reativar: USE_PARTICLES = true e ajustar pTarget.a nos atos
   de scene/timeline.js (hoje todos em 0).
   ------------------------------------------------------------------ */
const USE_PARTICLES = false;

export function start({ mode = 'full', reduced = false } = {}) {
  const canvas = document.getElementById('scene');
  if (!canvas) return null;

  const desktop = window.innerWidth >= 1024 && !isTouch();

  let renderer;
  try {
    renderer = new WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
  } catch (err) {
    // Sem contexto WebGL: sem canvas. A página inteira já funciona
    // sem ele — nenhuma informação vive só aqui.
    console.info('[syaco] sem contexto WebGL; seguindo sem a cena.', err);
    document.documentElement.dataset.scene = 'none';
    canvas.remove();
    document.querySelector('.dot-shadow')?.remove();
    return null;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.setClearAlpha(0);

  const scene = new Scene();

  const camera = new PerspectiveCamera(
    35,
    window.innerWidth / window.innerHeight,
    0.1,
    100
  );
  camera.position.set(0, 0, 6);
  camera.lookAt(0, 0, 0);

  const material = createInkMaterial();
  const discGeometry = createDiscGeometry({ segments: desktop ? 128 : 72 });
  const discMesh = new Mesh(discGeometry, material);

  /* O `S` e o ponto são dois corpos. Enquanto o SVG não chega, nada
     aparece: a abertura só começa com os dois prontos. */
  const markMesh = new Mesh(discGeometry, material);
  markMesh.visible = false;
  discMesh.visible = false;

  const dot = { disc: discMesh, mark: markMesh, material, discGeometry };
  const lights = createLights();
  const particles = USE_PARTICLES
    ? createParticles({ count: desktop ? 3000 : 1200 })
    : null;
  if (particles) {
    particles.currentShape = 'sphere';
    particles.material.uniforms.uSize.value = desktop ? 34 : 26;
  }

  scene.add(discMesh, markMesh, ...lights.all);
  if (particles) scene.add(particles.points);

  const shadow = createShadowController(document.querySelector('.dot-shadow'));

  let current = mode;
  let dirty = true;
  /* raf e idleFrames precisam ser declarados AQUI, antes de markDirty.
     Declarados lá embaixo junto do loop, o onTheme — que dispara o
     callback na hora em que é registrado — chamava wake() antes das
     declarações rodarem: "Cannot access 'raf' before initialization",
     e a cena inteira morria no boot. */
  let raf = 0;
  let idleFrames = 0;
  let wasSettled = true;
  let visible = true;
  let running = true;
  let last = performance.now();
  let elapsed = 0;

  const markDirty = () => { dirty = true; wake(); };

  const director = createDirector({
    camera,
    dot,
    particles,
    shadow,
    sceneEl: canvas,
    reduced: reduced || current === 'static',
  });

  director.bind({ onDirty: markDirty });

  /* ---------- cor do ponto, no mesmo scrub do fundo ----------
     A escuridão é "afiada" antes de virar cor: se o ponto
     interpolasse junto com o fundo, ele sumiria no meio-tom. */
  onTheme((d) => {
    const [r, g, b] = mixOklabRgb(DOT_LIGHT, DOT_DARK, sharpen(d, 4.2));
    // A string CSS mantém a cor em sRGB até o próprio Three convertê-la.
    // Converter os canais manualmente antes de passá-los ao material
    // altera a aparência do navy.
    material.color.set(`rgb(${r}, ${g}, ${b})`);
    particles?.material.uniforms.uColor.value.set(`rgb(${r}, ${g}, ${b})`);
    markDirty();
  });

  /* ---------- resize ----------
     Só reage quando a LARGURA muda. Em touch, a barra de URL muda a
     altura a cada scroll; reagir a isso dá salto a cada gesto. */
  let lastW = window.innerWidth;
  let lastH = window.innerHeight;
  let resizeT = 0;

  function applySize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    lastW = w;
    lastH = h;
    director.refresh();
    markDirty();
  }

  window.addEventListener('resize', () => {
    clearTimeout(resizeT);
    resizeT = setTimeout(() => {
      const widthChanged = window.innerWidth !== lastW;
      const bigHeightJump = Math.abs(window.innerHeight - lastH) > 180;
      if (widthChanged || (!isTouch() && window.innerHeight !== lastH) || bigHeightJump) {
        applySize();
      }
    }, 150);
  }, { passive: true });

  window.addEventListener('scroll', markDirty, { passive: true });

  /* ---------- pausas ---------- */

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (visible) markDirty();
      else if (raf) { cancelAnimationFrame(raf); raf = 0; }
    }).observe(canvas);
  }

  document.addEventListener('visibilitychange', () => {
    running = !document.hidden;
    if (running) markDirty();
  });

  /* ---------- degradação automática ---------- */

  const fpsTick = watchFrameRate((fps) => {
    console.info(`[syaco] ${fps.toFixed(0)}fps médio — caindo para o modo static.`);
    current = 'static';
    document.documentElement.dataset.scene = 'static';
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    if (particles) {
      particles.material.uniforms.uOpacity.value = 0;
      particles.points.visible = false;
    }
  });

  /* ---------- loop ---------- */

  /* Render sob demanda de verdade: quando o ato acomodou e não há
     nada sujo, o rAF é CANCELADO — não só o render pulado. Um loop
     que continua rodando para não desenhar nada ainda paga o custo do
     update a cada frame, e num celular isso é bateria e jank. */
  function wake() {
    idleFrames = 0;
    if (raf) return;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }

  function frame(now) {
    raf = requestAnimationFrame(frame);
    if (!running || !visible) { last = now; return; }

    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    elapsed += dt;

    const { settled } = director.update(dt, elapsed);

    /* Desenha quando há motivo: scroll, ponteiro, tween, ou um ato
       ainda se acomodando. No modo static não há rotação nem deriva,
       então `settled` chega em poucos frames e o loop volta a ficar
       parado — que é o objetivo. Condicionar o static só a `dirty`
       (primeira versão) deixava o ponto congelado na posição do ato
       anterior, porque o frame único era desenhado antes do lerp
       terminar. */
    /* O frame em que o ato acomoda também precisa ser desenhado: o
       update já moveu o ponto até o destino. Sem isso, no modo static,
       onde o lerp chega de uma vez, a tela ficava presa no frame
       anterior. */
    const wants = dirty || !settled || !wasSettled;
    wasSettled = settled;

    if (!wants) {
      if (++idleFrames > 12) { cancelAnimationFrame(raf); raf = 0; }
      return;
    }

    idleFrames = 0;
    dirty = false;
    renderer.render(scene, camera);
    if (current === 'full') fpsTick(now);
  }

  canvas.setAttribute('data-ready', '');
  // Só agora o ponto 3D existe de fato — é aqui que o "." de verdade
  // some. Antes isso dependia de data-scene, que era otimista.
  document.documentElement.classList.add('scene-live');
  /* Carregado depois da cena estar de pé: nada espera por ele. */
  createMarkGeometry('/syaco-s.svg')
    .then((g) => {
      if (!g) return;
      dot.markGeometry = g;
      markMesh.geometry = g;
      director.markReady();
    })
    .catch((err) => {
      console.info('[syaco] não consegui extrudar a marca; o ponto assume.', err);
    })
    .finally(() => {
      director.playIntro(markDirty);
      markDirty();
    });

  applySize();
  scheduleRefresh();
  wake();

  return {
    stop() {
      if (raf) cancelAnimationFrame(raf);
      director.dispose();
      particles?.geometry.dispose();
      particles?.material.dispose();
      discGeometry.dispose();
      dot.markGeometry?.dispose();
      material.dispose();
      renderer.dispose();
    },
  };
}
