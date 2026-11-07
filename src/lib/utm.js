/* ============================================================
   Origem do lead. Os UTM chegam na URL de quem clicou no anúncio
   ou no link da bio, mas a pessoa navega pela landing antes de ir
   ao formulário — e aí a URL já não tem mais nada. Por isso a
   primeira visita grava os UTM na sessão e o formulário lê de lá.
   ============================================================ */

const KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];
const STORE = 'syaco-utm';

function fromUrl() {
  const params = new URLSearchParams(location.search);
  const out = {};
  for (const k of KEYS) {
    const v = params.get(k);
    if (v) out[k] = v.slice(0, 200);
  }
  return out;
}

function stored() {
  try { return JSON.parse(sessionStorage.getItem(STORE)) || {}; } catch { return {}; }
}

/* UTM novos na URL substituem os da sessão: o último clique é o
   que trouxe a pessoa de volta. */
export function captureUtm() {
  const now = fromUrl();
  if (!Object.keys(now).length) return stored();
  try { sessionStorage.setItem(STORE, JSON.stringify(now)); } catch { /* modo privado */ }
  return now;
}

export function utmQuery() {
  const utm = stored();
  return Object.keys(utm).length ? `?${new URLSearchParams(utm)}` : '';
}
