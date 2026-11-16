// Vocabulário fixo da plataforma (o que não muda de semestre para semestre).

export const TIPOS = [
  { id: "gerais", nome: "Gerais e Estratégicas", curto: "Gerais" },
  { id: "capacitacao", nome: "Capacitação Teórica", curto: "Capacitação" },
  { id: "processos", nome: "Processos", curto: "Processos" },
  { id: "projetos", nome: "Projetos Práticos", curto: "Projetos" },
];
export const nomeTipo = (id) => (TIPOS.find((t) => t.id === id) || {}).nome || id;

// Feeling de sobrecarga da semana: cor + motivo (aba "Auxiliar Sobrecarga" do GIG).
export const FEELINGS = [
  { cor: "azul", nome: "Disponível para ajudar", motivos: ["Disponível para ajudar"] },
  { cor: "verde", nome: "Dentro do esperado", motivos: ["Dentro do esperado"] },
  { cor: "amarelo", nome: "Sobrecarregado", motivos: ["Motivo: GLean", "Motivo: Graduação", "Motivo: pessoal", "Motivo: outros"] },
  { cor: "vermelho", nome: "SOS", motivos: ["Motivo: GLean + outro motivo", "Motivo: GLean + graduação", "Motivo: outros"] },
];

export const PAPEIS = [
  { id: "membro", nome: "Membro" },
  { id: "gp", nome: "Gestão de Pessoas" },
  { id: "lider", nome: "Liderança" },
];
export const nomePapel = (id) => (PAPEIS.find((p) => p.id === id) || {}).nome || id;

export const MODULOS_PADRAO = ["M1", "M2", "M3", "M4", "Estagiário"];

export const STATUS_ENC = [
  { id: "aberto", nome: "Aberto" },
  { id: "andamento", nome: "Em andamento" },
  { id: "concluido", nome: "Concluído" },
  { id: "cancelado", nome: "Cancelado" },
];
export const nomeStatus = (id) => (STATUS_ENC.find((s) => s.id === id) || {}).nome || id;

export const TIPOS_ATA = ["Reunião Geral", "Processo", "Treinamento", "Projeto", "Outro"];
