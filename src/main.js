import gsap from 'gsap';
import ScrollTrigger from 'gsap/ScrollTrigger';
import Lenis from 'lenis';

import { initTheme } from './sections/theme.js';
import { initReveal } from './sections/reveal.js';
import { initHero } from './sections/hero.js';
import { initNav } from './sections/nav.js';
import { initStats } from './sections/stats.js';
import { initServices } from './sections/services.js';
import { initServiceVisuals } from './sections/services-visuals.js';
import { initProcessVisuals } from './sections/process-visuals.js';
import { detectMode, prefersReducedMotion } from './scene/capabilities.js';
import { scheduleRefresh } from './lib/refresh.js';
import { captureUtm, utmQuery } from './lib/utm.js';

const root = document.documentElement;
root.classList.add('js');

/* UTM do anúncio/bio: gravados na sessão e repassados aos links do
   formulário, para a origem do lead não se perder na navegação. */
captureUtm();
const utm = utmQuery();
if (utm) {
  for (const a of document.querySelectorAll('a[data-form-link]')) {
    a.setAttribute('href', a.getAttribute('href').split('?')[0] + utm);
  }
}

const reduced = prefersReducedMotion();
const mode = detectMode();
root.dataset.scene = mode;

gsap.registerPlugin(ScrollTrigger);

/* A barra de URL do celular muda a altura ao rolar. Com a seção de
   serviços pinada, um refresh nesse momento faria a página saltar. */
ScrollTrigger.config({ ignoreMobileResize: true });

/* ---------- Lenis ----------------------------------------------
   smoothTouch fica desligado: o momentum nativo do iOS é melhor
   que qualquer emulação. Com reduced-motion, Lenis nem entra. */

let lenis = null;

if (!reduced) {
  lenis = new Lenis({
    lerp: 0.1,
    smoothWheel: true,
    syncTouch: false,
    touchMultiplier: 1.4,
  });

  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.lagSmoothing(0);

  /* O ticker só roda enquanto há rolagem acontecendo.
     Deixá-lo ligado o tempo todo — que é o exemplo padrão do Lenis —
     mantém um rAF vivo para sempre: no Lighthouse mobile isso
     aparecia como 6.5s de tempo de execução atribuído ao GSAP, com a
     página parada. Também é bateria à toa no celular. */
  let ticking = false;
  let sleepAt = 0;

  /* A checagem de "já posso dormir?" mora DENTRO do próprio tick.
     Numa primeira versão ela era um segundo callback permanente no
     ticker — o que mantinha o ticker acordado para sempre e só
     mudava a quem o custo era atribuído no perfil. Removendo o
     último callback, o ticker do GSAP realmente hiberna. */
  const tick = (time) => {
    lenis.raf(time * 1000);
    if (performance.now() > sleepAt) {
      ticking = false;
      gsap.ticker.remove(tick);
    }
  };

  const wake = () => {
    sleepAt = performance.now() + 700;
    if (ticking) return;
    ticking = true;
    gsap.ticker.add(tick);
  };

  lenis.on('scroll', ({ isScrolling }) => {
    if (isScrolling) sleepAt = performance.now() + 700;
  });

  for (const ev of ['wheel', 'touchstart', 'touchmove', 'keydown', 'pointerdown']) {
    window.addEventListener(ev, wake, { passive: true });
  }

  // lenis.scrollTo (âncoras da nav) também precisa do ticker de volta
  const nativeScrollTo = lenis.scrollTo.bind(lenis);
  lenis.scrollTo = (...args) => { wake(); return nativeScrollTo(...args); };

  wake();
}

/* ---------- Seções --------------------------------------------- */

/* ORDEM IMPORTA. Os dois pins (hero e serviços) acrescentam altura
   ao documento. Se os ScrollTriggers do tema forem criados antes
   deles, o ScrollTrigger calcula start/end com a página ainda curta
   e tudo que vem depois dispara cedo demais — no teste, a seção de
   números ficava creme e a de equipe ficava navy. Pins primeiro, e
   com refreshPriority na ordem em que aparecem na página. */
initHero({ reduced });
initServices({ reduced });

initTheme({ reduced });
initReveal({ reduced });
initNav({ lenis });
initStats({ reduced });
initServiceVisuals({ reduced });
initProcessVisuals({ reduced });

const year = document.getElementById('year');
if (year) year.textContent = String(new Date().getFullYear());

/* O botão flutuante de WhatsApp sobe quando a seção de contato
   aparece, para não cobrir o botão do formulário. */
const contact = document.getElementById('contato');
if (contact && 'IntersectionObserver' in window) {
  new IntersectionObserver(
    ([entry]) => {
      document.body.toggleAttribute('data-contact-visible', entry.isIntersecting);
    },
    { rootMargin: '-40% 0px -20% 0px' }
  ).observe(contact);
}

/* ---------- Refresh ---------------------------------------------
   Fonte que carrega depois desloca o anchor do ponto e os pontos de
   start/end de todo mundo. Sem esses dois refresh, o ponto pousa no
   lugar errado. */

document.fonts?.ready.then(() => scheduleRefresh());

window.addEventListener('load', () => scheduleRefresh());

/* Resize: só reage quando a LARGURA muda. Em touch, a barra de URL
   muda a altura a cada scroll — reagir a isso dá salto de layout. */
let lastW = window.innerWidth;
let t = 0;
window.addEventListener('resize', () => {
  clearTimeout(t);
  t = setTimeout(() => {
    if (window.innerWidth === lastW) return;
    lastW = window.innerWidth;
    scheduleRefresh(0);
  }, 150);
});

/* ---------- Cena 3D --------------------------------------------
   Depois do primeiro paint, em tempo ocioso. O LCP é o <h1> em
   texto, não o WebGL. */

if (mode !== 'none') {
  const boot = () => {
    import('./scene/index.js')
      .then((m) => m.start({ mode, reduced }))
      .catch((err) => {
        console.warn('[syaco] cena 3D não iniciou; a página segue sem ela.', err);
        root.dataset.scene = 'none';
      });
  };

  /* Depois do load E em tempo ocioso. A cena cria os próprios
     ScrollTriggers e compila shaders; deixar isso disputar espaço com
     o carregamento da página é o que faz o tempo de bloqueio subir. */
  const idle = () => {
    if ('requestIdleCallback' in window) requestIdleCallback(boot, { timeout: 2500 });
    else setTimeout(boot, 600);
  };

  if (document.readyState === 'complete') idle();
  else window.addEventListener('load', idle, { once: true });
}
