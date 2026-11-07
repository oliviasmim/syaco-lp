import { defineConfig } from 'vite';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { SERVICE_VISUALS } from './src/data/service-visuals.js';
import { PROCESS_VISUALS } from './src/data/process-visuals.js';

const DATA = resolve(process.cwd(), 'src/data');
const read = (f) => JSON.parse(readFileSync(join(DATA, f), 'utf8'));
const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );

const ARROW =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';

/* --------------------------------------------------------------
   Os dados das seções vêm de src/data/*.json e são injetados no
   HTML em tempo de build. Duas razões:
   - o conteúdo existe no HTML servido (SEO, e a página funciona
     com JavaScript desabilitado);
   - quando os cases e depoimentos reais chegarem, só o JSON muda.
   -------------------------------------------------------------- */

function renderStats(stats) {
  return stats
    .map(
      (s, i) => `
        <li class="stat reveal">
          <p class="stat__value display u-num" data-count-to="${esc(s.value)}" data-count-prefix="${esc(s.prefix)}" data-count-suffix="${esc(s.suffix)}">${esc(s.prefix)}${esc(s.value)}${esc(s.suffix)}</p>
          <p class="stat__label">${esc(s.label)}</p>
        </li>`
    )
    .join('');
}

function renderServices(items) {
  return items
    .map(
      (s) => `
        <li class="svc reveal">
          <div class="svc__stage" data-visual="${esc(s.visual)}" aria-hidden="true">
            <div class="v v--${esc(s.visual)}">${SERVICE_VISUALS[s.visual] ?? ''}</div>
          </div>
          <div class="svc__body">
            <p class="svc__n">${esc(s.n)}</p>
            <h3 class="svc__title h3 display">${esc(s.title)}</h3>
            <p class="svc__desc">${esc(s.desc)}</p>
          </div>
        </li>`
    )
    .join('');
}

function renderTeam(people) {
  const anyPhoto = people.some((p) => p.photo);
  return people
    .map((p) => {
      /* Fotos soltas de estilos diferentes ficam piores que nenhuma.
         Só entram quando TODAS existirem — senão, tipografia pura. */
      const media = anyPhoto && p.photo
        ? `<div class="member__media"><img src="${esc(p.photo)}" alt="${esc(p.name)}, ${esc(p.role)} na SYACO" width="472" height="591" loading="lazy" decoding="async"></div>`
        : `<div class="member__media member__media--type" aria-hidden="true"><span>${esc(p.name.slice(0, 1))}</span></div>`;
      return `
        <li class="member reveal">
          ${media}
          <h3 class="member__name display">${esc(p.name)}</h3>
          <p class="member__role">${esc(p.role)}</p>
        </li>`;
    })
    .join('');
}

function renderCases(cases) {
  return cases
    .map((c) => {
      const media = c.image
        ? `<div class="case__media"><img src="${esc(c.image)}" alt="Projeto da SYACO para ${esc(c.client)}" width="800" height="600" loading="lazy" decoding="async"></div>`
        : `<div class="case__media"></div>`;
      const inner = `
          ${media}
          <p class="case__metric display u-num">${esc(c.metric)}</p>
          <p class="case__metric-label">${esc(c.metricLabel)}</p>
          <p class="case__client">${esc(c.client)}<span class="case__sector">${esc(c.sector)}</span></p>`;
      return c.url
        ? `<li class="case reveal"><a class="case__link" href="${esc(c.url)}" target="_blank" rel="noopener">${inner}</a></li>`
        : `<li class="case reveal">${inner}</li>`;
    })
    .join('');
}

function renderCasesSection(cases) {
  /* Sem case real, a seção inteira não existe. Nunca um case inventado. */
  if (!cases.length) return '';
  return `
    <section class="section section--dark section--cases" id="cases" data-below aria-labelledby="cases-title">
      <div class="shell">
        <header class="section__head">
          <h2 id="cases-title" class="h2 display reveal">Resultados que falam por si</h2>
          <p class="lede reveal">Cada projeto é uma história de crescimento. Veja alguns dos negócios que já transformamos.</p>
        </header>
        <ul class="cases">${renderCases(cases)}</ul>
      </div>
    </section>`;
}

function renderProcess(steps) {
  return steps
    .map(
      (s) => `
        <li class="step reveal">
          <div class="step__stage" data-visual="${esc(s.visual)}" aria-hidden="true">
            <div class="pv">${PROCESS_VISUALS[s.visual] ?? ''}</div>
          </div>
          <div class="step__body">
            <p class="step__n">${esc(s.n)}</p>
            <h3 class="step__title h3 display">${esc(s.title)}</h3>
            <p class="step__desc">${esc(s.desc)}</p>
          </div>
        </li>`
    )
    .join('');
}

function renderTestimonials(items) {
  /* Sem depoimento real, a seção inteira não existe.
     Depoimento genérico destrói a credibilidade do resto. */
  if (!items.length) return '';
  const card = (t, feature) => `
        <figure class="quote${feature ? ' quote--feature' : ''} reveal">
          <blockquote class="quote__text${feature ? ' display' : ''}">${esc(t.quote)}</blockquote>
          <figcaption class="quote__by">
            ${t.avatar ? `<img class="quote__avatar" src="${esc(t.avatar)}" alt="" width="96" height="96" loading="lazy" decoding="async">` : ''}
            <span class="quote__name">${esc(t.name)}</span>
            <span class="quote__role">${esc([t.role, t.company].filter(Boolean).join(' · '))}</span>
          </figcaption>
        </figure>`;
  const [first, ...rest] = items;
  return `
    <section id="feedbacks" class="section section--testimonials" data-below aria-labelledby="feedbacks-title">
      <div class="shell">
        <header class="section__head">
          <p class="eyebrow reveal">07 — Feedbacks</p>
          <h2 id="feedbacks-title" class="h2 display reveal">Quem trabalha com a gente, recomenda</h2>
        </header>
        <div class="quotes">
          ${card(first, true)}
          ${rest.length ? `<div class="quotes__rest">${rest.slice(0, 2).map((t) => card(t, false)).join('')}</div>` : ''}
        </div>
      </div>
    </section>`;
}

