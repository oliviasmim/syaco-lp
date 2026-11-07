import gsap from 'gsap';
import { $, $$ } from '../lib/dom.js';

/* Revezamento: as quatro telas ficam apagadas e uma etapa acende por
   vez, enquanto uma linha corre pelo topo dos cards. Mostra a ordem do
   processo, e só uma coisa se mexe a cada momento.

   Desktop: a sequência fecha e recomeça, só com a seção na tela.
   Até 1023px os cards estão empilhados, então cada um toca uma vez ao
   entrar na tela.

   O markup já é o estado final: sem JS ou com reduced-motion, nada roda
   e tudo fica completo e parado. */

const DIM = { opacity: 0.45, scale: 0.97 };
const HOLD = 3;
const SPEED = 1.25; // ritmo geral: 1 é o original, maior é mais rápido

const pop = { scale: 0, opacity: 0, duration: 0.32, ease: 'back.out(2.4)' };

const SCENES = {
  diagnostico(tl, r) {
    const rows = $$('.pv-row', r);
    tl.fromTo($('.pv-scan', r), { top: '0%', opacity: 1 }, { top: '100%', duration: 1.2, ease: 'none' }, 0)
      .to($('.pv-scan', r), { opacity: 0, duration: 0.15 });
    rows.forEach((row, i) => {
      const at = 0.1 + i * 0.27;
      tl.from($('.vlabel', row), { opacity: 0.3, duration: 0.2 }, at)
        .from($('.pv-tick', row), pop, at);
    });
  },

  estrategia(tl, r) {
    tl.from($$('.pv-chip', r), { opacity: 0.25, scale: 0.88, duration: 0.3, stagger: 0.2, ease: 'back.out(2.4)' })
      .from($('.pv-goal i', r), { scaleX: 0, transformOrigin: 'left', duration: 0.6, ease: 'power2.inOut' }, '+=0.05')
      .from($('.pv-goal b', r), pop, '-=0.12');
  },

  execucao(tl, r) {
    $$('.pv-row', r).forEach((row, i) => {
      const at = i * 0.42;
      const wait = $('.pv-wait', row);
      tl.fromTo(wait, { opacity: 1, rotation: 0 }, { rotation: 360, duration: 0.42, ease: 'none' }, at)
        .to(wait, { opacity: 0, duration: 0.08 }, at + 0.36)
        .from($('.pv-status', row), { ...pop, transformOrigin: 'right center' }, at + 0.36);
    });
  },

  medicao(tl, r) {
    const svg = $('.pv-chart', r);
    const line = $('.pv-line', r);
    const tip = $('.pv-tip', r);
    const total = line.getTotalLength();
    const draw = { p: 0 };

    // Um único progresso guia a linha e o ponto: tudo anda junto. Corta
    // com clip-path porque dash + non-scaling-stroke termina antes do
    // fim quando o SVG é esticado.
    const render = () => {
      const pt = line.getPointAtLength(total * draw.p);
      const x = (pt.x / 180) * 100;
      gsap.set(svg, { clipPath: `inset(-4px ${100 - x}% -4px 0)` });
      gsap.set(tip, { left: `${x}%`, top: `${(pt.y / 64) * 100}%` });
    };
    render();

    tl.to(draw, { p: 1, duration: 1.3, ease: 'power1.inOut', onUpdate: render, onRepeat: render })
      .fromTo($('.pv-tip i', r), { scale: 1, opacity: 0.5 }, { scale: 3.2, opacity: 0, duration: 0.6, ease: 'power2.out' });
    // Na volta do loop o GSAP rebobina sem chamar onUpdate.
    tl.resetDraw = () => { draw.p = 0; render(); };
  },
};

function buildStep(stage) {
  const scene = SCENES[stage.dataset.visual];
  if (!scene) return null;
  const tl = gsap.timeline();
  const inner = gsap.timeline();
  scene(inner, stage);
  tl.resetDraw = inner.resetDraw;

  tl.fromTo($('.pv', stage), DIM, { opacity: 1, scale: 1, duration: 0.3, ease: 'power2.out' }, 0)
    .add(inner, 0.12)
    .fromTo(
      stage,
      { '--bar': 0 },
      { '--bar': 1, duration: inner.duration() + 0.12, ease: 'none' },
      0
    );
  return tl;
}

function relay(steps, stages) {
  const panels = stages.map((s) => $('.pv', s));
  const master = gsap.timeline({ paused: true, repeat: -1 });
  const resets = [];

  master.fromTo(panels, { opacity: 0 }, { ...DIM, duration: 0.4, ease: 'power1.out', immediateRender: false }, 0);
  let at = 0.5;
  stages.forEach((stage) => {
    const tl = buildStep(stage);
    if (!tl) return;
    if (tl.resetDraw) resets.push(tl.resetDraw);
    master.add(tl, at);
    at += tl.duration() + 0.1;
  });
  master
    .to(panels, { opacity: 0, duration: 0.4, ease: 'power1.in' }, at + HOLD)
    .to(stages, { '--bar': 0, duration: 0.4, ease: 'power1.in' }, at + HOLD);
  master.eventCallback('onRepeat', () => resets.forEach((fn) => fn()));
  master.timeScale(SPEED);

  const io = new IntersectionObserver(
    ([e]) => (e.isIntersecting ? master.play() : master.pause()),
    { threshold: 0.3 }
  );
  io.observe(steps);
  return () => io.disconnect();
}

function oneByOne(stages) {
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        timelines.get(e.target)?.play();
        io.unobserve(e.target);
      }
    },
    { threshold: 0.6 }
  );
  const timelines = new Map();
  stages.forEach((stage) => {
    const tl = buildStep(stage);
    if (!tl) return;
    tl.pause().timeScale(SPEED);
    timelines.set(stage, tl);
    io.observe(stage);
  });
  return () => io.disconnect();
}

export function initProcessVisuals({ reduced = false } = {}) {
  const steps = $('.steps');
  if (reduced || !steps || !('IntersectionObserver' in window)) return;
  const stages = $$('.step__stage[data-visual]', steps);

  const clearDraw = () => gsap.set($$('.pv-chart, .pv-tip', steps), { clearProps: 'all' });

  const mm = gsap.matchMedia();
  mm.add('(min-width: 1024px)', () => {
    const stop = relay(steps, stages);
    return () => { stop(); clearDraw(); };
  });
  mm.add('(max-width: 1023.98px)', () => {
    const stop = oneByOne(stages);
    return () => { stop(); clearDraw(); };
  });
}
