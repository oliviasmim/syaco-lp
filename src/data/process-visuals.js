/* Mini-interfaces de "Como trabalhamos", injetadas no HTML em build.
   Como em service-visuals.js: o markup já é o estado final (sem JS ou
   com reduced-motion, a cena fica completa e parada), é decorativo e
   não tem números — métrica em mockup de agência é lida como resultado
   de cliente. A animação mora em src/sections/process-visuals.js. */

const CHECK =
  '<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 6.4 5 8.8l4.5-5.4"/></svg>';

const checkRow = (label) =>
  `<li class="pv-row"><span class="pv-ring"><span class="pv-tick">${CHECK}</span></span><span class="vlabel">${label}</span></li>`;

const diagnostico = `
  <ul class="pv-panel vm">
    <li class="pv-scan" aria-hidden="true"></li>
    ${['Perfil', 'Site', 'Anúncios', 'Concorrentes'].map(checkRow).join('')}
  </ul>`;

const estrategia = `
  <div class="pv-panel vm">
    <span class="vlabel pv-muted">Canais</span>
    <div class="pv-chips">
      <span class="vchip pv-chip">Redes sociais</span>
      <span class="vchip pv-chip">Tráfego pago</span>
      <span class="vchip pv-chip">Site</span>
    </div>
    <span class="vlabel pv-muted">Meta</span>
    <span class="pv-goal"><i></i><b></b></span>
  </div>`;

const statusRow = (label, status) => `
    <li class="pv-row pv-row--status">
      <span class="vlabel">${label}</span>
      <span class="pv-slot">
        <i class="pv-wait"></i>
        <span class="vchip pv-chip pv-status">${CHECK}${status}</span>
      </span>
    </li>`;

const execucao = `
  <ul class="pv-panel vm">
    ${statusRow('Conteúdo', 'Publicado')}
    ${statusRow('Campanha', 'No ar')}
    ${statusRow('Página', 'Pronta')}
  </ul>`;

const medicao = `
  <div class="pv-panel vm">
    <span class="vlabel pv-muted">Evolução</span>
    <div class="pv-plot">
      <svg class="pv-chart" viewBox="0 0 180 64" preserveAspectRatio="none" fill="none">
        <path class="pv-area" d="M0 56C18 54 32 48 50 49s28-10 46-12 26-10 44-14 24-16 40-18v59H0Z"/>
        <path class="pv-line" d="M0 56C18 54 32 48 50 49s28-10 46-12 26-10 44-14 24-16 40-18"/>
      </svg>
      <span class="pv-tip"><i></i></span>
    </div>
  </div>`;

export const PROCESS_VISUALS = { diagnostico, estrategia, execucao, medicao };
