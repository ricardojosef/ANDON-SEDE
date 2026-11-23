import { store, ehLider } from "../lib/store.js";
import { ehDestinatario, rotuloPublico, situacaoPrazo, rotuloPrazo } from "../lib/ddl.js";
import { ICONES } from "../components/Icones.js";

export default {
  data() { return { store, ICONES, aba: "responder" }; },
  computed: {
    uid() { return store.membro.id; },
    lider() { return ehLider(); },
    paraResponder() {
      return store.formularios
        .filter((f) => ehDestinatario(f, this.uid) && (f.aberto !== false || (f.respondentes && f.respondentes[this.uid])))
        .map((f) => ({ ...f, respondido: Boolean(f.respondentes && f.respondentes[this.uid]) }))
        .sort((a, b) => Number(a.respondido) - Number(b.respondido) || (a.prazo || "9999").localeCompare(b.prazo || "9999"));
    },
    meus() { return store.formularios.filter((f) => f.autor === this.uid); },
    todos() { return store.formularios; },
    lista() { return this.aba === "responder" ? this.paraResponder : this.aba === "meus" ? this.meus : this.todos; },
    pendentes() { return this.paraResponder.filter((f) => !f.respondido && f.aberto !== false).length; },
  },
  methods: {
    rotuloPublico, situacaoPrazo, rotuloPrazo,
    nRespostas(f) { return Object.values(f.respondentes || {}).filter(Boolean).length; },
    podeGerir(f) { return f.autor === this.uid || this.lider; },
  },
  template: `
  <div>
    <header class="cabecalho">
      <div><h1>Formulários</h1><p class="sub">Crie formulários para o grupo, com prazo de DDL se quiser, e acompanhe as respostas.</p></div>
      <div class="acoes"><router-link to="/formularios/novo" class="btn destaque"><span v-html="ICONES.mais"></span> Novo formulário</router-link></div>
    </header>

    <div class="abas">
      <button class="aba" :class="{ ativa: aba === 'responder' }" @click="aba = 'responder'">Para responder <span class="cont">{{ pendentes }}</span></button>
      <button class="aba" :class="{ ativa: aba === 'meus' }" @click="aba = 'meus'">Criados por mim</button>
      <button class="aba" :class="{ ativa: aba === 'todos' }" @click="aba = 'todos'">Todos</button>
    </div>

    <section class="cartao" v-if="!lista.length">
      <p class="vazio">{{ aba === 'responder' ? "Nenhum formulário para você responder." : "Nenhum formulário ainda." }}</p>
    </section>
    <div class="grade grade-2" v-else>
      <article class="cartao form-cartao" v-for="f in lista" :key="f.id">
        <div class="form-cartao-topo">
          <span class="ddl-tipo tipo-formulario" v-html="ICONES.form"></span>
          <div style="min-width:0">
            <h3>{{ f.titulo || "(sem título)" }}</h3>
            <p class="dica" style="margin:2px 0 0">por {{ f.autorNome }} · {{ (f.perguntas || []).length }} pergunta(s) · {{ rotuloPublico(f.publico) }}</p>
          </div>
        </div>
        <p class="form-desc" v-if="f.descricao">{{ f.descricao }}</p>
        <div class="linha" style="gap:6px;margin:10px 0 12px">
          <span class="selo" :class="situacaoPrazo(f.prazo).classe === 'atrasado' ? 'erro' : 'aviso'" v-if="f.prazo">DDL · {{ rotuloPrazo(f.prazo) }}</span>
          <span class="selo neutro" v-if="f.aberto === false">encerrado</span>
          <span class="selo ok" v-if="f.respondido">respondido</span>
          <span class="selo neutro" v-if="podeGerir(f)">{{ nRespostas(f) }} resposta(s)</span>
        </div>
        <div class="linha" style="gap:8px;margin-top:auto">
          <router-link class="btn pequeno destaque" :to="'/formularios/' + f.id" v-if="ehDestinatarioDe(f)">{{ f.respondido ? "Ver/alterar resposta" : "Responder" }}</router-link>
          <router-link class="btn pequeno" :to="'/formularios/' + f.id + '/respostas'" v-if="podeGerir(f)">Respostas</router-link>
          <router-link class="btn pequeno" :to="'/formularios/' + f.id + '/editar'" v-if="podeGerir(f)">Editar</router-link>
        </div>
      </article>
    </div>
  </div>`,
  // usado no template: mesmo critério da aba "para responder"
  beforeCreate() { this.ehDestinatarioDe = (f) => ehDestinatario(f, store.membro.id); },
};
