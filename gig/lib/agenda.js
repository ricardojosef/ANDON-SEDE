// Google Agenda direto do navegador, sem servidor: o Google Identity Services
// entrega um token de acesso (válido por ~1h) para a conta @glean.ufsc.br de
// quem está usando, e as chamadas vão para a Calendar API v3 com esse token.
import { reactive } from "vue";
import { store } from "./store.js";
import { DOMINIO } from "./firebase.js";
import { paraISO, deISO } from "./util.js";

const API = "https://www.googleapis.com/calendar/v3";
// Criar/editar eventos em qualquer agenda a que a pessoa tenha acesso, e
// listar as agendas dela (pessoal, do grupo, de processos…).
const ESCOPOS = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.calendarlist.readonly",
].join(" ");
export const FUSO = "America/Sao_Paulo";
const CHAVE_TOKEN = "gig-agenda-token";

export const agenda = reactive({ conectado: false, conectando: false, erro: "" });

let token = "";
let expiraEm = 0;

// O token dura uma hora; guardá-lo na sessão evita pedir de novo a cada
// recarga da página dentro desse tempo.
(function restaurar() {
  try {
    const salvo = JSON.parse(sessionStorage.getItem(CHAVE_TOKEN) || "null");
    if (salvo && salvo.expiraEm > Date.now()) {
      token = salvo.token; expiraEm = salvo.expiraEm; agenda.conectado = true;
    }
  } catch {}
})();

export const clientId = () => (store.configAgenda && store.configAgenda.clientId) || "";

function carregarGis() {
  if (window.google && window.google.accounts && window.google.accounts.oauth2) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Não foi possível carregar o login do Google."));
    document.head.appendChild(s);
  });
}

// Precisa ser chamado a partir de um clique: o Google abre uma janelinha.
export async function conectar() {
  if (!clientId()) throw new Error("A liderança ainda não configurou o Client ID do Google.");
  agenda.conectando = true; agenda.erro = "";
  try {
    await carregarGis();
    await new Promise((resolve, reject) => {
      const cliente = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId(),
        scope: ESCOPOS,
        hint: store.user && store.user.email,
        hosted_domain: DOMINIO,
        callback: (r) => {
          if (r.error) { reject(new Error(r.error_description || r.error)); return; }
          token = r.access_token;
          expiraEm = Date.now() + (Number(r.expires_in || 3600) - 60) * 1000;
          try { sessionStorage.setItem(CHAVE_TOKEN, JSON.stringify({ token, expiraEm })); } catch {}
          agenda.conectado = true;
          resolve();
        },
        error_callback: (e) => reject(new Error(e && e.type === "popup_closed" ? "Janela do Google fechada." : (e && e.message) || "Falha ao conectar.")),
      });
      cliente.requestAccessToken({ prompt: "" });
    });
  } catch (err) {
    agenda.erro = err.message;
    throw err;
  } finally {
    agenda.conectando = false;
  }
}

export function desconectar() {
  if (token && window.google && window.google.accounts) window.google.accounts.oauth2.revoke(token, () => {});
  token = ""; expiraEm = 0; agenda.conectado = false;
  try { sessionStorage.removeItem(CHAVE_TOKEN); } catch {}
}

