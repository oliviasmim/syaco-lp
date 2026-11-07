import gsap from 'gsap';
import { $$ } from '../lib/dom.js';

/* Revelação de seção: opacity 0→1 + y 24→0, 500ms, power2.out,
   stagger 80ms, no máximo 8 filhos por grupo.

   Usa IntersectionObserver, e não ScrollTrigger, de propósito. São
   ~40 elementos reveláveis; como ScrollTrigger isso virava oito
   triggers que o GSAP reavalia a cada frame de scroll. O
   IntersectionObserver é nativo, não roda no rAF e não custa nada
   quando a página está parada — medido no Lighthouse mobile, é a
   diferença entre segundos e milissegundos de bloqueio. O
   ScrollTrigger fica só onde ele é insubstituível: nos dois pins e
   nos scrubs. */

export function initReveal({ reduced = false } = {}) {
  const groups = new Map();

  $$('.reveal').forEach((el) => {
    const host =
      el.closest('.section, .hero, .footer, .services__pin') || document.body;
    if (!groups.has(host)) groups.set(host, []);
    groups.get(host).push(el);
  });

  const chunks = [];
  groups.forEach((items) => {
    // Grupos de no máximo 8: acima disso o stagger vira espera.
    for (let i = 0; i < items.length; i += 8) chunks.push(items.slice(i, i + 8));
  });

  if (!('IntersectionObserver' in window)) {
    chunks.flat().forEach((el) => el.classList.add('is-in'));
    gsap.set(chunks.flat(), { opacity: 1, y: 0 });
    return;
  }

  const chunkOf = new Map();

  const play = (chunk, forward) => {
    gsap.to(chunk, {
      opacity: forward ? 1 : 0,
      y: forward ? 0 : 24,
      duration: reduced ? 0.2 : forward ? 0.5 : 0.32,
      ease: forward ? 'power2.out' : 'power2.in',
      stagger: reduced || !forward ? 0 : 0.08,
      overwrite: 'auto',
      onComplete() {
        if (forward) chunk.forEach((el) => (el.style.willChange = 'auto'));
      },
    });
    chunk.forEach((el) => el.classList.toggle('is-in', forward));
  };

  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        const chunk = chunkOf.get(e.target);
        if (!chunk) continue;
        const lead = chunk[0];
        if (e.isIntersecting) {
          if (!lead.classList.contains('is-in')) play(chunk, true);
        } else if (!reduced && e.target === lead && e.boundingClientRect.top > 0) {
          // só desfaz quando o grupo sai por baixo (scroll de volta)
          play(chunk, false);
        }
      }
    },
    // equivale a start: 'top 88%' do ScrollTrigger
    { rootMargin: '0px 0px -12% 0px', threshold: 0 }
  );

  // Observa todos, não só o primeiro: quem chega no meio do grupo (reload,
  // tecla End, barra de rolagem) também dispara a revelação.
  chunks.forEach((chunk) => {
    chunk.forEach((el) => {
      chunkOf.set(el, chunk);
      io.observe(el);
    });
  });
}
