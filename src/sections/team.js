import gsap from 'gsap';
import ScrollTrigger from 'gsap/ScrollTrigger';
import { $ } from '../lib/dom.js';

/* Celular em pé: mesmo comportamento dos serviços. A seção fica pinada
   e os cards passam na horizontal conforme a página rola.
   A partir de 768px a equipe é um grid, sem carrossel. Celular deitado,
   tela baixa demais ou sem JS: swipe horizontal nativo com snap. */

export function initTeam({ reduced = false } = {}) {
  const section = $('.section--team');
  const pin = $('.team__pin');
  const track = $('.team');
  if (!section || !pin || !track) return;

  gsap.matchMedia().add('(max-width: 767px) and (orientation: portrait)', () => {
    section.classList.add('is-pinned');

    // Só pina se tudo couber na altura da tela (ver hero.js).
    if (pin.offsetHeight > window.innerHeight + 8) {
      section.classList.remove('is-pinned');
      return undefined;
    }

    // Remedida a cada refresh: fonte carregada tarde muda a largura.
    const distance = () => Math.max(0, track.offsetWidth - window.innerWidth);
    const place = (self) => gsap.set(track, { x: -distance() * self.progress });

    const st = ScrollTrigger.create({
      trigger: section,
      start: 'top top',
      end: () => `+=${distance() + window.innerHeight * 0.4}`,
      pin,
      pinSpacing: true,
      scrub: reduced ? false : 1,
      invalidateOnRefresh: true,
      anticipatePin: 1,
      refreshPriority: 1,
      onUpdate: place,
      onRefresh: place,
    });

    return () => {
      st.kill();
      gsap.set(track, { x: 0 });
      section.classList.remove('is-pinned');
    };
  });
}
