import ScrollTrigger from 'gsap/ScrollTrigger';
import { mixOklab } from '../lib/color.js';
import { clamp } from '../lib/dom.js';

/* ============================================================
   Transição creme ↔ navy.

   Um único <div class="bg-stage"> fixo tem a cor interpolada por
   scrub, em vez de cada seção pintar a si mesma: o corte não pisca
   e o ponto 3D troca de material no mesmo scrub.

   Cada bloco navy contribui com uma escuridão própria; a da página
   é o máximo entre elas — assim dois blocos nunca brigam.

   O FUNDO interpola devagar (em OkLab: sRGB puro passaria por um
   cinza-barro). A TINTA troca de uma vez, com fade de 140ms no CSS.

   Sobre o ponto de troca: o caminho creme→navy passa por um
   meio-tom onde NENHUMA das duas tintas chega a 4.5:1 — o melhor
   ponto do caminho é d≈0.54, onde as duas empatam em ~3.6:1. Por
   isso: (a) troca-se exatamente ali, (b) a faixa de transição é
   curta, ~26vh de scroll, para o estado ruim durar um piscar, e
   (c) há histerese, para quem parar o scroll em cima da borda não
   ver a tinta oscilando. Nos estados parados — que é onde a pessoa
   lê — o contraste é 12.4:1 dos dois lados.
   ============================================================ */

const LIGHT = '#FFFFFF';
const DARK = '#13273F';

const FLIP = 0.54;
const HYST = 0.05;

const state = { d: 0, dark: false };
const subs = new Set();

export const darkness = () => state.d;
export const isDark = () => state.dark;

export const onTheme = (fn) => {
  subs.add(fn);
  fn(state.d);
  return () => subs.delete(fn);
};

export function initTheme({ reduced = false } = {}) {
  const root = document.documentElement;
  const blocks = Array.from(document.querySelectorAll('.section--dark'));
  if (!blocks.length) return;

  const enter = new Map();
  const exit = new Map();

  function apply() {
    let d = 0;
    for (const el of blocks) {
      const v = (enter.get(el) ?? 0) * (1 - (exit.get(el) ?? 0));
      if (v > d) d = v;
    }
    d = clamp(d);
    if (Math.abs(d - state.d) < 0.002) return;
    state.d = d;

    // O token é o que o resto do CSS lê (a pílula da nav, os campos
    // do formulário). Mexer só no style do .bg-stage deixaria todos
    // eles presos na cor clara.
    root.style.setProperty('--page-bg', mixOklab(LIGHT, DARK, d));

    const dark = state.dark ? d > FLIP - HYST : d > FLIP + HYST;
    if (dark !== state.dark) {
      state.dark = dark;
      root.classList.toggle('is-dark', dark);
    }

    for (const fn of subs) fn(d);
  }

  blocks.forEach((el) => {
    enter.set(el, 0);
    exit.set(el, 0);

    if (reduced) {
      // Sem scrub: troca seca, sem nenhum estado intermediário.
      ScrollTrigger.create({
        trigger: el,
        start: 'top 55%',
        end: 'bottom 45%',
        onToggle: (self) => {
          enter.set(el, self.isActive ? 1 : 0);
          apply();
        },
      });
      return;
    }

    ScrollTrigger.create({
      trigger: el,
      start: 'top 70%',
      end: 'top 38%',
      scrub: true,
      invalidateOnRefresh: true,
      onUpdate: (self) => { enter.set(el, self.progress); apply(); },
      onRefresh: (self) => { enter.set(el, self.progress); apply(); },
    });

    ScrollTrigger.create({
      trigger: el,
      start: 'bottom 44%',
      end: 'bottom 18%',
      scrub: true,
      invalidateOnRefresh: true,
      onUpdate: (self) => { exit.set(el, self.progress); apply(); },
      onRefresh: (self) => { exit.set(el, self.progress); apply(); },
    });
  });

  apply();
}
