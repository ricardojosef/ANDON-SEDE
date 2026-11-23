// Escolha de destinatários: todos os membros ou um grupo, montado por
// módulo, por processo e/ou por pessoa. v-model = { tipo, modulos, processos, pessoas }.
import { store, membrosAtivos, semestreAtivo } from "../lib/store.js";
import { MODULOS_PADRAO } from "../lib/constantes.js";
import { resolverDestinatarios } from "../lib/ddl.js";

export const publicoVazio = () => ({ tipo: "todos", modulos: [], processos: [], pessoas: [] });

export default {
  props: { modelValue: Object },
  emits: ["update:modelValue"],
  data() { return { store }; },
  computed: {
    v() { return this.modelValue || publicoVazio(); },
    membros() { return membrosAtivos(); },
    modulos() { const s = semestreAtivo(); return (s && s.modulos && s.modulos.length) ? s.modulos : MODULOS_PADRAO; },
    processos() { return store.processos.filter((p) => p.ativo !== false); },
    total() { return resolverDestinatarios(this.v).length; },
  },
  methods: {
    mudar(campo, valor) { this.$emit("update:modelValue", { ...this.v, [campo]: valor }); },
    alternar(campo, id) {
      const lista = [...(this.v[campo] || [])];
      const i = lista.indexOf(id);
      if (i >= 0) lista.splice(i, 1); else lista.push(id);
      this.mudar(campo, lista);
    },
  },
  template: `
  <div class="destinatarios">
    <div class="segmentado">
      <button type="button" :class="{ sel: v.tipo === 'todos' }" @click="mudar('tipo', 'todos')">Todos os membros</button>
      <button type="button" :class="{ sel: v.tipo === 'grupo' }" @click="mudar('tipo', 'grupo')">Um grupo</button>
    </div>
    <div v-if="v.tipo === 'grupo'" class="destinatarios-grupo">
      <div class="dest-linha"><span>Módulos</span>
        <button type="button" v-for="m in modulos" :key="m" class="chip" :class="{ sel: (v.modulos || []).includes(m) }" @click="alternar('modulos', m)">{{ m }}</button>
      </div>
      <div class="dest-linha"><span>Processos</span>
        <button type="button" v-for="p in processos" :key="p.id" class="chip" :class="{ sel: (v.processos || []).includes(p.id) }" @click="alternar('processos', p.id)">{{ p.nome }}</button>
      </div>
      <div class="dest-linha"><span>Pessoas</span>
        <button type="button" v-for="m in membros" :key="m.id" class="chip" :class="{ sel: (v.pessoas || []).includes(m.id) }" @click="alternar('pessoas', m.id)">{{ m.nome }}</button>
      </div>
    </div>
    <p class="dica" style="margin:8px 0 0">{{ total }} {{ total === 1 ? "pessoa recebe" : "pessoas recebem" }}{{ v.tipo === 'todos' ? " (e quem entrar depois)" : "" }}.</p>
  </div>`,
};