function jsonLd(siteUrl) {
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'ProfessionalService',
    name: 'SYACO — Marketing & Tecnologia',
    description:
      'Agência full-service de marketing e tecnologia. Gestão de redes sociais, tráfego pago, sites e landing pages, branding e automação.',
    url: siteUrl,
    telephone: '+5513996625980',
    email: 'syacocompany@gmail.com',
    areaServed: { '@type': 'Country', name: 'BR' },
    address: { '@type': 'PostalAddress', addressRegion: 'SP', addressCountry: 'BR' },
    image: `${siteUrl}/og.jpg`,
    logo: `${siteUrl}/syaco-mark.svg`,
    sameAs: ['https://www.instagram.com/syacocompany'],
    priceRange: '$$',
  });
}

function syacoData() {
  let siteUrl = 'https://syaco.com.br';
  let formEndpoint = '';
  return {
    name: 'syaco-data',
    configResolved(cfg) {
      siteUrl = (cfg.env.VITE_SITE_URL || siteUrl).replace(/\/$/, '');
      formEndpoint = cfg.env.VITE_FORM_ENDPOINT || '';
    },
    configureServer(server) {
      // Editar um JSON de dados recarrega a página em dev.
      server.watcher.add(DATA);
      server.watcher.on('change', (file) => {
        if (file.startsWith(DATA)) server.ws.send({ type: 'full-reload' });
      });
    },
    writeBundle({ dir }) {
      /* Os arquivos de public/ não passam pelo bundle do Rollup: são
         copiados para dist/ e só podem ser reescritos aqui, em disco. */
      const edit = (file, fn) => {
        const path = join(dir, file);
        writeFileSync(path, fn(readFileSync(path, 'utf8')));
      };
      const withSite = (s) => s.replace(/https:\/\/syaco\.com\.br/g, siteUrl);

      edit('robots.txt', withSite);
      edit('sitemap.xml', (s) =>
        withSite(s).replace('%BUILD_DATE%', new Date().toISOString().slice(0, 10))
      );

      /* A CSP só libera o que esta build usa: os scripts inline pelo
         hash e o envio do formulário só para a origem configurada. */
      const hashes = new Set();
      for (const page of ['index.html', 'comecar/index.html']) {
        const html = readFileSync(join(dir, page), 'utf8');
        for (const [, code] of html.matchAll(/<script>([\s\S]*?)<\/script>/g)) {
          hashes.add(`'sha256-${createHash('sha256').update(code).digest('base64')}'`);
        }
      }
      let formOrigin = formEndpoint ? new URL(formEndpoint).origin : '';
      // A resposta do Apps Script vem por redirecionamento para outro domínio,
      // e a CSP também vale para o destino do redirecionamento.
      if (formOrigin === 'https://script.google.com') {
        formOrigin += ' https://script.googleusercontent.com';
      }
      edit('_headers', (s) =>
        s.replace('%CSP_SCRIPT_HASHES%', [...hashes].join(' ')).replace('%FORM_ORIGIN%', formOrigin)
      );

      if (!formEndpoint) {
        this.warn(
          'VITE_FORM_ENDPOINT vazio: nesta build o formulário não envia leads e cai no fallback do WhatsApp.'
        );
      }
    },
    transformIndexHtml: {
      order: 'pre',
      handler(html) {
        const testimonials = read('testimonials.json');
        return html
          .replace('<!--@stats-->', renderStats(read('stats.json')))
          .replace('<!--@services-->', renderServices(read('services.json')))
          .replace('<!--@team-->', renderTeam(read('team.json')))
          .replace('<!--@cases-section-->', renderCasesSection(read('cases.json')))
          .replace('<!--@process-->', renderProcess(read('process.json')))
          .replace('<!--@testimonials-section-->', renderTestimonials(testimonials))
          .replace('<!--@jsonld-->', jsonLd(siteUrl))
          .replace(/%SITE_URL%/g, siteUrl)
          .replace(/<!--@arrow-->/g, ARROW);
      },
    },
  };
}

/* Os comentários do HTML são notas de desenvolvimento: ficam no
   código-fonte, mas não vão para quem visita a página. */
const stripHtmlComments = {
  name: 'strip-html-comments',
  apply: 'build',
  transformIndexHtml: {
    order: 'post',
    handler: (html) => html.replace(/<!--[\s\S]*?-->/g, '').replace(/\n\s*\n+/g, '\n'),
  },
};

export default defineConfig({
  plugins: [syacoData(), stripHtmlComments],
  build: {
    target: 'es2020',
    // O chunk do three.js é carregado sob demanda, depois do primeiro paint.
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      // A landing, o formulário de qualificação (que não carrega three,
      // GSAP nem Lenis) e a página de erro servida pela Cloudflare.
      input: {
        main: resolve(process.cwd(), 'index.html'),
        comecar: resolve(process.cwd(), 'comecar/index.html'),
        notFound: resolve(process.cwd(), '404.html'),
      },
      output: {
        manualChunks(id) {
          // O 3D vira um chunk próprio, carregado depois do primeiro paint.
          if (id.includes('node_modules/three')) return 'three';
          if (id.includes('node_modules/gsap')) return 'gsap';
        },
      },
    },
  },
});
