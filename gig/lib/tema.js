// Modo claro/escuro. A preferência fica neste navegador (localStorage):
// "claro", "escuro" ou "sistema" (segue o Windows/celular). O index.html
// aplica o tema antes de desenhar a página, para não piscar branco.
import { reactive } from "vue";

const CHAVE = "gig-tema";
const midia = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;

function lerPreferencia() {
  try { return localStorage.getItem(CHAVE) || "sistema"; } catch { return "sistema"; }
}

export const tema = reactive({ preferencia: lerPreferencia(), efetivo: "claro" });

function aplicar() {
  tema.efetivo = tema.preferencia === "sistema" ? (midia && midia.matches ? "escuro" : "claro") : tema.preferencia;
  document.documentElement.dataset.tema = tema.efetivo;
  const cor = document.querySelector('meta[name="theme-color"]');
  if (cor) cor.content = tema.efetivo === "escuro" ? "#0b141d" : "#123a5c";
}

export function definirTema(preferencia) {
  tema.preferencia = preferencia;
  try { localStorage.setItem(CHAVE, preferencia); } catch {}
  aplicar();
}

export const alternarTema = () => definirTema(tema.efetivo === "escuro" ? "claro" : "escuro");

if (midia && midia.addEventListener) midia.addEventListener("change", () => { if (tema.preferencia === "sistema") aplicar(); });
aplicar();
