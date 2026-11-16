// Estado compartilhado entre as telas: usuário logado, seu cadastro e os
// catálogos (membros, processos, atividades, semestres, configurações).
// Tudo chega por onSnapshot, então uma mudança feita pela liderança aparece
// em todas as telas abertas.
import { reactive } from "vue";
import { db, collection, doc, onSnapshot, comId } from "./firebase.js";
import { CONFIG_QUEDAS_PADRAO } from "./id.js";

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
  configClima: {},
  configAgenda: {},     // { clientId, agendaGrupo } — integração com o Google Agenda
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

export function iniciarStore(uid) {
  pararStore();
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
  });
  escuta(doc(db, "config", "quedas"), (s) => {
    store.configQuedas = s.exists() ? { ...CONFIG_QUEDAS_PADRAO, ...s.data() } : CONFIG_QUEDAS_PADRAO;
  });
  escuta(doc(db, "config", "clima"), (s) => { store.configClima = s.exists() ? s.data() : {}; });
  escuta(doc(db, "config", "agenda"), (s) => { store.configAgenda = s.exists() ? s.data() : {}; });
}

export function pararStore() {
  desligar.forEach((f) => f());
  desligar = [];
  store.membro = null;
  store.membros = []; store.processos = []; store.atividades = []; store.semestres = [];
}
