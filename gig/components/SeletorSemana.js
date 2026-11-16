// Seletor "‹ Semana N (dd/mm – dd/mm) ›" ligado ao semestre ativo.
import { listaSemanas, datasDaSemana } from "../lib/semana.js";
import { formatarData } from "../lib/util.js";
import { ICONES } from "./Icones.js";

export default {
  props: { modelValue: Number, semestre: Object },
  emits: ["update:modelValue"],
  data() { return { ICONES }; },
  computed: {
    semanas() { return listaSemanas(this.semestre); },
    datas() {
      const d = datasDaSemana(this.semestre, this.modelValue);
      return d.inicio ? `${formatarData(d.inicio)} – ${formatarData(d.fim)}` : "";
    },
  },
  methods: {
    mudar(n) {
      if (n >= 1 && n <= this.semanas.length) this.$emit("update:modelValue", n);
    },
  },
  template: `
  <div class="filtros" style="margin:0">
    <button class="btn icone" @click="mudar(modelValue - 1)" :disabled="modelValue <= 1" v-html="ICONES.voltar" title="Semana anterior"></button>
    <select :value="modelValue" @change="mudar(Number($event.target.value))">
      <option v-for="n in semanas" :key="n" :value="n">Semana {{ n }}</option>
    </select>
    <button class="btn icone" @click="mudar(modelValue + 1)" :disabled="modelValue >= semanas.length" v-html="ICONES.seta" title="Próxima semana"></button>
    <span class="dica" style="margin:0" v-if="datas">{{ datas }}</span>
  </div>`,
};
