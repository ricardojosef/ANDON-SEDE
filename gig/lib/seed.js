// Catálogos iniciais, tirados das planilhas do GIG 26.2. A liderança carrega
// uma vez, na tela de Membros; depois tudo é editável lá.
import { db, doc, writeBatch, serverTimestamp } from "./firebase.js";
import { slug } from "./util.js";
import { CONFIG_QUEDAS_PADRAO } from "./id.js";

export const PROCESSOS_INICIAIS = [
  { nome: "Liderança", cargos: ["Líder Geral", "Vice Liderança"] },
  { nome: "Gestão de Pessoas" }, { nome: "Kikai" }, { nome: "Conhecimento" },
  { nome: "Processo Seletivo" }, { nome: "DP" }, { nome: "Kaigi Lean" },
  { nome: "Visibilidade" }, { nome: "Oportunidades Práticas" }, { nome: "Expansão" },
  { nome: "GLean Run" }, { nome: "Summer Job" }, { nome: "Consultoria" },
  { nome: "Mentoria" }, { nome: "Padrinhos" },
];
export const CARGOS_PADRAO = ["Shusa", "Big-Shusa", "Shusee"];

// [tipo, nome, descrição?]. Prefixos (M1)/(M2)/(M2+)/(M3+) viram restrição de módulo.
export const ATIVIDADES_INICIAIS = [
  ["gerais", "Reunião Geral", "Reunião geral semanal do grupo"],
  ["gerais", "GIG / Planejamento Semanal", "Realizar o planejamento semanal e compilar o GIG"],
  ["gerais", "Feedbacks", "Passar/receber feedbacks pessoalmente"],
  ["gerais", "Comunicação interna/externa", "Tempo gasto com mensagens e comunicação (Telegram, pessoalmente, avisos…)"],
  ["gerais", "Participação em RT/PE", "Participar do momento de RT/PE"],
  ["gerais", "Preparação PE/RT", "Preparar o momento de RT/PE"],
  ["gerais", "Eventos GLean", "Participar de eventos do grupo (Kaigi Lean, Lean Day…)"],
  ["gerais", "Bench com Ex Membros", "Conversa com ex-membros (senseis) para qualquer finalidade do grupo"],
  ["gerais", "Preparação do encerramento", "Preparação do momento de encerramento do semestre"],
  ["gerais", "Participar Hansei Parcial", "Horas assistindo ao Hansei Parcial"],
  ["gerais", "Participar Hansei Final", "Horas assistindo ao Hansei Final"],
  ["gerais", "Apresentação A3 Hoshin/Lente Base", "Participar do momento de apresentação da A3 Hoshin e/ou Lente Base"],
  ["gerais", "Destaque do Mês", "Responder os formulários das DDLs"],
  ["gerais", "Acompanhamento Individual", "Acompanhamento com Liderança ou Gestão de Pessoas"],
  ["gerais", "Formulários", "Responder formulários do grupo (pesquisinha, DDM…)"],
  ["gerais", "5S", "Realizar a atividade de 5S destinada a você na semana"],
  ["gerais", "Entrega DP", "Assistir à entrega da DP + corrigir a entrega da DP"],
  ["gerais", "Reunião Stakeholders", "Reuniões com apoiadores do grupo (professores, empresas parceiras, entidades…)"],
  ["gerais", "A3 Pessoal", ""],
  ["gerais", "Comitê Estratégico", "Reuniões do comitê para ver o desenvolvimento das metas Hoshin"],

  ["capacitacao", "(M1) Leitura Dinâmica dos Parafusos", "Horas com LEITURAS da Dinâmica dos Parafusos"],
  ["capacitacao", "(M1) Atividades Dinâmica dos Parafusos", "Horas com ATIVIDADES da Dinâmica dos Parafusos"],
  ["capacitacao", "(M1) Reuniões Dinâmica dos Parafusos", "Horas com REUNIÕES da Dinâmica dos Parafusos"],
  ["capacitacao", "(M1) Acompanhamento de Leitura DP", "Horas com ACOMPANHAMENTOS DE LEITURA da DP"],
  ["capacitacao", "(M1) Apadrinhamento DP - Afilhado", "Reunião do afilhado com seu padrinho"],
  ["capacitacao", "(M2) Leitura Coaching DP", "Horas com LEITURAS do momento de acompanhamento"],
  ["capacitacao", "(M2) Preparação Coaching DP", "Horas com PREPARAÇÕES do momento de acompanhamento"],
  ["capacitacao", "(M2) Reunião Coaching DP", "Horas com ACOMPANHAMENTO DE LEITURA"],
  ["capacitacao", "(M2+) Acompanhamento DP", "Horas com ACOMPANHAMENTOS dos M1s na DP"],
  ["capacitacao", "(M2+) Reunião DP", "Participação de um M2+ em REUNIÕES da DP"],
  ["capacitacao", "(M2+) Reunião de M2+", "Reunião de acompanhamento da DP (somente M2+)"],
  ["capacitacao", "(M3+) Apadrinhamento DP - Padrinho", "Reunião do padrinho com seu afilhado"],
  ["capacitacao", "Leitura Pessoal", "Horas com LEITURAS não obrigatórias"],
  ["capacitacao", "Assistir ou Ministrar Treinamento Interno", "Treinamentos ministrados para o grupo"],
  ["capacitacao", "Assistir ou Ministrar Treinamento Externo", "Treinamentos externos ao grupo"],
  ["capacitacao", "Assistir ou Ministrar Treinumbuca", ""],
  ["capacitacao", "Preparar Treinamento Filosofia, Cultura e Liderança Lean", "Preparar treinamento (slides, reuniões de alinhamento…)"],
  ["capacitacao", "Preparar Treinamento Pensamento A3 e Kaizen", ""],
  ["capacitacao", "Preparar Treinamento Estabilidade Básica", ""],
  ["capacitacao", "Preparar Treinumbuca MFV", ""],
  ["capacitacao", "Preparar Treinamento Fluxo e Puxada", ""],
  ["capacitacao", "Preparar Treinamento Logística Interna", ""],
  ["capacitacao", "Preparar Treinumbuca Supermercado", ""],
  ["capacitacao", "Preparar Treinamento SMED/TRF", ""],
  ["capacitacao", "Preparar Treinamento Hoshin Kanri", ""],
  ["capacitacao", "Preparar Treinamento de PCP", ""],
  ["capacitacao", "Preparar Treinamento Logística Externa", ""],
  ["capacitacao", "Preparar Treinamento de TPM", ""],
  ["capacitacao", "Preparar Treinamento Externo", ""],
  ["capacitacao", "Preparar Treinamento MFV Engenharia do Trabalho", ""],
  ["capacitacao", "Preparar Treinamento EJEP", ""],
  ["capacitacao", "Preparar Treinamento Six Sigma", ""],
  ["capacitacao", "Preparar Treinamento TOC", ""],
  ["capacitacao", "Preparar Treinamento Gelog", ""],
  ["capacitacao", "Curso / Congresso", ""],
  ["capacitacao", "Estudo Extra", ""],
  ["capacitacao", "Assistir ROPs", ""],
  ["capacitacao", "Preparar ROP", ""],
  ["capacitacao", "Correção Entrega DP", ""],
  ["capacitacao", "Dinâmica Extra", ""],

  ["processos", "Shusas: Obeya Room"],
  ["processos", "Liderança Geral: Reuniões"], ["processos", "Liderança Geral: Atividades"], ["processos", "Liderança Geral: Acompanhamento de Membros"],
  ["processos", "Vice Liderança: Atividades"], ["processos", "Vice Liderança: Gestão Financeira"],
  ["processos", "Gestão de Pessoas: Reunião"], ["processos", "Gestão de Pessoas: Atividades"], ["processos", "Gestão de Pessoas: Atividades de Shusa"], ["processos", "Gestão de Pessoas: Acompanhamento de Membros"],
  ["processos", "Kikai: Reuniões"], ["processos", "Kikai: Reuniões Internas"], ["processos", "Kikai: Reuniões Externas (Stakeholders)"], ["processos", "Kikai: Atividades"], ["processos", "Kikai: Atividades de Big-Shusa"],
  ["processos", "Conhecimento: Reuniões"], ["processos", "Conhecimento: Atividades"], ["processos", "Conhecimento: Atividades de Shusa"],
  ["processos", "Processo Seletivo: Reuniões"], ["processos", "Processo Seletivo: Atividades"], ["processos", "Processo Seletivo: Atividades de Shusa"], ["processos", "Processo Seletivo: Currículo e A3"], ["processos", "Processo Seletivo: Dinâmica"], ["processos", "Processo Seletivo: Entrevista"], ["processos", "Processo Seletivo: Feedbacks"], ["processos", "Processo Seletivo: Reuniões de Decisão"], ["processos", "Processo Seletivo: Reuniões (avaliadores)"], ["processos", "Processo Seletivo: Atividades (avaliadores)"], ["processos", "Processo Seletivo: Daily (demais membros)"], ["processos", "Processo Seletivo: Prospecção PS"],
  ["processos", "Dinâmica dos Parafusos: Atividades de Shusa", "Atividades de Shusa da Dinâmica dos Parafusos (DP)"],
  ["processos", "Kaigi Lean: Reuniões"], ["processos", "Kaigi Lean: Atividades"], ["processos", "Kaigi Lean: Atividades de Shusa (Organização)"], ["processos", "Kaigi Lean: Atividades de Shusa (Vendas)"], ["processos", "Kaigi Lean: Auxílio Kaigi (demais membros)"], ["processos", "Kaigi Lean: Prospecção & Vendas"],
  ["processos", "Visibilidade: Atividades de Shusa"], ["processos", "Visibilidade: Marketing de Conteúdo"],
  ["processos", "Oportunidades Práticas: Reuniões"], ["processos", "Oportunidades Práticas: Atividades"], ["processos", "Oportunidades Práticas: Atividades de Shusa"],
  ["processos", "Expansão: Reuniões"], ["processos", "Expansão: Atividades"], ["processos", "Expansão: Atividades de Shusa"],
  ["processos", "GLean Run: Reuniões"], ["processos", "GLean Run: Atividades"], ["processos", "GLean Run: Atividades de Shusa"],
  ["processos", "Summer Job: Reuniões"], ["processos", "Summer Job: Atividades"], ["processos", "Summer Job: Atividades de Shusa"], ["processos", "Summer Job (demais membros)"],
  ["processos", "Padrinhos: Reuniões"], ["processos", "Padrinhos: Atividades"],
  ["processos", "Hoshin: Construção", "Reuniões e atividades da construção das A3 Hoshin"],
  ["processos", "Hoshin: Review/Planning", "Momentos de review e planning do Hoshin"],
  ["processos", "Hoshin: Atividades", "Atividades das metas Hoshin"],
  ["processos", "Cadeia de Ajuda: Kaigi", "Ajuda prestada ao Kaigi Lean pela cadeia de ajuda"],
  ["processos", "Cadeia de Ajuda: Gestão de Pessoas", "Ajuda prestada à Gestão de Pessoas pela cadeia de ajuda"],
  ["processos", "Cadeia de Ajuda: Conhecimento", "Ajuda prestada ao Conhecimento pela cadeia de ajuda"],
  ["processos", "Cadeia de Ajuda: DP", "Ajuda prestada à Dinâmica dos Parafusos pela cadeia de ajuda"],
  ["processos", "Cadeia de Ajuda: Liderança", "Ajuda prestada à Liderança pela cadeia de ajuda"],
  ["processos", "Cadeia de Ajuda: Summer/OP", "Ajuda prestada ao Summer Job / Oportunidades Práticas pela cadeia de ajuda"],

  ["projetos", "Consultoria: Atividades de Projeto Prático"], ["projetos", "Consultoria: Reuniões de Projeto"], ["projetos", "Consultoria: Visita à Empresa"],
  ["projetos", "Mentoria: Atividades"], ["projetos", "Mentoria: Reuniões"], ["projetos", "Mentoria: Visitas à Empresa"],
  ["projetos", "Projeto + Trilha: Atividades de Projeto Prático"], ["projetos", "Projeto + Trilha: Reuniões de Projeto"], ["projetos", "Projeto + Trilha: Visita à Empresa"],
  ["projetos", "Reunião Interna de Diagnósticos"],
  ["projetos", "Workshops: Preparação"], ["projetos", "Workshops: Aplicação"],
  ["projetos", "Visita Técnica"], ["projetos", "Visitas GLean Run"],
];

