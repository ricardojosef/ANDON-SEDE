// Tipos de pergunta do criador de formulários e utilidades de respostas.

export const TIPOS_PERGUNTA = [
  { id: "curta", nome: "Resposta curta" },
  { id: "paragrafo", nome: "Parágrafo" },
  { id: "multipla", nome: "Múltipla escolha" },
  { id: "caixas", nome: "Caixas de seleção" },
  { id: "lista", nome: "Lista suspensa" },
  { id: "escala", nome: "Escala linear" },
  { id: "numero", nome: "Número" },
  { id: "data", nome: "Data" },
];
export const nomeTipoPergunta = (id) => (TIPOS_PERGUNTA.find((t) => t.id === id) || {}).nome || id;
export const temOpcoes = (tipo) => ["multipla", "caixas", "lista"].includes(tipo);

const novoId = () => "p" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

export function novaPergunta(tipo = "multipla") {
  return {
    id: novoId(), tipo, texto: "", obrigatoria: false,
    opcoes: temOpcoes(tipo) ? ["Opção 1"] : [],
    min: 1, max: 5, rotuloMin: "", rotuloMax: "",
  };
}

export const duplicarPergunta = (p) => ({ ...JSON.parse(JSON.stringify(p)), id: novoId() });

export function respostaVazia(p, r) {
  const v = r[p.id];
  if (p.tipo === "caixas") return !Array.isArray(v) || !v.length;
  return v == null || String(v).trim() === "";
}

export function textoResposta(p, v) {
  if (v == null || v === "") return "";
  if (Array.isArray(v)) return v.join("; ");
  return String(v);
}

// Resumo por pergunta para a tela de respostas.
export function resumir(p, respostas) {
  const valores = respostas.map((r) => r.r && r.r[p.id]).filter((v) => !(v == null || v === "" || (Array.isArray(v) && !v.length)));
  if (temOpcoes(p.tipo)) {
    const contagem = Object.fromEntries((p.opcoes || []).map((o) => [o, 0]));
    for (const v of valores) for (const o of Array.isArray(v) ? v : [v]) contagem[o] = (contagem[o] || 0) + 1;
    return { tipo: "contagem", total: valores.length, itens: Object.entries(contagem).map(([opcao, n]) => ({ opcao, n })) };
  }
  if (p.tipo === "escala" || p.tipo === "numero") {
    const nums = valores.map(Number).filter((n) => Number.isFinite(n));
    const media = nums.length ? nums.reduce((s, n) => s + n, 0) / nums.length : 0;
    if (p.tipo === "escala") {
      const itens = [];
      for (let v = Number(p.min); v <= Number(p.max); v++) itens.push({ opcao: String(v), n: nums.filter((n) => n === v).length });
      return { tipo: "contagem", total: nums.length, media, itens };
    }
    return { tipo: "numeros", total: nums.length, media };
  }
  return { tipo: "textos", total: valores.length, textos: valores.map(String) };
}

export function csvDasRespostas(form, respostas) {
  const esc = (s) => `"${String(s ?? "").replace(/"/g, '""')}"`;
  const cab = ["Nome", "Respondido em", ...form.perguntas.map((p) => p.texto || "(sem título)")];
  const linhas = respostas.map((r) => [
    r.nome, r.emTexto || "",
    ...form.perguntas.map((p) => textoResposta(p, r.r && r.r[p.id])),
  ]);
  return "﻿" + [cab, ...linhas].map((l) => l.map(esc).join(";")).join("\r\n");
}
