// Lembretes de DDL. Sem servidor (o plano gratuito do Firebase não agenda
// tarefas), os avisos vêm da própria página:
//   - faixa no topo de todas as telas quando há DDL vencendo hoje ou atrasada;
//   - notificação do navegador de manhã (a partir das 9h) e à noite (a partir
//     das 18h) nos dias com DDL — terça e quinta, ou um prazo excepcional —
//     enquanto a plataforma estiver aberta em alguma aba.
// Quem quer aviso com a plataforma fechada usa o convite no Google Agenda,
// que a tela de DDLs pode criar junto com a DDL.
import { reactive } from "vue";
import { ddlsPendentes, passou } from "./ddl.js";
import { acompanharClimaDaSemana } from "./store.js";
import { hojeISO } from "./util.js";

const suporta = typeof window !== "undefined" && "Notification" in window;
const CHAVE_DISPENSA = "gig-aviso-ddl-dispensado";

export const lembretes = reactive({
  permissao: suporta ? Notification.permission : "indisponivel",
  dispensadoEm: lerLocal(CHAVE_DISPENSA),
  agora: Date.now(),
});

function lerLocal(chave) { try { return localStorage.getItem(chave) || ""; } catch { return ""; } }
function gravarLocal(chave, v) { try { localStorage.setItem(chave, v); } catch {} }

export const ehDiaDeDdl = (d = new Date()) => d.getDay() === 2 || d.getDay() === 4;
export const vencemHoje = () => ddlsPendentes().filter((d) => d.prazo && d.prazo.startsWith(hojeISO()) && !passou(d.prazo));
export const atrasadas = () => ddlsPendentes().filter((d) => passou(d.prazo));

export async function pedirPermissao() {
  if (!suporta) return "indisponivel";
  lembretes.permissao = await Notification.requestPermission();
  if (lembretes.permissao === "granted") notificar("Notificações ligadas", "Você será avisado nos dias de DDL enquanto o GIG estiver aberto.");
  return lembretes.permissao;
}

function notificar(titulo, corpo) {
  if (!suporta || Notification.permission !== "granted") return;
  const n = new Notification(titulo, { body: corpo, icon: "../assets/marca/favicon_glean.png", tag: "gig-ddl" });
  n.onclick = () => { window.focus(); location.hash = "#/ddls"; n.close(); };
}

export function dispensarAviso() {
  lembretes.dispensadoEm = hojeISO();
  gravarLocal(CHAVE_DISPENSA, lembretes.dispensadoEm);
}

function verificar() {
  lembretes.agora = Date.now();
  acompanharClimaDaSemana();
  const hora = new Date().getHours();
  const periodo = hora >= 18 ? "noite" : hora >= 9 ? "manha" : "";
  if (!periodo) return;
  const lista = vencemHoje();
  if (!lista.length) return;
  // uma notificação por período e por dia, mesmo com várias abas abertas
  const chave = `gig-lembrete-${hojeISO()}-${periodo}`;
  if (lerLocal(chave)) return;
  gravarLocal(chave, "1");
  const titulo = lista.length === 1 ? "1 DDL vence hoje" : `${lista.length} DDLs vencem hoje`;
  notificar(titulo, lista.slice(0, 4).map((d) => `• ${d.titulo} (${d.prazo.split("T")[1]})`).join("\n"));
}

let relogio = null;
export function iniciarLembretes() {
  if (relogio) return;
  verificar();
  relogio = setInterval(verificar, 60000);
}
