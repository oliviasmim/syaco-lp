export const $  = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
export const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;

/* smootherstep com pivô: a tinta troca rápido no meio da transição
   de tema enquanto o fundo interpola devagar. */
export function sharpen(t, k = 3.2) {
  const x = clamp((t - 0.5) * k + 0.5);
  return x * x * (3 - 2 * x);
}
