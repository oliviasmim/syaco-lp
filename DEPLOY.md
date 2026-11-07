# Publicação

O site é estático e roda em **Cloudflare Workers Static Assets** (`wrangler.jsonc`).
O domínio `syaco.com.br` continua registrado na Hostinger; só o DNS passa para a Cloudflare.

## 1. Cloudflare: adicionar o domínio

1. No painel da Cloudflare: **Add a domain** → `syaco.com.br` → plano Free.
2. Na revisão dos registros importados:
   - **Manter:** o `MX` `1 smtp.google.com` e o `TXT` `google-site-verification=…`.
     Sem o MX, o e-mail do domínio para de funcionar.
   - **Apagar:** o `A` `2.57.91.91` e o registro de `www`, que apontam para a página de
     estacionamento da Hostinger. Um `A` na raiz impede a criação do Custom Domain.
3. Anote os dois nameservers que a Cloudflare indicar.

## 2. Hostinger: trocar os nameservers

Faça este passo depois do anterior: o Registro.br testa se os novos servidores já respondem pelo domínio.

1. hPanel → **Domínios** → `syaco.com.br` → **DNS / Nameservers** → **Alterar nameservers**.
2. Troque `atlas.dns-parking.com` e `hyperion.dns-parking.com` pelos da Cloudflare.
3. Aguarde o domínio ficar **Active** na Cloudflare. Costuma levar de minutos a algumas horas.

O domínio não usa DNSSEC hoje, então não há registro DS para remover antes da troca.

## 3. Cloudflare: conectar o repositório

**Workers & Pages → Create → Import a repository** → `syaco-lp`, branch `main`.

| Campo | Valor |
|---|---|
| Build command | `npm run build` |
| Deploy command | `npx wrangler deploy` |
| Build variable `VITE_FORM_ENDPOINT` | URL do Apps Script (README, "Leads: planilha e WhatsApp") |
| Build variable `VITE_SITE_URL` | `https://syaco.com.br` |

As variáveis são de **build**, não de runtime: o Vite as grava no JavaScript. Depois de alterá-las,
é preciso publicar de novo. Sem `VITE_FORM_ENDPOINT`, o formulário de produção não envia lead: ele
mostra o erro com o link do WhatsApp, e a build avisa no log.

A rota em `wrangler.jsonc` cria o Custom Domain e o certificado no primeiro deploy, por isso o
domínio precisa estar ativo antes. Como alternativa ao repositório, `npx wrangler login` e `npm run deploy`.

## 4. Cloudflare: ajustes da zona

- **www → raiz:** crie um `A` proxied `www` → `192.0.2.0` e, em **Rules → Redirect Rules**, use o
  modelo *Redirect from WWW to root* (301).
- **SSL/TLS → Edge Certificates:** ligue **Always Use HTTPS**.
- **Scrape Shield:** desligue **Email Address Obfuscation**. Ele injeta um script que a CSP bloqueia.
- **Speed:** deixe **Rocket Loader** desligado, pelo mesmo motivo.
- **Web Analytics** (opcional): dá os dados de campo de LCP e INP. A CSP já libera o beacon.

## 5. Conferir depois do deploy

```bash
curl -sI https://syaco.com.br/ | grep -iE 'HTTP/|content-security|strict-transport'
```

```bash
curl -sI https://www.syaco.com.br/ | grep -iE 'HTTP/|location'
```

```bash
dig +short MX syaco.com.br
```

- Preencha o formulário em `/comecar/` e confira se a linha chegou na planilha.
- Mande um e-mail para o domínio e confira se ele chega.
- Faça o scroll da página num celular real, para ver a cena 3D.
- No Google Search Console, envie `https://syaco.com.br/sitemap.xml`.
- Passe a URL no [PageSpeed Insights](https://pagespeed.web.dev/) e no
  [teste de resultados avançados](https://search.google.com/test/rich-results).
