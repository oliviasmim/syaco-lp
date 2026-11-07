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

function google({ planilha = true, mailThrows } = {}) {
  const log = { rows: [], links: {}, values: {}, mails: [] };
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
  const ctx = {
    console: { error() {}, log() {} },
    ContentService: {
      MimeType: { JSON: 'json' },
      createTextOutput: (s) => ({ setMimeType: () => JSON.parse(s) }),
    },
    SpreadsheetApp: {
      getActiveSpreadsheet: () => (planilha ? ss : null),
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
    CacheService: {
      getScriptCache: () => ({
        get: (k) => cache.get(k) ?? null,
        put: (k, v) => cache.set(k, v),
      }),
    },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    MailApp: {
      sendEmail: (...a) => {
        if (mailThrows) throw new Error('cota');
        log.mails.push(a);
      },
    },
  };
  vm.createContext(ctx);
  vm.runInContext(CODE, ctx);
  const post = (d) => ctx.doPost({ postData: { contents: JSON.stringify(d) } });
  const raw = (contents) => ctx.doPost({ postData: { contents } });
  return { post, raw, log };
}

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
beforeEach(() => { g = google(); });

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

  const outro = google();
  outro.post({ ...lead, tela_final: 'nao-agora' });
  assert.match(new URL(outro.log.links[BOTAO]).searchParams.get('text'), /Obrigada por responder/);
});

test('avisa a SYACO por e-mail com o nome do lead', () => {
  g.post(lead);
  const [para, assunto, texto] = g.log.mails[0];
  assert.equal(para, 'syacocompany@gmail.com');
  assert.equal(assunto, 'Novo lead: Ana');
  assert.match(texto, /Ana acabou de preencher o formulário/);
  assert.equal(g.log.values[AVISO], 'E-mail enviado');
});

test('e-mail que falha não perde o lead e a planilha mostra a falha', () => {
  const t = google({ mailThrows: true });
  assert.equal(t.post(lead).ok, true);
  assert.equal(t.log.rows.length, 1);
  assert.equal(t.log.values[AVISO], 'Aviso falhou');
});

test('reenvio do mesmo número não duplica linha nem aviso', () => {
  g.post(lead);
  assert.equal(g.post(lead).ok, true);
  assert.equal(g.log.rows.length, 1);
  assert.equal(g.log.mails.length, 1);
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
  assert.equal(google({ planilha: false }).post(lead).ok, false);
  assert.equal(g.raw('{quebrado').ok, false);
});

test('tela_final desconhecida vira "Talvez"', () => {
  g.post({ ...lead, tela_final: 'constructor' });
  assert.equal(g.log.rows[0][6], 'Talvez');
});

test('o script só alcança esta planilha e o envio de e-mail', () => {
  const manifesto = JSON.parse(readFileSync(new URL('./appsscript.json', import.meta.url), 'utf8'));
  assert.deepEqual(manifesto.oauthScopes.map((e) => e.split('/').pop()).sort(), [
    'script.send_mail',
    'spreadsheets.currentonly',
  ]);
  assert.equal(manifesto.urlFetchWhitelist, undefined);
  assert.doesNotMatch(CODE, /openById|Session\.|UrlFetchApp/);
});
