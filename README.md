# Andon GLean — painel da sede

Painel para o monitor da sede do GLean. Mostra, de relance: quem está no horário de sede,
se há reunião acontecendo, quem precisa de ajuda na cadeia de ajuda, os eventos de terça e
quinta, recados no letreiro, relógio, temperatura — e um alerta em tela cheia quando o
ambiente fica barulhento demais.

Todos que abrirem a página veem o mesmo conteúdo. Qualquer pessoa pode editar pelo botão
**✎ Editar** à direita (ou pela tecla `E`), e a alteração aparece nas outras telas na hora.

---

## 1. Rodar localmente

O painel precisa ser servido por `http://` (o SDK do Firebase e o microfone não funcionam
abrindo o arquivo direto pelo `file://`). Na pasta do projeto:

```bash
npx serve .
```

Abra o endereço que aparecer (normalmente <http://localhost:3000>). Com Python instalado,
`python -m http.server 8000` também serve.

Sem configurar o Firebase, o painel já funciona em **modo local**: tudo é salvo apenas no
navegador daquele computador, e aparece um selo "modo local — sem sincronização" no rodapé.

## 2. Ligar a sincronização (Firebase)

Para que todos vejam os mesmos dados, crie um Realtime Database gratuito:

1. Acesse <https://console.firebase.google.com> e clique em **Adicionar projeto**
   (pode desativar o Google Analytics).
2. No menu lateral: **Criar** → **Realtime Database** → **Criar banco de dados**.
   Escolha a localização e comece em **modo de teste**.
3. Ainda no projeto: ⚙️ **Configurações do projeto** → role até **Seus apps** →
   ícone **`</>`** (Web) → registre o app.
4. Copie o objeto `firebaseConfig` que aparece e cole os valores em [`config.js`](config.js).
   O campo `databaseURL` é obrigatório — se não vier no objeto, pegue na página do Realtime
   Database (formato `https://SEU-PROJETO-default-rtdb.firebaseio.com`).
5. Recarregue a página. O selo no rodapé deve mudar para **"sincronizado"**.

### Regras do banco

O modo de teste expira em 30 dias. Antes disso, vá em **Realtime Database → Regras** e use:

```json
{
  "rules": {
    "andon": { ".read": true, ".write": true },
    "$outros": { ".read": false, ".write": false }
  }
}
```

Isso libera leitura e escrita apenas no nó `/andon`, que é o que o painel usa. É deliberadamente
aberto: o grupo decidiu que qualquer membro pode editar sem login. As chaves em `config.js`
**não são segredo** — chaves web do Firebase são identificadores públicos, e a proteção real
vem justamente destas regras. Não guarde nada sensível neste banco.

## 3. Publicar

Qualquer hospedagem de arquivos estáticos serve. Com **GitHub Pages**: repositório →
**Settings** → **Pages** → Source: `main` / raiz. Em poucos minutos a URL fica disponível
e é ela que você abre no monitor da sede e compartilha com os membros.

---

## 4. Uso na sede

### Microfone e alerta de volume

O navegador **não fornece decibéis absolutos**, então o limiar é definido por calibração no
próprio ambiente. Faça isso uma vez, no computador que fica ligado no monitor:

1. **✎ Editar** → aba **Volume** → **Ligar microfone** (aceite a permissão do navegador).
2. Com a sala no barulho normal, clique em **1. Medir ambiente normal** e aguarde 5s.
3. Peça para o pessoal conversar alto / bata palmas, clique em **2. Medir volume alto**, 5s.
4. Clique em **Aplicar limiar sugerido**. Dá para ajustar depois no slider, acompanhando a
   barra de nível ao vivo.

O alerta **VOLUME ALTO** cobre a tela em vermelho piscando depois de ~2s acima do limiar,
e sai depois de ~3s abaixo — a folga evita que fique tremendo na fronteira.

Só a tela da sede mede o áudio; quem abrir de casa não precisa dar permissão. O limiar é
compartilhado, a medição é local.

> Para o navegador lembrar da permissão do microfone entre reinícios, a página precisa estar
> em `https://` ou `localhost`. O GitHub Pages já serve por `https://`.

### Horário de sede

Sete slots, das 09:10 às 17:00, com a pausa de 12:00 a 13:30:

| Manhã | Tarde |
|---|---|
| 09:10–10:10 | 13:30–14:20 |
| 10:10–11:00 | 14:20–15:10 |
| 11:00–12:00 | 15:10–16:20 |
| | 16:20–17:00 |

A escala é **fixada por semestre e vale de segunda a sexta** — cada dia tem a sua. Na aba
**Horário de sede** há um seletor de dia no topo, que já abre no dia de hoje (marcado com
"hoje"); os outros mostram quantos slots estão preenchidos. O botão **"Copiar esta escala
para os outros dias"** replica o dia aberto nos demais, útil quando a escala é igual a
semana toda.

O painel destaca quem está de plantão **agora** e quem vem **a seguir**, sempre lendo a
escala do dia corrente. Qualquer um pode reescrever qualquer slot — inclusive para repassar
o plantão a outra pessoa em cima da hora. Para mudar a grade de horários, edite
`SLOTS_PLANTAO` em [`config.js`](config.js).

### Cadeia de ajuda

Cada membro declara sua cor no começo da semana:

| Cor | Significado | Aparece no painel? |
|---|---|---|
| 🔴 Vermelho | Ocupado e preciso de ajuda | Sempre, em destaque máximo |
| 🟡 Amarelo | Ocupado, mas não delegável | Sempre, em tamanho médio |
| 🔵 Azul | Disponível para ajudar | Só se sobrar espaço, em tamanho menor |
| 🟢 Verde | Tranquilo, mas sem tanta disponibilidade | Não aparece |

A seção existe para mostrar **quem precisa de ajuda**, então só os vermelhos e amarelos são
garantidos. Os azuis entram embaixo, sob "disponíveis para ajudar", como apoio — e são os
primeiros a sair quando falta espaço. Se ninguém estiver em vermelho, amarelo ou azul, a
seção mostra "ninguém precisando de ajuda agora": espaço vazio significa que está tudo bem.

Cada pessoa aparece com **foto e nome abaixo**; quem ainda não tem foto mostra as iniciais.
Há também uma nota curta opcional ("preciso de ajuda com X").

Trocar a cor de alguém é livre. **Renomear, adicionar, remover membros ou alterar fotos pede
senha** — definida em `SENHA_MEMBROS` no [`config.js`](config.js) (padrão: `glean`). Troque
essa senha. A lista não é fixa em 16 pessoas: dá para adicionar e remover quantas quiser.

#### Fotos dos membros

Em **Gerenciar membros**, cada pessoa tem um botão de envio que abre os arquivos do
computador. A foto é recortada em quadrado e reduzida para **400×400** automaticamente no
navegador, antes de ser salva — cada uma fica em torno de 10–40 KB, então as fotos do grupo
inteiro cabem folgadamente no plano gratuito do Firebase.

### Reunião na sede

Aba **Geral**. Dois controles, ambos em forma de switch liga/desliga:

- **"Está havendo reunião na sede agora"** — avisa manualmente, na hora. Também dá para
  alternar clicando direto na placa do topo enquanto o modo de edição está aberto.
- **"Agendar automaticamente por horário"** — ao ligar, aparecem os campos de **início** e
  **fim**. Dentro desse período o aviso liga e desliga sozinho, em todas as telas, sem
  ninguém precisar editar na hora. O período vale todos os dias.

Os dois se combinam: o switch manual funciona **por cima** do agendamento, para avisar de
uma reunião fora do horário previsto. Ou seja, a placa fica vermelha se o switch manual
estiver ligado **ou** se o horário atual estiver dentro do período agendado.

### Letreiro

Aba **Geral**. Três modos:

- **Desligado**
- **Faixa inferior** — passa continuamente na barra de baixo
- **Tela cheia** — ocupa todo o monitor **uma única vez** (~15s) e volta sozinho ao normal,
  sincronizado entre todas as telas abertas

### Eventos de terça e quinta

Cada bloco aceita texto com cor, fonte e tamanho próprios, além de **piscar** e **confete**.
Também dá para **enviar uma imagem** do computador (um logo, um cartaz) pelo botão
"Enviar imagem…", que abre os arquivos do sistema. A imagem substitui o texto do bloco, é
reduzida para no máximo 1000px antes de ser salva e nunca ultrapassa as bordas do cartão.
Logos com fundo transparente continuam transparentes.

### Temperatura

Automática via [Open-Meteo](https://open-meteo.com) (sem cadastro), configurada para
Florianópolis-SC. Atualiza a cada 15 min e mantém o último valor em cache se a rede oscilar.
Para outra cidade, altere `LOCAL` em [`config.js`](config.js).

---

## Arquivos

| Arquivo | Papel |
|---|---|
| [`index.html`](index.html) | Estrutura do painel e do modal de edição |
| [`styles.css`](styles.css) | Layout em grid, tema azul/branco, animações |
| [`app.js`](app.js) | Estado, sincronização, render, microfone, clima |
| [`config.js`](config.js) | **O que você edita**: Firebase, senha, cidade, horários |
| `assets/logo.png` | Logo do GLean |

A tela se recarrega sozinha às 4h da manhã (ajustável em `HORA_RELOAD_DIARIO`), já que fica
ligada por semanas seguidas.

A tipografia é **Montserrat**, carregada do Google Fonts. Sem internet, o navegador cai para
a fonte de sistema e o painel continua legível.
