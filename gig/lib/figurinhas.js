// Pacote de figurinhas do GLean, desenhado em SVG (não ocupa o banco: a
// mensagem guarda só a chave). Cada figurinha é um "adesivo" com contorno
// branco, um emoji grande e uma frase do dia a dia do grupo.
import { svgIcone } from "./marca.js";

export const PACOTE_GLEAN = [
  { chave: "kaizen", emoji: "🚀", texto: "Kaizen!", cor: "#2e8bc0" },
  { chave: "bom-dia", emoji: "☀️", texto: "Bom dia, GLean!", cor: "#f2a516" },
  { chave: "ddl", emoji: "⏰", texto: "DDL é hoje!", cor: "#e2483d" },
  { chave: "feito", emoji: "✅", texto: "Feito!", cor: "#2fa36b" },
  { chave: "pdca", emoji: "🔄", texto: "PDCA", cor: "#123a5c" },
  { chave: "gemba", emoji: "👷", texto: "Vai pro Gemba!", cor: "#e8a317" },
  { chave: "porques", emoji: "🤔", texto: "5 porquês?", cor: "#7b61ff" },
  { chave: "muda", emoji: "🗑️", texto: "Isso é muda!", cor: "#8a6d5a" },
  { chave: "hansei", emoji: "🧘", texto: "Hansei", cor: "#14a3a3" },
  { chave: "junto", emoji: "🤝", texto: "Tamo junto", cor: "#1f6a9a" },
  { chave: "valeu", emoji: "🙏", texto: "Valeu!", cor: "#e8618c" },
  { chave: "reuniao", emoji: "📅", texto: "Reunião?", cor: "#3c7dd9" },
  { chave: "bora", emoji: "💪", texto: "Bora!", cor: "#d9661f" },
  { chave: "parabens", emoji: "🎉", texto: "Parabéns!", cor: "#c2399b" },
  { chave: "cafe", emoji: "☕", texto: "Pausa pro café", cor: "#6b4a35" },
  { chave: "gig", emoji: "", texto: "Preenche o GIG!", cor: "#123a5c", logo: true },
];

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

function desenhar(f) {
  const tam = f.texto.length > 12 ? 25 : f.texto.length > 8 ? 30 : 36;
  const centro = f.logo
    ? `<g transform="translate(70 42) scale(1.8)">${svgIcone({ variante: "cor", id: "fg" }).replace(/<svg[^>]*>/, "").replace("</svg>", "")}</g>`
    : `<text x="128" y="132" font-size="96" text-anchor="middle" font-family="Segoe UI Emoji, Apple Color Emoji, Noto Color Emoji, sans-serif">${f.emoji}</text>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256">
  <defs><filter id="s" x="-10%" y="-10%" width="120%" height="130%"><feDropShadow dx="0" dy="4" stdDeviation="4" flood-opacity=".28"/></filter></defs>
  <g filter="url(#s)">
    <circle cx="128" cy="104" r="86" fill="#fff"/>
    <circle cx="128" cy="104" r="76" fill="${f.cor}" opacity=".16"/>
    <rect x="18" y="168" width="220" height="64" rx="32" fill="#fff"/>
    <rect x="26" y="176" width="204" height="48" rx="24" fill="${f.cor}"/>
  </g>
  ${centro}
  <text x="128" y="${200 + tam * 0.36}" font-size="${tam}" font-weight="800" text-anchor="middle" fill="#fff"
        font-family="Montserrat, Segoe UI, Arial, sans-serif">${esc(f.texto)}</text>
</svg>`;
}

const prontas = new Map();
export function figurinhaDoPacote(chave) {
  if (!prontas.has(chave)) {
    const f = PACOTE_GLEAN.find((x) => x.chave === chave);
    prontas.set(chave, f ? "data:image/svg+xml;charset=utf-8," + encodeURIComponent(desenhar(f)) : "");
  }
  return prontas.get(chave);
}
