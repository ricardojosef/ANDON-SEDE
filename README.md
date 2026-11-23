# GLean — site e ferramentas internas

Repositório publicado em **[glean.com.br](https://glean.com.br)** pelo GitHub Pages. Começou
como o Andon da sede e hoje reúne o site do grupo e as ferramentas internas:

| Endereço | O que é | Pasta |
|---|---|---|
| [glean.com.br](https://glean.com.br) | Landing do Treinamento Aberto (página inicial) | [`index.html`](index.html) |
| [glean.com.br/processo-seletivo](https://glean.com.br/processo-seletivo/) | Landing do Processo Seletivo | [`processo-seletivo/`](processo-seletivo/) |
| [glean.com.br/andon](https://glean.com.br/andon/) | Andon: painel do monitor da sede | [`andon/`](andon/) |
| [glean.com.br/andon/pop](https://glean.com.br/andon/pop/) | POP impresso "Ligar o Andon" | [`andon/pop/`](andon/pop/) |
| [glean.com.br/cuckoo](https://glean.com.br/cuckoo/) | Cuckoo: timer com sessões compartilhadas | [`cuckoo/`](cuckoo/) |
| [glean.com.br/gig](https://glean.com.br/gig/) | Plataforma GIG: carga semanal, pesquisinha, agenda, atas e encaminhamentos | [`gig/`](gig/) |

O endereço antigo `glean.com.br/site-psaberto.html` continua funcionando: o arquivo
[`site-psaberto.html`](site-psaberto.html) só redireciona para `/processo-seletivo/`.

## Estrutura

```
├── index.html              Página inicial (Treinamento Aberto)
├── processo-seletivo/      Landing do Processo Seletivo (index, styles, script)
├── andon/                  Painel da sede  ·  README próprio
│   └── pop/                POP impresso (HTML + PDF)
├── cuckoo/                 Timer compartilhado  ·  README próprio
├── gig/                    Plataforma GIG  ·  README próprio
│   ├── lib/  views/  components/
│   └── dados/              Planilhas de referência (fora do git)
├── firebase/               Configuração e regras do Firebase, comuns a tudo  ·  README próprio
├── assets/                 Imagens compartilhadas
│   ├── marca/              Logos do GLean, favicon e brasão da UFSC
│   ├── parceiros/          Logos das empresas parceiras
│   └── fotos/              Fotos das landings
├── site-psaberto.html      Redirecionamento do endereço antigo do PS
└── CNAME                   Domínio glean.com.br (o GitHub Pages exige na raiz)
```

Tudo é HTML, CSS e JavaScript estáticos, **sem etapa de build**: o que está no `main` é o que
vai ao ar.

## Rodar localmente

Sirva a **raiz** do repositório por `http://` (módulos JavaScript, Firebase e microfone não
funcionam abrindo o arquivo direto pelo `file://`), porque as páginas usam arquivos de
`assets/` e `firebase/`:

```bash
npx serve .
```

e abra `http://localhost:3000/andon/`, `/gig/`, `/cuckoo/` etc. Com Python instalado,
`python -m http.server 8000` também serve.

## Publicar

`git push` no `main`. O GitHub Pages publica em poucos minutos. O domínio passa pelo
Cloudflare: se uma mudança não aparecer, recarregue com **Ctrl + Shift + R**. Para que os
navegadores busquem a versão nova em até 10 minutos, deixe no Cloudflare **Caching →
Configuration → Browser Cache TTL = "Respect Existing Headers"**.

## Firebase

Andon, Cuckoo e GIG usam um único projeto Firebase (`andon-sede`). A configuração e as regras
dos bancos estão em [`firebase/`](firebase/), com o passo a passo de ativação no
[README de lá](firebase/README.md).

## Dados pessoais

As planilhas (`*.xlsx`, `*.xls`, `*.csv`) **não vão para o git** ([`.gitignore`](.gitignore)):
têm nomes, e-mails e respostas da pesquisa de clima, e o repositório é público. As de
referência do GIG ficam localmente em `gig/dados/`.
