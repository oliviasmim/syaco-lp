# SYACO — Landing Page

Vite (vanilla) · CSS moderno com `@layer` e custom properties · three.js · GSAP + ScrollTrigger · Lenis.
Sem React, sem Tailwind, sem build de componente.

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # → dist/
npm run preview
```

Publicação (Cloudflare e domínio): [DEPLOY.md](DEPLOY.md).

---

## O que ainda falta (e o que a página faz enquanto não chega)

Nada aqui foi inventado. Cada item abaixo está em estado de placeholder explícito.

| # | Pendência | Estado hoje | Onde entra |
|---|---|---|---|
| 1 | **Números reais de autoridade** | Usa os três do copy, sem `+` inventado em cima | `src/data/stats.json` |
| 2 | **Cases (3 a 6)** | Seção **não existe** no HTML; no lugar dela entra "Como trabalhamos" (`src/data/process.json`). Ao publicar cases, incluir o link no menu | `src/data/cases.json` |
| 3 | **Depoimentos** | Seção **não existe** no HTML | `src/data/testimonials.json` |
| 4 | ~~Fotos do time~~ | **Feito**: as quatro em `public/img/*.webp` (472×591, mesmo enquadramento) | `src/data/team.json` |
| 5 | Grafia "Iasmin" | Corrigido para **Iasmim** | — |
| 6 | **CNPJ / razão social** | Comentário reservando o lugar | `index.html`, `.footer__meta` |
| 7 | **Endpoint do formulário** | Modo demo: valida tudo, mostra a tela final, avisa no console que nada foi enviado. Instalação em "Leads: planilha e WhatsApp" | `.env` |
| 8 | **Páginas de destino dos CTAs** | Viraram âncoras internas (`#contato`) — nenhum link morto | `index.html` |
| 9 | **Headline A ou B** | A ativa, B comentada logo acima dela | `index.html`, seção Hero |
| 10 | **SVG do logo** | Vetorizado a partir do PNG (`public/syaco-mark.svg`, `public/syaco-wordmark.svg`) | — |

### Os dados são injetados no HTML em tempo de build

`vite.config.js` lê os JSON de `src/data/` e escreve o markup direto no `index.html`.
Duas consequências que importam:

- o conteúdo **existe no HTML servido** — o Google lê, e a página funciona com JavaScript desligado;
- para publicar um case ou um depoimento real, **só o JSON muda**. Nada de HTML.

```jsonc
// src/data/cases.json — array vazio = a seção some inteira.
[{ "client": "", "sector": "", "image": "/img/cliente.jpg",
   "metric": "+120%", "metricLabel": "em leads qualificados", "url": null }]

// src/data/testimonials.json — array vazio = a seção some inteira.
// Isso é de propósito: depoimento genérico destrói a credibilidade
// que o resto da página constrói.
[{ "quote": "", "name": "", "role": "", "company": "", "avatar": null }]

// src/data/team.json — as fotos só entram quando as QUATRO existirem,
// no mesmo enquadramento. Fotos soltas de estilos diferentes ficam
// piores que nenhuma.
[{ "name": "Sarah", "role": "Social Media e Estrategista", "photo": "/img/sarah.webp" }]
```

### Formulário de qualificação — `/comecar/`

Todo CTA de contato ("Falar com a gente", "Quero solicitar um orçamento") leva para
`/comecar/`: uma pergunta por tela, 7 perguntas, três telas finais. Página própria,
sem three/GSAP/Lenis — abre rápido no celular e pode ser o destino direto de anúncio.

| Arquivo | O que tem |
|---|---|
| `src/form/questions.js` | Toda a copy, as opções e os pontos. Mudou texto ou valor: só aqui. |
| `src/form/qualify.js` | Regras puras: tela final, soma de pontos, prioridade, validação do WhatsApp. |
| `src/form/qualify.test.js` | Testes das regras — `npm test`. |
| `src/form/main.js` | Fluxo de telas, teclado, rascunho na sessão e envio. |
| `src/styles/form.css` | Estilo, só com tokens. |

**Roteamento** (`qualify.js`): faturamento até R$ 5 mil ou "Ainda não cabe" → **Não agora**,
e o formulário acaba ali mesmo; "preciso me organizar" ou "só pesquisando" → **Talvez**;
o resto → **Deu match**. Os pontos (0–9) só ordenam a fila, não decidem a tela.

**UTM**: a landing grava `utm_*` na sessão na primeira visita e repassa para os links do
formulário. Quem chega direto em `/comecar/?utm_…` também é registrado.

**Robôs**: campo honeypot oculto + tempo mínimo de 4 s. Robô vê a tela de sucesso e nada é enviado.

```bash
cp .env.example .env
```

`VITE_FORM_ENDPOINT` aceita o Apps Script da planilha (ver "Leads: planilha e WhatsApp"
abaixo) ou qualquer endpoint que receba `POST` com JSON (n8n, Formspree e Web3Forms — este
último usa `VITE_FORM_KEY`).
Corpo enviado:

```json
{ "nome": "Ana", "whatsapp": "+5513996625980", "presenca": "@ana",
  "servico": "Social media e tráfego pago", "faturamento": "R$ 10 a 30 mil",
  "investimento": "Cabe tranquilo", "prazo": "Este mês",
  "pontos": 8, "prioridade": "responder primeiro", "tela_final": "match",
  "lead_quente": true,
  "utm_source": "instagram", "utm_medium": "bio", "utm_campaign": "", "utm_content": "", "utm_term": "",
  "origem": "formulario-comecar", "enviado_em": "2026-10-30T12:00:00.000Z" }
```

`lead_quente` = 7+ pontos e fora do "Não agora". Quem sai em "Não agora" na pergunta 5 chega com `investimento`
e `prazo` vazios.

Sem a variável, em desenvolvimento o formulário entra em **modo demo**: valida tudo, mostra a
tela final e registra no console o que teria sido enviado. Em produção, ele mostra o erro com o
link do WhatsApp, para o lead nunca se perder em silêncio. Falha de rede mostra mensagem, link do
WhatsApp já com as respostas e o botão da barra vira "Tentar de novo".

### Leads: planilha e WhatsApp

`apps-script/leads.gs` recebe o formulário, grava a linha na planilha e avisa a SYACO.
Cada lead tem um **Status** e o link **Enviar mensagem**, que abre o WhatsApp de quem
clicou com a mensagem pronta para o lead (os textos ficam em `MENSAGENS`, no topo do script).

Instalação:

1. Crie uma planilha no Google com a conta da SYACO e abra **Extensões → Apps Script**.
2. Cole o conteúdo de `apps-script/leads.gs` e salve.
3. Escolha a função `configurar` e clique em **Executar**. Autorize com a conta da SYACO.
4. Em **Implantar → Nova implantação → App da Web**, use "Executar como: **eu**" e
   "Quem pode acessar: **qualquer pessoa**". Copie a URL que termina em `/exec`.
5. Coloque a URL em `VITE_FORM_ENDPOINT` no `.env` e na hospedagem, e publique o site de novo.

Aviso no WhatsApp da SYACO, pelo [CallMeBot](https://www.callmebot.com/blog/free-api-whatsapp-messages/):

1. Siga a ativação da página acima no WhatsApp da SYACO para receber a chave.
   Se a página disser que o bot está cheio, o número dele fica oculto: tente de novo depois.
2. Em **Configurações do projeto → Propriedades do script**, crie `CALLMEBOT_PHONE`
   (ex. `+5513996625980`) e `CALLMEBOT_APIKEY`.
3. Rode a função `testarAviso` no editor.

Enquanto o CallMeBot não estiver ativo, ou se ele falhar, o aviso vai por e-mail para a conta
dona do script. A coluna **Aviso** mostra por onde cada um saiu. O CallMeBot é gratuito, não
oficial e se declara para uso pessoal; o texto dele leva o nome do lead, nunca o telefone.

Ao mudar o script, publique em **Implantar → Gerenciar implantações → Editar → Nova versão**.
A URL continua a mesma, e sem esse passo o site segue usando a versão anterior.

---

## Cores — leia antes de mexer

`src/styles/tokens.css` é a **única** fonte de cor da página. Nenhum hex fora dele.

O **Red Inferno** (`#4E0000`) tem praticamente a mesma luminância do **Mystic Navy**:
o contraste entre os dois é **1.05:1**. Ele é inutilizável sobre navy. Por isso:

- Red Inferno é cor de **seção clara** — CTA primário, links, numeração (13.7:1 sobre o creme);
- nas seções navy o CTA **inverte**: creme sólido com texto navy (10.5:1);
- para detalhe aceso sobre navy existe `--ember` (`#E4572E`), uma **derivação declarada**,
  não uma cor da marca: 4.1:1 sobre navy, o que serve para UI e texto grande, nunca para corpo.

Todos esses números foram medidos, não estimados. Os pares em uso:

| par | medido | mínimo |
|---|---|---|
| corpo sobre claro | 13.0:1 | 4.5 |
| secundário sobre claro | 6.1:1 | 4.5 |
| corpo sobre navy | 13.0:1 | 4.5 |
| secundário sobre navy | 7.3:1 | 4.5 |
| acento sobre claro | 13.7:1 | 4.5 |
| ember sobre navy (UI/texto grande) | 4.1:1 | 3.0 |
| texto do CTA invertido | 10.5:1 | 4.5 |

**Uma ressalva honesta sobre a transição creme↔navy.** O fundo é um `<div>` fixo cuja cor
é interpolada em OkLab por scrub — é isso que faz o corte não piscar. No meio do caminho
existe um tom onde nenhuma das duas tintas chega a 4.5:1; o melhor ponto possível é
d≈0.54, onde as duas empatam em ~3.6:1. O código troca a tinta exatamente ali, mantém a
faixa de transição curta (~26vh de scroll) e usa histerese para não oscilar se você parar
em cima da borda. Nos estados parados — que é onde alguém lê — são 13:1 dos dois lados.
Com `prefers-reduced-motion` a troca é seca e esse meio-termo nem existe.

---

## A cena 3D

O logo é `S.` — um "S" com um **ponto**. A página inteira é a jornada desse ponto.

### O logo em duas peças

Não existe esfera aqui, e isso é uma decisão. Uma esfera é a única forma que é igual de
todo ângulo: girar não comunica nada, o parallax não comunica nada, e o material vira brilho
de bola de bilhar. Ela também não era a marca — era um objeto de starter kit de three.js.

O `syaco-mark.svg` é um traçado único, com o `S` e o ponto fundidos. Para a cena, as duas
peças foram separadas:

- **`mark`** — o `S` extrudado de `public/syaco-s.svg`: o traçado original, sem o ponto e com
  o bojo fechado por uma curva que fica escondida atrás dele (`SVGLoader` + `ExtrudeGeometry`);
- **`disc`** — o ponto: um disco biselado que, de frente, **é** um círculo chapado.

`MARK_DOT` em `src/scene/dot.js` guarda onde o ponto encaixa no `S`. Encaixados, os dois são
o logo inteiro. O disco tem uma mistura `free`: em 0 ele segue o encaixe; em 1 segue o próprio
alvo. Trocar de um para o outro nunca dá salto.

Se o SVG do `S` não carregar, o ponto faz o caminho inteiro sozinho.

### O hero: o ponto se solta

Três movimentos que se sobrepõem, para o scroll sempre ter resposta: o `S.` gira desde o
primeiro pixel, o ponto se solta e viaja até a headline, e o `S` gira até virar lâmina e some.

| | Desktop | Mobile e tablet |
|---|---|---|
| **Onde o `S.` mora** | no respiro à direita da headline | à direita de "Da", na mesma linha de base (a única faixa livre em todos os tamanhos) |
| **Tamanho** | 30% da altura da tela | até 78% da faixa livre, 30% da largura ou 200px, o que for menor |
| **O que dirige** | o pin de 1.2 tela | os pixels até o pouso: 75% da distância entre a headline e a nav, sem pin |
| **Extra** | o `S.` inclina com o ponteiro; o ponto passa por baixo do `S` | — |

**Sem pin, o pouso tem que acabar antes de "resultado" passar por baixo da nav.** A versão
anterior usava o progresso de 1 tela inteira: o ato trocava aos 50% e a viagem só começava aos
56%, então no mobile o ponto nunca pousava.

**O lerp não cuida do scroll.** O scroll é somado direto à posição atual e o lerp só resolve a
mudança de alvo. É isso que mantém o `S.` colado no texto numa rolagem rápida no celular.

### Os atos

| Ato | Seção | O que acontece |
|---|---|---|
| 0 | abertura | o `S` entra girando e o ponto encaixa por último |
| 1 | hero | o ponto se solta e **pousa como ponto final da headline** |
| 2 | números | o ponto salta de métrica em métrica, acima do algarismo |
| 3 | quem somos | **pousa como ponto final de "Somos a SYACO."** |
| 4 | serviços | vira o indicador de progresso e corre no trilho |
| 5 | equipe e como trabalhamos | **sai de cena** — o canvas vai a `opacity: 0` |
| 6 | cases | volta no quadrante vazio da seção |
| 7 | feedbacks | sem ponto |
| 8 | CTA | pousa na faixa vazia entre o card e o rodapé, com o tamanho que cabe nela |
| 9 | rodapé | o logo se remonta na assinatura, antes do wordmark entrar |

O canvas fica **atrás** do conteúdo. No CTA, o disco encostado no card aparecia cortado, como
uma meia-lua; por isso o tamanho dele vem da faixa livre.

O `.` de verdade das frases só some no ato em que o ponto 3D está pousado nele. Quando o ponto
segue viagem, a frase recupera o próprio.

**Convenção de escala:** as geometrias são normalizadas para **altura 1**. `mark.scale` é a
altura do logo inteiro; `disc.scale` é o diâmetro.

### O momento assinatura

`<i class="dot-anchor">` é um inline-block de tamanho zero alinhado à baseline, colocado
imediatamente **antes** do `.`. Assim `rect.top` é exatamente a baseline e `rect.left` é a
borda esquerda do glifo. O diâmetro e o centro da tinta saem do `measureText` do canvas 2D,
na mesma fonte e tamanho — mais uma correção óptica de 1.14, porque o ponto final do Archivo
é um **quadrado** e um círculo da mesma largura parece menor (área 0.785 contra 1).

O `ScrollTrigger.refresh()` roda em `document.fonts.ready` e no `load`, coalescido. **Sem
isso o ponto pousa no lugar errado** quando a fonte chega depois.

Um bloco pinado tem três fases e as três importam: antes do pin o conteúdo rola; durante,
congela; **depois, volta a rolar deslocado da duração inteira do pin**. A terceira faltava na
primeira versão — a frase subia e o ponto ficava boiando no meio da tela até o ato seguinte
assumir.

### Material: tinta, não verniz

`roughness: 0.55`, `clearcoat: 0.16`. Duas coisas testadas e descartadas por medição de pixel:

- **sheen creme a 0.45** — o lobo retrorreflexivo espalhava calor pela superfície inteira e o
  Mystic Navy saía em `(45,51,62)`: cinza-ardósia, não a cor da marca. Sem sheen, sai em
  `(24,37,56)` contra o alvo `(19,39,63)`.
- **hemisfério com chão marrom** (`#6B5A48`) — mesmo problema, tirava azul por baixo. Virou
  `#3C4A5E`.

O ambiente é alto de propósito (2.9): o Mystic Navy tem L\* 17, então sem isso ele lê como
carvão. A contraluz fria vem de trás para desenhar a borda e a espessura do bisel **sem**
criar um segundo brilho especular — duas luzes numa superfície lisa é a cara de render de
banco de imagem.

### Partículas: desligadas de propósito

O sistema está pronto e funciona (`src/scene/particles.js`: um único `Points`,
`aFrom`/`aTo` + `uMorph` no vertex shader). Foi ligado e olhado em tela nos quatro atos
previstos — halo no hero, três nuvens nos números, disco-lente nos cases, halo no CTA.
Em todos, o resultado caiu na lista de "não faça" do briefing: nuvem cinza sobre a headline,
manchas de café atrás dos algarismos, ruído estático sobre os cards.

Para reativar: `USE_PARTICLES = true` em `src/scene/index.js` e ajustar `pTarget.a` nos
atos de `src/scene/timeline.js` (hoje todos em 0).

### Três modos de degradação

`src/scene/capabilities.js`:

- `full` — tudo acima;
- `static` — sem giro contínuo e sem deriva; desenha até acomodar e para;
- `none` — canvas removido.

Entram em `static`: `prefers-reduced-motion`, `hardwareConcurrency ≤ 4`, `deviceMemory ≤ 4`,
ou FPS médio abaixo de 45 por 2s seguidos (degrada uma vez e não volta).
Entram em `none`: `save-data`, ou falha ao criar o contexto WebGL — e quem descobre isso é o
próprio renderer, num try/catch, **não uma sonda**. A sonda da primeira versão custava 1,35
segundo síncrono antes do primeiro paint, medido em perfil de CPU.

O canvas é `aria-hidden="true"` sempre. **Nenhuma informação existe só nele.** Enquanto o SVG
da marca não chega, o ponto segura a cena sozinho — a página nunca fica sem ele.

## Decisões que fogem do briefing

Três, todas com motivo medido:

1. **`content-visibility: auto` foi removido.** Ele muda a altura das seções conforme elas
   entram e saem do render, e o ScrollTrigger calcula `start`/`end` na carga. O resultado
   em teste: a transição creme↔navy disparava uma seção inteira fora de lugar e o ponto
   pousava longe da headline. Numa página de nove seções o ganho não paga o risco.

2. **O ponto do CTA não fica no centro da tela.** No layout de duas colunas do contato, o
   centro é exatamente onde está o formulário — o único objetivo da página. Ele pousa na
   linha entre o contato e o rodapé, que está sempre vazia.

3. **As partículas estão desligadas** (acima).

4. **A esfera do hero virou o `S` extrudado e o ponto do logo.** O briefing pedia "o ponto",
   e o ponto continua sendo o fio da narrativa — mas uma esfera não consegue carregá-la:
   ela é igual de todo ângulo, então girar e o parallax não significam nada. Separar o `S` do ponto faz o
   giro significar alguma coisa: a marca se desmonta e vira pontuação. Custo: +18 KB gzip no chunk 3D.

E uma proteção que não estava pedida: o hero **só é pinado se couber na janela**
(`src/sections/hero.js`). A headline B é mais longa que a A; pinar um bloco mais alto que a
viewport esconderia o CTA principal enquanto durasse o pin.

---

## O que foi verificado, e como

Lighthouse 13 (perfil mobile padrão) e medições diretas, servindo `dist/` com gzip,
Chromium headless.

| | resultado | meta do briefing |
|---|---|---|
| **Acessibilidade** | **100** | 100 ✅ |
| **Best Practices** | **100** | ≥ 95 ✅ |
| **SEO** | **100** | 100 ✅ |
| **Performance** | **68** | ≥ 90 ❌ — ver abaixo |
| LCP | **2,0 s** | < 2,0 s ✅ |
| CLS | **0** | < 0,05 ✅ |
| chunk do three.js | **136 KB gzip** | < 180 KB ✅ |

Além disso:

- ordem de carga: CSS → JS da página → fontes → **three.js por último**, depois do primeiro paint;
- LCP é o `<h1>` em texto, não o WebGL;
- zero erro de console, zero warning do three.js;
- zero scroll horizontal em 375 / 414 / 768 / 1024 / 1440;
- um `<h1>`, hierarquia sem pular nível, `lang="pt-BR"`, skip link como primeiro focável,
  todos os inputs com `<label for>`, canvas `aria-hidden`, JSON-LD `ProfessionalService`;
- foco visível (2px sólido) em todos os 16 primeiros stops de tab;
- menu mobile abre, prende o foco, fecha no `Esc` e devolve o foco ao botão;
- formulário: submit vazio marca os três campos e foca o primeiro; campo limpo só acusa erro
  no blur; a máscara aceita `+55 (13) 99662-5980`, `5513996625980`, `(13) 3222-1010` e
  `13 99662 5980`;
- com `prefers-reduced-motion` ligado, os 13 elementos reveláveis testados aparecem — nenhum
  conteúdo fica escondido;
- a página funciona e converte com JavaScript desligado;
- o ponto 3D pousa sobre o ponto final da headline com o diâmetro certo (verificado em pixel).

### Sobre a nota 69 de Performance

Os três números que o Google usa para ranquear estão verdes: **LCP 2,0s** e **CLS 0**. O que
derruba a nota é o **total blocking time**, e a causa é uma só. Medido:

| versão | Performance | TBT |
|---|---|---|
| a página, sem JavaScript nenhum | 100 | 0 ms |
| **com GSAP + Lenis + todo o JS da página, sem o módulo 3D** | **99** | **80 ms** |
| com o módulo 3D (o que está entregue) | 68 | ~3–4 s |

Ou seja: **tudo o que não é three.js custa 80ms.** Os 30 pontos são o parse do three.js
(526 KB, dos quais ~56 KB são o `SVGLoader` e o `ExtrudeGeometry` que montam o `S.`) mais a
criação do contexto WebGL e a compilação dos shaders.

Duas ressalvas sobre esse número: o ambiente de teste roda WebGL por **software**
(SwiftShader), o que encarece contexto e shader muito além do que um celular com GPU real
gasta; e o teste já rodou com CPU a 1/4. A nota num aparelho real deve ficar acima disso —
mas não a 90.

Se os 90 forem inegociáveis, existem três caminhos, em ordem de custo:

1. **Rodar a cena só no desktop.** Uma linha em `src/main.js` (`mode` vira `'none'` abaixo de
   1024px). O celular passa a ver a página estática, que marca 99. Custo: o momento do ponto
   final deixa de existir no mobile — que é onde está a maior parte do tráfego.
2. **Trocar o three.js por um shader próprio.** A cena desenha *uma esfera*; um impostor de
   esfera em WebGL puro é matematicamente exato e cabe em ~3 KB, contra 118 KB. Elimina
   praticamente todo o TBT. Custo: reescrever `scene/index.js` e `scene/dot.js` e revalidar a
   coreografia inteira.
3. **Aceitar 69.** LCP e CLS estão verdes, que é o que entra no Core Web Vitals. TBT não é
   Core Web Vital (quem entrou no lugar do FID foi o INP, que mede resposta à interação, não
   carga).

Minha recomendação: publicar assim, medir o INP e o LCP reais com dados de campo por algumas
semanas, e só então decidir entre (1) e (2). Otimizar contra um número de laboratório antes
de ter dado de gente de verdade usando é o tipo de decisão que a própria copy da página
critica.

### O que não foi verificado aqui

**60fps num celular mediano real.** O ambiente roda WebGL por software, então qualquer FPS
medido daqui não significa nada. O vigia de FPS está ligado e rebaixa `full → static`
sozinho se a média cair abaixo de 45 por 2s — inclusive durante os testes, ele disparou. Vale
rodar um scroll de ponta a ponta num aparelho de verdade antes de publicar.

## Estrutura

```
index.html                 9 seções, copy final, headline B comentada
vite.config.js             injeção dos dados no HTML + JSON-LD + sitemap
public/
  fonts/                   Archivo variável (wght 100–900, wdth 62–125) + DM Mono
  syaco-mark.svg           o `S.` — nav (via mask-image), favicon
  syaco-s.svg              só o `S`, sem o ponto — corpo 3D da cena
  syaco-wordmark.svg       lockup completo — rodapé
src/
  main.js                  bootstrap; pins primeiro, cena 3D por último
  lib/                     color.js (mistura OkLab) · dom.js
  styles/
    tokens.css             ÚNICA fonte de cor/tipo/espaço
    base.css               fontes, reset, tema, foco, botões
    sections/*.css
  scene/
    capabilities.js        full | static | none + vigia de FPS
    index.js               renderer, cena, câmera, loop sob demanda
    dot.js                 o `S`, o ponto, as luzes, a sombra de contato
    particles.js           pronto, desligado (ver acima)
    timeline.js            a coreografia
  sections/
    hero.js services.js    os dois pins — criados antes de tudo
    theme.js               transição creme↔navy
    nav.js reveal.js stats.js form.js
  data/*.json              stats · services · team · cases · process · testimonials
```

Uma nota sobre a ordem em `main.js`: os dois pins são criados **antes** dos outros
ScrollTriggers e com `refreshPriority`. Eles acrescentam altura ao documento; criados
depois, tudo que vem abaixo dispara cedo demais.
