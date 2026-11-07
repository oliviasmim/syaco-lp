/* ============================================================
   Como o lead chega ao endpoint. O Apps Script tem duas exigências:
   - não responde ao preflight de CORS, então o corpo vai como
     text/plain, que o navegador envia sem preflight;
   - responde HTTP 200 mesmo quando falha, então só o { ok: true }
     do corpo confirma que o lead foi gravado.
   ============================================================ */

const isAppsScript = (endpoint) => endpoint.startsWith('https://script.google.com/');

export function buildRequest(endpoint, data, key) {
  const contentType = isAppsScript(endpoint) ? 'text/plain;charset=utf-8' : 'application/json';
  return {
    method: 'POST',
    headers: { 'Content-Type': contentType, Accept: 'application/json' },
    body: JSON.stringify(key ? { access_key: key, ...data } : data),
  };
}

export async function assertDelivered(endpoint, res) {
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  if (!isAppsScript(endpoint)) return;
  const body = await res.json();
  if (body.ok !== true) throw new Error(`Apps Script: ${body.erro ?? 'resposta inesperada'}`);
}
