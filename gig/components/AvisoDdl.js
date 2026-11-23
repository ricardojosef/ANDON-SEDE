// Faixa no topo de todas as telas: DDLs vencendo hoje ou atrasadas.
import { lembretes, vencemHoje, atrasadas, dispensarAviso, ehDiaDeDdl } from "../lib/lembretes.js";
import { hojeISO } from "../lib/util.js";

export default {
  data() { return { lembretes }; },
  computed: {
    hoje() { this.lembretes.agora; return vencemHoje(); },
    atrasadas() { this.lembretes.agora; return atrasadas(); },
    visivel() {
      if (this.$route.path === "/ddls") return false;
      if (lembretes.dispensadoEm === hojeISO()) return false;
      return this.hoje.length > 0 || this.atrasadas.length > 0;
    },
    texto() {
      const partes = [];
      if (this.hoje.length) {
        const dia = ehDiaDeDdl() ? (new Date().getDay() === 2 ? "Hoje é terça, dia de DDL" : "Hoje é quinta, dia de DDL") : "Hoje tem DDL";
        partes.push(`${dia}: ${this.hoje.length === 1 ? "1 entrega vence" : this.hoje.length + " entregas vencem"} às 23:59`);
      }
      if (this.atrasadas.length) {
        const n = this.atrasadas.length;
        partes.push(this.hoje.length ? `${n} atrasada${n > 1 ? "s" : ""}` : `Você tem ${n} DDL${n > 1 ? "s" : ""} atrasada${n > 1 ? "s" : ""}`);
      }
      return partes.join(" · ");
    },
  },
  methods: { dispensar: dispensarAviso },
  template: `
  <div class="aviso-ddl" v-if="visivel" role="status">
    <span class="aviso-ddl-icone">⏰</span>
    <span class="aviso-ddl-texto">{{ texto }}</span>
    <router-link to="/ddls" class="btn pequeno destaque">Ver DDLs</router-link>
    <button class="remover" @click="dispensar" title="Esconder até amanhã">×</button>
  </div>`,
};
