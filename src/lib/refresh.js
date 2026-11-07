import ScrollTrigger from 'gsap/ScrollTrigger';

/* ScrollTrigger.refresh() força um layout do documento inteiro e
   recalcula start/end de todos os triggers (aqui são ~25, dois deles
   com pin). Num celular modesto isso custa caro.

   A página tem três motivos legítimos para pedir refresh quase ao
   mesmo tempo — fonte carregada, load, cena 3D pronta — e chamar três
   vezes seguidas triplicava o custo à toa: medido no Lighthouse
   mobile, 4.9s de total blocking time, quase todo atribuído ao GSAP
   e ao bundle principal. Coalescendo num só, o trabalho acontece uma
   vez, fora do caminho crítico. */

let pending = 0;

export function scheduleRefresh(delay = 180) {
  clearTimeout(pending);
  pending = setTimeout(() => {
    ScrollTrigger.refresh();
  }, delay);
}

export function refreshNow() {
  clearTimeout(pending);
  ScrollTrigger.refresh();
}
