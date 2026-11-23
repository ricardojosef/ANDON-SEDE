// Estado compartilhado entre as telas: usuário logado, seu cadastro e os
// catálogos (membros, processos, atividades, semestres, configurações).
// Tudo chega por onSnapshot, então uma mudança feita pela liderança aparece
// em todas as telas abertas.
import { reactive } from "vue";
import { db, collection, doc, onSnapshot, comId, query, where } from "./firebase.js";
import { CONFIG_QUEDAS_PADRAO } from "./id.js";
import { semanaAtual, idSemana } from "./semana.js";

export const store = reactive({
  pronto: false,        // já sabemos se há alguém logado?
  user: null,           // usuário do Firebase Auth
  membro: null,         // documento membros/{uid}
  erroLogin: "",
  membros: [],
  processos: [],
  atividades: [],
  semestres: [],
  configQuedas: CONFIG_QUEDAS_PADRAO,
  configQuedasExiste: false,
  configClima: {},
  configAgenda: {},     // { clientId, agendaGrupo } — integração com o Google Agenda
  ddls: [],             // DDLs do tipo tarefa (ddls/{id})
  formularios: [],      // formulários (os com prazo também são DDLs)
  climaDaSemana: null,  // a pesquisinha desta semana do usuário (null = não respondida)
  conversas: [],        // chat: conversas de que o usuário participa (mais recente primeiro)
  figurinhas: [],       // chat: figurinhas criadas pelos membros
});

// Derivados simples, usados em várias telas.
export const membrosAtivos = () =>
  store.membros.filter((m) => m.ativo !== false).sort((a, b) => (a.nome || "").localeCompare(b.nome || ""));
export const semestreAtivo = () => store.semestres.find((s) => s.ativo) || null;
export const nomeDoMembro = (uid) => (store.membros.find((m) => m.id === uid) || {}).nome || "—";
export const ehLider = () => Boolean(store.membro && store.membro.papel === "lider");
export const ehGestao = () => Boolean(store.membro && ["lider", "gp"].includes(store.membro.papel));
export const processosDoMembro = (m = store.membro) =>
  ((m && m.cargos) || []).map((c) => c.processo).filter(Boolean);

let desligar = [];
let desligarClima = null;
let climaAtual = "";

// A pesquisinha é DDL de quinta; acompanhar o documento da semana atual deixa
// o contador de DDLs certo sem consultas extras. Chamado quando o semestre
// muda e periodicamente (a semana vira com a página aberta).
export function acompanharClimaDaSemana() {
  const sem = store.semestres.find((s) => s.ativo);
  const uid = store.membro && store.membro.id;
  const id = sem && uid ? idSemana(sem.id, semanaAtual(sem), uid) : "";
  if (id === climaAtual) return;
  if (desligarClima) desligarClima();
  climaAtual = id; desligarClima = null; store.climaDaSemana = null;
  if (!id) return;
  desligarClima = onSnapshot(doc(db, "clima", id),
    (s) => { store.climaDaSemana = s.exists() ? s.data() : null; },
    (err) => console.error("snapshot clima", err));
}

export function iniciarStore(uid) {
  pararStore({ manterMembro: true }); // o cadastro já foi lido no login; não some enquanto o snapshot chega
  const escuta = (ref, aoMudar) =>
    desligar.push(onSnapshot(ref, aoMudar, (err) => console.error("snapshot", err)));

  escuta(doc(db, "membros", uid), (s) => { if (s.exists()) store.membro = comId(s); });
  escuta(collection(db, "membros"), (s) => { store.membros = s.docs.map(comId); });
  escuta(collection(db, "processos"), (s) => {
    store.processos = s.docs.map(comId).sort((a, b) => a.nome.localeCompare(b.nome));
  });
  escuta(collection(db, "atividades"), (s) => {
    store.atividades = s.docs.map(comId).sort((a, b) => a.nome.localeCompare(b.nome));
  });
  escuta(collection(db, "semestres"), (s) => {
    store.semestres = s.docs.map(comId).sort((a, b) => b.id.localeCompare(a.id));
    acompanharClimaDaSemana();
  });
  escuta(collection(db, "ddls"), (s) => { store.ddls = s.docs.map(comId); });
  escuta(collection(db, "formularios"), (s) => {
    store.formularios = s.docs.map(comId).sort((a, b) => (b.criadoEmISO || "").localeCompare(a.criadoEmISO || ""));
  });
  // chat: só as conversas de que a pessoa participa (as regras exigem esse filtro)
  escuta(query(collection(db, "conversas"), where("membros", "array-contains", uid)), (s) => {
    store.conversas = s.docs.map(comId).sort((a, b) => (b.atualizadoEm || "").localeCompare(a.atualizadoEm || ""));
  });
  escuta(collection(db, "figurinhas"), (s) => {
    store.figurinhas = s.docs.map(comId).sort((a, b) => (b.criadoEmISO || "").localeCompare(a.criadoEmISO || ""));
  });
  escuta(doc(db, "config", "quedas"), (s) => {
    store.configQuedasExiste = s.exists();
    store.configQuedas = s.exists() ? { ...CONFIG_QUEDAS_PADRAO, ...s.data() } : CONFIG_QUEDAS_PADRAO;
  });
  escuta(doc(db, "config", "clima"), (s) => { store.configClima = s.exists() ? s.data() : {}; });
  escuta(doc(db, "config", "agenda"), (s) => { store.configAgenda = s.exists() ? s.data() : {}; });
}

export function pararStore({ manterMembro = false } = {}) {
  desligar.forEach((f) => f());
  desligar = [];
  if (desligarClima) desligarClima();
  desligarClima = null; climaAtual = ""; store.climaDaSemana = null;
  store.ddls = []; store.formularios = []; store.conversas = []; store.figurinhas = [];
  if (!manterMembro) store.membro = null;
  store.membros = []; store.processos = []; store.atividades = []; store.semestres = [];
}
