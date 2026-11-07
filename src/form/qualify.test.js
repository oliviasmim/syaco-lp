import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  route, score, priority, isHot, endsAfter,
  phoneDigits, formatPhone, isValidPhone, validate,
} from './qualify.js';

const base = { nome: 'Ana', whatsapp: '13996625980', presenca: '@ana', servico: 'social' };

test('faturamento baixo encerra em "nao-agora" logo depois da pergunta 5', () => {
  for (const f of ['sem-faturamento', 'ate-5k']) {
    const a = { ...base, faturamento: f };
    assert.equal(route(a), 'nao-agora');
    assert.equal(endsAfter(4, a), true);
  }
});

test('"Ainda não cabe" encerra em "nao-agora" mesmo com faturamento alto', () => {
  const a = { ...base, faturamento: '100k-mais', investimento: 'nao-cabe' };
  assert.equal(route(a), 'nao-agora');
  assert.equal(endsAfter(5, a), true);
});

test('"nao-agora" vence "talvez"', () => {
  assert.equal(route({ ...base, faturamento: 'ate-5k', prazo: 'pesquisando' }), 'nao-agora');
});

test('"talvez": preciso me organizar, ou só pesquisando', () => {
  assert.equal(route({ ...base, faturamento: '10-30k', investimento: 'organizar', prazo: 'este-mes' }), 'talvez');
  assert.equal(route({ ...base, faturamento: '10-30k', investimento: 'cabe', prazo: 'pesquisando' }), 'talvez');
});

test('"match" no resto', () => {
  assert.equal(route({ ...base, faturamento: '5-10k', investimento: 'cabe', prazo: '2-3-meses' }), 'match');
});

test('formulário não acaba antes da última pergunta sem "nao-agora"', () => {
  const a = { ...base, faturamento: '10-30k', investimento: 'organizar' };
  assert.equal(endsAfter(5, a), false);
  assert.equal(endsAfter(6, { ...a, prazo: 'este-mes' }), true);
});

test('pontos e prioridade', () => {
  const max = { ...base, faturamento: '30-100k', investimento: 'cabe', prazo: 'este-mes' };
  assert.equal(score(max), 9);
  assert.equal(priority(9), 'responder primeiro');
  assert.equal(isHot(max), true);

  const mid = { ...base, faturamento: '5-10k', investimento: 'organizar', prazo: '2-3-meses' };
  assert.equal(score(mid), 4);
  assert.equal(priority(4), 'responder no mesmo dia útil');
  assert.equal(isHot(mid), false);

  assert.equal(priority(3), 'responder depois, com calma');
  assert.equal(score(base), 0);
});

test('7+ pontos em "nao-agora" não dispara aviso', () => {
  // impossível pelas regras atuais (nao-agora zera faturamento ou
  // investimento), mas o aviso não pode depender disso
  assert.equal(isHot({ ...base, faturamento: '100k-mais', investimento: 'nao-cabe', prazo: 'este-mes' }), false);
});

test('WhatsApp: normaliza, formata e valida', () => {
  assert.equal(phoneDigits('+55 (13) 99662-5980'), '13996625980');
  assert.equal(formatPhone('13996625980'), '(13) 99662-5980');
  assert.equal(formatPhone('1332221111'), '(13) 3222-1111');
  assert.equal(formatPhone('139'), '(13) 9');
  assert.equal(isValidPhone('(13) 99662-5980'), true);
  assert.equal(isValidPhone('(13) 3222-1111'), true);
  assert.equal(isValidPhone('996625980'), false);    // sem DDD
  assert.equal(isValidPhone('13896625980'), false);  // 11 dígitos sem o 9
  assert.equal(isValidPhone('01996625980'), false);  // DDD inválido
});

test('validação por pergunta', () => {
  assert.ok(validate('nome', '  '));
  assert.equal(validate('nome', 'Ana'), null);
  assert.ok(validate('whatsapp', '1399'));
  assert.equal(validate('presenca', 'não tenho'), null);
  // O @ é opcional: o usuário do Instagram vale com ou sem ele.
  assert.equal(validate('presenca', 'syacocompany'), null);
  assert.equal(validate('presenca', '@syacocompany'), null);
  assert.ok(validate('servico', undefined));
  assert.equal(validate('servico', 'site'), null);
});
