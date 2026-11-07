/* ============================================================
   Detecção de capacidade. Decide um de três modos:

     'full'   → cena completa, scrub, parallax
     'static' → sem rotação e sem deriva; desenha até acomodar e para
     'none'   → sem canvas

   Nota sobre "sem WebGL": o modo 'static' também precisa de um
   contexto para desenhar. Sem contexto, o único caminho honesto é
   'none' — e quem descobre isso é o renderer, não uma sonda.
   ============================================================ */

export const prefersReducedMotion = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* NÃO sonde o WebGL aqui.

   A primeira versão criava um <canvas> e pedia um contexto WebGL logo
   no boot, só para decidir o modo. Medido em perfil de CPU (celular
   emulado, 4x de throttle): 1.355 SEGUNDOS, síncronos, antes do
   primeiro paint — para um teste cujo resultado só interessa ao
   módulo 3D, que carrega depois do load.

   Agora a decisão de "dá para rodar WebGL?" é tomada pelo próprio
   renderer, dentro de um try/catch em scene/index.js, quando ele
   finalmente é criado. Um contexto em vez de dois, e fora do caminho
   crítico. Se falhar, a página cai para o modo 'none' sozinha. */

export function detectMode() {
  const conn = navigator.connection || navigator.webkitConnection;

  if (conn?.saveData) return 'none';
  if (prefersReducedMotion()) return 'static';

  const cores = navigator.hardwareConcurrency ?? 8;
  const mem = navigator.deviceMemory ?? 8;
  if (cores <= 4 || mem <= 4) return 'static';

  return 'full';
}

export const isDesktop = () => window.matchMedia('(min-width: 1024px)').matches;
export const isTouch = () => window.matchMedia('(hover: none)').matches;

/* Vigia de FPS: 'full' → 'static' se a média cair abaixo de 45 por
   2s seguidos. Degrada uma vez e não volta atrás. */
export function watchFrameRate(onDegrade, { floor = 45, window: win = 2000 } = {}) {
  let frames = 0;
  let since = performance.now();
  let spent = false;

  return function tick(now) {
    if (spent) return;
    frames++;
    const dt = now - since;
    if (dt < win) return;
    const fps = (frames * 1000) / dt;
    frames = 0;
    since = now;
    if (fps < floor) {
      spent = true;
      onDegrade(fps);
    }
  };
}
