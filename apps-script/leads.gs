/* ============================================================
   Leads da SYACO: recebe o formulário /comecar/, grava na planilha
   e avisa no WhatsApp da SYACO. Instalação no README, seção
   "Leads: planilha e WhatsApp".

   Propriedades do script (nunca escreva a chave neste arquivo):
     CALLMEBOT_PHONE   número que recebe o aviso, ex. +5513996625980
     CALLMEBOT_APIKEY  chave que o CallMeBot manda no WhatsApp
   Sem elas, o aviso vai só por e-mail e a planilha segue funcionando.
   ============================================================ */

const ABA = 'Leads';

const COLUNAS = [
  'Data', 'Nome', 'WhatsApp', 'Status', 'Falar com o lead', 'Prioridade',
  'Resultado', 'Empresa', 'Serviço', 'Faturamento', 'Investimento', 'Prazo',
  'Pontos', 'Aviso', 'UTM source', 'UTM medium', 'UTM campaign', 'UTM content',
  'UTM term',
];

const STATUS = ['Aguardando contato', 'Contatado', 'Em negociação', 'Fechou', 'Sem interesse'];

const RESULTADOS = { match: 'Deu match', talvez: 'Talvez', 'nao-agora': 'Não agora' };

/* A mensagem de cada lead sai daqui, conforme a tela final que a pessoa viu.
   Mudar um texto só vale para os leads novos. */
const MENSAGENS = {
  match: (nome) =>
    `Oi, ${nome}! Aqui é da SYACO. Recebemos as suas respostas no nosso formulário e queremos marcar uma conversa. Qual o melhor horário para você?`,
  talvez: (nome) =>
    `Oi, ${nome}! Aqui é da SYACO. Recebemos as suas respostas no nosso formulário e queremos entender melhor o momento do seu negócio. Podemos conversar por aqui?`,
  'nao-agora': (nome) =>
    `Oi, ${nome}! Aqui é da SYACO. Obrigada por responder ao nosso formulário. Quando o seu negócio estiver pronto para o próximo passo, será um prazer conversar com você.`,
};

/* O cliente pode tentar de novo depois de um timeout, com o lead já gravado. */
const JANELA_DUPLICADO_S = 600;

/* ---------- entrada ------------------------------------------ */

function doPost(e) {
  try {
    const lead = lerLead_(JSON.parse(e.postData.contents));
    if (!lead) return json_({ ok: false, erro: 'dados-invalidos' });

    const ss = abrirPlanilha_();
    const linha = gravar_(ss, lead);
    // Linha nula: é o mesmo lead de agora há pouco, já gravado e avisado.
    if (linha) registrarAviso_(ss, linha, avisar_(ss, lead));
    return json_({ ok: true });
  } catch (err) {
    console.error('Falha ao receber lead', err);
    return json_({ ok: false, erro: 'falha-interna' });
  }
}

/* Abrir a URL no navegador confirma que a implantação está no ar. */
function doGet() {
  return json_({ ok: true, servico: 'syaco-leads' });
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/* ---------- validação ---------------------------------------- */

/* A URL é pública: nada do corpo é confiável. */
function lerLead_(d) {
  const nome = texto_(d.nome);
  const digitos = String(d.whatsapp ?? '').replace(/\D/g, '');
  if (nome.length < 2 || !/^55[1-9]{2}\d{8,9}$/.test(digitos)) return null;

  const tela = Object.prototype.hasOwnProperty.call(RESULTADOS, d.tela_final) ? d.tela_final : 'talvez';
  return {
    nome,
    digitos,
    tela,
    presenca: texto_(d.presenca),
    servico: texto_(d.servico),
    faturamento: texto_(d.faturamento),
    investimento: texto_(d.investimento),
    prazo: texto_(d.prazo),
    pontos: Number(d.pontos) || 0,
    prioridade: texto_(d.prioridade),
    utm: ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'].map((k) => texto_(d[k])),
  };
}

function texto_(v) {
  return String(v ?? '').trim().slice(0, 200);
}

/* Sem o apóstrofo, um nome como =IMPORTXML(...) viraria fórmula na planilha. */
function celula_(s) {
  return /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
}

function telefoneLegivel_(digitos) {
  const d = digitos.slice(2);
  const corte = d.length === 11 ? 7 : 6;
  return `(${d.slice(0, 2)}) ${d.slice(2, corte)}-${d.slice(corte)}`;
}

/* ---------- planilha ----------------------------------------- */

function abrirPlanilha_() {
  const id = PropertiesService.getScriptProperties().getProperty('SHEET_ID');
  if (!id) throw new Error('Rode a função configurar antes de implantar.');
  return SpreadsheetApp.openById(id);
}

function gravar_(ss, lead) {
  const chave = `lead:${lead.digitos}`;
  const cache = CacheService.getScriptCache();
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    if (cache.get(chave)) return null;

    const sheet = ss.getSheetByName(ABA);
    sheet.appendRow([
      new Date(),
      celula_(lead.nome),
      telefoneLegivel_(lead.digitos),
      STATUS[0],
      '',
      celula_(lead.prioridade),
      RESULTADOS[lead.tela],
      celula_(lead.presenca),
      celula_(lead.servico),
      celula_(lead.faturamento),
      celula_(lead.investimento),
      celula_(lead.prazo),
      lead.pontos,
      'Enviando…',
      ...lead.utm.map(celula_),
    ]);
    const linha = sheet.getLastRow();
    sheet.getRange(linha, COLUNAS.indexOf('Falar com o lead') + 1).setRichTextValue(botao_(lead));
    SpreadsheetApp.flush();
    cache.put(chave, '1', JANELA_DUPLICADO_S);
    return linha;
  } finally {
    lock.releaseLock();
  }
}

