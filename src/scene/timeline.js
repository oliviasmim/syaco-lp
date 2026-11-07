import { Euler, Vector3 } from 'three';
import gsap from 'gsap';
import ScrollTrigger from 'gsap/ScrollTrigger';
import { clamp, lerp } from '../lib/dom.js';
import { SHAPES } from './particles.js';
import { servicesState } from '../sections/services.js';
import { heroState } from '../sections/hero.js';
import { MARK_DOT } from './dot.js';

/* ============================================================
   A coreografia do ponto.

   Regras que valem para tudo aqui:
   - nenhuma leitura de getBoundingClientRect acontece dentro do
     render(). Tudo é medido no refresh e guardado em cache, em
     coordenadas de documento;
   - a troca de ato acontece no centro da viewport, e o ponto
     persegue o alvo por lerp — nunca salta;
   - o lerp só cuida da mudança de alvo. O scroll é somado direto à
     posição atual, então o que está ancorado na página anda junto
     com o texto, sem atraso, mesmo numa rolagem rápida no celular.
   ============================================================ */

const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const smooth = (t) => { const c = clamp(t); return c * c * (3 - 2 * c); };

/* Posição no documento pelo layout, ignorando transforms: as seções
   entram com .reveal deslocado, e medir com getBoundingClientRect
   nesse momento faria o ponto pousar longe do texto. */
function docPos(el) {
  let x = 0;
  let y = 0;
  for (let n = el; n; n = n.offsetParent) {
    x += n.offsetLeft;
    y += n.offsetTop;
  }
  return { x, y };
}

