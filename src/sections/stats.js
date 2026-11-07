import gsap from 'gsap';
import { $$ } from '../lib/dom.js';

/* Count-up em 900ms na entrada, uma vez só, expo.out.
   Com reduced-motion o número já aparece no valor final.
   IntersectionObserver pelo mesmo motivo do reveal.js. */

export function initStats({ reduced = false } = {}) {
  const targets = $$('[data-count-to]');
  if (!targets.length) return;

  const run = (el) => {
    const to = Number(el.dataset.countTo);
    if (!Number.isFinite(to)) return;
    const prefix = el.dataset.countPrefix || '';
    const suffix = el.dataset.countSuffix || '';
    const write = (v) => { el.textContent = `${prefix}${Math.round(v)}${suffix}`; };

    if (reduced) { write(to); return; }

    const box = { v: 0 };
    write(0);
    const count = gsap.to(box, {
      v: to,
      duration: 0.9,
      ease: 'expo.out',
      onUpdate: () => write(box.v),
    });

    // Rede de segurança: se as animações pararem por qualquer motivo, o
    // pior estado possível é a página afirmar "+0". O número final
    // aparece de qualquer jeito.
    setTimeout(() => {
      count.kill();
      write(to);
    }, 1400);
  };

  if (reduced || !('IntersectionObserver' in window)) {
    targets.forEach(run);
    return;
  }

  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        io.unobserve(e.target);
        run(e.target);
      }
    },
    { rootMargin: '0px 0px -15% 0px', threshold: 0 }
  );

  targets.forEach((el) => io.observe(el));
}