/* wa.me abre o WhatsApp de quem clicou com a mensagem pronta. */
function linkLead_(lead) {
  return `https://wa.me/${lead.digitos}?text=${encodeURIComponent(MENSAGENS[lead.tela](lead.nome))}`;
}

function botao_(lead) {
  const estilo = SpreadsheetApp.newTextStyle()
    .setForegroundColor('#FFFFFF').setBold(true).setUnderline(false).build();
  return SpreadsheetApp.newRichTextValue()
    .setText('Enviar mensagem')
    .setLinkUrl(linkLead_(lead))
    .setTextStyle(estilo)
    .build();
}

function registrarAviso_(ss, linha, resultado) {
  ss.getSheetByName(ABA).getRange(linha, COLUNAS.indexOf('Aviso') + 1).setValue(resultado);
}

/* ---------- aviso para a SYACO ------------------------------- */

/* O telefone do lead fica de fora: o texto passa por um serviço de terceiros. */
function textoAviso_(ss, lead) {
  return [
    `Novo lead: *${lead.nome}* acabou de preencher o formulário.`,
    `${RESULTADOS[lead.tela]} · ${lead.prioridade}`,
    ss.getUrl(),
  ].join('\n');
}

/* Um aviso que falha não pode perder o lead: ele já está na planilha,
   e o e-mail cobre o WhatsApp. Devolve o que aparece na coluna Aviso. */
function avisar_(ss, lead) {
  const texto = textoAviso_(ss, lead);
  try {
    if (enviarWhatsApp_(texto)) return 'WhatsApp enviado';
  } catch (err) {
    console.error('Falha no CallMeBot', err);
  }
  try {
    MailApp.sendEmail(Session.getEffectiveUser().getEmail(), `Novo lead: ${lead.nome}`, texto);
    return 'Só por e-mail';
  } catch (err) {
    console.error('Falha no e-mail de aviso', err);
    return 'Aviso falhou';
  }
}

/* O CallMeBot não documenta a resposta de um envio. Vale como enviado o
   HTTP 200 sem palavra de erro; na dúvida, sai também o e-mail. */
function enviarWhatsApp_(texto) {
  const props = PropertiesService.getScriptProperties();
  const phone = props.getProperty('CALLMEBOT_PHONE');
  const apikey = props.getProperty('CALLMEBOT_APIKEY');
  if (!phone || !apikey) return false;

  const url = 'https://api.callmebot.com/whatsapp.php'
    + `?phone=${encodeURIComponent(phone)}`
    + `&text=${encodeURIComponent(texto)}`
    + `&apikey=${encodeURIComponent(apikey)}`;
  const res = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  return res.getResponseCode() === 200 && !/error|invalid|paused/i.test(res.getContentText());
}

/* ---------- instalação (rodar pelo editor) ------------------- */

function configurar() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(ABA) || ss.insertSheet(ABA);
  ss.setSpreadsheetTimeZone('America/Sao_Paulo');
  ss.setActiveSheet(sheet);
  ss.moveActiveSheet(1);

  sheet.getRange(1, 1, 1, COLUNAS.length).setValues([COLUNAS])
    .setFontWeight('bold').setFontColor('#FFFFFF').setBackground('#13273F');
  sheet.setFrozenRows(1);
  sheet.setFrozenColumns(2);

  const linhas = sheet.getMaxRows() - 1;
  const col = (nome) => sheet.getRange(2, COLUNAS.indexOf(nome) + 1, linhas, 1);

  col('Data').setNumberFormat('dd/MM/yyyy HH:mm');
  col('Falar com o lead').setHorizontalAlignment('center');
  col('Status').setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(STATUS, true).setAllowInvalid(false).build()
  );

  const regra = (range, valor, fundo) =>
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo(valor).setBackground(fundo).setRanges([range]).build();
  sheet.setConditionalFormatRules([
    regra(col('Status'), STATUS[0], '#FCE8B2'),
    regra(col('Status'), STATUS[1], '#D2E3FC'),
    regra(col('Status'), STATUS[2], '#E4D7F5'),
    regra(col('Status'), STATUS[3], '#CEEAD6'),
    regra(col('Status'), STATUS[4], '#E8EAED'),
    regra(col('Aviso'), 'Aviso falhou', '#F6AEA9'),
    SpreadsheetApp.newConditionalFormatRule()
      .whenCellNotEmpty().setBackground('#1E8E5A').setRanges([col('Falar com o lead')]).build(),
  ]);

  sheet.autoResizeColumns(1, COLUNAS.length);
  PropertiesService.getScriptProperties().setProperty('SHEET_ID', ss.getId());
}

/* Manda um aviso de teste sem criar linha. Veja o resultado no registro. */
function testarAviso() {
  const lead = { nome: 'Lead de teste', tela: 'match', prioridade: 'responder primeiro' };
  console.log(avisar_(abrirPlanilha_(), lead));
}
