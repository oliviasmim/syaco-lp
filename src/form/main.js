import { INTRO, QUESTIONS, ENDINGS, INSTAGRAM, WHATSAPP } from './questions.js';
import {
  route, score, priority, isHot, endsAfter,
  formatPhone, phoneDigits, validate, labelOf,
} from './qualify.js';
import { buildRequest, assertDelivered } from './request.js';
import { captureUtm } from '../lib/utm.js';
import { $ } from '../lib/dom.js';

/* ============================================================
   Formulário de qualificação — uma pergunta por tela.

   Estado mínimo: em que passo a pessoa está e o que respondeu.
   step -1 é a abertura; 0…6 são as perguntas; `done` guarda a
   tela final depois do envio (recarregar não reenvia nada).
   O rascunho vive no sessionStorage: atualizar a página ou sair
   e voltar na mesma aba não apaga as respostas.
   ============================================================ */

document.documentElement.classList.add('js');

const ENDPOINT = import.meta.env.VITE_FORM_ENDPOINT;
const FORM_KEY = import.meta.env.VITE_FORM_KEY;

const TOTAL = QUESTIONS.length;
const DRAFT = 'syaco-form';
const LETTERS = 'ABCDEF';

/* Menos que isso para responder sete perguntas não é gente. */
const MIN_FILL_MS = 4000;

const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const OUT_MS = reduced ? 0 : 140;   // = --dur-out
const FLASH_MS = reduced ? 0 : 280; // confirmação da escolha antes de avançar

const utm = captureUtm();

const form = $('#fx-form');
const stage = $('#fx-stage');
const bar = $('.fx-bar');
const backBtn = $('[data-back]');
const nextBtn = $('[data-next]');
const nextLabel = $('[data-next-label]');
const hint = $('.fx-bar__hint');
const progress = $('.fx-progress');
const track = $('.fx-progress__track');
const fill = $('.fx-progress__fill');
const count = $('[data-count]');
const status = $('#fx-status');
const honeypot = $('#fx-website');

let state = load();
let current = null;
let locked = false;

/* ---------- rascunho ---------------------------------------- */

/* O rascunho só volta quando a pessoa ATUALIZA a página ou usa
   voltar/avançar do navegador — aí ela espera ver o que deixou.
   Chegar de novo por um CTA é uma visita nova: começa do zero,
   inclusive depois de já ter enviado. */
function load() {
  const fresh = { step: -1, answers: {}, startedAt: 0, done: null };
  const nav = performance.getEntriesByType?.('navigation')[0]?.type;
  try {
    if (nav !== 'reload' && nav !== 'back_forward') {
      sessionStorage.removeItem(DRAFT);
      return fresh;
    }
    const s = JSON.parse(sessionStorage.getItem(DRAFT));
    if (s && typeof s.step === 'number' && s.answers) return s;
  } catch { /* nada salvo, ou storage bloqueado */ }
  return fresh;
}

function save() {
  try { sessionStorage.setItem(DRAFT, JSON.stringify(state)); } catch { /* segue sem rascunho */ }
}

