// DDLs (deadlines): entregas com prazo em terça ou quinta às 23:59, ou num
// dia/hora "excepcional". Três origens aparecem juntas para cada membro:
//   - ddls/{id} do tipo "tarefa", marcadas como feitas pelo próprio membro;
//   - formulários com prazo (feito = respondido);
//   - a pesquisinha da semana, que é sempre DDL de quinta (feito = respondida).
import { store, membrosAtivos, semestreAtivo } from "./store.js";
import { semanaAtual, datasDaSemana } from "./semana.js";
import { hojeISO, somarDias, deISO, paraISO, formatarData } from "./util.js";

export const HORA_PADRAO = "23:59";
export const CATEGORIAS = [
  { id: "terca", nome: "Terça" },
  { id: "quinta", nome: "Quinta" },
  { id: "excepcional", nome: "Excepcional" },
];
const DIA_SEMANA = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

// Próximas datas de um dia da semana (2 = terça, 4 = quinta), a partir de hoje.
export function proximas(diaDaSemana, quantas = 3, aPartirDe = hojeISO()) {
  const datas = [];
  let d = deISO(aPartirDe);
  while (datas.length < quantas) {
    if (d.getDay() === diaDaSemana) datas.push(paraISO(d));
    d.setDate(d.getDate() + 1);
  }
  return datas;
}

export const prazoDe = (data, hora = HORA_PADRAO) => `${data}T${hora || HORA_PADRAO}`;
export const instante = (prazo) => new Date(prazo).getTime();
export const passou = (prazo) => Boolean(prazo) && instante(prazo) < Date.now();

export function rotuloPrazo(prazo) {
  if (!prazo) return "sem prazo";
  const [data, hora] = prazo.split("T");
  const d = deISO(data);
  const hoje = hojeISO();
  const dia = data === hoje ? "hoje" : data === somarDias(hoje, 1) ? "amanhã" : `${DIA_SEMANA[d.getDay()]}, ${formatarData(data)}`;
  return `${dia} às ${hora}`;
}

// "vence em 2 dias", "vence hoje às 23:59", "atrasada"
export function situacaoPrazo(prazo) {
  if (!prazo) return { texto: "sem prazo", classe: "" };
  const ms = instante(prazo) - Date.now();
  if (ms < 0) return { texto: "atrasada", classe: "atrasado" };
  const data = prazo.split("T")[0];
  if (data === hojeISO()) return { texto: `vence hoje às ${prazo.split("T")[1]}`, classe: "hoje" };
  const dias = Math.round((deISO(data) - deISO(hojeISO())) / 86400000);
  return { texto: dias === 1 ? "vence amanhã" : `vence em ${dias} dias`, classe: "" };
}

export function categoriaDoPrazo(data) {
  const dia = deISO(data).getDay();
  return dia === 2 ? "terca" : dia === 4 ? "quinta" : "excepcional";
}

// ---------------------------------------------------------------------------
// Destinatários: todos os membros ativos ou um grupo (módulos, processos,
// pessoas). O grupo é resolvido na hora de salvar; "todos" vale para quem
// entrar depois também.
// ---------------------------------------------------------------------------
export function resolverDestinatarios(publico) {
  if (!publico || publico.tipo === "todos") return membrosAtivos().map((m) => m.id);
  const ids = new Set(publico.pessoas || []);
  for (const m of membrosAtivos()) {
    if ((publico.modulos || []).includes(m.modulo)) ids.add(m.id);
    if ((m.cargos || []).some((c) => (publico.processos || []).includes(c.processo))) ids.add(m.id);
  }
  return [...ids];
}

export function ehDestinatario(doc, uid) {
  if (!doc) return false;
  if (!doc.publico || doc.publico.tipo === "todos") return true;
  return (doc.destinatarios || []).includes(uid);
}

export function rotuloPublico(publico) {
  if (!publico || publico.tipo === "todos") return "Todos os membros";
  const partes = [];
  if ((publico.modulos || []).length) partes.push(publico.modulos.join(", "));
  const nomesProc = (publico.processos || []).map((id) => (store.processos.find((p) => p.id === id) || {}).nome || id);
  if (nomesProc.length) partes.push(nomesProc.join(", "));
  if ((publico.pessoas || []).length) partes.push(`${publico.pessoas.length} pessoa(s)`);
  return partes.join(" · ") || "Grupo";
}

// ---------------------------------------------------------------------------
// Lista unificada das DDLs de um membro
// ---------------------------------------------------------------------------
export function pesquisinhaDaSemana() {
  const sem = semestreAtivo();
  if (!sem) return null;
  const n = semanaAtual(sem);
  const quinta = somarDias(datasDaSemana(sem, n).inicio, 3);
  return {
    id: `pesquisinha-${sem.id}-${n}`, tipo: "pesquisinha", titulo: `Pesquisinha de clima — semana ${n}`,
    descricao: "Formulário semanal de clima do grupo.", prazo: prazoDe(quinta), categoria: "quinta",
    criadoPorNome: "Gestão de Pessoas", link: "/clima", feito: Boolean(store.climaDaSemana),
  };
}

export function ddlsDoMembro(uid = store.membro && store.membro.id) {
  if (!uid) return [];
  const lista = [];
  for (const d of store.ddls) {
    if (!ehDestinatario(d, uid)) continue;
    lista.push({ ...d, tipo: "tarefa", feito: Boolean(d.concluidos && d.concluidos[uid]) });
  }
  for (const f of store.formularios) {
    if (!f.prazo || !ehDestinatario(f, uid)) continue;
    lista.push({
      id: f.id, tipo: "formulario", titulo: f.titulo, descricao: f.descricao, prazo: f.prazo, categoria: f.categoria,
      criadoPor: f.autor, criadoPorNome: f.autorNome, link: `/formularios/${f.id}`,
      feito: Boolean(f.respondentes && f.respondentes[uid]), aberto: f.aberto !== false,
    });
  }
  const p = pesquisinhaDaSemana();
  if (p) lista.push(p);
  return lista.sort((a, b) => (a.prazo || "9999").localeCompare(b.prazo || "9999"));
}

export const ddlsPendentes = (uid) => ddlsDoMembro(uid).filter((d) => !d.feito);
