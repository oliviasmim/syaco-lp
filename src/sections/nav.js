import gsap from 'gsap';
import { $, $$, clamp } from '../lib/dom.js';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function initNav({ lenis } = {}) {
  const nav = $('#nav');
  const toggle = $('.nav__toggle');
  const menu = $('#nav-menu');
  const label = toggle?.querySelector('.vh');
  let open = false;
  let lastFocus = null;

  /* ---------- menu mobile ---------- */

  function setOpen(next) {
    if (next === open) return;
    open = next;

    if (open) {
      lastFocus = document.activeElement;
      menu.hidden = false;
      // Um frame para o hidden sair antes da transição de opacidade.
      requestAnimationFrame(() => menu.setAttribute('data-open', 'true'));
      document.body.setAttribute('data-menu-open', '');
      lenis?.stop();
      menu.querySelector(FOCUSABLE)?.focus();
    } else {
      menu.removeAttribute('data-open');
      document.body.removeAttribute('data-menu-open');
      lenis?.start();
      const done = () => { if (!open) menu.hidden = true; };
      menu.addEventListener('transitionend', done, { once: true });
      setTimeout(done, 320);
      lastFocus?.focus();
    }

    toggle.setAttribute('aria-expanded', String(open));
    if (label) label.textContent = open ? 'Fechar menu' : 'Abrir menu';
  }

  toggle?.addEventListener('click', () => setOpen(!open));

  document.addEventListener('keydown', (e) => {
    if (!open) return;

    if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
      toggle.focus();
      return;
    }

    if (e.key !== 'Tab') return;

    // focus trap
    const items = $$(FOCUSABLE, menu).filter((el) => el.offsetParent !== null);
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];

    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  });

  /* ---------- âncoras ---------- */

  const NAV_OFFSET = 84;
  // Acima disso a rolagem atravessaria pins e trocas de tema em cerca
  // de um segundo. Esses saltos passam por uma cortina, sem o trajeto.
  const LONG_JUMP_VH = 1.5;

  const curtain = $('.jump-curtain');

  /* Um elemento pinado está deslocado pelo próprio pin, então o rect
     dele não diz onde ele mora no documento: quem diz é o pin-spacer.
     Seções com pin param coladas no topo, onde o pin começa; com o
     offset da nav, a seção anterior apareceria no vão. */
  function anchorY(target) {
    const spacer = target.closest('.pin-spacer');
    const hasPin = spacer || target.querySelector('.pin-spacer');
    const top = (spacer ?? target).getBoundingClientRect().top + window.scrollY;
    return Math.max(0, top - (hasPin ? 0 : NAV_OFFSET));
  }

  function jumpTo(y) {
    gsap.killTweensOf(curtain);
    gsap.to(curtain, {
      opacity: 1,
      duration: 0.16,
      ease: 'power1.out',
      onComplete() {
        lenis.scrollTo(y, { immediate: true, force: true });
        // A pausa cobre a troca de cor da cortina (ver base.css).
        gsap.to(curtain, { opacity: 0, duration: 0.32, delay: 0.16, ease: 'power2.out' });
      },
    });
  }

  function goTo(target) {
    const y = anchorY(target);

    if (!lenis) {
      window.scrollTo({ top: y, behavior: 'auto' });
      return;
    }

    const longJump = window.innerHeight * LONG_JUMP_VH;
    const distance = Math.abs(y - window.scrollY);

    if (distance > longJump && curtain) jumpTo(y);
    else lenis.scrollTo(y, { duration: 0.6 + 0.5 * clamp(distance / longJump) });
  }

  $$('a[href^="#"]').forEach((a) => {
    a.addEventListener('click', (e) => {
      const id = a.getAttribute('href');
      if (!id || id === '#') return;
      const target = document.querySelector(id);
      if (!target) return;

      e.preventDefault();
      if (open) setOpen(false);

      goTo(target);

      // O foco tem que seguir o scroll, senão o teclado fica para trás.
      target.setAttribute('tabindex', '-1');
      target.focus({ preventScroll: true });
    });
  });

  /* ---------- scrollspy ---------- */

  const spyLinks = $$('.nav__links a, .nav-menu__links a');
  const spyTargets = spyLinks
    .map((a) => a.getAttribute('href'))
    .filter((id, i, all) => id && id.startsWith('#') && all.indexOf(id) === i)
    .map((id) => document.querySelector(id))
    .filter(Boolean);

  function setCurrent(id) {
    spyLinks.forEach((a) => {
      if (a.getAttribute('href') === id) a.setAttribute('aria-current', 'true');
      else a.removeAttribute('aria-current');
    });
  }

  // Banda central da viewport: a seção que cruza o meio da tela é a ativa.
  const spy = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (en.isIntersecting) setCurrent('#' + en.target.id);
    });
  }, { rootMargin: '-45% 0px -50% 0px' });

  spyTargets.forEach((t) => spy.observe(t));

  /* ---------- esconder no scroll para baixo ---------- */

  let last = 0;
  const onScroll = (y) => {
    nav.dataset.scrolled = String(y > 32);
    if (open) return;
    const down = y > last && y > 220;
    nav.dataset.hidden = String(down);
    last = y;

    // Acima da primeira seção linkada (hero), nenhum item fica ativo.
    if (spyTargets[0] && y + window.innerHeight * 0.5 < spyTargets[0].offsetTop) {
      setCurrent(null);
    }
  };

  if (lenis) lenis.on('scroll', ({ scroll }) => onScroll(scroll));
  else window.addEventListener('scroll', () => onScroll(window.scrollY), { passive: true });

  return { close: () => setOpen(false) };
}
