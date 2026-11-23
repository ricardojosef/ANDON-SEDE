// Prazo de DDL: próximas terças e quintas às 23:59, ou excepcional (qualquer
// dia e hora). v-model = { categoria, data, hora } ou null (sem prazo).
import { proximas, HORA_PADRAO, categoriaDoPrazo } from "../lib/ddl.js";
import { formatarData, hojeISO } from "../lib/util.js";

export default {
  props: { modelValue: Object, permiteSemPrazo: Boolean },
  emits: ["update:modelValue"],
  computed: {
    v() { return this.modelValue; },
    opcoes() {
      const ter = proximas(2, 2).map((data) => ({ data, nome: "Terça", categoria: "terca" }));
      const qui = proximas(4, 2).map((data) => ({ data, nome: "Quinta", categoria: "quinta" }));
      return [...ter, ...qui].sort((a, b) => a.data.localeCompare(b.data));
    },
    excepcional() { return this.v && this.v.categoria === "excepcional"; },
    hoje: hojeISO,
  },
  methods: {
    formatarData,
    escolher(o) { this.$emit("update:modelValue", { categoria: o.categoria, data: o.data, hora: HORA_PADRAO }); },
    abrirExcepcional() {
      this.$emit("update:modelValue", { categoria: "excepcional", data: (this.v && this.v.data) || hojeISO(), hora: (this.v && this.v.hora) || HORA_PADRAO });
    },
    mudar(campo, valor) {
      const novo = { ...this.v, [campo]: valor };
      // uma data de terça ou quinta às 23:59 continua sendo DDL normal
      if (novo.hora === HORA_PADRAO && novo.categoria !== "excepcional") novo.categoria = categoriaDoPrazo(novo.data);
      this.$emit("update:modelValue", novo);
    },
    selecionado(o) { return this.v && !this.excepcional && this.v.data === o.data; },
  },
  template: `
  <div class="seletor-prazo">
    <div class="prazo-opcoes">
      <button type="button" v-if="permiteSemPrazo" class="prazo-opcao" :class="{ sel: !v }" @click="$emit('update:modelValue', null)">
        <b>Sem prazo</b><small>não é DDL</small>
      </button>
      <button type="button" v-for="o in opcoes" :key="o.data" class="prazo-opcao" :class="{ sel: selecionado(o) }" @click="escolher(o)">
        <b>{{ o.nome }} {{ formatarData(o.data) }}</b><small>até 23:59</small>
      </button>
      <button type="button" class="prazo-opcao" :class="{ sel: excepcional }" @click="abrirExcepcional">
        <b>Excepcional</b><small>outro dia/hora</small>
      </button>
    </div>
    <div class="linha" v-if="excepcional" style="margin-top:10px">
      <label class="campo curto"><span>Dia</span><input type="date" :min="hoje" :value="v.data" @input="mudar('data', $event.target.value)"></label>
      <label class="campo curto"><span>Hora</span><input type="time" :value="v.hora" @input="mudar('hora', $event.target.value)"></label>
    </div>
  </div>`,
};