const MODULOS_POR_PREFIXO = {
  "(M1)": ["M1"], "(M2)": ["M2"], "(M2+)": ["M2", "M3", "M4"], "(M3+)": ["M3", "M4"],
};

export function atividadeDoSeed([tipo, nome, descricao = ""]) {
  const prefixo = (nome.match(/^\((M\d\+?)\)/) || [])[0];
  const processo = tipo === "processos" && nome.includes(":") ? nome.split(":")[0].trim() : "";
  return {
    id: slug(nome), nome, tipo, descricao, processo,
    modulos: prefixo ? MODULOS_POR_PREFIXO[prefixo] || [] : [],
    ativo: true,
  };
}

// Grava processos, atividades e config de quedas. Só escreve o que ainda não
// existe (ids determinísticos), então rodar duas vezes não duplica nada.
export const faltandoNoCatalogo = (atividades = []) => {
  const tem = new Set(atividades.map((a) => a.id));
  return ATIVIDADES_INICIAIS.map(atividadeDoSeed).filter((a) => !tem.has(a.id));
};

export async function semearCatalogos({ processos = [], atividades = [], configQuedasExiste = false } = {}) {
  const temProcesso = new Set(processos.map((p) => p.id));
  const temAtividade = new Set(atividades.map((a) => a.id));
  const lote = writeBatch(db);
  let n = 0;
  for (const p of PROCESSOS_INICIAIS) {
    const id = slug(p.nome);
    if (temProcesso.has(id)) continue;
    lote.set(doc(db, "processos", id), {
      nome: p.nome, cargos: p.cargos || CARGOS_PADRAO, ativo: true, criadoEm: serverTimestamp(),
    });
    n++;
  }
  for (const linha of ATIVIDADES_INICIAIS) {
    const a = atividadeDoSeed(linha);
    if (temAtividade.has(a.id)) continue;
    const { id, ...dados } = a;
    lote.set(doc(db, "atividades", id), dados);
    n++;
  }
  // não sobrescreve motivos de queda que a gestão já ajustou
  if (!configQuedasExiste) { lote.set(doc(db, "config", "quedas"), CONFIG_QUEDAS_PADRAO, { merge: true }); n++; }
  if (!n) return 0;
  await lote.commit();
  return n;
}
