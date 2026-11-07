import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

/* Roda o leads.gs de verdade contra um Google de mentira. */

const CODE = readFileSync(new URL('./leads.gs', import.meta.url), 'utf8');

const chain = (extra = {}) =>
  new Proxy(extra, {
    get: (t, k) => (k in t ? t[k] : () => chain(t)),
  });

function google({ props = {}, fetchResult = { code: 200, body: 'Message queued' }, fetchThrows, mailThrows } = {}) {
  const log = { rows: [], links: {}, values: {}, fetches: [], mails: [] };
  const cache = new Map();
  const sheet = {
    appendRow: (r) => log.rows.push(r),
    getLastRow: () => log.rows.length + 1,
    getRange: (row, col) => ({
      setRichTextValue: (v) => { log.links[`${row}:${col}`] = v; },
      setValue: (v) => { log.values[`${row}:${col}`] = v; },
    }),
  };
  const ss = { getSheetByName: () => sheet, getUrl: () => 'https://sheet.test' };
  const properties = { SHEET_ID: 'id', ...props };
  const ctx = {
    console: { error() {}, log() {} },
    ContentService: {
      MimeType: { JSON: 'json' },
      createTextOutput: (s) => ({ setMimeType: () => JSON.parse(s) }),
    },
    SpreadsheetApp: {
      openById: () => ss,
      flush() {},
      newTextStyle: () => chain({ build: () => ({}) }),
      newRichTextValue: () => {
        const b = {
          setText: () => b,
          setTextStyle: () => b,
          setLinkUrl: (url) => { b.url = url; return b; },
          build: () => b.url,
        };
        return b;
      },
    },
    PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => properties[k] ?? null }) },
    CacheService: {
      getScriptCache: () => ({
        get: (k) => cache.get(k) ?? null,
        put: (k, v) => cache.set(k, v),
      }),
    },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    UrlFetchApp: {
      fetch: (url) => {
        if (fetchThrows) throw new Error('rede');
        log.fetches.push(url);
        return { getResponseCode: () => fetchResult.code, getContentText: () => fetchResult.body };
      },
    },
    MailApp: {
      sendEmail: (...a) => {
        if (mailThrows) throw new Error('cota');
        log.mails.push(a);
      },
    },
    Session: { getEffectiveUser: () => ({ getEmail: () => 'dono@test' }) },
  };
  vm.createContext(ctx);
  vm.runInContext(CODE, ctx);
  const post = (d) => ctx.doPost({ postData: { contents: JSON.stringify(d) } });
  const raw = (contents) => ctx.doPost({ postData: { contents } });
  return { post, raw, log };
}

const CONFIG = { CALLMEBOT_PHONE: '+5513996625980', CALLMEBOT_APIKEY: 'k3y' };
const AVISO = '2:14';
const BOTAO = '2:5';
const lead = {
  nome: 'Ana',
  whatsapp: '+5513996625980',
  presenca: '@ana',
  servico: 'Social media e tráfego pago',
  faturamento: 'R$ 10 a 30 mil',
  investimento: 'Cabe tranquilo',
  prazo: 'Este mês',
  pontos: 8,
  prioridade: 'responder primeiro',
  tela_final: 'match',
};

let g;
beforeEach(() => { g = google({ props: CONFIG }); });

test('grava o lead com status inicial e telefone legível', () => {
  assert.equal(g.post(lead).ok, true);
  const row = g.log.rows[0];
  assert.equal(row[1], 'Ana');
  assert.equal(row[2], '(13) 99662-5980');
  assert.equal(row[3], 'Aguardando contato');
  assert.equal(row[6], 'Deu match');
});

test('o botão abre o WhatsApp do lead com a mensagem da tela final', () => {
  g.post(lead);
  const url = new URL(g.log.links[BOTAO]);
  assert.equal(url.origin + url.pathname, 'https://wa.me/5513996625980');
  assert.match(url.searchParams.get('text'), /^Oi, Ana! .*marcar uma conversa/);

  const outro = google({ props: CONFIG });
  outro.post({ ...lead, tela_final: 'nao-agora' });
  assert.match(new URL(outro.log.links[BOTAO]).searchParams.get('text'), /Obrigada por responder/);
});

test('avisa a SYACO com o nome do lead, sem o telefone dele', () => {
  g.post({ ...lead, whatsapp: '+5511988887777' });
  const url = new URL(g.log.fetches[0]);
  assert.equal(url.searchParams.get('phone'), '+5513996625980');
  assert.equal(url.searchParams.get('apikey'), 'k3y');
  assert.match(url.searchParams.get('text'), /\*Ana\* acabou de preencher o formulário/);
  assert.doesNotMatch(url.searchParams.get('text'), /988887777/);
  assert.equal(g.log.values[AVISO], 'WhatsApp enviado');
  assert.equal(g.log.mails.length, 0);
});

test('aviso que falha não perde o lead e cai no e-mail', () => {
  for (const opts of [
    { fetchThrows: true },
    { fetchResult: { code: 500, body: '' } },
    { fetchResult: { code: 200, body: 'Your account is paused' } },
    {},
  ]) {
    const t = google(opts.fetchThrows || opts.fetchResult ? { props: CONFIG, ...opts } : {});
    assert.equal(t.post(lead).ok, true);
    assert.equal(t.log.rows.length, 1);
    assert.equal(t.log.mails.length, 1);
    assert.equal(t.log.values[AVISO], 'Só por e-mail');
  }
});

test('sem WhatsApp e sem e-mail, a planilha mostra que o aviso falhou', () => {
  const t = google({ fetchThrows: true, mailThrows: true, props: CONFIG });
  assert.equal(t.post(lead).ok, true);
  assert.equal(t.log.values[AVISO], 'Aviso falhou');
});

test('reenvio do mesmo número não duplica linha nem aviso', () => {
  g.post(lead);
  assert.equal(g.post(lead).ok, true);
  assert.equal(g.log.rows.length, 1);
  assert.equal(g.log.fetches.length, 1);
});

test('texto do lead nunca vira fórmula na planilha', () => {
  g.post({ ...lead, nome: '=IMPORTXML("http://x","//a")', presenca: '@ana', servico: '+1', prazo: '-1' });
  const row = g.log.rows[0];
  assert.equal(row[1][0], "'");
  assert.equal(row[7], "'@ana");
  assert.equal(row[8], "'+1");
  assert.equal(row[11], "'-1");
});

test('recusa corpo inválido sem gravar nada', () => {
  for (const d of [{ ...lead, nome: '' }, { ...lead, whatsapp: '123' }, {}]) {
    assert.equal(g.post(d).ok, false);
  }
  assert.equal(g.log.rows.length, 0);
});

test('JSON quebrado e planilha não configurada respondem ok: false', () => {
  assert.equal(google({ props: { SHEET_ID: null } }).post(lead).ok, false);
  assert.equal(g.raw('{quebrado').ok, false);
});

test('tela_final desconhecida vira "Talvez"', () => {
  g.post({ ...lead, tela_final: 'constructor' });
  assert.equal(g.log.rows[0][6], 'Talvez');
});
