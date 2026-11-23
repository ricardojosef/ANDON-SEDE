import { store, ehLider, ehGestao } from "../lib/store.js";
import { sair } from "../lib/firebase.js";
import { ICONES } from "./Icones.js";
import { nomePapel } from "../lib/constantes.js";
import { primeiroNome } from "../lib/util.js";
import { ddlsPendentes } from "../lib/ddl.js";
import { totalNaoLidas } from "../lib/chat.js";
import { tema, alternarTema, layout, alternarMenu } from "../lib/tema.js";
import Logo from "./Logo.js";

export default {
  components: { Logo },
  data() { return { store, ICONES, tema, layout }; },
  computed: {
    itens() {
      const itens = [
        { to: "/", nome: "Início", icone: "inicio" },
        { to: "/gig", nome: "GIG", icone: "gig" },
        { to: "/chat", nome: "Chat", icone: "chat", contador: totalNaoLidas() },
        { to: "/ddls", nome: "DDLs", icone: "ddl", contador: this.pendentes },
        { to: "/clima", nome: "Pesquisinha", icone: "clima" },
        { to: "/agenda", nome: "Agenda", icone: "agenda" },
        { to: "/encaminhamentos", nome: "Encaminhamentos", icone: "enc" },
        { to: "/formularios", nome: "Formulários", icone: "form" },
        { to: "/atas", nome: "Atas", icone: "atas" },
        { to: "/quedas", nome: "Quedas no ID", icone: "quedas" },
      ];
      if (ehGestao()) itens.push({ to: "/dashboards", nome: "Dashboards", icone: "dash" });
      if (ehLider()) itens.push({ to: "/membros", nome: "Membros", icone: "membros" });
      return itens;
    },
    pendentes() { return ddlsPendentes().length; },
    nome() { return primeiroNome(store.membro && store.membro.nome); },
    papel() { return nomePapel(store.membro && store.membro.papel); },
  },
  methods: {
    ativo(item) {
      const p = this.$route.path;
      return item.to === "/" ? p === "/" : p.startsWith(item.to);
    },
    sair, alternarTema, alternarMenu,
  },
  template: `
  <nav class="nav">
    <div class="nav-topo">
      <router-link to="/" class="nav-marca" title="GIG · Gestão Interna do Grupo"><Logo variante="clara" :altura="38" :so-icone="layout.menuRecolhido" /></router-link>
      <button class="nav-recolher" @click="alternarMenu" :title="layout.menuRecolhido ? 'Mostrar o menu' : 'Esconder o menu'" :aria-expanded="String(!layout.menuRecolhido)" v-html="ICONES.menuLateral"></button>
    </div>
    <router-link v-for="i in itens" :key="i.to" :to="i.to" class="nav-item" :class="{ ativo: ativo(i) }" :title="layout.menuRecolhido ? i.nome : ''">
      <span class="nav-icone" v-html="ICONES[i.icone]"></span><span class="nav-nome">{{ i.nome }}</span>
      <span class="nav-contador" v-if="i.contador">{{ i.contador }}</span>
    </router-link>
    <div class="nav-rodape" v-if="store.membro">
      <router-link to="/perfil" class="nav-usuario" title="Perfil e configurações">
        <img :src="store.membro.foto || '../assets/marca/favicon_glean.png'" alt="">
        <div><b>{{ nome }}</b><small>{{ papel }}</small></div>
      </router-link>
      <button class="nav-sair" @click="alternarTema" :title="tema.efetivo === 'escuro' ? 'Usar modo claro' : 'Usar modo escuro'" v-html="tema.efetivo === 'escuro' ? ICONES.sol : ICONES.lua"></button>
      <button class="nav-sair" @click="sair" title="Sair" v-html="ICONES.sair"></button>
    </div>
  </nav>`,
};
