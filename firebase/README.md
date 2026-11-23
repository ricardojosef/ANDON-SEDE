# Firebase

Um único projeto Firebase (**`andon-sede`**) atende todo o site:

| Quem usa | Serviço | Regras |
|---|---|---|
| Andon da sede ([`andon/`](../andon/)) | Realtime Database, nó `/andon` | [`database.rules.json`](database.rules.json) |
| Cuckoo ([`cuckoo/`](../cuckoo/)) | Realtime Database, nó `/cuckoo/sessoes` | [`database.rules.json`](database.rules.json) |
| Plataforma GIG ([`gig/`](../gig/)) | Authentication (Google) + Cloud Firestore | [`firestore.rules`](firestore.rules) |

| Arquivo | Papel |
|---|---|
| [`config.js`](config.js) | `FIREBASE_CONFIG` importado pelas três ferramentas. O Andon o reexporta em `andon/config.js` |
| [`database.rules.json`](database.rules.json) | Regras do Realtime Database |
| [`firestore.rules`](firestore.rules) | Regras do Cloud Firestore |

As chaves em `config.js` **não são segredo**: chaves web do Firebase são identificadores
públicos. A proteção real vem das regras, que precisam ser **coladas no Console** sempre que
mudarem aqui (o arquivo no repositório não é aplicado sozinho).

## Criar o projeto (só se for recomeçar do zero)

1. Em <https://console.firebase.google.com>, **Adicionar projeto** (pode desativar o
   Google Analytics).
2. ⚙️ **Configurações do projeto** → **Seus apps** → ícone **`</>`** (Web) → registre o app e
   copie os valores do `firebaseConfig` para [`config.js`](config.js). O `databaseURL` é
   obrigatório; se não vier, pegue na página do Realtime Database
   (`https://SEU-PROJETO-default-rtdb.firebaseio.com`).

## Realtime Database (Andon e Cuckoo)

1. **Criar** → **Realtime Database** → **Criar banco de dados**.
2. Aba **Regras**: cole [`database.rules.json`](database.rules.json) e publique.

Isso libera leitura e escrita só no nó `/andon` (qualquer membro edita o painel sem login,
por decisão do grupo) e nas sessões do Cuckoo, uma por código de 5 caracteres. A lista de
sessões não pode ser lida: só entra quem tem o código ou o link. Não guarde nada sensível
neste banco.

## Authentication e Firestore (GIG)

1. **Authentication → Sign-in method → Google**: ativar. Em **Settings → Authorized
   domains**, adicionar `glean.com.br` (`localhost` já vem).
2. **Firestore Database → Create database** (modo produção) → aba **Rules**: cole
   [`firestore.rules`](firestore.rules) e publique. Só contas `@glean.ufsc.br` verificadas
   passam, mesmo sem o front.

O restante da ativação do GIG (primeiro líder, semestre, catálogos e Google Agenda) está no
[README do GIG](../gig/README.md).
