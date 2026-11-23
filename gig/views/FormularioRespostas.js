import { store, ehLider, nomeDoMembro } from "../lib/store.js";
import { db, doc, updateDoc, listar, mensagemErro } from "../lib/firebase.js";
import { resumir, textoResposta, csvDasRespostas, nomeTipoPergunta } from "../lib/formularios.js";
import { resolverDestinatarios, rotuloPublico, rotuloPrazo } from "../lib/ddl.js";
import { fmt, formatarData } from "../lib/util.js";
import { ICONES } from "../components/Icones.js";

export default {
  props: { id: String },
  data() { return { store, ICONES, respostas: [], aba: "resumo", carregando: true, erro: "", copiado: false }; },
  computed: {
    f() { return store.formularios.find((x) => x.id === this.id) || null; },
    pode() { return this.f && (this.f.autor === store.membro.id || ehLider()); },
    resumos() { return this.f ? this.f.perguntas.map((p) => ({ p, s: resumir(p, this.respostas) })) : []; },
    destinatarios() { return this.f ? (this.f.publico && this.f.publico.tipo !== "todos" ? this.f.destinatarios || [] : resolverDestinatarios(this.f.publico)) : []; },
    faltando() { const ja = new Set(this.respostas.map((r) => r.uid)); return this.destinatarios.filter((u) => !ja.has(u)); },
    link() { return `${location.origin}${location.pathname}#/formularios/${this.id}`; },
  },
  watch: { f: { immediate: true, handler(v) { if (v && this.pode && this.carregando) this.carregar(); else if (v) this.carregando = false; } } },
  methods: {
    fmt, formatarData, textoResposta, nomeTipoPergunta, nomeDoMembro, rotuloPublico, rotuloPrazo,
    pct(n, total) { return total ? Math.round((n / total) * 100) : 0; },
    async carregar() {
      try {
        this.respostas = (await listar(`formularios/${this.id}/respostas`)).sort((a, b) => (a.nome || "").localeCompare(b.nome || ""));
      } catch (err) { this.erro = mensagemErro(err); }
      finally { this.carregando = false; }
    },
    async alternarAberto() {
      try { await updateDoc(doc(db, "formularios", this.id), { aberto: this.f.aberto === false }); }
      catch (err) { this.erro = mensagemErro(err); }
    },
    async copiarLink() {
      try { await navigator.clipboard.writeText(this.link); this.copiado = true; setTimeout(() => { this.copiado = false; }, 1800); } catch {}
    },
    baixarCsv() {
      const linhas = this.respostas.map((r) => ({ ...r, emTexto: r.emISO ? new Date(r.emISO).toLocaleString("pt-BR") : "" }));
      const blob = new Blob([csvDasRespostas(this.f, linhas)], { type: "text/csv;charset=utf-8" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${(this.f.titulo || "formulario").replace(/[^\\w\\-]+/g, "_")}.csv`;
      a.click();
      URL.revokeObjectURL(a.href);
    },
  },
  template: `
  <div>
    <header class="cabecalho">
      <div>
        <router-link to="/formularios" class="btn pequeno" style="margin-bottom:8px"><span v-html="ICONES.voltar"></span> Formulários</router-link>
        <h1>{{ f ? f.titulo : "Respostas" }}</h1>
        <p class="sub" v-if="f">{{ respostas.length }} de {{ destinatarios.length }} responderam · {{ rotuloPublico(f.publico) }}<span v-if="f.prazo"> · DDL {{ rotuloPrazo(f.prazo) }}</span></p>
      </div>
      <div class="acoes" v-if="f && pode">
        <button class="btn" @click="copiarLink">{{ copiado ? "Link copiado ✓" : "Copiar link" }}</button>
        <router-link class="btn" :to="'/formularios/' + id + '/editar'">Editar</router-link>
        <button class="btn" @click="alternarAberto">{{ f.aberto === false ? "Reabrir respostas" : "Encerrar respostas" }}</button>
        <button class="btn destaque" @click="baixarCsv" :disabled="!respostas.length">Baixar CSV</button>
      </div>
    </header>

    <p class="erro" v-if="erro">{{ erro }}</p>
    <div class="aviso" v-if="f && !pode">Só quem criou o formulário (ou a liderança) vê as respostas.</div>
    <p class="vazio" v-else-if="carregando">Carregando…</p>

    <template v-else-if="f">
      <div class="abas">
        <button class="aba" :class="{ ativa: aba === 'resumo' }" @click="aba = 'resumo'">Resumo</button>
        <button class="aba" :class="{ ativa: aba === 'individual' }" @click="aba = 'individual'">Individuais <span class="cont">{{ respostas.length }}</span></button>
        <button class="aba" :class="{ ativa: aba === 'faltando' }" @click="aba = 'faltando'">Faltam responder <span class="cont">{{ faltando.length }}</span></button>
      </div>

      <template v-if="aba === 'resumo'">
        <section class="cartao" v-if="!respostas.length"><p class="vazio">Nenhuma resposta ainda.</p></section>
        <section class="cartao" v-for="x in resumos" :key="x.p.id" v-else>
          <div class="cartao-titulo">{{ x.p.texto }} <span class="selo neutro">{{ x.s.total }} resposta(s)</span></div>
          <div v-if="x.s.tipo === 'contagem'">
            <p class="dica" v-if="x.s.media != null && x.s.total">Média: <b>{{ fmt(x.s.media, 1) }}</b></p>
            <div class="barra-resposta" v-for="it in x.s.itens" :key="it.opcao">
              <span class="barra-rotulo">{{ it.opcao }}</span>
              <span class="barra-trilho"><i :style="{ width: pct(it.n, x.s.total) + '%' }"></i></span>
              <span class="barra-valor">{{ it.n }} <small>({{ pct(it.n, x.s.total) }}%)</small></span>
            </div>
          </div>
          <p v-else-if="x.s.tipo === 'numeros'">Média: <b>{{ fmt(x.s.media, 2) }}</b> em {{ x.s.total }} resposta(s)</p>
          <ul class="lista-textos" v-else>
            <li v-for="(t, i) in x.s.textos" :key="i">{{ t }}</li>
            <li class="dica" v-if="!x.s.textos.length">Sem respostas.</li>
          </ul>
        </section>
      </template>

      <section class="cartao" v-else-if="aba === 'individual'">
        <p class="vazio" v-if="!respostas.length">Nenhuma resposta ainda.</p>
        <div class="tabela-caixa" v-else>
          <table class="tabela">
            <thead><tr><th>Nome</th><th>Quando</th><th v-for="p in f.perguntas" :key="p.id">{{ p.texto }}</th></tr></thead>
            <tbody><tr v-for="r in respostas" :key="r.id">
              <td style="white-space:nowrap"><b>{{ r.nome }}</b></td>
              <td style="white-space:nowrap">{{ r.emISO ? new Date(r.emISO).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "" }}</td>
              <td v-for="p in f.perguntas" :key="p.id">{{ textoResposta(p, r.r && r.r[p.id]) }}</td>
            </tr></tbody>
          </table>
        </div>
      </section>

      <section class="cartao" v-else>
        <p class="vazio" v-if="!faltando.length">Todos os destinatários responderam ✓</p>
        <div class="chips-nomes" v-else><span class="chip" v-for="u in faltando" :key="u">{{ nomeDoMembro(u) }}</span></div>
      </section>
    </template>
  </div>`,
};
