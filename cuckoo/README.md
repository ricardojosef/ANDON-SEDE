# Cuckoo — timer compartilhado

Timer em [glean.com.br/cuckoo](https://glean.com.br/cuckoo/). Os tempos aparecem como bolas
que o "ímã" do centro junta em 1,5 s; a bola **+** adiciona um tempo específico (minutos e
segundos). Durante a contagem, o fundo vai do violeta ao vermelho conforme o tempo acaba; ao
fim toca o `som-cuckoo.mp3` uma vez e a tela se divide entre o tempo extra contando ("tempo
esgotado há") e as bolas, para escolher o próximo tempo.

## Sessões compartilhadas

O botão **sessão compartilhada** cria uma sessão com código de 5 caracteres e nome opcional,
que entra no link (`glean.com.br/cuckoo/#reuniao-de-sexta-K7Q2M`). Todos que abrem o link
veem o mesmo tempo passando, contado pelo relógio do servidor; qualquer pessoa da sessão pode
iniciar, reiniciar ou encerrar o timer, e os tempos das bolas valem para toda a sessão.

As sessões ficam no Realtime Database do projeto Firebase comum, no nó `/cuckoo/sessoes`.
A regra que libera esse nó está em [`../firebase/database.rules.json`](../firebase/database.rules.json);
sem ela, o timer funciona normalmente, só sem sessões.

## Arquivos

| Arquivo | Papel |
|---|---|
| [`index.html`](index.html) | Página inteira: estilos, simulação das bolas, timer e sessões |
| `som-cuckoo.mp3` | Som tocado quando o timer termina |

Ajustes rápidos dentro de `index.html`: `DURACAO_ACOMODACAO` (tempo até as bolas pararem),
as forças em `simular()` e as cores da contagem em `CORES`.
