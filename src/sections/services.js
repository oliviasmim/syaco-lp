import gsap from 'gsap';
import ScrollTrigger from 'gsap/ScrollTrigger';
import { $, clamp } from '../lib/dom.js';

/* Desktop e celular/tablet em pé: seção pinned, track horizontal por
   translateX dirigido pela rolagem da página. O ponto 3D corre no
   trilho do rodapé.
   Celular deitado, tela baixa demais ou sem JS: swipe horizontal
   nativo com snap. Pinar um bloco mais alto que a tela esconderia
   parte dele durante todo o pin. */

export const servicesState = {
  progress: 0,
  pinned: false,
  active: false,
  pinStart: 0,
  pinDuration: 0,
};

export function initServices({ reduced = false } = {}) {
  const section = $('.section--services');
  const viewport = $('.services__viewport');
  const track = $('.services__track');
  const fill = $('.services__rail-fill');
  if (!section || !track) return;

  const setProgress = (p) => {
    servicesState.progress = clamp(p);
    if (fill) fill.style.width = `${servicesState.progress * 100}%`;
  };

  // Progresso no swipe horizontal nativo (quando não há pin).
  const onNative = () => {
    const max = viewport.scrollWidth - viewport.clientWidth;
    setProgress(max > 0 ? viewport.scrollLeft / max : 0);
  };
  viewport?.addEventListener('scroll', onNative, { passive: true });

  ScrollTrigger.create({
    trigger: section,
    start: 'top bottom',
    end: 'bottom top',
    onToggle: (self) => { servicesState.active = self.isActive; },
  });

  const mm = gsap.matchMedia();

  mm.add({
    desktop: '(min-width: 1024px)',
    handheld: '(max-width: 1023px) and (orientation: portrait)',
  }, (ctx) => {
    section.classList.add('is-pinned');

    // Só pina no celular se tudo couber na altura da tela (ver hero.js).
    const pin = $('.services__pin');
    if (!ctx.conditions.desktop && pin.offsetHeight > window.innerHeight + 8) {
      section.classList.remove('is-pinned');
      return undefined;
    }

    servicesState.pinned = true;
    viewport.removeEventListener('scroll', onNative);

    // A distância é remedida a cada refresh: fonte carregada tarde
    // ou resize mudam a largura do track.
    const distance = () => Math.max(0, track.scrollWidth - window.innerWidth);

    const st = ScrollTrigger.create({
      trigger: section,
      start: 'top top',
      end: () => `+=${distance() + window.innerHeight * 0.4}`,
      pin: '.services__pin',
      pinSpacing: true,
      scrub: reduced ? false : 1,
      invalidateOnRefresh: true,
      anticipatePin: 1,
      refreshPriority: 2,
      onUpdate: (self) => {
        setProgress(self.progress);
        gsap.set(track, { x: -distance() * self.progress });
      },
      onRefresh: (self) => {
        servicesState.pinStart = self.start;
        servicesState.pinDuration = self.end - self.start;
        setProgress(self.progress);
        gsap.set(track, { x: -distance() * self.progress });
      },
    });

    return () => {
      section.classList.remove('is-pinned');
      servicesState.pinned = false;
      servicesState.pinDuration = 0;
      gsap.set(track, { x: 0 });
      setProgress(0);
      st.kill();
      viewport.addEventListener('scroll', onNative, { passive: true });
    };
  });

  onNative();
}
