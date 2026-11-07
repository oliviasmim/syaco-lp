import gsap from 'gsap';
import ScrollTrigger from 'gsap/ScrollTrigger';

/* O pin do hero vive aqui, e não no módulo 3D, de propósito: se
   ficasse lá, a altura do documento mudaria quando o chunk da cena
   carregasse — um salto de layout um segundo depois do paint. O pin
   existe em todos os modos; a cena só lê o progresso. */

export const heroState = { progress: 0, pinned: false, pinStart: 0, pinDuration: 0 };

export function initHero({ reduced = false } = {}) {
  const hero = document.querySelector('.hero');
  if (!hero) return;

  const mm = gsap.matchMedia();

  mm.add(
    {
      desktop: '(min-width: 1024px)',
      handheld: '(max-width: 1023px)',
    },
    (ctx) => {
      const { desktop } = ctx.conditions;

      /* Só pina se o hero couber na janela. Se a copy crescer — a
         headline B é mais longa, e o cliente ainda vai decidir qual
         usar — pinar um bloco mais alto que a viewport esconde o CTA
         principal enquanto durar o pin. Nesse caso a página
         simplesmente rola, que é o comportamento certo. */
      const fits = hero.offsetHeight <= window.innerHeight + 8;
      const pin = Boolean(desktop) && fits;
      heroState.pinned = pin;

      const st = ScrollTrigger.create({
        trigger: hero,
        start: 'top top',
        end: () => `+=${window.innerHeight * (pin ? 1.2 : 1)}`,
        // Pina a SEÇÃO, não só o .hero__shell. Pinando só o miolo, o
        // resto da página continuava subindo durante o pin e a seção
        // de números já começava a virar o fundo navy no exato momento
        // em que o ponto pousava na headline.
        pin: pin ? hero : false,
        pinSpacing: pin,
        anticipatePin: pin ? 1 : 0,
        refreshPriority: 3,
        scrub: reduced ? false : true,
        invalidateOnRefresh: true,
        onUpdate: (self) => { heroState.progress = self.progress; },
        onRefresh: (self) => {
          heroState.pinStart = self.start;
          heroState.pinDuration = self.end - self.start;
          heroState.progress = self.progress;
        },
      });

      return () => {
        heroState.pinned = false;
        heroState.pinDuration = 0;
        heroState.progress = 0;
        st.kill();
      };
    }
  );
}
