import gsap from 'gsap';
import { $, $$ } from '../lib/dom.js';

/* Uma cena em loop por card de serviço. O markup (data/service-visuals.js)
   já é o estado final, então cada cena só descreve de onde as peças
   vêm: sem JS ou com reduced-motion, nada aqui roda e o card fica
   completo e parado.

   Cada timeline só anda enquanto o card está na tela. Parado, nenhuma
   tween fica ativa e o ticker do GSAP volta a hibernar. */

const HOLD = 2.4;
const pop = { scale: 0, opacity: 0, duration: 0.4, ease: 'back.out(2.2)' };
const rise = { y: 10, opacity: 0, duration: 0.45, ease: 'power2.out' };
const draw = { strokeDashoffset: 1, duration: 0.9, ease: 'power1.inOut' };

const SCENES = {
  social(tl, r) {
    tl.from($$('.vs-day.is-on i', r), { ...pop, stagger: 0.28 })
      .from($('.vs-post', r), rise, '+=0.1')
      .from($$('.vs-lines .sk', r), { scaleX: 0, transformOrigin: 'left', duration: 0.4, stagger: 0.1, ease: 'power2.out' }, '-=0.2')
      .from($('.vs-pub', r), pop, '+=0.1')
      .from($('.vs-heart', r), { scale: 0, duration: 0.5, ease: 'back.out(3)' }, '+=0.15')
      .to($('.vs-heart', r), { scale: 1.2, duration: 0.14, yoyo: true, repeat: 1, ease: 'power1.inOut' });
  },

  traffic(tl, r) {
    tl.from($('.vt-base', r), draw)
      .from($('.vt-line', r), { ...draw, duration: 1.5 }, '-=0.5')
      .from($('.vt-area', r), { opacity: 0, duration: 0.7 }, '-=0.8')
      .from($('.vt-dot', r), pop, '-=0.15')
      .from($$('.vt-bar i', r), { scaleX: 0, transformOrigin: 'left', duration: 0.7, stagger: 0.15, ease: 'power2.out' }, '-=0.3');
  },

  site(tl, r) {
    const cta = $('.vw-cta', r);
    const cursor = $('.vw-cursor', r);
    tl.from($('.vw', r), rise)
      .from($$('.vw-b', r), { opacity: 0, y: 6, duration: 0.3, stagger: 0.1, ease: 'power2.out' })
      .from(cursor, { x: 96, y: 52, opacity: 0, duration: 0.9, ease: 'power2.inOut' }, '+=0.1')
      .to(cta, { scale: 0.92, duration: 0.1, yoyo: true, repeat: 1, ease: 'power1.inOut' })
      .to(cursor, { scale: 0.82, duration: 0.1, yoyo: true, repeat: 1, ease: 'power1.inOut' }, '<')
      .from($('.vw-toast', r), { ...rise, scale: 0.9 }, '+=0.05');
  },

  brand(tl, r) {
    // Guias acesas e o tipo em Archivo no início; o CSS guarda o fim.
    tl.set($('.vb-guides', r), { opacity: 1 })
      .set($('.vb-aa', r), { opacity: 1 })
      .set($('.vb-aa--alt', r), { opacity: 0 })
      .from($$('.vb-guides > *', r), { ...draw, duration: 0.7, stagger: 0.14 })
      .from($('.vb-shape--a', r), { opacity: 0, duration: 0.45 }, '+=0.05')
      .from($('.vb-shape--b', r), { ...pop, transformOrigin: '50% 50%' }, '-=0.15')
      .to($('.vb-guides', r), { opacity: 0.35, duration: 0.4 }, '<')
      .from($('.vb-type', r), rise, '-=0.1')
      .from($$('.vb-sw', r), { ...pop, stagger: 0.09 }, '-=0.1')
      .to($('.vb-aa', r), { opacity: 0, duration: 0.3 }, '+=0.35')
      .to($('.vb-aa--alt', r), { opacity: 1, duration: 0.3 }, '<');
  },

  automation(tl, r) {
    const [a, b, c, d] = ['.va-1', '.va-2', '.va-3', '.va-4'].map((s) => $(s, r));
    const wires = $$('.va-wire', r);
    const tick = (n) => $('.va-tick', n);
    const wire = { strokeDashoffset: 1, duration: 0.45, ease: 'power1.inOut' };

    tl.from(a, rise)
      .from(tick(a), pop)
      .from(wires[0], wire)
      .from(b, rise, '-=0.1')
      .from(tick(b), pop, '+=0.1')
      .from([wires[1], wires[2]], wire)
      .from([c, d], rise, '-=0.1')
      .from([tick(c), tick(d)], { ...pop, stagger: 0.14 }, '+=0.05');
  },
};

export function initServiceVisuals({ reduced = false } = {}) {
  if (reduced || !('IntersectionObserver' in window)) return;

  const timelines = new Map();

  $$('.svc__stage[data-visual]').forEach((stage) => {
    const scene = SCENES[stage.dataset.visual];
    const root = $('.v', stage);
    if (!scene || !root) return;

    const tl = gsap.timeline({ paused: true, repeat: -1 });
    tl.set(root, { autoAlpha: 1 });
    scene(tl, root);
    tl.to(root, { autoAlpha: 0, duration: 0.35, ease: 'power1.in' }, `+=${HOLD}`);
    timelines.set(stage, tl);
  });

  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        const tl = timelines.get(e.target);
        if (e.isIntersecting) tl.play();
        else tl.pause();
      }
    },
    { threshold: 0.35 }
  );

  timelines.forEach((_, stage) => io.observe(stage));
}
