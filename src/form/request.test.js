import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildRequest, assertDelivered } from './request.js';

const SCRIPT = 'https://script.google.com/macros/s/abc/exec';
const OTHER = 'https://seu-n8n/webhook/syaco-lead';
const reply = (body, status = 200) => new Response(JSON.stringify(body), { status });

test('Apps Script recebe text/plain para evitar o preflight; os outros, JSON', () => {
  assert.match(buildRequest(SCRIPT, {}).headers['Content-Type'], /^text\/plain/);
  assert.equal(buildRequest(OTHER, {}).headers['Content-Type'], 'application/json');
});

test('a chave só entra no corpo quando existe', () => {
  assert.deepEqual(JSON.parse(buildRequest(OTHER, { a: 1 }, 'k').body), { access_key: 'k', a: 1 });
  assert.deepEqual(JSON.parse(buildRequest(OTHER, { a: 1 }).body), { a: 1 });
});

test('HTTP 200 do Apps Script só vale com ok: true no corpo', async () => {
  await assertDelivered(SCRIPT, reply({ ok: true }));
  await assert.rejects(assertDelivered(SCRIPT, reply({ ok: false, erro: 'falha-interna' })), /falha-interna/);
  await assert.rejects(assertDelivered(SCRIPT, new Response('<html>erro</html>')));
});

test('nos outros endpoints basta o status HTTP', async () => {
  await assertDelivered(OTHER, new Response('tudo certo'));
  await assert.rejects(assertDelivered(OTHER, reply({}, 500)), /HTTP 500/);
});
