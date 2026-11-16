// Embrulho do Chart.js: recria o gráfico quando os dados mudam.
export default {
  props: { tipo: { type: String, default: "bar" }, dados: Object, opcoes: Object, alto: Boolean },
  data() { return { grafico: null }; },
  mounted() { this.desenhar(); },
  beforeUnmount() { if (this.grafico) this.grafico.destroy(); },
  watch: { dados: { deep: true, handler() { this.desenhar(); } }, tipo() { this.desenhar(); } },
  methods: {
    desenhar() {
      if (!window.Chart || !this.dados) return;
      if (this.grafico) this.grafico.destroy();
      window.Chart.defaults.font.family = '"Montserrat", sans-serif';
      window.Chart.defaults.color = "#62809a";
      this.grafico = new window.Chart(this.$refs.tela, {
        type: this.tipo,
        data: JSON.parse(JSON.stringify(this.dados)),
        options: { responsive: true, maintainAspectRatio: false, ...(this.opcoes || {}) },
      });
    },
  },
  template: `<div class="grafico" :class="{ alto }"><canvas ref="tela"></canvas></div>`,
};
