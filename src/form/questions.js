/* ============================================================
   Formulário de qualificação — conteúdo.

   Todo o texto, as opções e os pontos moram aqui. Mudou a copy,
   mudou um valor de faturamento, mudou um ponto: só este arquivo.

   Em cada opção:
     points → soma para a fila de prioridade (máx. 9)
     route  → 'nao-agora' encerra o formulário na hora;
              'talvez' segue até o fim mas muda a tela final.
   As regras que leem esses campos estão em qualify.js.
   ============================================================ */

export const INTRO = {
  title: 'Bem-vindo(a) à SYACO',
  text:
    'Este formulário rápido ajuda a gente a conhecer o seu negócio e entender como a SYACO pode caminhar junto com você. A SYACO funciona como uma estrutura de marketing completa: a gente cuida do conteúdo, dos anúncios e da imagem do seu negócio. Depois que você enviar, vamos analisar as suas respostas e, se o momento for bom para os dois lados, entraremos em contato em até 1 dia útil pelo WhatsApp.',
  meta: '7 perguntas · cerca de 2 minutos',
  cta: 'Bora começar',
};

export const QUESTIONS = [
  {
    id: 'nome',
    kind: 'text',
    title: 'Qual o seu nome?',
    placeholder: 'Seu nome',
    autocomplete: 'given-name',
    errors: { empty: 'Escreva o seu nome para a gente saber como te chamar.' },
  },
  {
    id: 'whatsapp',
    kind: 'phone',
    title: 'Qual o seu WhatsApp com DDD?',
    placeholder: '(13) 99662-5980',
    errors: {
      empty: 'Escreva o seu WhatsApp com DDD.',
      invalid: 'Confira o número: são o DDD + 8 ou 9 dígitos, ex. (13) 99662-5980.',
    },
  },
  {
    id: 'presenca',
    kind: 'text',
    title: 'Qual o @ do Instagram ou o site da sua empresa?',
    hint: 'Se ainda não tiver, escreva "não tenho".',
    placeholder: '@suaempresa ou suaempresa.com.br',
    shortcut: 'não tenho',
    autocomplete: 'off',
    errors: { empty: 'Escreva o @ ou o site, ou toque em "Não tenho".' },
  },
  {
    id: 'servico',
    kind: 'choice',
    title: 'O que você está procurando?',
    options: [
      { value: 'social-trafego', label: 'Social media e tráfego pago' },
      { value: 'social', label: 'Social media (gestão do Instagram)' },
      { value: 'site', label: 'Site ou landing page' },
      { value: 'automacao', label: 'Automação de atendimento' },
      { value: 'branding', label: 'Branding (criar ou renovar a marca)' },
    ],
  },
  {
    id: 'faturamento',
    kind: 'choice',
    title: 'Qual o seu faturamento médio mensal?',
    options: [
      { value: 'sem-faturamento', label: 'Ainda não estou faturando', points: 0, route: 'nao-agora' },
      { value: 'ate-5k', label: 'Até R$ 5 mil', points: 0, route: 'nao-agora' },
      { value: '5-10k', label: 'R$ 5 a 10 mil', points: 1 },
      { value: '10-30k', label: 'R$ 10 a 30 mil', points: 2 },
      { value: '30-100k', label: 'R$ 30 a 100 mil', points: 3 },
      { value: '100k-mais', label: 'Acima de R$ 100 mil', points: 3 },
    ],
  },
  {
    id: 'investimento',
    kind: 'choice',
    note:
      'Nossos serviços começam a partir de R$ 2.000 por mês, e com tráfego pago junto, a partir de R$ 3.500 por mês, fora a verba dos anúncios. Site, landing page, automação e branding são sob demanda: o valor depende do que o seu negócio precisa e a gente alinha na nossa conversa.',
    title: 'Esse investimento cabe no seu negócio hoje?',
    options: [
      { value: 'cabe', label: 'Cabe tranquilo', points: 3 },
      { value: 'organizar', label: 'Cabe, mas preciso me organizar', points: 1, route: 'talvez' },
      { value: 'nao-cabe', label: 'Ainda não cabe', points: 0, route: 'nao-agora' },
    ],
  },
  {
    id: 'prazo',
    kind: 'choice',
    title: 'Quando você quer começar?',
    options: [
      { value: 'este-mes', label: 'Este mês', points: 3 },
      { value: '2-3-meses', label: 'Nos próximos 2 ou 3 meses', points: 2 },
      { value: 'pesquisando', label: 'Estou só pesquisando', points: 0, route: 'talvez' },
    ],
  },
];

/* O 🎉 do "Deu match!" virou o símbolo da SYACO animado na tela:
   emoji muda de cara em cada sistema e briga com a identidade.
   Para voltar com ele, é só pôr no title. */
export const ENDINGS = {
  match: {
    title: 'Deu match!',
    text:
      'Recebemos as suas respostas e o seu negócio tem tudo para conversar com a gente. Entraremos em contato em até 1 dia útil pelo WhatsApp para marcar uma conversa.',
  },
  talvez: {
    title: 'Recebemos as suas respostas!',
    text:
      'Vamos olhar o seu caso com carinho e entraremos em contato pelo WhatsApp para entender se o momento é este. Enquanto isso, passa no @syacocompany e vê o que a gente anda postando.',
  },
  'nao-agora': {
    title: 'Obrigada por responder!',
    text:
      'Recebemos as suas respostas e agradecemos o seu interesse na SYACO. Pelo que você nos contou, o nosso investimento ainda não cabe no seu momento, e está tudo bem por aqui. Quando o seu negócio estiver pronto para dar o próximo passo, será um prazer conversar com você. Até lá, acompanhe o nosso conteúdo no @syacocompany.',
  },
};

export const INSTAGRAM = 'https://www.instagram.com/syacocompany';
export const WHATSAPP = '5513996625980';
