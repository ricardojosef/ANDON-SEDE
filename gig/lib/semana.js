// Semana do semestre a partir da data de início (segunda-feira da semana 1).
import { deISO, hojeISO, somarDias } from "./util.js";

export function semanaAtual(semestre, hoje = hojeISO()) {
  if (!semestre || !semestre.inicio) return 1;
  const dias = Math.round((deISO(hoje) - deISO(semestre.inicio)) / 86400000);
  const n = Math.floor(dias / 7) + 1;
  return Math.max(1, Math.min(semestre.semanas || 15, n));
}

export function datasDaSemana(semestre, n) {
  if (!semestre || !semestre.inicio) return { inicio: "", fim: "" };
  const inicio = somarDias(semestre.inicio, (n - 1) * 7);
  return { inicio, fim: somarDias(inicio, 4) };
}

export const listaSemanas = (semestre) =>
  Array.from({ length: (semestre && semestre.semanas) || 15 }, (_, i) => i + 1);

// Id dos documentos "um por membro-semana" (gig e clima).
export const idSemana = (semestreId, semana, uid) => `${semestreId}_${semana}_${uid}`;
