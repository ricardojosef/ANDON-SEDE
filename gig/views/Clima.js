import { store, semestreAtivo } from "../lib/store.js";
import { db, doc, getDoc, setDoc, serverTimestamp, mensagemErro } from "../lib/firebase.js";
import { semanaAtual, idSemana, datasDaSemana } from "../lib/semana.js";
import { somarDias } from "../lib/util.js";
import { prazoDe, rotuloPrazo, situacaoPrazo } from "../lib/ddl.js";
import { secoesParaModulo, perguntasObrigatorias } from "../lib/clima.js";
import SeletorSemana from "../components/SeletorSemana.js";
import Escala from "../components/Escala.js";

export default {
  components: { SeletorSemana, Escala },
  data() {
    return {
      store,
      semana: semanaAtual(semestreAtivo()),
      r: {}, existente: false, editando: false, carregando: true, salvando: false, erro: "", ok: "", faltando: [],
    };
  },
  computed: {
    semestre() { return semestreAtivo(); },
    uid() { return store.membro.id; },
    modulo() { return store.membro.modulo || ""; },
    secoes() { return secoesParaModulo(this.modulo); },
    obrigatorias() { return perguntasObrigatorias(this.modulo); },
    semanaHoje() { return semanaAtual(this.semestre); },
    semanaFechada() { return this.semana < this.semanaHoje; },
    // a pesquisinha é DDL de quinta-feira, 23:59, da própria semana
    prazo() { const d = datasDaSemana(this.semestre, this.semana); return d.inicio ? prazoDe(somarDias(d.inicio, 3)) : ""; },
    situacao() { return situacaoPrazo(this.prazo); },
    mostrarForm() { return !this.carregando && (!this.existente || this.editando); },
  },
  watch: {
    semana() { this.carregar(); },
    "store.semestres"(novo, antigo) { if (!antigo.length && novo.length) { this.semana = semanaAtual(semestreAtivo()); this.carregar(); } },
  },
  created() { this.carregar(); },
  methods: {
    rotuloPrazo,
    texto(p) { return (store.configClima && store.configClima[p.id]) || p.texto; },
    visivel(p) { return !p.condicao || p.condicao(this.r); },
    falta(p) { return this.faltando.includes(p.id); },
    async carregar() {
      this.erro = ""; this.ok = ""; this.faltando = [];
      if (!this.semestre) { this.carregando = false; return; }
      this.carregando = true;
      try {
        const s = await getDoc(doc(db, "clima", idSemana(this.semestre.id, this.semana, this.uid)));
        this.r = s.exists() ? { ...(s.data().r || {}) } : {};
        this.existente = s.exists();
        this.editando = false;
      } catch (err) { this.erro = mensagemErro(err); }
      finally { this.carregando = false; }
    },
    async salvar() {
      this.erro = ""; this.ok = "";
      this.faltando = this.obrigatorias.filter((id) => this.r[id] == null || this.r[id] === "");
      if (this.faltando.length) {
        this.erro = `Faltam ${this.faltando.length} resposta(s) obrigatória(s), marcadas em vermelho.`;
        const el = this.$el.querySelector(".pergunta.falta");
        if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }
      this.salvando = true;
      try {
        // Só grava o que foi respondido (e remove respostas de perguntas que deixaram de aparecer).
        const r = {};
        for (const s of this.secoes) for (const p of s.perguntas) {
          if (this.visivel(p) && this.r[p.id] != null && this.r[p.id] !== "") r[p.id] = this.r[p.id];
        }
        await setDoc(doc(db, "clima", idSemana(this.semestre.id, this.semana, this.uid)), {
          semestre: this.semestre.id, semana: this.semana, uid: this.uid,
          nome: store.membro.nome, modulo: this.modulo, r, em: serverTimestamp(),
        });
        this.existente = true; this.editando = false;
        this.ok = "Pesquisinha enviada. Obrigado!";
        window.scrollTo({ top: 0, behavior: "smooth" });
      } catch (err) { this.erro = mensagemErro(err); }
      finally { this.salvando = false; }
    },
  },
  template: `
  <div>
    <header class="cabecalho">
      <div><h1>Pesquisinha de clima</h1><p class="sub">Como foi a sua semana no GLean. Só a liderança e Gestão de Pessoas leem as respostas individuais.</p></div>
      <SeletorSemana v-model="semana" :semestre="semestre" v-if="semestre" />
    </header>

    <div class="aviso" v-if="!semestre">Nenhum semestre ativo. Peça à liderança para configurar em Membros → Semestres.</div>
    <template v-else>
      <div class="aviso" v-if="!modulo">Seu módulo ainda não foi definido pela liderança, então a seção da Dinâmica dos Parafusos (M1) não aparece.</div>
      <div class="faixa-ddl" v-if="prazo" :class="existente ? 'ok' : situacao.classe">
        <b>DDL de quinta-feira</b>
        <span>{{ existente ? "entregue" : "entregar até " + rotuloPrazo(prazo) }}</span>
        <span class="selo" :class="existente ? 'ok' : situacao.classe === 'atrasado' ? 'erro' : 'aviso'">{{ existente ? "respondida ✓" : situacao.texto }}</span>
      </div>

      <p class="vazio" v-if="carregando">Carregando…</p>

      <section class="cartao respondido" v-if="existente && !editando && !carregando">
        <div class="respondido-icone">✓</div>
        <div>
          <p class="sucesso" v-if="ok" style="margin:0 0 4px">{{ ok }}</p>
          <h2>{{ semana === semanaHoje ? "A pesquisinha dessa semana foi respondida." : "A pesquisinha da semana " + semana + " foi respondida." }}</h2>
          <p class="dica" style="margin:4px 0 0">{{ semanaFechada ? "Essa semana já fechou." : "Quer alterar suas respostas?" }}</p>
        </div>
        <button class="btn destaque" v-if="!semanaFechada" @click="editando = true; ok = ''">Alterar respostas</button>
      </section>

      <template v-if="mostrarForm">
      <section class="cartao" v-for="s in secoes" :key="s.id">
        <h2 class="secao-titulo">{{ s.titulo }}</h2>
        <p class="secao-desc" v-if="s.descricao">{{ s.descricao }}</p>
        <template v-for="p in s.perguntas" :key="p.id">
          <div class="pergunta" v-if="visivel(p)" :class="{ falta: falta(p) }" :style="falta(p) ? 'box-shadow: inset 4px 0 0 var(--st-vermelho); padding-left: 12px' : ''">
            <div class="pergunta-texto">{{ texto(p) }}<span class="obrig" v-if="p.obrigatoria" title="obrigatória">*</span></div>
            <Escala v-if="p.tipo === 'escala'" v-model="r[p.id]" />
            <textarea v-else-if="p.tipo === 'texto'" v-model="r[p.id]" rows="2" placeholder="Escreva aqui (opcional)"></textarea>
            <input v-else type="number" min="0" v-model="r[p.id]" style="max-width:120px">
          </div>
        </template>
      </section>

      <section class="cartao">
        <div class="linha" style="align-items:center">
          <button class="btn destaque" @click="salvar" :disabled="salvando || carregando">{{ existente ? "Atualizar respostas" : "Enviar pesquisinha" }}</button>
          <button class="btn" v-if="existente" @click="editando = false; carregar()">Cancelar</button>
        </div>
        <p class="erro" v-if="erro">{{ erro }}</p>
      </section>
      </template>
    </template>
  </div>`,
};
