import { QUESTIONS } from './questions.js';

/* ============================================================
   Regras de qualificação. Funções puras, sem DOM — testadas em
   qualify.test.js (npm test).

   Tela final:
     1. 'nao-agora' — faturamento até R$ 5 mil (ou sem faturar) ou
        investimento "Ainda não cabe". Vale primeiro e encerra o
        formulário na hora.
     2. 'talvez'    — investimento "preciso me organizar" ou prazo
        "só pesquisando".
     3. 'match'     — todo o resto.

   A soma de pontos NÃO decide a tela. Só ordena a fila de resposta.
   ============================================================ */

const byId = Object.fromEntries(QUESTIONS.map((q) => [q.id, q]));

function chosenOptions(answers) {
  return QUESTIONS.filter((q) => q.kind === 'choice' && answers[q.id] != null)
    .map((q) => q.options.find((o) => o.value === answers[q.id]))
    .filter(Boolean);
}

export function route(answers) {
  const opts = chosenOptions(answers);
  if (opts.some((o) => o.route === 'nao-agora')) return 'nao-agora';
  if (opts.some((o) => o.route === 'talvez')) return 'talvez';
  return 'match';
}

export function score(answers) {
  return chosenOptions(answers).reduce((sum, o) => sum + (o.points ?? 0), 0);
}

export function priority(points) {
  if (points >= 7) return 'responder primeiro';
  if (points >= 4) return 'responder no mesmo dia útil';
  return 'responder depois, com calma';
}

/* Lead quente: 7+ pontos e fora do "Não agora". É o gatilho do
   aviso no WhatsApp/e-mail — o webhook só precisa olhar este campo. */
export function isHot(answers) {
  return score(answers) >= 7 && route(answers) !== 'nao-agora';
}

/* Depois de responder a pergunta `index`: o formulário acaba aqui? */
export function endsAfter(index, answers) {
  return route(answers) === 'nao-agora' || index >= QUESTIONS.length - 1;
}

/* ---------- WhatsApp ---------------------------------------- */

/* Só dígitos, sem o 55 do país se a pessoa colou "+55 13 9…". */
export function phoneDigits(raw) {
  let d = String(raw ?? '').replace(/\D/g, '');
  if (d.length > 11 && d.startsWith('55')) d = d.slice(2);
  return d.slice(0, 11);
}

export function formatPhone(raw) {
  const d = phoneDigits(raw);
  if (d.length <= 2) return d.length ? `(${d}` : '';
  const ddd = d.slice(0, 2);
  const rest = d.slice(2);
  const cut = rest.length > 8 ? 5 : 4;
  if (rest.length <= cut) return `(${ddd}) ${rest}`;
  return `(${ddd}) ${rest.slice(0, cut)}-${rest.slice(cut)}`;
}

/* DDD 11–99; celular com 9 dígitos começa em 9; fixo tem 8. */
export function isValidPhone(raw) {
  const d = phoneDigits(raw);
  if (!/^[1-9][1-9]/.test(d)) return false;
  if (d.length === 11) return d[2] === '9';
  return d.length === 10;
}

/* ---------- Validação por pergunta --------------------------- */

export function validate(id, value) {
  const q = byId[id];
  const v = String(value ?? '').trim();
  if (q.kind === 'choice') return v ? null : 'Escolha uma das opções para continuar.';
  if (!v) return q.errors.empty;
  if (q.kind === 'phone' && !isValidPhone(v)) return q.errors.invalid;
  if (v.length < 2) return q.errors.empty;
  return null;
}

export function labelOf(id, value) {
  const q = byId[id];
  if (q?.kind !== 'choice') return value ?? '';
  return q.options.find((o) => o.value === value)?.label ?? '';
}
