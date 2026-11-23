# Plataforma GIG — Gestão Interna do Grupo

Plataforma de gestão semanal do grupo, em [glean.com.br/gig](https://glean.com.br/gig/):
login com a conta Google `@glean.ufsc.br`, GIG semanal (planejado × realizado por tipo de
atividade, feeling de sobrecarga e atividades padrão por membro), pesquisinha de clima,
agenda integrada ao Google Agenda, atas com encaminhamentos, DDLs (entregas com prazo),
construtor de formulários, visão centralizada de encaminhamentos e DDLs no Início, quadro de
quedas no ID e dashboards para a liderança.

Roda sem build (Vue 3 e vue-router por CDN, via *import map*) e usa o projeto Firebase comum
([`../firebase/`](../firebase/)): Authentication (Google) e Cloud Firestore. Tudo cabe no
plano gratuito.

**Marca:** o ícone do GIG vem da marca do GLean (o anel com seta do ciclo de melhoria, no
mesmo degradê) envolvendo uma grade 2×2, os quatro blocos da planilha do GIG. O desenho está
em [`lib/marca.js`](lib/marca.js); os arquivos prontos ficam em
[`../assets/marca/`](../assets/marca/) (`gig-icone.svg`, `gig-logo.svg` e as versões claras,
para fundo escuro).

**Modo escuro:** em **Perfil e configurações → Aparência** (Claro, Escuro ou Automático, que
segue o sistema) ou no botão de lua/sol ao lado do nome, na navegação. Vale para o navegador
em que foi escolhido.

## Ativar (uma vez)

1. Ative o login Google e o Firestore e cole as regras, conforme o
   [README do Firebase](../firebase/README.md).
2. Entre na plataforma com a conta do líder. Isso cria `membros/{uid}`. No Console, em
   **Firestore → membros**, abra esse documento e troque `papel` de `"membro"` para
   `"lider"`. Daí em diante tudo é feito pela tela **Membros** da própria plataforma.
3. Na plataforma, em **Membros → Semestres**, crie o semestre (segunda-feira da semana 1 e
   número de semanas) e marque-o como ativo; em **Membros**, clique em **Carregar catálogos
   iniciais** (processos, as ~145 atividades da aba "Padrão Atividades" do GIG 26.2 e os
   motivos de queda). Se o catálogo já existir, a aba **Catálogo de atividades** mostra
   **Importar da planilha**, que só acrescenta as atividades que faltam (não apaga nem
   sobrescreve nada, nem os motivos de queda já ajustados).

## Papéis

| Papel | Quem | Pode |
|---|---|---|
| `membro` | todos, ao entrar pela primeira vez | preencher GIG e pesquisinha, criar atas e encaminhamentos, ver quadro de quedas |
| `gp` | Gestão de Pessoas | o mesmo + registrar quedas, ler respostas da pesquisinha, dashboards, motivos de queda |
| `lider` | Liderança | tudo + membros, cargos por processo, módulos, catálogos e semestres |

As respostas individuais da pesquisinha só são lidas por `lider`/`gp`; cada membro lê só a
sua. GIG, atas, encaminhamentos e quedas são visíveis a todos (gestão visual). Qualquer
membro pode vincular uma ata a uma reunião da agenda (só o campo do vínculo).

## Google Agenda

A tela **Agenda** mostra a semana das agendas Google de quem está logado (pessoal, do grupo,
de processos) numa grade de horários, com cada compromisso na cor que tem no Google. Permite
criar/editar/excluir reuniões com convidados do grupo, cor e link do Meet, e liga cada reunião
a uma **ata**: "Criar ata" já preenche título, data e participantes, e os encaminhamentos da
ata aparecem (e podem ser criados) no painel da reunião. O link da ata é escrito na descrição
do evento, para quem abre direto no Google Agenda.

Funciona só no navegador (Google Identity Services + Calendar API), sem servidor e sem custo.
Cada pessoa clica em **Conectar Google Agenda** e autoriza a própria conta; o acesso vale por
cerca de uma hora e depois é só conectar de novo.

Configuração, uma vez, no [Google Cloud Console](https://console.cloud.google.com/) do projeto
`andon-sede`:

1. **APIs e serviços → Biblioteca → Google Calendar API → Ativar.**
2. **Google Auth Platform → Público-alvo.** Se o projeto pertence à organização do Workspace
   `glean.ufsc.br`, use **Interno**: só contas do grupo, sem verificação do Google. Fora da
   organização, use **Externo** em modo **Teste** e cadastre cada membro em **Usuários de
   teste** (até 100) — sem isso aparece "Acesso bloqueado… erro 403: access_denied". Escopos:
   `calendar.events` e `calendar.calendarlist.readonly`.
3. **Credenciais → IDs do cliente OAuth 2.0 →** "Web client (auto created by Google Service)"
   (criado pelo Firebase) → em **Origens JavaScript autorizadas**, adicione
   `https://glean.com.br` (e `http://localhost:8765` para testar localmente). Copie o
   **Client ID**.
4. Na plataforma, como líder: **Agenda → Configurar** → cole o Client ID e escolha a
   **agenda do grupo** (ela vem marcada para todos e é onde as reuniões novas são criadas).
5. Agenda do grupo: no Google Agenda, crie uma agenda "GLean" e compartilhe com o grupo do
   Workspace com a permissão **Fazer alterações nos eventos**.

Se o Workspace restringir apps de terceiros (Admin → Segurança → Controles de API), o
administrador precisa marcar este Client ID como confiável.

## Agenda

A semana começa no domingo, como no Google Agenda. O botão **Tela cheia** abre a agenda
ocupando a tela inteira, no layout do Google Agenda (botão Criar, mini calendário do mês, lista
"Minhas agendas" e a grade da semana); **Voltar ao GIG** (ou `Esc`) retorna à plataforma.
O link `#/agenda?tela=cheia` já abre nesse modo.

## Chat

Conversas diretas com qualquer membro e **grupos** (nome, emoji, cor, descrição; quem cria é
administrador e pode adicionar/remover pessoas e promover outros admins; qualquer um pode sair).
Dá para responder uma mensagem, **encaminhar** qualquer mensagem (texto, figurinha ou anexo) para
uma ou várias conversas, apagar as próprias mensagens e ver ✓✓ azul quando todos leram.

- **Figurinhas:** o pacote do GLean (desenhado em [`lib/figurinhas.js`](lib/figurinhas.js)) e a
  biblioteca "Do grupo", em que qualquer membro cria uma figurinha a partir de uma imagem (PNG
  com fundo transparente fica melhor) ou guarda uma figurinha que recebeu.
- **Anexos:** fotos, PDFs, planilhas, qualquer arquivo de até **5 MB** (clipe, arrastar para a
  conversa ou colar). Ficam no próprio Firestore, em pedaços de ~600 KB, sem precisar do
  Firebase Storage (que exige o plano pago). Fotos grandes são reduzidas e comprimidas antes de
  enviar. Como tudo divide a cota de 1 GB do plano gratuito, o chat não serve para vídeos
  grandes: para isso, compartilhe um link do Drive.
- **Avisos:** o item Chat da navegação mostra quantas conversas têm mensagem nova e, com as
  notificações do navegador ligadas (tela DDLs), chega um aviso quando o GIG está aberto em
  segundo plano.

## DDLs e formulários

**DDL** é uma entrega com prazo: terça ou quinta às 23:59, ou um prazo *excepcional* (outro dia
e hora). Três coisas aparecem como DDL para cada membro, na aba **DDLs** e no **Início**:

- tarefas criadas em **DDLs → Nova DDL** para todos ou para um grupo (módulos, processos ou
  pessoas); cada destinatário marca a sua como feita e quem criou acompanha quem falta;
- formulários com prazo (feita = respondido);
- a **pesquisinha de clima**, que é sempre DDL de quinta-feira da própria semana.

Avisos, sem servidor: faixa no topo quando há DDL vencendo hoje ou atrasada, contador no menu
e, se o membro ligar as notificações do navegador (aba DDLs), um aviso de manhã e outro à noite
nos dias de DDL enquanto o GIG estiver aberto numa aba. Com o Google Agenda conectado, a DDL
pode também virar convite na agenda do grupo, e aí o Google avisa por e-mail/celular.

**Formulários**: qualquer membro cria (resposta curta, parágrafo, múltipla escolha, caixas,
lista, escala, número, data), escolhe quem responde e, opcionalmente, um prazo de DDL. Quem
criou (e a liderança) vê o resumo com gráficos, as respostas individuais, quem falta e baixa
CSV. Cada membro só lê a própria resposta.

## Arquivos

| Caminho | Papel |
|---|---|
| [`index.html`](index.html) | Shell: import map (Vue, vue-router), Chart.js, monta o app |
| [`app.js`](app.js) | Rotas, login/guarda de autenticação, criação do cadastro no 1º acesso |
| [`styles.css`](styles.css) | Paleta e componentes (mesmos tokens do Andon) |
| `lib/` | Firebase, Google Agenda (`agenda.js`), store reativa, semana do semestre, cálculo do ID, perguntas da pesquisinha, catálogos iniciais |
| `views/` | Uma tela por arquivo: Início, GIG, Pesquisinha, DDLs, Formulários (lista, editor, resposta, respostas), Agenda, Encaminhamentos, Atas, Membros, Quedas, Dashboards, Perfil |
| `components/` | Logo do GIG, navegação, faixa de DDL, seletor de semana, seletor de prazo, destinatários, escala, gráfico |
| `dados/` | Planilhas de referência (GIG, gerenciamento, pesquisinha). **Fora do git** (dados pessoais) |
| [`../firebase/firestore.rules`](../firebase/firestore.rules) | Regras do Firestore (colar no Console) |

Modelo de dados: um documento por **membro-semana** em `gig/{semestre}_{semana}_{uid}` e
`clima/{semestre}_{semana}_{uid}`; `encaminhamentos` guardam `responsavel` e a `origem`
(ata ou manual); `atas` podem ter `evento` (a reunião do Google Agenda vinculada);
`membros/{uid}` guarda papel, módulo, cargos e as atividades padrão; `config/agenda` guarda o
Client ID e a agenda do grupo; `ddls/{id}` guarda prazo, público e `concluidos.{uid}`;
`formularios/{id}` guarda perguntas, público, prazo e `respondentes.{uid}`, com as respostas em
`formularios/{id}/respostas/{uid}`; `conversas/{id}` (diretas com id `dm_<uidA>_<uidB>` ou
grupos) guarda membros, admins, a última mensagem e `lidas.{uid}`, com as mensagens em
`conversas/{id}/mensagens` e os anexos em `conversas/{id}/anexos/{aid}/partes/{n}`;
`figurinhas/{id}` guarda as figurinhas criadas pelos membros.