/* ---------- utilitários ------------------------------------- */

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/* "R$" nunca fica sozinho no fim da linha, longe do valor. */
const esc = (s) =>
  String(s ?? '')
    .replace(/[&<>"']/g, (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
    )
    .replace(/R\$ /g, () => 'R$ ');

const pad = (n) => String(n).padStart(2, '0');

const ICON = {
  arrow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5 10 17.5 19 7"/></svg>',
  alert: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7.5v5.5M12 16.5h.01"/></svg>',
  clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  out: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 17 17 7M7 7h10v10"/></svg>',
};

/* O @ da marca dentro do texto da tela final vira link. */
const linkHandle = (text) =>
  esc(text).replace('@syacocompany', `<a href="${INSTAGRAM}" target="_blank" rel="noopener">@syacocompany</a>`);

/* ---------- telas ------------------------------------------- */

function screen(html, cls, labelledby) {
  const el = document.createElement('section');
  el.className = `fx-screen ${cls}`;
  el.setAttribute('aria-labelledby', labelledby);
  el.innerHTML = html;
  return el;
}

function buildIntro() {
  return screen(
    `
    <h1 class="fx-intro__title display" id="fx-title" tabindex="-1">${esc(INTRO.title)}</h1>
    <p class="fx-intro__text">${esc(INTRO.text)}</p>
    <div class="fx-intro__actions">
      <button class="btn btn--primary fx-intro__cta" type="button" data-start>${esc(INTRO.cta)} ${ICON.arrow}</button>
      <p class="fx-intro__meta">${ICON.clock}<span>${esc(INTRO.meta)}</span></p>
    </div>`,
    'fx-intro',
    'fx-title'
  );
}

function buildField(q) {
  const describedby = [q.hint && 'fx-hint', 'fx-error'].filter(Boolean).join(' ');
  if (q.kind === 'phone') {
    return `
      <div class="fx-field fx-field--phone">
        <span class="fx-field__prefix" aria-hidden="true">+55</span>
        <input class="fx-input u-num" id="fx-input" name="${q.id}" type="tel" inputmode="numeric"
               autocomplete="tel-national" placeholder="${esc(q.placeholder)}" maxlength="16"
               enterkeyhint="next" aria-describedby="${describedby}">
      </div>`;
  }
  return `
    <div class="fx-field">
      <input class="fx-input" id="fx-input" name="${q.id}" type="text"
             autocomplete="${esc(q.autocomplete)}" placeholder="${esc(q.placeholder)}" maxlength="120"
             autocapitalize="${q.id === 'nome' ? 'words' : 'off'}" spellcheck="false"
             enterkeyhint="next" aria-describedby="${describedby}">
    </div>
    ${q.shortcut ? `<button class="fx-chip" type="button" data-shortcut>${esc(q.shortcut[0].toUpperCase() + q.shortcut.slice(1))}</button>` : ''}`;
}

function buildOptions(q, answer) {
  const selectedIdx = q.options.findIndex((o) => o.value === answer);
  return `
    <div class="fx-opts" role="radiogroup" aria-labelledby="fx-title" aria-describedby="fx-error">
      ${q.options
        .map((o, i) => {
          const checked = i === selectedIdx;
          const tabbable = checked || (selectedIdx === -1 && i === 0);
          return `
          <button class="fx-opt" type="button" role="radio" data-value="${esc(o.value)}"
                  aria-checked="${checked}" tabindex="${tabbable ? 0 : -1}">
            <span class="fx-opt__key" aria-hidden="true">${LETTERS[i]}</span>
            <span class="fx-opt__label">${esc(o.label)}</span>
            <span class="fx-opt__check">${ICON.check}</span>
          </button>`;
        })
        .join('')}
    </div>`;
}

function buildQuestion(q, i) {
  const isChoice = q.kind === 'choice';
  const title = isChoice
    ? esc(q.title)
    : `<label for="fx-input">${esc(q.title)}</label>`;

  const el = screen(
    `
    <p class="fx-q__num" aria-hidden="true"><span class="u-num">${pad(i + 1)}</span>${ICON.arrow}</p>
    ${q.note ? `<p class="fx-q__note">${esc(q.note)}</p>` : ''}
    <h1 class="fx-q__title display" id="fx-title" tabindex="-1">${title}</h1>
    ${q.hint ? `<p class="fx-q__hint" id="fx-hint">${esc(q.hint)}</p>` : ''}
    ${isChoice ? buildOptions(q, state.answers[q.id]) : buildField(q)}
    <p class="fx-error" id="fx-error" hidden>${ICON.alert}<span></span></p>`,
    `fx-q fx-q--${q.kind}`,
    'fx-title'
  );

  const input = $('#fx-input', el);
  if (input) {
    const saved = state.answers[q.id];
    if (saved) input.value = q.kind === 'phone' ? formatPhone(saved) : saved;
  }
  return el;
}

function buildEnding(kind) {
  const e = ENDINGS[kind];
  const toSite = `<a class="btn ${kind === 'match' ? 'btn--primary' : 'btn--ghost'}" href="/">Voltar ao site</a>`;
  const toInsta = `<a class="btn ${kind === 'match' ? 'btn--ghost' : 'btn--primary'}" href="${INSTAGRAM}" target="_blank" rel="noopener">Ver o @syacocompany ${ICON.out}</a>`;
  return screen(
    `
    <span class="fx-end__mark" aria-hidden="true"></span>
    <h1 class="fx-end__title display" id="fx-title" tabindex="-1">${esc(e.title)}</h1>
    <p class="fx-end__text">${linkHandle(e.text)}</p>
    <div class="fx-end__actions">${kind === 'match' ? toSite + toInsta : toInsta + toSite}</div>`,
    `fx-end fx-end--${kind}`,
    'fx-title'
  );
}

function build() {
  if (state.done) return buildEnding(state.done);
  if (state.step < 0) return buildIntro();
  return buildQuestion(QUESTIONS[state.step], state.step);
}

/* ---------- moldura: progresso e barra ----------------------- */

function syncChrome() {
  const asking = !state.done && state.step >= 0;
  const q = QUESTIONS[state.step];

  progress.toggleAttribute('data-hidden', !asking);
  bar.toggleAttribute('data-hidden', !asking);
  document.documentElement.toggleAttribute('data-asking', asking);
  if (!asking) return;

  fill.style.transform = `scaleX(${state.step / TOTAL})`;
  track.setAttribute('aria-valuenow', String(state.step));
  count.textContent = String(state.step + 1);

  const last = state.step === TOTAL - 1;
  nextLabel.textContent = last ? 'Enviar' : 'OK';
  hint.innerHTML = q.kind === 'choice'
    ? 'aperte <kbd>A</kbd>–<kbd>' + LETTERS[q.options.length - 1] + '</kbd>'
    : 'aperte <kbd>Enter ↵</kbd>';
}

/* iOS só abre o teclado quando o foco vem do próprio toque, e a tela
   nova chega depois da animação. Então, no toque, o foco vai para um
   campo invisível (o teclado abre) e passa para o campo real quando
   ele entra. Só quando a próxima tela tem campo de texto. */
let keyboardProxy;
function primeKeyboard(step) {
  const q = QUESTIONS[step];
  if (!q || q.kind === 'choice') return;
  if (!keyboardProxy) {
    keyboardProxy = document.createElement('input');
    keyboardProxy.type = 'text';
    keyboardProxy.tabIndex = -1;
    keyboardProxy.setAttribute('aria-hidden', 'true');
    // 16px evita o zoom automático do iOS no foco.
    keyboardProxy.style.cssText =
      'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;font-size:16px;pointer-events:none;border:0;padding:0';
    document.body.append(keyboardProxy);
  }
  keyboardProxy.focus({ preventScroll: true });
}

function focusScreen(el) {
  const target =
    $('#fx-input', el) ||
    $('.fx-opt[tabindex="0"]', el) ||
    $('[data-start]', el) ||
    $('#fx-title', el);
  target?.focus({ preventScroll: true });
}

/* ---------- transição entre telas ---------------------------- */

async function show(dir = 'forward') {
  const next = build();
  const prev = current;
  current = next;

  if (prev) {
    prev.dataset.dir = dir;
    prev.dataset.state = 'leave';
    await wait(OUT_MS);
    prev.remove();
  }

  next.dataset.dir = dir;
  next.dataset.state = 'enter';
  stage.append(next);
  syncChrome();
  window.scrollTo(0, 0);

  next.getBoundingClientRect(); // fixa o estado inicial antes de animar
  requestAnimationFrame(() => { next.dataset.state = 'in'; });

  if (!state.done && state.step >= 0) status.textContent = `Pergunta ${state.step + 1} de ${TOTAL}`;
  focusScreen(next);
}

async function go(step, dir) {
  if (locked) return;
  locked = true;
  state.step = step;
  save();
  await show(dir);
  locked = false;
}

/* ---------- respostas ---------------------------------------- */

function showError(msg) {
  const err = $('#fx-error', current);
  if (!err) return;
  err.querySelector('span').textContent = msg;
  err.hidden = false;
  err.setAttribute('role', 'alert');
  const input = $('#fx-input', current);
  if (input) {
    input.setAttribute('aria-invalid', 'true');
    input.focus();
  } else {
    $('.fx-opt[tabindex="0"]', current)?.focus();
  }
}

function clearError() {
  const err = $('#fx-error', current);
  if (err && !err.hidden) {
    err.hidden = true;
    err.removeAttribute('role');
  }
  $('#fx-input', current)?.removeAttribute('aria-invalid');
}

function readAnswer(q) {
  if (q.kind === 'choice') return state.answers[q.id];
  const raw = $('#fx-input', current)?.value.trim() ?? '';
  return q.kind === 'phone' ? phoneDigits(raw) : raw;
}

async function next() {
  if (locked || state.done) return;

  if (state.step < 0) {
    if (!state.startedAt) state.startedAt = Date.now();
    return go(0, 'forward');
  }

  const q = QUESTIONS[state.step];
  const value = readAnswer(q);
  const err = validate(q.id, value);
  if (err) return showError(err);

  state.answers[q.id] = value;
  save();

  if (endsAfter(state.step, state.answers)) return submit();
  return go(state.step + 1, 'forward');
}

function back() {
  if (locked || state.done || state.step < 0) return;
  go(state.step - 1, 'back');
}

/* Marca a opção (sem avançar): setas do teclado. */
function check(btn) {
  const group = btn.closest('.fx-opts');
  for (const o of group.querySelectorAll('.fx-opt')) {
    const on = o === btn;
    o.setAttribute('aria-checked', String(on));
    o.tabIndex = on ? 0 : -1;
  }
  state.answers[QUESTIONS[state.step].id] = btn.dataset.value;
  save();
  clearError();
}

/* Marca e avança: clique, toque, Enter/Espaço ou a letra. O piscar
   confirma o que foi escolhido antes da tela trocar. */
async function commit(btn) {
  if (locked) return;
  check(btn);
  btn.focus({ preventScroll: true });
  locked = true;
  btn.classList.add('is-confirm');
  await wait(FLASH_MS);
  locked = false;
  next();
}

/* ---------- envio -------------------------------------------- */

function payload(kind) {
  const a = state.answers;
  const pts = score(a);
  return {
    nome: a.nome ?? '',
    whatsapp: a.whatsapp ? `+55${a.whatsapp}` : '',
    presenca: a.presenca ?? '',
    servico: labelOf('servico', a.servico),
    faturamento: labelOf('faturamento', a.faturamento),
    investimento: labelOf('investimento', a.investimento),
    prazo: labelOf('prazo', a.prazo),
    pontos: pts,
    prioridade: priority(pts),
    tela_final: kind,
    lead_quente: isHot(a),
    utm_source: utm.utm_source ?? '',
    utm_medium: utm.utm_medium ?? '',
    utm_campaign: utm.utm_campaign ?? '',
    utm_content: utm.utm_content ?? '',
    utm_term: utm.utm_term ?? '',
    origem: 'formulario-comecar',
    enviado_em: new Date().toISOString(),
  };
}

async function send(data) {
  if (!ENDPOINT) {
    /* Em produção, fingir sucesso perderia o lead em silêncio. O erro
       leva à tela com o link do WhatsApp já preenchido. */
    if (import.meta.env.PROD) throw new Error('VITE_FORM_ENDPOINT ausente na build');
    console.info('[syaco] VITE_FORM_ENDPOINT vazio — modo demo, nada foi enviado.', data);
    await wait(500);
    return;
  }

  const ctrl = new AbortController();
  // Apps Script parado demora para acordar, e o aviso sai antes da resposta.
  const timer = setTimeout(() => ctrl.abort(), 30000);
  try {
    const res = await fetch(ENDPOINT, { ...buildRequest(ENDPOINT, data, FORM_KEY), signal: ctrl.signal });
    await assertDelivered(ENDPOINT, res);
  } finally {
    clearTimeout(timer);
  }
}

function setBusy(on) {
  nextBtn.disabled = on;
  backBtn.disabled = on;
  nextBtn.toggleAttribute('aria-busy', on);
  nextLabel.textContent = on ? 'Enviando…' : state.step === TOTAL - 1 ? 'Enviar' : 'OK';
  for (const o of current.querySelectorAll('.fx-opt, .fx-input, .fx-chip')) o.disabled = on;
}

function whatsappFallback() {
  const a = state.answers;
  const lines = [
    'Olá! Tentei enviar o formulário do site, mas não foi. Minhas respostas:',
    `Nome: ${a.nome ?? ''}`,
    `Empresa: ${a.presenca ?? ''}`,
    a.servico && `Procuro: ${labelOf('servico', a.servico)}`,
    a.faturamento && `Faturamento: ${labelOf('faturamento', a.faturamento)}`,
    a.investimento && `Investimento: ${labelOf('investimento', a.investimento)}`,
    a.prazo && `Quero começar: ${labelOf('prazo', a.prazo)}`,
  ].filter(Boolean);
  return `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(lines.join('\n'))}`;
}

function showSendError() {
  current.querySelector('.fx-send-error')?.remove();
  const box = document.createElement('div');
  box.className = 'fx-send-error';
  box.setAttribute('role', 'alert');
  box.innerHTML = `
    <p>${ICON.alert}<span>Não conseguimos enviar agora. Confira a sua conexão e tente de novo, ou mande as respostas pelo WhatsApp.</span></p>
    <div class="fx-send-error__actions">
      <a class="btn btn--ghost" href="${whatsappFallback()}" target="_blank" rel="noopener">Enviar pelo WhatsApp ${ICON.out}</a>
    </div>`;
  current.append(box);
  // Uma ação primária por tela: o próprio botão da barra vira o "tentar de novo".
  nextLabel.textContent = 'Tentar de novo';
  nextBtn.focus();
}

async function submit() {
  if (locked) return;
  locked = true;
  const kind = route(state.answers);
  current.querySelector('.fx-send-error')?.remove();
  setBusy(true);

  const bot = honeypot.value !== '' || Date.now() - state.startedAt < MIN_FILL_MS;

  try {
    if (bot) await wait(500); // robô vê "sucesso" e vai embora; nada sai daqui
    else await send(payload(kind));
  } catch (err) {
    console.warn('[syaco] envio do formulário falhou', err);
    setBusy(false);
    locked = false;
    showSendError();
    return;
  }

  setBusy(false);
  // Depois de enviado, só a tela final fica na sessão — as respostas saem.
  state = { step: -1, answers: {}, startedAt: 0, done: kind };
  save();
  await show('forward');
  locked = false;
}

/* ---------- eventos ------------------------------------------ */

form.addEventListener('submit', (e) => {
  e.preventDefault();
  if (!locked && !state.done) {
    const q = QUESTIONS[state.step];
    // Só prepara o teclado se a resposta atual vai passar.
    if (!q || !validate(q.id, readAnswer(q))) primeKeyboard(state.step + 1);
  }
  next();
});

backBtn.addEventListener('click', () => {
  if (!locked && !state.done && state.step > 0) primeKeyboard(state.step - 1);
  back();
});

stage.addEventListener('click', (e) => {
  const t = e.target.closest('[data-start], [data-shortcut], .fx-opt');
  if (!t || t.disabled) return;

  if (t.matches('[data-start]')) {
    if (!locked) primeKeyboard(0);
    return next();
  }
  if (t.matches('[data-shortcut]')) {
    $('#fx-input', current).value = QUESTIONS[state.step].shortcut;
    clearError();
    return next();
  }
  commit(t);
});

stage.addEventListener('input', (e) => {
  const input = e.target;
  if (input.id !== 'fx-input') return;
  clearError();
  /* Máscara só quando o cursor está no fim: editar no meio do número
     e ver o cursor pular para o final é pior que ficar sem máscara. */
  if (input.type === 'tel' && input.selectionStart === input.value.length) {
    input.value = formatPhone(input.value);
  }
});

document.addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey || locked || state.done) return;
  const q = QUESTIONS[state.step];
  const inField = e.target.matches?.('input, textarea');

  // Enter fora de um campo ou botão (ex.: título focado) também avança.
  if (e.key === 'Enter' && !inField && !e.target.closest?.('button, a')) {
    e.preventDefault();
    next();
    return;
  }

  if (!q || q.kind !== 'choice') return;
  const opts = [...current.querySelectorAll('.fx-opt')];

  const letter = LETTERS.indexOf(e.key.toUpperCase());
  if (e.key.length === 1 && letter > -1 && letter < opts.length && !inField) {
    e.preventDefault();
    commit(opts[letter]);
    return;
  }

  // Setas: padrão de radiogroup — move o foco e marca, sem avançar.
  const step = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
  if (step && e.target.classList?.contains('fx-opt')) {
    e.preventDefault();
    const i = (opts.indexOf(e.target) + step + opts.length) % opts.length;
    check(opts[i]);
    opts[i].focus();
  }
});

/* Teclado virtual: a barra de ações fica fixa no rodapé e subiria
   para trás do teclado no iOS. visualViewport diz quanto ele ocupa. */
if (window.visualViewport) {
  const vv = window.visualViewport;
  const onVV = () => {
    const kb = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
    document.documentElement.style.setProperty('--kb', `${Math.round(kb)}px`);
  };
  vv.addEventListener('resize', onVV);
  vv.addEventListener('scroll', onVV);
}

show();
