import { store, semestreAtivo, membrosAtivos } from "../lib/store.js";
import { listar, where, mensagemErro } from "../lib/firebase.js";
import { listaSemanas, semanaAtual } from "../lib/semana.js";
import { calcularID } from "../lib/id.js";
import { METRICAS, SATISFACAO_GERAL, JUSTIFICATIVAS } from "../lib/clima.js";
import { TIPOS, nomeTipo, MODULOS_PADRAO } from "../lib/constantes.js";
import { media, soma, fmt, num } from "../lib/util.js";
import Grafico from "../components/Grafico.js";

const AZUL = "#2e8bc0", MARINHO = "#123a5c", CLARO = "#61b3e4", VERDE = "#2fa36b", AMARELO = "#e8a317", VERMELHO = "#d93025";
const PALETA = [AZUL, MARINHO, CLARO, VERDE, AMARELO, VERMELHO, "#7b61ff", "#8fabc4"];
const horizontal = { indexAxis: "y", plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true } } };

export default {
  components: { Grafico },
  data() {
    return {
      store, METRICAS, gigs: [], climas: [], quedas: [], carregando: true, erro: "",
      filtro: { semana: "todas", modulo: "todos", membro: "todos" },
    };
  },
  computed: {
    semestre() { return semestreAtivo(); },
    semanas() { return listaSemanas(this.semestre); },
    modulos() { return (this.semestre && this.semestre.modulos) || MODULOS_PADRAO; },
    membros() { return membrosAtivos(); },
    moduloDe() { return Object.fromEntries(store.membros.map((m) => [m.id, m.modulo || ""])); },
    // filtros aplicados
    gigsF() { return this.aplicar(this.gigs); },
    climasF() { return this.aplicar(this.climas); },
    quedasF() { return this.aplicar(this.quedas); },
    // cards
    cards() {
      const c = [
        { nome: "Média de carga realizada", valor: fmt(media(this.gigsF.map((g) => g.totais && g.totais.realizado)), 1) + "h", sub: "por membro-semana" },
        { nome: "Total de quedas", valor: soma(this.quedasF.map((q) => q.quantidade || 1)), sub: "no recorte" },
        { nome: "Satisfação geral", valor: fmt(this.satisfacaoGeral, 1) + "%", sub: "média das satisfações ÷ 7" },
      ];
      for (const m of METRICAS) c.push({ nome: m.nome, valor: this.mediaMetrica(this.climasF, m.id), sub: "de 1 a 7" });
      return c;
    },
    satisfacaoGeral() {
      const notas = this.climasF.flatMap((c) => SATISFACAO_GERAL.map((id) => c.r && c.r[id]).filter((v) => v != null && v !== ""));
      return notas.length ? (media(notas) / 7) * 100 : 0;
    },
    // gráficos
    cargaPorSemana() {
      const sem = this.semanas;
      const porSemana = (docs, f) => sem.map((n) => soma(docs.filter((d) => d.semana === n).map(f)));
      return {
        labels: sem.map((n) => "S" + n),
        datasets: [
          { type: "line", label: "Planejado (h)", data: porSemana(this.gigsF, (g) => g.totais && g.totais.planejado), borderColor: MARINHO, backgroundColor: MARINHO, tension: .3, yAxisID: "y1" },
          { type: "line", label: "Realizado (h)", data: porSemana(this.gigsF, (g) => g.totais && g.totais.realizado), borderColor: AZUL, backgroundColor: AZUL, tension: .3, yAxisID: "y1" },
          { type: "bar", label: "Quedas", data: porSemana(this.quedasF, (q) => q.quantidade || 1), backgroundColor: VERMELHO + "99", yAxisID: "y" },
        ],
      };
    },
    opcoesCarga() {
      return { scales: { y: { position: "left", beginAtZero: true, title: { display: true, text: "quedas" } }, y1: { position: "right", beginAtZero: true, grid: { drawOnChartArea: false }, title: { display: true, text: "horas" } } } };
    },
    motivacaoPorSemana() {
      const sem = this.semanas;
      const grupo = this.aplicar(this.climas, { ignorarMembro: true });
      const serie = (docs) => sem.map((n) => { const v = docs.filter((d) => d.semana === n).map((d) => d.r && d.r.motivacao).filter((x) => x != null && x !== ""); return v.length ? media(v) : null; });
      const datasets = [{ label: "Média do grupo", data: serie(grupo), borderColor: MARINHO, backgroundColor: MARINHO, tension: .3 }];
      if (this.filtro.membro !== "todos") datasets.unshift({ label: "Membro", data: serie(this.climasF), borderColor: AZUL, backgroundColor: AZUL, tension: .3 });
      return { labels: sem.map((n) => "S" + n), datasets };
    },
    cargaPorTipo() {
      const total = {};
      for (const g of this.gigsF) for (const a of g.atividades || []) total[a.tipo] = (total[a.tipo] || 0) + num(a.realizado);
      const soma_ = soma(Object.values(total)) || 1;
      return { labels: TIPOS.map((t) => t.nome), datasets: [{ label: "% do realizado", data: TIPOS.map((t) => Math.round(((total[t.id] || 0) / soma_) * 1000) / 10), backgroundColor: PALETA }] };
    },
    topAtividades() {
      const total = {};
      for (const g of this.gigsF) for (const a of g.atividades || []) total[a.atividade] = (total[a.atividade] || 0) + num(a.realizado);
      const top = Object.entries(total).sort((a, b) => b[1] - a[1]).slice(0, 10);
      return { labels: top.map((t) => t[0]), datasets: [{ label: "Horas realizadas", data: top.map((t) => Math.round(t[1] * 10) / 10), backgroundColor: AZUL }] };
    },
    satisfacao() {
      const dims = [["pertencimento", "União"], ["satisfProcesso", "Processo"], ["satisfCapacitacao", "Capacitação"], ["satisfTempoExtra", "Tempo extra"], ["desafio", "Desafio"], ["sobrecarga", "Sobrecarga"]];
      return { labels: dims.map((d) => d[1]), datasets: [{ label: "Média (1–7)", data: dims.map((d) => num(this.mediaMetrica(this.climasF, d[0]))), backgroundColor: AZUL }] };
    },
    opcoesSatisfacao() { return { ...horizontal, scales: { x: { min: 0, max: 7 } } }; },
    quedasPorMotivo() {
      const total = {};
      for (const q of this.quedasF) total[q.motivo] = (total[q.motivo] || 0) + (num(q.quantidade) || 1);
      const lista = Object.entries(total).sort((a, b) => b[1] - a[1]);
      return { labels: lista.map((l) => l[0]), datasets: [{ label: "Quedas", data: lista.map((l) => l[1]), backgroundColor: VERMELHO }] };
    },
    farol() {
      const ultima = this.filtro.semana === "todas" ? semanaAtual(this.semestre) : Number(this.filtro.semana);
      return this.membros
        .filter((m) => this.filtro.modulo === "todos" || (m.modulo || "") === this.filtro.modulo)
        .filter((m) => this.filtro.membro === "todos" || m.id === this.filtro.membro)
        .map((m) => {
          const gigsM = this.gigs.filter((g) => g.uid === m.id && g.semana <= ultima);
          const atual = gigsM.sort((a, b) => b.semana - a.semana)[0];
          const idInfo = calcularID(this.quedas.filter((q) => q.uid === m.id), store.configQuedas);
          return { ...m, feeling: atual && atual.feeling, semanaFeeling: atual && atual.semana, idInfo, horas: soma(this.gigsF.filter((g) => g.uid === m.id).map((g) => g.totais && g.totais.realizado)) };
        });
    },
    justificativas() {
      const linhas = [];
      for (const c of this.climasF) for (const j of JUSTIFICATIVAS) {
        const t = c.r && c.r[j.id];
        if (t && String(t).trim()) linhas.push({ nome: c.nome, semana: c.semana, tipo: j.nome, texto: t });
      }
      return linhas.sort((a, b) => b.semana - a.semana || a.nome.localeCompare(b.nome));
    },
  },
  watch: { "store.semestres": "carregar" },
  created() { this.carregar(); },
  methods: {
    fmt, nomeTipo,
    aplicar(docs, { ignorarMembro = false } = {}) {
      return docs.filter((d) =>
        (this.filtro.semana === "todas" || d.semana === Number(this.filtro.semana))
        && (this.filtro.modulo === "todos" || (d.modulo != null ? d.modulo : this.moduloDe[d.uid]) === this.filtro.modulo)
        && (ignorarMembro || this.filtro.membro === "todos" || d.uid === this.filtro.membro));
    },
    mediaMetrica(docs, id) {
      const v = docs.map((c) => c.r && c.r[id]).filter((x) => x != null && x !== "");
      return v.length ? fmt(media(v), 1) : "—";
    },
    async carregar() {
      this.erro = "";
      if (!this.semestre) { this.carregando = false; return; }
      this.carregando = true;
      try {
        const id = this.semestre.id;
        [this.gigs, this.climas, this.quedas] = await Promise.all([
          listar("gig", where("semestre", "==", id)),
          listar("clima", where("semestre", "==", id)),
          listar("quedas", where("semestre", "==", id)),
        ]);
      } catch (err) { this.erro = mensagemErro(err); }
      finally { this.carregando = false; }
    },
  },
  template: `
  <div>
    <header class="cabecalho">
      <div><h1>Dashboards</h1><p class="sub" v-if="semestre">{{ semestre.id }} · {{ gigs.length }} GIGs · {{ climas.length }} pesquisinhas · {{ quedas.length }} quedas</p></div>
      <div class="filtros" style="margin:0">
        <select v-model="filtro.semana"><option value="todas">Todas as semanas</option><option v-for="n in semanas" :key="n" :value="n">Semana {{ n }}</option></select>
        <select v-model="filtro.modulo"><option value="todos">Todos os módulos</option><option v-for="m in modulos" :key="m" :value="m">{{ m }}</option></select>
        <select v-model="filtro.membro"><option value="todos">Todos os membros</option><option v-for="m in membros" :key="m.id" :value="m.id">{{ m.nome }}</option></select>
        <button class="btn pequeno" @click="carregar">Atualizar</button>
      </div>
    </header>

    <div class="aviso" v-if="!semestre">Nenhum semestre ativo.</div>
    <p class="erro" v-if="erro">{{ erro }}</p>
    <p class="vazio" v-if="carregando">Carregando…</p>

    <template v-else-if="semestre">
      <div class="grade grade-cards" style="margin-bottom:16px">
        <div class="cartao indicador" v-for="c in cards" :key="c.nome"><span>{{ c.nome }}</span><b>{{ c.valor }}</b><span>{{ c.sub }}</span></div>
      </div>

      <div class="grade grade-2">
        <section class="cartao"><div class="cartao-titulo">Carga e quedas por semana</div><Grafico tipo="bar" :dados="cargaPorSemana" :opcoes="opcoesCarga" /></section>
        <section class="cartao"><div class="cartao-titulo">Motivação por semana</div><Grafico tipo="line" :dados="motivacaoPorSemana" :opcoes="{ scales: { y: { min: 1, max: 7 } } }" /></section>
        <section class="cartao"><div class="cartao-titulo">Carga por tipo de atividade (% do realizado)</div><Grafico tipo="bar" :dados="cargaPorTipo" :opcoes="{ indexAxis: 'y', plugins: { legend: { display: false } }, scales: { x: { min: 0, max: 100 } } }" /></section>
        <section class="cartao"><div class="cartao-titulo">Satisfação por dimensão</div><Grafico tipo="bar" :dados="satisfacao" :opcoes="opcoesSatisfacao" /></section>
        <section class="cartao"><div class="cartao-titulo">Atividades com mais horas</div><Grafico tipo="bar" :dados="topAtividades" :opcoes="{ indexAxis: 'y', plugins: { legend: { display: false } } }" alto /></section>
        <section class="cartao"><div class="cartao-titulo">Quedas por motivo</div><Grafico tipo="bar" :dados="quedasPorMotivo" :opcoes="{ indexAxis: 'y', plugins: { legend: { display: false } } }" alto /></section>
      </div>

      <section class="cartao" style="margin-top:16px">
        <div class="cartao-titulo">Farol por membro</div>
        <div class="tabela-caixa"><table class="tabela">
          <thead><tr><th>Membro</th><th>Módulo</th><th>Feeling</th><th class="num">Horas realizadas</th><th class="num">Quedas</th><th>ID</th></tr></thead>
          <tbody><tr v-for="m in farol" :key="m.id">
            <td><b>{{ m.nome }}</b></td><td>{{ m.modulo }}</td>
            <td><span v-if="m.feeling"><i class="ponto" :class="m.feeling.cor"></i> {{ m.feeling.motivo }} <small style="color:var(--texto-fraco)">(S{{ m.semanaFeeling }})</small></span><span v-else class="dica">sem GIG</span></td>
            <td class="num">{{ fmt(m.horas, 1) }}h</td><td class="num">{{ m.idInfo.quantidade }}</td>
            <td><span class="farol" :class="'bg-' + m.idInfo.cor"></span> {{ fmt(m.idInfo.id * 100, 0) }}%</td>
          </tr></tbody>
        </table></div>
      </section>

      <section class="cartao" style="margin-top:16px">
        <div class="cartao-titulo">Justificativas da pesquisinha</div>
        <p class="vazio" v-if="!justificativas.length">Nenhuma justificativa no recorte.</p>
        <div class="tabela-caixa" v-else><table class="tabela">
          <thead><tr><th>Sem.</th><th>Membro</th><th>Sobre</th><th>Texto</th></tr></thead>
          <tbody><tr v-for="(j, i) in justificativas" :key="i"><td>{{ j.semana }}</td><td style="white-space:nowrap">{{ j.nome }}</td><td style="white-space:nowrap">{{ j.tipo }}</td><td>{{ j.texto }}</td></tr></tbody>
        </table></div>
      </section>
    </template>
  </div>`,
};
