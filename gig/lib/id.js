// Índice de Desempenho (ID): começa em 1,0 e cada queda desconta a
// porcentagem do motivo. Farol: verde = 1,0; amarelo a partir de `amarelo`;
// vermelho abaixo disso (limites em config/quedas).
import { num } from "./util.js";

export const CONFIG_QUEDAS_PADRAO = {
  motivos: [
    { nome: "Leitura", pct: 0.05 },
    { nome: "Falta em compromissos obrigatórios", pct: 0.1 },
    { nome: "Atraso em compromissos obrigatórios", pct: 0.05 },
    { nome: "Prazos de e-mails e formulários", pct: 0.05 },
    { nome: "Preenchimento do GIG", pct: 0.05 },
    { nome: "Entrega de Processo e DP", pct: 0.1 },
    { nome: "Entrega de trilha de conhecimento", pct: 0.05 },
    { nome: "Dinâmica dos Parafusos", pct: 0.05 },
    { nome: "Entrega de A3 Estratégica", pct: 0.05 },
    { nome: "Atraso/Não realização do 5S", pct: 0.05 },
    { nome: "Outros motivos", pct: 0.05 },
  ],
  farol: { amarelo: 0.9, verde: 1.0 },
};

export function pctDoMotivo(config, motivo) {
  const m = ((config && config.motivos) || []).find((x) => x.nome === motivo);
  return m ? num(m.pct) : 0.05;
}

export function calcularID(quedasDoMembro, config = CONFIG_QUEDAS_PADRAO) {
  const quantidade = quedasDoMembro.reduce((s, q) => s + num(q.quantidade || 1), 0);
  const perda = quedasDoMembro.reduce(
    (s, q) => s + num(q.quantidade || 1) * pctDoMotivo(config, q.motivo), 0);
  const id = Math.max(0, 1 - perda);
  const farol = (config && config.farol) || CONFIG_QUEDAS_PADRAO.farol;
  const cor = id >= num(farol.verde) ? "verde" : id >= num(farol.amarelo) ? "amarelo" : "vermelho";
  return { quantidade, perda, id, cor };
}
