// Pesquisinha de clima: estrutura fixa (os textos podem ser ajustados em
// config/clima, mas os ids e a ordem são estes). Escalas vão de 1 a 7.
//
// Cada pergunta: { id, tipo: "escala" | "texto" | "numero", texto, obrigatoria?,
// condicao?(r) } — `condicao` recebe as respostas e diz se a pergunta aparece.

const baixa = (r, ids) => ids.some((id) => r[id] != null && r[id] !== "" && Number(r[id]) <= 5);

export const SECOES = [
  {
    id: "reconhecimento", titulo: "Reconhecimento",
    perguntas: [
      { id: "reconhecimento", tipo: "escala", texto: "O quanto você se sentiu reconhecido(a) nas últimas semanas?" },
      { id: "reconhecimentoPq", tipo: "texto", texto: "Por que você atribuiu essa nota?" },
    ],
  },
  {
    id: "dp", titulo: "Dinâmica dos Parafusos", modulos: ["M1"],
    descricao: "Seção respondida só por M1.",
    perguntas: [
      { id: "dpMotivacao", tipo: "escala", texto: "O quão MOTIVADO(A) você está com a DP?", obrigatoria: true },
      { id: "dpMotivacaoPq", tipo: "texto", texto: "Diga o porquê." },
      { id: "dpNivelamento", tipo: "escala", texto: "Como você avalia o NIVELAMENTO TEÓRICO do grupo de M1s? (Considere se, de forma geral, os M1s estão na mesma página em relação ao conhecimento teórico.)", obrigatoria: true },
      { id: "dpNivelamentoPq", tipo: "texto", texto: "Quais fatores te levaram a dar essa nota?" },
      { id: "dpSinergia", tipo: "escala", texto: "Como você avalia a SINERGIA DA EQUIPE de vocês? (Considere se estão se dando bem e conseguindo trabalhar em equipe. Dificuldades com o grupo ou com alguma pessoa contam.)", obrigatoria: true },
      { id: "dpSinergiaPq", tipo: "texto", texto: "Por que você atribuiu essa nota?" },
      { id: "dpOrganizacao", tipo: "escala", texto: "Como você avalia a ORGANIZAÇÃO DA EQUIPE de vocês? (Cronograma, gestão de encaminhamentos, planejamento e execução das reuniões, capacidade de reorganização diante de imprevistos.)", obrigatoria: true },
      { id: "dpOrganizacaoPq", tipo: "texto", texto: "Por que você atribuiu essa nota?" },
    ],
  },
  {
    id: "semana", titulo: "Sua semana",
    perguntas: [
      { id: "desafio", tipo: "escala", texto: "O quão desafiado(a) você se sentiu nessa semana?", obrigatoria: true },
      { id: "satisfProcesso", tipo: "escala", texto: "Quão satisfeito(a) você está em relação ao processo nessa semana?", obrigatoria: true },
      { id: "satisfCapacitacao", tipo: "escala", texto: "Quão satisfeito(a) você está com a sua capacitação nessa semana?", obrigatoria: true },
      { id: "satisfTempoExtra", tipo: "escala", texto: "Quão satisfeito(a) você está com seu tempo extra GLean nessa semana?", obrigatoria: true },
      { id: "pertencimento", tipo: "escala", texto: "Quão pertencente ao grupo você está se sentindo nessa semana?", obrigatoria: true },
      { id: "motivoBaixo", tipo: "texto", texto: "Você deu nota 5 ou menor a alguma pergunta acima. Qual foi o motivo, na sua visão? (Considere todas as perguntas em que deu nota igual ou inferior a 5.)",
        condicao: (r) => baixa(r, ["desafio", "satisfProcesso", "satisfCapacitacao", "satisfTempoExtra", "pertencimento"]) },
      { id: "sobrecarga", tipo: "escala", texto: "O quanto você se sente sobrecarregado(a) em relação à carga do GLean nessa semana? (Considere a sua sensação, não exatamente a quantidade de horas.)", obrigatoria: true },
      { id: "sobrecargaMotivo", tipo: "texto", texto: "Qual seria o motivo, na sua visão?", condicao: (r) => baixa(r, ["sobrecarga"]) },
      { id: "comentarios", tipo: "texto", texto: "Algo a mais que queira comentar sobre algum dos tópicos acima?" },
      { id: "motivacao", tipo: "escala", texto: "Como estava sua motivação em relação ao grupo nesta semana?", obrigatoria: true },
      { id: "motivacaoPq", tipo: "texto", texto: "Por que você atribuiu essa nota?" },
      { id: "comentariosGerais", tipo: "texto", texto: "Comentários gerais" },
    ],
  },
  {
    id: "feedbacks", titulo: "Feedbacks",
    perguntas: [
      { id: "satisfFeedbacks", tipo: "escala", texto: "Quão satisfeito(a) você está em relação aos feedbacks recebidos nessa semana?" },
      { id: "feedbacksMotivo", tipo: "texto", texto: "Qual seria o motivo, na sua visão?", condicao: (r) => baixa(r, ["satisfFeedbacks"]) },
      { id: "feedbacksComQuem", tipo: "texto", texto: "Com quem você teve ou ainda pretende ter conversas de feedback nesta semana?" },
      { id: "feedbacksQuantas", tipo: "numero", texto: "Quantas conversas de feedback teve ou pretende ter na semana?" },
    ],
  },
  {
    id: "justificativas", titulo: "Canal de justificativas",
    perguntas: [
      { id: "justificativasQualidade", tipo: "escala", texto: "Como você avalia a qualidade e efetividade das justificativas lançadas no canal de justificativas?" },
      { id: "justificativasComentario", tipo: "texto", texto: "Algum comentário sobre o canal de justificativas?" },
    ],
  },
  {
    id: "a3", titulo: "A3 Pessoal",
    perguntas: [
      { id: "satisfA3", tipo: "escala", texto: "Qual sua satisfação com a A3 Pessoal?" },
      { id: "feedbackA3", tipo: "texto", texto: "Feedbacks para a A3 Pessoal (assim podemos melhorar!)" },
    ],
  },
  {
    id: "final", titulo: "Para fechar",
    perguntas: [
      { id: "feedbackFormulario", tipo: "texto", texto: "Feedbacks para este formulário" },
      { id: "feedbackGP", tipo: "texto", texto: "Feedbacks para Gestão de Pessoas" },
    ],
  },
];

