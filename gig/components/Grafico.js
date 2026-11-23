// Embrulho do Chart.js: recria o gráfico quando os dados ou o tema mudam.
import { tema } from "../lib/tema.js";
const css = (nome) => getComputedStyle(document.documentElement).getPropertyValue(nome).trim();
// no modo escuro o marinho dos gráficos some no fundo; troca por um azul claro
const CLAREAR = { "#123a5c": "#8fc3ea", "#8fabc4": "#a9bfd3" };
export default {
  props: { tipo: { type: String, default: "bar" }, dados: Object, opcoes: Object, alto: Boolean },
  data() { return { grafico: null, tema }; },
  mounted() { this.desenhar(); },
  beforeUnmount() { if (this.grafico) this.grafico.destroy(); },
  watch: { dados: { deep: true, handler() { this.desenhar(); } }, tipo() { this.desenhar(); }, "tema.efetivo"() { this.desenhar(); } },
  methods: {
    desenhar() {
      if (!window.Chart || !this.dados) return;
      if (this.grafico) this.grafico.destroy();
      window.Chart.defaults.font.family = '"Montserrat", sans-serif';
      window.Chart.defaults.color = css("--texto-fraco") || "#62809a";
      window.Chart.defaults.borderColor = css("--linha-2") || "#e3eaf0";
      let dados = JSON.stringify(this.dados);
      if (tema.efetivo === "escuro") for (const [de, para] of Object.entries(CLAREAR)) dados = dados.split(de).join(para);
      this.grafico = new window.Chart(this.$refs.tela, {
        type: this.tipo,
        data: JSON.parse(dados),
        options: { responsive: true, maintainAspectRatio: false, ...(this.opcoes || {}) },
      });
    },
  },
  template: `<div class="grafico" :class="{ alto }"><canvas ref="tela"></canvas></div>`,
};
