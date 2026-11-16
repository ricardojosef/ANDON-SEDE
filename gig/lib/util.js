// Utilidades sem dependência: datas em texto ISO (YYYY-MM-DD), números e textos.

export const slug = (s) => String(s || "")
  .normalize("NFD").replace(/[̀-ͯ]/g, "")
  .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

const dois = (n) => String(n).padStart(2, "0");

// Datas são guardadas como "YYYY-MM-DD" (sem fuso) para prazos, início de
// semestre e datas de ata. Estas funções convertem sem passar por UTC.
export function paraISO(d) {
  return d.getFullYear() + "-" + dois(d.getMonth() + 1) + "-" + dois(d.getDate());
}
export function deISO(iso) {
  const [a, m, d] = String(iso).split("-").map(Number);
  return new Date(a, m - 1, d);
}
export const hojeISO = () => paraISO(new Date());
export function somarDias(iso, n) {
  const d = deISO(iso);
  d.setDate(d.getDate() + n);
  return paraISO(d);
}
export function formatarData(iso, longa = false) {
  if (!iso) return "";
  const [a, m, d] = String(iso).split("-");
  return longa ? `${d}/${m}/${a}` : `${d}/${m}`;
}
export function diasAte(iso) {
  const hoje = deISO(hojeISO());
  return Math.round((deISO(iso) - hoje) / 86400000);
}

// "1,5" e "1.5" viram 1.5; vazio vira 0.
export function num(v) {
  const n = Number(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}
export const arred = (n, casas = 2) => Math.round(num(n) * 10 ** casas) / 10 ** casas;
export const fmt = (n, casas = 1) =>
  arred(n, casas).toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: casas });
export function media(valores) {
  const v = valores.map(num).filter((x) => Number.isFinite(x));
  return v.length ? v.reduce((s, x) => s + x, 0) / v.length : 0;
}
export const soma = (valores) => valores.reduce((s, x) => s + num(x), 0);

export const primeiroNome = (nome) => String(nome || "").trim().split(/\s+/)[0] || "";