async function api(caminho, { metodo = "GET", corpo, params } = {}) {
  if (!token || Date.now() > expiraEm) {
    agenda.conectado = false;
    throw new Error("A conexão com o Google Agenda expirou. Clique em “Conectar” de novo.");
  }
  const url = new URL(API + caminho);
  for (const [k, v] of Object.entries(params || {})) if (v != null && v !== "") url.searchParams.set(k, v);
  const r = await fetch(url, {
    method: metodo,
    headers: { Authorization: "Bearer " + token, ...(corpo ? { "Content-Type": "application/json" } : {}) },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  if (r.status === 401) { desconectar(); throw new Error("A conexão com o Google Agenda expirou. Conecte de novo."); }
  if (r.status === 204) return null;
  const dados = await r.json().catch(() => ({}));
  if (!r.ok) {
    const msg = (dados.error && dados.error.message) || `Erro ${r.status}`;
    if (r.status === 403 && /has not been used|disabled/i.test(msg)) throw new Error("A Google Calendar API não está ativada no projeto do Google Cloud.");
    throw new Error(msg);
  }
  return dados;
}

const enc = encodeURIComponent;

export async function listarAgendas() {
  const r = await api("/users/me/calendarList", { params: { maxResults: 250 } });
  return (r.items || []).map((c) => ({
    id: c.id, nome: c.summaryOverride || c.summary, cor: c.backgroundColor || "#2e8bc0",
    primaria: Boolean(c.primary), papel: c.accessRole,
    podeEditar: ["writer", "owner"].includes(c.accessRole),
  }));
}

export async function listarEventos(agendaId, inicioISO, fimISO) {
  const itens = [];
  let pageToken;
  do {
    const r = await api(`/calendars/${enc(agendaId)}/events`, {
      params: {
        timeMin: deISO(inicioISO).toISOString(), timeMax: deISO(fimISO).toISOString(),
        singleEvents: "true", orderBy: "startTime", maxResults: 250, timeZone: FUSO, pageToken,
      },
    });
    itens.push(...(r.items || []));
    pageToken = r.nextPageToken;
  } while (pageToken);
  return itens.filter((e) => e.status !== "cancelled");
}

export function criarEvento(agendaId, evento, { meet = false, notificar = true } = {}) {
  const corpo = { ...evento };
  if (meet) {
    corpo.conferenceData = {
      createRequest: { requestId: "gig-" + Date.now() + Math.random().toString(36).slice(2), conferenceSolutionKey: { type: "hangoutsMeet" } },
    };
  }
  return api(`/calendars/${enc(agendaId)}/events`, {
    metodo: "POST", corpo,
    params: { conferenceDataVersion: meet ? 1 : 0, sendUpdates: notificar ? "all" : "none" },
  });
}

export function atualizarEvento(agendaId, eventoId, mudancas, { meet = false, notificar = true } = {}) {
  const corpo = { ...mudancas };
  if (meet) {
    corpo.conferenceData = {
      createRequest: { requestId: "gig-" + Date.now() + Math.random().toString(36).slice(2), conferenceSolutionKey: { type: "hangoutsMeet" } },
    };
  }
  return api(`/calendars/${enc(agendaId)}/events/${enc(eventoId)}`, {
    metodo: "PATCH", corpo,
    params: { conferenceDataVersion: meet ? 1 : 0, sendUpdates: notificar ? "all" : "none" },
  });
}

export function excluirEvento(agendaId, eventoId, { notificar = true } = {}) {
  return api(`/calendars/${enc(agendaId)}/events/${enc(eventoId)}`, {
    metodo: "DELETE", params: { sendUpdates: notificar ? "all" : "none" },
  });
}

export function lerEvento(agendaId, eventoId) {
  return api(`/calendars/${enc(agendaId)}/events/${enc(eventoId)}`);
}

// ---------------------------------------------------------------------------
// Conversões entre o evento do Google e o formulário da plataforma
// ---------------------------------------------------------------------------
const dois = (n) => String(n).padStart(2, "0");
const horaDe = (d) => `${dois(d.getHours())}:${dois(d.getMinutes())}`;

// Início/fim como Date locais, e se é de dia inteiro.
export function tempoDoEvento(e) {
  if (e.start && e.start.date) {
    return { diaInteiro: true, inicio: deISO(e.start.date), fim: deISO(e.end.date) };
  }
  return { diaInteiro: false, inicio: new Date(e.start.dateTime), fim: new Date(e.end.dateTime) };
}

export function rotuloHorario(e) {
  const t = tempoDoEvento(e);
  return t.diaInteiro ? "dia inteiro" : `${horaDe(t.inicio)} – ${horaDe(t.fim)}`;
}

export const dataDoEvento = (e) => paraISO(tempoDoEvento(e).inicio);

export const linkMeet = (e) =>
  e.hangoutLink || ((e.conferenceData && e.conferenceData.entryPoints) || []).find((p) => p.entryPointType === "video")?.uri || "";

export function formDoEvento(e) {
  const t = tempoDoEvento(e);
  const fimDia = t.diaInteiro ? new Date(t.fim.getTime() - 86400000) : t.fim;
  return {
    titulo: e.summary || "", local: e.location || "", descricao: e.description || "",
    data: paraISO(t.inicio), dataFim: paraISO(fimDia),
    inicio: t.diaInteiro ? "09:00" : horaDe(t.inicio), fim: t.diaInteiro ? "10:00" : horaDe(t.fim),
    diaInteiro: t.diaInteiro,
    convidados: (e.attendees || []).filter((a) => !a.resource).map((a) => a.email.toLowerCase()),
    meet: Boolean(linkMeet(e)),
  };
}

export function eventoDoForm(f) {
  const proximo = (iso) => { const d = deISO(iso); d.setDate(d.getDate() + 1); return paraISO(d); };
  const evento = {
    summary: f.titulo.trim(),
    location: f.local || "",
    description: f.descricao || "",
    attendees: (f.convidados || []).map((email) => ({ email })),
  };
  if (f.diaInteiro) {
    evento.start = { date: f.data };
    evento.end = { date: proximo(f.dataFim && f.dataFim >= f.data ? f.dataFim : f.data) };
  } else {
    evento.start = { dateTime: `${f.data}T${f.inicio}:00`, timeZone: FUSO };
    evento.end = { dateTime: `${f.data}T${f.fim}:00`, timeZone: FUSO };
  }
  return evento;
}

// Linha acrescentada à descrição do evento quando uma ata é vinculada, para
// quem abre direto no Google Agenda chegar à ata.
export const linkDaAta = (ataId) => `${location.origin}${location.pathname}#/atas/${ataId}`;
export function descricaoComAta(descricao, ataId) {
  const linha = `📄 Ata no GIG: ${linkDaAta(ataId)}`;
  const base = String(descricao || "").replace(/\n*📄 Ata no GIG: \S+/g, "").trim();
  return base ? `${base}\n\n${linha}` : linha;
}