export function createDirector({ camera, dot, particles, shadow, sceneEl, reduced }) {
  const measurer = document.createElement('canvas').getContext('2d');

  /* ---------- medidas em cache ---------- */
  const cache = {
    period: null,     // { docX, docY, diameter }
    rail: null,       // { docX, docY, width }
    home: null,       // { docX, docY, h }: onde o `S.` mora no hero
    landPx: 240,      // scroll em que o ponto pousa, sem pin
    stats: [],        // [{ docX, docY, size }]
    statsBox: null,   // { top, h }
    about: null,      // { docX, docY, size }
    cta: null,        // { docX, top, bottom }
    casesDoc: null,
    caseCards: [],
    signature: null,
  };

  /* O hero, em uma frase: o `S.` inteiro gira, o ponto se solta e pousa
     na headline; o `S` gira até virar uma lâmina e some. Em turn = π/2
     ele está de perfil, então encolher ali não tem frame visível. */
  const HALF_TURN = Math.PI / 2;
  const FACE_ON = 0;
  const START_TURN = -0.55;
  const START_TURN_HANDHELD = -0.32;

  /* `target`/`cur` são o ponto. `free` diz quanto ele está solto:
     0 = encaixado no `S`, 1 = dono do próprio caminho. */
  const target = { x: 0, y: 0, s: 0.05, o: 1, turn: FACE_ON, tilt: 0, shadow: 0, free: 0 };
  const cur = { ...target };
  const markTarget = { x: 0, y: 0, s: 0, turn: START_TURN, tilt: 0 };
  const markCur = { ...markTarget };

  let markOk = false;
  let started = false;
  let snapAll = true;   // primeiro frame: tudo já no lugar, sem voo
  let snapMark = false; // o `S` reaparece onde vai ficar
  let lastPage = null;
  let arc = 0;

  /* Abertura: o `S` entra girando e o ponto encaixa por último. */
  const intro = { s: 1, spin: 0, dot: 1 };
  const euler = new Euler();
  const offset = new Vector3();

  /* As partículas têm alvo próprio. Sem isso elas viram uma nuvem
     cinza do tamanho da tela por cima da headline — foi o primeiro
     resultado do teste visual, e é exatamente o clichê que o briefing
     manda evitar. Aqui elas são um halo discreto: só ganham presença
     nos dois atos em que a FORMA é o assunto (os três satélites dos
     números e o disco dos cases). */
  const pTarget = { x: 0, y: 0, s: 1, a: 0 };
  const pCur = { x: 0, y: 0, s: 1, a: 0 };

  let act = 'hero';
  let shape = 'sphere';
  let casesProgress = 0;
  let activeCase = -1;

  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };

  /* ---------- helpers de projeção ---------- */

  /* A projeção usa a altura do canvas (100lvh), não innerHeight: no
     celular innerHeight muda com a barra de URL e o canvas, não. */
  let canvasH = 0;
  const viewH = () => canvasH || sceneEl?.clientHeight || window.innerHeight;

  function view() {
    const h =
      2 * Math.tan(((camera.fov * Math.PI) / 180) / 2) * camera.position.z;
    return { h, w: h * camera.aspect, pxToWorld: h / viewH() };
  }

  function toWorld(screenX, screenY) {
    const v = view();
    return {
      x: (screenX / window.innerWidth - 0.5) * v.w,
      y: (0.5 - screenY / viewH()) * v.h,
    };
  }

  const scrollY = () => window.scrollY || window.pageYOffset || 0;

  /* Dentro de um bloco pinned o conteúdo congela na posição em que o
     pin começou: o scroll efetivo para ali. Estas duas funções são
     usadas TANTO na medição quanto na leitura — é isso que faz a
     conta fechar independentemente de quando o refresh aconteceu.

     Medir com scrollY() cru quebrava assim: durante o pin o elemento
     está em position:fixed, então getBoundingClientRect().top já é a
     posição de tela; somar scrollY() a isso inflava a coordenada de
     documento e o ponto pousava longe da headline. */
  /* Um bloco pinado tem três fases, e as três importam:
       antes do pin   → o conteúdo rola normalmente;
       durante o pin  → congela na posição de início;
       depois do pin  → volta a rolar, mas deslocado da duração
                        inteira do pin.

     A terceira fase era a que faltava. Só com o clamp (Math.min), o
     ponto continuava colado na posição CONGELADA da headline depois
     que o pin soltava: a frase subia e ele ficava boiando no meio da
     tela até o ato seguinte assumir. */
  function pinnedScroll(pinned, start, duration) {
    const s = scrollY();
    if (!pinned || !duration) return s;
    if (s <= start) return s;
    if (s <= start + duration) return start;
    return s - duration;
  }

  const heroScroll = () =>
    pinnedScroll(heroState.pinned, heroState.pinStart, heroState.pinDuration);

  const servicesScroll = () =>
    pinnedScroll(
      servicesState.pinned,
      servicesState.pinStart,
      servicesState.pinDuration
    );

  /* ---------- o ponto final da headline ----------
     O anchor é um inline-block de tamanho zero alinhado à baseline,
     colocado imediatamente ANTES do ".". Logo: rect.top é exatamente
     a baseline e rect.left é a borda esquerda do glifo. As métricas
     de tinta do "." saem do measureText do canvas 2D, na mesma fonte
     e no mesmo tamanho — é a única forma de acertar o centro e o
     diâmetro sem chutar. */

  function periodMetrics(el) {
    const cs = getComputedStyle(el);
    const fs = parseFloat(cs.fontSize) || 64;

    let inkOffsetX = fs * 0.14;
    let diameter = fs * 0.145;
    let aboveBaseline = diameter / 2;

    try {
      measurer.font = `${cs.fontWeight} ${fs}px ${cs.fontFamily}`;
      const m = measurer.measureText('.');
      const ih = (m.actualBoundingBoxAscent || 0) + (m.actualBoundingBoxDescent || 0);
      const iw = (m.actualBoundingBoxLeft || 0) + (m.actualBoundingBoxRight || 0);
      if (ih > 0.5 && iw > 0.5 && m.width > 0) {
        // centro da TINTA, não do avanço: o "." tem bearings laterais
        // bem assimétricos nesta fonte
        inkOffsetX = (m.actualBoundingBoxRight - m.actualBoundingBoxLeft) / 2;
        /* A altura é o eixo confiável: o eixo wdth do Archivo alarga o
           glifo e o canvas 2D não aplica font-variation-settings.

           O 1.14 é correção óptica, não erro de medida: o ponto final
           do Archivo é um QUADRADO, e um círculo da mesma largura
           parece menor que ele — área de 0.785 contra 1. O disco
           precisa ser um pouco maior para pesar igual na frase. */
        diameter = ih * 1.14;
        aboveBaseline = m.actualBoundingBoxAscent - ih / 2;
      }
    } catch {
      /* measureText sem métricas de tinta: fica no fallback acima */
    }

    return { inkOffsetX, diameter, aboveBaseline };
  }

  function measurePeriod() {
    const anchor = document.querySelector('.dot-anchor');
    const h1 = document.querySelector('#hero-title');
    if (!anchor || !h1) return null;

    const { inkOffsetX, diameter, aboveBaseline } = periodMetrics(h1);
    const r = anchor.getBoundingClientRect();

    return {
      docX: r.left + inkOffsetX,
      docY: r.top + heroScroll() - aboveBaseline,
      diameter,
    };
  }

  function periodTarget() {
    if (!cache.period) return { x: 0, y: 0, s: 0.05 };
    const v = view();
    const p = toWorld(cache.period.docX, cache.period.docY - heroScroll());
    // As geometrias são normalizadas para altura 1, então `scale` é
    // a altura na tela — não o raio. Daí o diâmetro entrar inteiro.
    return { x: p.x, y: p.y, s: cache.period.diameter * v.pxToWorld };
  }

  /* ---------- refresh ---------- */

  /* Onde o `S.` mora, em coordenadas de documento.

     Desktop: o respiro à direita da headline.

     Mobile e tablet: à direita de "Da", na mesma linha de base. É a
     única faixa livre que existe em todos os tamanhos (117px de altura
     num celular de 320, 200px num de 430), então o logo vira parte da
     composição em vez de flutuar por cima dela. */
  function measureHome() {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    if (vw >= 1024) return { docX: vw * 0.77, docY: vh * 0.48, h: vh * 0.3 };

    const h1 = document.querySelector('#hero-title');
    const text = h1?.firstChild;
    const anchor = document.querySelector('.dot-anchor');
    const nav = document.querySelector('.nav__pill');
    if (!text || text.nodeType !== 3 || !anchor || !nav) {
      return { docX: vw * 0.8, docY: vh * 0.2, h: vh * 0.1 };
    }

    const scroll = heroScroll();
    const range = document.createRange();
    range.setStart(text, 0);
    range.setEnd(text, 2);
    const da = range.getBoundingClientRect();
    const baselineLast = anchor.getBoundingClientRect().top;
    const cs = getComputedStyle(h1);
    const fs = parseFloat(cs.fontSize) || 56;
    const lh = parseFloat(cs.lineHeight) || fs;
    const lines = Math.round((baselineLast - da.bottom) / lh);
    const baseline = baselineLast - lines * lh + scroll;

    const navBottom = nav.getBoundingClientRect().bottom;
    const free = da.bottom + scroll - navBottom;
    const h = Math.max(56, Math.min(free * 0.78, vw * 0.3, 200));

    return { docX: vw - da.left - h * 0.6, docY: baseline - h / 2, h };
  }

  /* Sem pin, o pouso é medido em pixels: tem que terminar antes de
     "resultado" passar por baixo da nav. */
  function measureLanding() {
    const anchor = document.querySelector('.dot-anchor');
    const nav = document.querySelector('.nav__pill');
    if (!anchor || !nav) return 240;
    const baseline = anchor.getBoundingClientRect().top + heroScroll();
    return Math.max(120, (baseline - nav.getBoundingClientRect().bottom) * 0.75);
  }

  function refresh() {
    canvasH = sceneEl?.clientHeight || 0;
    cache.period = measurePeriod();
    cache.home = measureHome();
    cache.landPx = measureLanding();

    const rail = document.querySelector('.services__rail');
    if (rail) {
      const r = rail.getBoundingClientRect();
      cache.rail = { docX: r.left, docY: r.top + servicesScroll(), width: r.width };
    }

    /* Um ponto pequeno logo acima de cada número. */
    const statsEl = document.querySelector('.section--stats');
    if (statsEl) {
      cache.statsBox = { top: docPos(statsEl).y, h: statsEl.offsetHeight };
    }
    cache.stats = Array.from(document.querySelectorAll('.stat__value')).map((el) => {
      const pos = docPos(el);
      const size = Math.max(9, parseFloat(getComputedStyle(el).fontSize) * 0.17);
      return { docX: pos.x + size / 2, docY: pos.y - size * 0.9, size };
    });

    /* O ponto final de "Somos a SYACO." */
    const aboutAnchor = document.querySelector('[data-about-anchor]');
    if (aboutAnchor) {
      const pos = docPos(aboutAnchor);
      const m = periodMetrics(aboutAnchor);
      cache.about = {
        docX: pos.x + m.inkOffsetX,
        docY: pos.y - m.aboveBaseline,
        size: m.diameter,
      };
    }

    /* No contato o ponto descansa na faixa vazia entre o card e o
       rodapé. O canvas fica atrás do conteúdo: encostado no card, o
       disco aparecia cortado, como uma meia-lua. */
    const contact = document.querySelector('#contato');
    const card = document.querySelector('.contact-card');
    if (contact && card) {
      const c = docPos(card);
      cache.cta = {
        docX: c.x + card.offsetWidth / 2,
        top: c.y + card.offsetHeight,
        bottom: docPos(contact).y + contact.offsetHeight,
      };
    }

    const cases = document.querySelector('.cases');
    if (cases) {
      const r = cases.getBoundingClientRect();
      cache.casesDoc = {
        docX: r.left + r.width / 2,
        docY: r.top + r.height / 2 + scrollY(),
      };
    }

    cache.caseCards = Array.from(document.querySelectorAll('.case')).map((el) => {
      const media = el.querySelector('.case__media') || el;
      const r = media.getBoundingClientRect();
      return { el, docX: r.left + r.width / 2, docY: r.top + scrollY() };
    });

    const signature = document.querySelector('.footer__signature-origin');
    if (signature) {
      const r = signature.getBoundingClientRect();
      cache.signature = { docX: r.left + r.width / 2, docY: r.top + r.height / 2 + scrollY() };
    }
  }

  /* ---------- atos ---------- */

  /* O `S` sai de cena: nos outros atos só o ponto existe. */
  function dropMark() {
    target.free = 1;
    markTarget.s = 0;
    arc = 0;
  }

  function actHero() {
    const v = view();
    const desktop = window.innerWidth >= 1024;
    const home = cache.home || { docX: 0, docY: 0, h: 100 };
    const scroll = heroScroll();
    const h = toWorld(home.docX, home.docY - scroll);
    const homeS = home.h * v.pxToWorld;
    const per = periodTarget();

    // Com pin, o progresso é o do pin. Sem pin, os pixels até o pouso.
    const p = heroState.pinned
      ? heroState.progress
      : clamp(scroll / Math.max(1, cache.landPx));

    /* Três coisas que se sobrepõem, para o scroll sempre ter resposta:
       o `S.` gira desde o primeiro pixel, o ponto se solta e, por fim,
       o `S` vira lâmina e some. */
    let turn;
    let release;
    let exit;
    if (desktop) {
      turn = p < 0.42
        ? lerp(START_TURN, 0, p / 0.42)
        : lerp(0, HALF_TURN, smooth((p - 0.42) / 0.38));
      release = smooth((p - 0.3) / 0.7);
      exit = smooth((p - 0.52) / 0.3);
    } else {
      turn = lerp(START_TURN_HANDHELD, HALF_TURN, smooth(p / 0.72));
      release = smooth(p);
      exit = smooth((p - 0.28) / 0.46);
    }

    const present = 1 - release;
    const px = desktop ? pointer.x : 0;
    const py = desktop ? pointer.y : 0;

    markTarget.x = h.x + px * v.w * 0.012 * present;
    markTarget.y = h.y + py * v.h * 0.012 * present;
    markTarget.s = homeS * (1 - exit);
    markTarget.turn = turn + px * 0.24 * present;
    markTarget.tilt = 0.08 * present - py * 0.16 * present;

    target.o = 1;
    target.turn = FACE_ON;
    target.tilt = 0;
    target.shadow = (1 - exit) * (desktop ? 0.55 : 0.3);
    // No desktop o ponto desce e passa por baixo do `S`, nunca por dentro.
    arc = desktop ? -0.11 : 0;

    if (markOk) {
      target.x = per.x;
      target.y = per.y;
      target.s = per.s;
      target.free = release;
    } else {
      // Sem o SVG, o ponto faz o caminho inteiro sozinho.
      target.x = lerp(h.x, per.x, release);
      target.y = lerp(h.y, per.y, release);
      target.s = lerp(homeS, per.s, release);
      target.free = 1;
    }

    shape = 'sphere';
    pTarget.a = 0;
  }

  /* Números: o ponto salta de métrica em métrica. A posição na seção
     escolhe qual, e não a posição na tela: no desktop as três estão
     na mesma linha. */
  function actStats() {
    dropMark();
    shape = 'sphere';
    pTarget.a = 0;
    target.o = 1;
    target.shadow = 0;
    target.turn = FACE_ON;
    target.tilt = 0;

    const box = cache.statsBox;
    const stats = cache.stats;
    if (!box || !stats.length) return;

    const center = scrollY() + window.innerHeight / 2;
    const i = Math.min(
      stats.length - 1,
      Math.floor(clamp((center - box.top) / box.h) * stats.length)
    );
    const st = stats[i];
    const w = toWorld(st.docX, st.docY - scrollY());
    target.x = w.x;
    target.y = w.y;
    target.s = st.size * view().pxToWorld;
  }

  /* Quem somos: o ponto volta a ser o ponto final de um título. */
  function actAbout() {
    dropMark();
    shape = 'sphere';
    pTarget.a = 0;
    target.o = 1;
    target.shadow = 0;
    target.turn = FACE_ON;
    target.tilt = 0;

    const a = cache.about;
    if (!a) return;
    const w = toWorld(a.docX, a.docY - scrollY());
    target.x = w.x;
    target.y = w.y;
    target.s = a.size * view().pxToWorld;
  }

  function actServices() {
    dropMark();
    const v = view();
    shape = 'sphere';
    pTarget.a = 0;
    target.o = 1;
    target.turn = FACE_ON;
    target.tilt = 0;
    target.shadow = 0.4;

    const r = cache.rail;
    if (!r) return;

    // O ponto É o indicador de progresso: x = progresso no trilho.
    const screenY = r.docY - servicesScroll();
    const screenX = r.docX + r.width * servicesState.progress;
    const p = toWorld(screenX, screenY);
    target.x = p.x;
    target.y = p.y;
    target.s = v.h * 0.036;
  }

  function actTeam() {
    dropMark();
    // Descanso. Uma seção sem efeito nenhum faz as outras funcionarem.
    target.o = 0;
    target.shadow = 0;
    pTarget.a = 0;
  }

  function actRest() {
    actTeam();
  }

  function setActiveCase(index) {
    if (index === activeCase) return;
    activeCase = index;
    cache.caseCards.forEach((card, i) => card.el.classList.toggle('is-active', i === index));
  }

  function actCases() {
    dropMark();
    const cards = cache.caseCards;
    if (!cards.length) return;

    const v = view();
    const raw = clamp(casesProgress) * Math.max(0, cards.length - 1);
    const from = Math.min(cards.length - 1, Math.floor(raw));
    const to = Math.min(cards.length - 1, from + 1);
    const travel = clamp((raw - from - 0.54) / 0.46);
    const eased = easeInOut(travel);
    const start = cards[from];
    const end = cards[to];
    const a = toWorld(start.docX, start.docY - scrollY());
    const b = toWorld(end.docX, end.docY - scrollY());

    const size = v.h * 0.024;
    const edgeOffset = size / 2;

    shape = 'disc';
    target.o = 1;
    target.s = size;
    target.x = lerp(a.x, b.x, eased);
    target.y = lerp(a.y, b.y, eased) + edgeOffset + Math.sin(eased * Math.PI) * v.h * 0.052;
    target.turn = FACE_ON - 0.1;
    target.tilt = 0.04;
    target.shadow = 0.44;
    pTarget.a = 0;
    setActiveCase(eased < 0.5 ? from : to);
  }

  /* Resolução: o ponto pousa na faixa vazia acima do rodapé, com o
     tamanho que cabe nela, e para. */
  function actCta() {
    dropMark();
    const v = view();
    shape = 'sphere';
    target.o = 1;
    target.turn = FACE_ON - 0.22;
    target.tilt = 0.14;
    target.shadow = 0.4;
    pTarget.a = 0;

    const c = cache.cta;
    if (!c) return;
    const gap = c.bottom - c.top;
    const px = Math.max(18, Math.min(gap * 0.62, window.innerHeight * 0.17));
    const p = toWorld(c.docX, c.top + gap / 2 - scrollY());
    target.x = p.x;
    target.y = p.y;
    target.s = px * v.pxToWorld;
  }

  /* O logo se remonta na assinatura do rodapé. */
  function actFooter() {
    pTarget.a = 0;
    target.o = 1;
    target.turn = START_TURN;
    target.tilt = 0;
    target.shadow = 0.25;
    target.free = 0;
    arc = 0;
    markTarget.s = view().h * 0.09;
    markTarget.turn = START_TURN;
    markTarget.tilt = 0;

    const signature = cache.signature;
    if (!signature) return;
    const p = toWorld(signature.docX, signature.docY - scrollY());
    markTarget.x = p.x;
    markTarget.y = p.y;
    target.x = p.x;
    target.y = p.y;
    target.s = markTarget.s * MARK_DOT.d;
  }

  const ACTS = {
    hero: actHero,
    stats: actStats,
    about: actAbout,
    services: actServices,
    team: actRest,
    cases: actCases,
    process: actRest,
    quotes: actRest,
    cta: actCta,
    footer: actFooter,
  };

  /* ---------- ScrollTriggers ---------- */

  const triggers = [];

  /* Troca de ato: um ato está em cena enquanto a seção dele CRUZA o
     centro da viewport. Como o fim de uma seção é o começo da
     seguinte, as faixas não se sobrepõem e existe sempre exatamente
     um ato ativo.

     Isso é um IntersectionObserver com rootMargin de -50% em cima e
     embaixo — uma linha de um pixel no meio da tela — e não oito
     ScrollTriggers. Mesma semântica, custo por frame igual a zero. */
  let actObserver = null;
  const actByEl = new Map();

  function bindAct(selector, name) {
    const el = document.querySelector(selector);
    if (!el) return;
    actByEl.set(el, name);
  }

  function startActObserver() {
    if (!('IntersectionObserver' in window)) return;
    actObserver = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          const name = actByEl.get(e.target);
          if (name) setAct(name);
        }
      },
      { rootMargin: '-50% 0px -50% 0px', threshold: 0 }
    );
    actByEl.forEach((_, el) => actObserver.observe(el));
  }

  let onChange = () => {};
  let footerTimer = 0;

  function setAct(next) {
    if (next === act) return;
    const leaving = act;
    act = next;
    lastPage = null;
    /* O `S` não voa de onde estava: reaparece de perfil, no próprio
       lugar, e abre. */
    if ((next === 'hero' || next === 'footer') && leaving !== 'hero' && leaving !== 'footer') {
      snapMark = true;
      markCur.s = 0;
      markCur.turn = HALF_TURN;
    }
    if (next !== 'cases') setActiveCase(-1);

    // O canvas inteiro some na equipe e em "Como trabalhamos": é o
    // descanso da página, e o ponto não passa por cima dos cards.
    sceneEl?.toggleAttribute('data-rest', next === 'team' || next === 'process');
    clearTimeout(footerTimer);
    if (next === 'footer') {
      sceneEl?.setAttribute('data-footer-transition', '');
      footerTimer = setTimeout(() => sceneEl?.removeAttribute('data-footer-transition'), reduced ? 0 : 980);
    } else {
      sceneEl?.removeAttribute('data-footer-transition');
    }
    document.documentElement.dataset.sceneAct = next;

    const shapeFor = { stats: 'clusters', cases: 'disc' }[next] || 'sphere';
    if (particles && shapeFor !== particles.currentShape) {
      particles.currentShape = shapeFor;
      particles.morphTo(buildShape(shapeFor));
      gsap.to(particles.material.uniforms.uMorph, {
        value: 1,
        duration: reduced ? 0.01 : 1.1,
        ease: 'power2.inOut',
        onUpdate: onChange,
      });
    }

    onChange();
  }

  function buildShape(name) {
    const n = particles?.count ?? 0;
    if (name === 'clusters') {
      const v = view();
      const centers = cache.stats.length
        ? cache.stats.map((s) => {
            const p = toWorld(s.docX, s.docY - scrollY());
            return [p.x, p.y, 0];
          })
        : [
            [-v.w * 0.28, 0, 0],
            [0, 0, 0],
            [v.w * 0.28, 0, 0],
          ];
      return SHAPES.clusters(n, centers, 0.28);
    }
    if (name === 'disc') return SHAPES.disc(n, 2.2);
    if (name === 'ring') return SHAPES.ring(n);
    return SHAPES.sphere(n, 1.7);
  }

  function bind({ onDirty }) {
    onChange = onDirty;
    document.documentElement.dataset.sceneAct = act;

    bindAct('.hero', 'hero');
    bindAct('.section--stats', 'stats');
    bindAct('#quem-somos', 'about');
    bindAct('.section--services', 'services');
    bindAct('#equipe', 'team');
    bindAct('#cases', 'cases');
    bindAct('#como-trabalhamos', 'process');
    bindAct('#feedbacks', 'quotes');
    bindAct('#contato', 'cta');
    bindAct('.footer', 'footer');
    startActObserver();

    // O scrub do hero — o único ato com precisão de sub-pixel — é
    // dirigido pelo pin que vive em sections/hero.js. Aqui só lemos.
    const hero = document.querySelector('.hero');
    if (hero) {
      triggers.push(
        ScrollTrigger.create({
          trigger: hero,
          start: 'top top',
          end: () => `+=${window.innerHeight * (heroState.pinned ? 1.2 : 1)}`,
          scrub: true,
          onUpdate: onDirty,
        })
      );
    }

    const cases = document.querySelector('#cases');
    if (cases) {
      triggers.push(
        ScrollTrigger.create({
          trigger: cases,
          start: 'top 72%',
          end: 'bottom 42%',
          scrub: true,
          invalidateOnRefresh: true,
          onUpdate: (self) => { casesProgress = self.progress; onDirty(); },
          onRefresh: (self) => { casesProgress = self.progress; },
        })
      );
    }

    const footer = document.querySelector('.footer');
    if (footer) {
      triggers.push(
        ScrollTrigger.create({
          trigger: footer,
          start: 'top 60%',
          end: 'bottom 40%',
          onEnter: () => setAct('footer'),
          onEnterBack: () => setAct('footer'),
          onLeaveBack: () => setAct('cta'),
        })
      );
    }

    ScrollTrigger.addEventListener('refresh', refresh);

    // O `S.` acompanha o ponteiro: inclina e desloca de leve. Só no hero.
    window.addEventListener(
      'pointermove',
      (e) => {
        if (e.pointerType === 'touch') return;
        pointer.tx = (e.clientX / window.innerWidth - 0.5) * 2;
        pointer.ty = (e.clientY / window.innerHeight - 0.5) * -2;
        onDirty();
      },
      { passive: true }
    );

    refresh();
  }

  /* ---------- update ---------- */

  const pageScroll = () => {
    if (act === 'hero') return heroScroll();
    if (act === 'services') return servicesScroll();
    return scrollY();
  };

  function update(dt, elapsed) {
    pointer.x += (pointer.tx - pointer.x) * Math.min(1, dt * 3.4);
    pointer.y += (pointer.ty - pointer.y) * Math.min(1, dt * 3.4);

    (ACTS[act] || actHero)();

    const v = view();

    /* O scroll entra direto, sem lerp: é o que mantém o `S.` e o ponto
       colados no texto. Com o lerp cuidando disso também, o corpo ficava
       para trás a cada gesto e parecia solto da página. */
    const page = pageScroll();
    if (lastPage !== null && page !== lastPage) {
      const d = (page - lastPage) * v.pxToWorld;
      cur.y += d;
      markCur.y += d;
    }
    lastPage = page;

    if (snapAll) {
      Object.assign(cur, target);
      Object.assign(markCur, markTarget);
      snapAll = false;
    }
    if (snapMark) {
      markCur.x = markTarget.x;
      markCur.y = markTarget.y;
      snapMark = false;
    }

    const k = Math.min(1, dt * (reduced ? 24 : 9));
    cur.x += (target.x - cur.x) * k;
    cur.y += (target.y - cur.y) * k;
    cur.s += (target.s - cur.s) * k;
    cur.o += (target.o - cur.o) * Math.min(1, dt * 5);
    cur.shadow += (target.shadow - cur.shadow) * Math.min(1, dt * 5);
    cur.turn += (target.turn - cur.turn) * k;
    cur.tilt += (target.tilt - cur.tilt) * k;
    cur.free += (target.free - cur.free) * k;

    markCur.x += (markTarget.x - markCur.x) * k;
    markCur.y += (markTarget.y - markCur.y) * k;
    markCur.s += (markTarget.s - markCur.s) * k;
    markCur.turn += (markTarget.turn - markCur.turn) * k;
    markCur.tilt += (markTarget.tilt - markCur.tilt) * k;

    if (!started) {
      dot.disc.visible = false;
      dot.mark.visible = false;
      shadow.hide();
      return { settled: true, act };
    }

    /* A pose do `S`, e onde o ponto encaixaria nela. */
    const markS = markCur.s * intro.s;
    const markTurn = markCur.turn - intro.spin * 1.1;
    euler.set(markCur.tilt, markTurn, 0);
    offset.set(MARK_DOT.x, MARK_DOT.y, 0).multiplyScalar(markS).applyEuler(euler);

    /* O ponto é a mistura entre o encaixe e o caminho próprio. O encaixe
       sai da pose ATUAL do `S`, e não do alvo: assim os dois nunca se
       separam antes da hora. */
    const free = markOk ? cur.free : 1;
    const dotX = lerp(markCur.x + offset.x, cur.x, free);
    const dotY = lerp(markCur.y + offset.y, cur.y, free) + Math.sin(free * Math.PI) * arc * v.h;
    const dotZ = lerp(offset.z, 0, free);
    const dotS = lerp(markS * MARK_DOT.d * intro.dot, cur.s, free);

    dot.disc.visible = cur.o > 0.01 && dotS > 0.0005;
    dot.disc.position.set(dotX, dotY, dotZ);
    dot.disc.scale.set(dotS, dotS, dotS * lerp(MARK_DOT.z, 1, free));
    dot.disc.rotation.set(lerp(markCur.tilt, cur.tilt, free), lerp(markTurn, cur.turn, free), 0);

    const markOn = markOk && cur.o > 0.01 && markS > 0.002;
    dot.mark.visible = markOn;
    if (markOn) {
      dot.mark.position.set(markCur.x, markCur.y, 0);
      dot.mark.scale.setScalar(markS);
      dot.mark.rotation.set(markCur.tilt, markTurn, 0);
    }

    dot.material.opacity = cur.o;
    dot.material.transparent = cur.o < 0.999;

    const pk = Math.min(1, dt * 3.2);
    pCur.x += (pTarget.x - pCur.x) * pk;
    pCur.y += (pTarget.y - pCur.y) * pk;
    pCur.s += (pTarget.s - pCur.s) * pk;
    pCur.a += (pTarget.a - pCur.a) * pk;

    if (particles) {
      particles.points.position.set(pCur.x, pCur.y, -0.45);
      particles.points.scale.setScalar(Math.max(0.001, pCur.s));
      particles.material.uniforms.uTime.value = elapsed;
      particles.material.uniforms.uOpacity.value = pCur.a;
    }

    // Sombra de contato: embaixo do `S` enquanto ele existe; depois, do ponto.
    const sx = ((markOn ? markCur.x : dotX) / v.w + 0.5) * window.innerWidth;
    const sy = (0.5 - (markOn ? markCur.y : dotY) / v.h) * viewH();
    const rpx = (markOn ? markS : dotS) / v.pxToWorld / 2;
    if (cur.shadow > 0.01 && cur.o > 0.05) {
      shadow.update(sx, sy, rpx, cur.shadow * 0.9 * cur.o);
    } else {
      shadow.hide();
    }

    const settled =
      Math.abs(target.x - cur.x) < 0.0008 &&
      Math.abs(target.y - cur.y) < 0.0008 &&
      Math.abs(target.s - cur.s) < 0.0004 &&
      Math.abs(target.o - cur.o) < 0.004 &&
      Math.abs(target.free - cur.free) < 0.002 &&
      Math.abs(target.turn - cur.turn) < 0.002 &&
      Math.abs(markTarget.x - markCur.x) < 0.0008 &&
      Math.abs(markTarget.y - markCur.y) < 0.0008 &&
      Math.abs(markTarget.s - markCur.s) < 0.0004 &&
      Math.abs(markTarget.turn - markCur.turn) < 0.002 &&
      Math.abs(pointer.tx - pointer.x) < 0.002 &&
      Math.abs(pointer.ty - pointer.y) < 0.002 &&
      Math.abs(pTarget.a - pCur.a) < 0.004 &&
      Math.abs(pTarget.x - pCur.x) < 0.002;

    return { settled, act };
  }

  function playIntro(onDirty) {
    started = true;
    if (reduced) return;
    intro.s = 0.82;
    intro.spin = 1;
    intro.dot = 0;
    gsap
      .timeline({ onUpdate: onDirty })
      .to(intro, { s: 1, spin: 0, duration: 1, ease: 'power3.out' }, 0)
      .to(intro, { dot: 1, duration: 0.5, ease: 'back.out(2.2)' }, 0.55);
  }

  function dispose() {
    clearTimeout(footerTimer);
    sceneEl?.removeAttribute('data-footer-transition');
    actObserver?.disconnect();
    triggers.forEach((t) => t.kill());
    ScrollTrigger.removeEventListener('refresh', refresh);
  }

  return {
    bind,
    update,
    refresh,
    playIntro,
    dispose,
    markReady: () => { markOk = true; },
    getAct: () => act,
  };
}
