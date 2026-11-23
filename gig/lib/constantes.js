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

// Cores dos cargos: cada processo·cargo tem uma cor fixa (a mesma em todas as
// telas) e, na lista de um membro, nunca se repete.
export const PALETA_CARGOS = [
  { fundo: "#dbeafe", texto: "#1e3a8a" }, { fundo: "#dcfce7", texto: "#14532d" },
  { fundo: "#fef3c7", texto: "#78350f" }, { fundo: "#fce7f3", texto: "#831843" },
  { fundo: "#ede9fe", texto: "#4c1d95" }, { fundo: "#ffedd5", texto: "#7c2d12" },
  { fundo: "#cffafe", texto: "#164e63" }, { fundo: "#fee2e2", texto: "#7f1d1d" },
  { fundo: "#ecfccb", texto: "#365314" }, { fundo: "#e0e7ff", texto: "#312e81" },
  { fundo: "#ccfbf1", texto: "#134e4a" }, { fundo: "#fae8ff", texto: "#701a75" },
  { fundo: "#f1f5f9", texto: "#334155" }, { fundo: "#fef9c3", texto: "#713f12" },
];
const hashTexto = (s) => [...String(s)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
// Cargos conhecidos têm cor fixa; os demais recebem uma cor pelo nome.
const COR_FIXA = { "shusa": 0, "big-shusa": 5, "shusee": 1, "lider geral": 7, "vice lideranca": 4, "lider": 7 };
const normalizar = (s) => String(s || "").normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim();
export function corDoCargo(cargo) {
  const n = normalizar(cargo);
  const i = n in COR_FIXA ? COR_FIXA[n] : hashTexto(n) % PALETA_CARGOS.length;
  const cor = PALETA_CARGOS[i];
  return { background: cor.fundo, color: cor.texto, borderColor: cor.texto + "33" };
}
export const coresDosCargos = (cargos = []) => cargos.map((c) => corDoCargo(c.cargo));
