import { store, ehLider, ehGestao } from "../lib/store.js";
import { sair } from "../lib/firebase.js";
import { ICONES } from "./Icones.js";
import { nomePapel } from "../lib/constantes.js";
import { primeiroNome } from "../lib/util.js";

export default {
  data() { return { store, ICONES }; },
  computed: {
    itens() {
      const itens = [
        { to: "/", nome: "Início", icone: "inicio" },
        { to: "/gig", nome: "GIG", icone: "gig" },
        { to: "/clima", nome: "Pesquisinha", icone: "clima" },
        { to: "/agenda", nome: "Agenda", icone: "agenda" },
        { to: "/encaminhamentos", nome: "Encaminhamentos", icone: "enc" },
        { to: "/atas", nome: "Atas", icone: "atas" },
        { to: "/quedas", nome: "Quedas no ID", icone: "quedas" },
      ];
      if (ehGestao()) itens.push({ to: "/dashboards", nome: "Dashboards", icone: "dash" });
      if (ehLider()) itens.push({ to: "/membros", nome: "Membros", icone: "membros" });
      return itens;
    },
    nome() { return primeiroNome(store.membro && store.membro.nome); },
    papel() { return nomePapel(store.membro && store.membro.papel); },
  },
  methods: {
    ativo(item) {
      const p = this.$route.path;
      return item.to === "/" ? p === "/" : p.startsWith(item.to);
    },
    sair,
  },
  template: `
  <nav class="nav">
    <div class="nav-marca"><img src="../assets/logo-branca-glean.png" alt="GLean"><span>GIG</span></div>
    <router-link v-for="i in itens" :key="i.to" :to="i.to" class="nav-item" :class="{ ativo: ativo(i) }">
      <span v-html="ICONES[i.icone]"></span><span>{{ i.nome }}</span>
    </router-link>
    <div class="nav-rodape" v-if="store.membro">
      <router-link to="/perfil" class="nav-usuario" title="Meu perfil">
        <img :src="store.membro.foto || '../assets/favicon_glean.png'" alt="">
        <div><b>{{ nome }}</b><small>{{ papel }}</small></div>
      </router-link>
      <button class="nav-sair" @click="sair" title="Sair" v-html="ICONES.sair"></button>
    </div>
  </nav>`,
};
