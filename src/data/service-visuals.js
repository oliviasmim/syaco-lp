/* Mockups animados dos cards de serviço, injetados no HTML em build.
   O markup já é o ESTADO FINAL de cada animação: sem JavaScript ou
   com prefers-reduced-motion, o card mostra a cena completa e parada.
   As animações moram em src/sections/services-visuals.js.

   São decorativos (aria-hidden no palco). Sem números de propósito:
   métrica em mockup de agência é lida como resultado de cliente. */

const CHECK =
  '<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 6.4 5 8.8l4.5-5.4"/></svg>';

const HEART =
  '<svg viewBox="0 0 16 16" fill="currentColor"><path d="M8 14S1.5 10.2 1.5 5.7A3.4 3.4 0 0 1 8 4.3a3.4 3.4 0 0 1 6.5 1.4C14.5 10.2 8 14 8 14Z"/></svg>';

const DAYS = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D'];
const PLANNED = new Set([0, 2, 3, 5]);

const social = `
  <div class="vs-week vm">
    ${DAYS.map(
      (d, i) =>
        `<span class="vs-day${PLANNED.has(i) ? ' is-on' : ''}"><b>${d}</b><i></i></span>`
    ).join('')}
  </div>
  <div class="vs-post vm">
    <div class="vs-thumb"><span class="vs-heart">${HEART}</span></div>
    <div class="vs-lines">
      <i class="sk" style="width:82%"></i>
      <i class="sk" style="width:56%"></i>
      <span class="vchip vchip--ok vs-pub">${CHECK}Publicado</span>
    </div>
  </div>`;

const traffic = `
  <div class="vt vm">
    <div class="vt-head">
      <span class="vlabel">Retorno</span>
      <span class="vlive"><i></i>Ao vivo</span>
    </div>
    <svg class="vt-chart" viewBox="0 0 224 72" preserveAspectRatio="none">
      <path class="vt-grid" d="M0 18h224M0 42h224M0 66h224"/>
      <path class="vt-area" d="M0 62C20 60 34 54 54 55s30-10 50-12 28-12 48-16 34-20 72-23v68H0Z"/>
      <path class="vt-base" pathLength="1" d="M0 58C60 56 150 54 224 50"/>
      <path class="vt-line" pathLength="1" d="M0 62C20 60 34 54 54 55s30-10 50-12 28-12 48-16 34-20 72-23"/>
    </svg>
    <span class="vt-dot"></span>
    <div class="vt-rows">
      <span class="vlabel">Meta Ads</span><span class="vt-bar"><i style="width:78%"></i></span>
      <span class="vlabel">Google Ads</span><span class="vt-bar"><i style="width:62%"></i></span>
    </div>
  </div>`;

const site = `
  <div class="vw vm">
    <div class="vw-bar"><i></i><i></i><i></i><span class="vw-url"></span></div>
    <div class="vw-page">
      <i class="sk sk--ink vw-b" style="width:70%"></i>
      <i class="sk vw-b" style="width:90%"></i>
      <i class="sk vw-b" style="width:54%"></i>
      <span class="vw-cta vw-b">Quero saber mais</span>
    </div>
    <div class="vw-media vw-b"></div>
  </div>
  <svg class="vw-cursor" viewBox="0 0 16 16"><path d="M3 1.5v11.2l3.1-2.7 2 4.5 2.1-.9-2-4.5 4.1-.3L3 1.5Z"/></svg>
  <span class="vchip vchip--ok vw-toast">${CHECK}Novo lead</span>`;

const brand = `
  <div class="vb-mark vm">
    <svg viewBox="0 0 96 96" fill="none">
      <g class="vb-guides">
        <path pathLength="1" d="M0 48h96M48 0v96"/>
        <circle pathLength="1" cx="48" cy="48" r="30"/>
        <rect pathLength="1" x="18" y="18" width="60" height="60"/>
      </g>
      <path class="vb-shape vb-shape--a" d="M18 18h60v30H48a30 30 0 0 0-30 30Z"/>
      <circle class="vb-shape vb-shape--b" cx="62" cy="62" r="16"/>
    </svg>
  </div>
  <div class="vb-side">
    <div class="vb-type vm"><span class="vb-aa">Aa</span><span class="vb-aa vb-aa--alt">Aa</span></div>
    <div class="vb-swatches">
      <i class="vb-sw vb-sw--navy"></i>
      <i class="vb-sw vb-sw--cream"></i>
      <i class="vb-sw vb-sw--inferno"></i>
      <i class="vb-sw vb-sw--soil"></i>
    </div>
  </div>`;

const node = (cls, label) =>
  `<span class="va-node vm ${cls}"><span class="va-tick">${CHECK}</span>${label}</span>`;

const automation = `
  <svg class="va-wires" viewBox="0 0 248 140" fill="none">
    <path class="va-wire" pathLength="1" d="M66 70h22"/>
    <path class="va-wire" pathLength="1" d="M154 70c14 0 14-44 28-44"/>
    <path class="va-wire" pathLength="1" d="M154 70c14 0 14 44 28 44"/>
  </svg>
  ${node('va-1', 'Novo lead')}
  ${node('va-2', 'Qualifica')}
  ${node('va-3', 'CRM')}
  ${node('va-4', 'WhatsApp')}`;

export const SERVICE_VISUALS = { social, traffic, site, brand, automation };