export function secoesParaModulo(modulo) {
  return SECOES.filter((s) => !s.modulos || s.modulos.includes(modulo));
}

export function perguntasObrigatorias(modulo) {
  return secoesParaModulo(modulo).flatMap((s) => s.perguntas.filter((p) => p.obrigatoria).map((p) => p.id));
}

export const TODAS_PERGUNTAS = SECOES.flatMap((s) => s.perguntas);
export const textoPergunta = (id) => (TODAS_PERGUNTAS.find((p) => p.id === id) || {}).texto || id;

// Métricas dos dashboards: nome exibido → id da pergunta.
export const METRICAS = [
  { id: "motivacao", nome: "Motivação" },
  { id: "desafio", nome: "Desafio" },
  { id: "satisfTempoExtra", nome: "Tempo extra" },
  { id: "pertencimento", nome: "União" },
  { id: "satisfProcesso", nome: "Processo" },
  { id: "satisfCapacitacao", nome: "Capacitação" },
  { id: "sobrecarga", nome: "Sobrecarga" },
  { id: "reconhecimento", nome: "Reconhecimento" },
];
// "Satisfação geral" = média destas notas ÷ 7 (mesma ideia do KR2 de GP).
export const SATISFACAO_GERAL = ["satisfProcesso", "satisfCapacitacao", "satisfTempoExtra", "pertencimento"];

export const JUSTIFICATIVAS = [
  { id: "motivacaoPq", nome: "Motivação" },
  { id: "motivoBaixo", nome: "Satisfação" },
  { id: "sobrecargaMotivo", nome: "Sobrecarga" },
  { id: "reconhecimentoPq", nome: "Reconhecimento" },
  { id: "comentariosGerais", nome: "Comentários gerais" },
];
