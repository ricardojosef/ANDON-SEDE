// Marca do GIG — Gestão Interna do Grupo (desenho em lib/marca.js).
import { tema } from "../lib/tema.js";
import { svgIcone, svgLetras } from "../lib/marca.js";

export default {
  props: {
    variante: { type: String, default: "cor" },  // "cor" | "clara"
    altura: { type: Number, default: 40 },
    subtitulo: { type: Boolean, default: true },
    soIcone: Boolean,
  },
  computed: {
    // no modo escuro o ícone colorido usa os tons claros, para não sumir no fundo
    icone() { return svgIcone({ variante: this.variante === "cor" && tema.efetivo === "escuro" ? "clara" : this.variante }); },
    letras() { return svgLetras(); },
  },
  template: `
  <span class="logo-gig" :class="'logo-' + variante" :style="{ '--alt': altura + 'px' }">
    <span class="logo-gig-icone" v-html="icone"></span>
    <span class="logo-gig-texto" v-if="!soIcone">
      <span class="logo-gig-letras" v-html="letras"></span>
      <small v-if="subtitulo">Gestão Interna do Grupo</small>
    </span>
  </span>`,
};
