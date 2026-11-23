import { store } from "../lib/store.js";
import { db, doc, setDoc, updateDoc, ler, serverTimestamp, mensagemErro } from "../lib/firebase.js";
import { respostaVazia } from "../lib/formularios.js";
import { ehDestinatario, rotuloPrazo, situacaoPrazo } from "../lib/ddl.js";
import { ICONES } from "../components/Icones.js";
import Escala from "../components/Escala.js";

export default {
  components: { Escala },
  props: { id: String },
  data() { return { store, ICONES, r: {}, jaRespondeu: false, editando: true, carregando: true, salvando: false, erro: "", faltando: [] }; },
  computed: {
    uid() { return store.membro.id; },
    f() { return store.formularios.find((x) => x.id === this.id) || null; },
    destinatario() { return this.f && ehDestinatario(this.f, this.uid); },
    aberto() { return this.f && this.f.aberto !== false; },
  },
  watch: { f: { immediate: true, handler(v) { if (v && this.carregando) this.carregar(); } } },
  methods: {
    rotuloPrazo, situacaoPrazo,
    async carregar() {
      try {
        const minha = await ler(`formularios/${this.id}/respostas`, this.uid);
        if (minha) { this.r = { ...(minha.r || {}) }; this.jaRespondeu = true; this.editando = false; }
      } catch (err) { console.warn(err); }
      finally { this.carregando = false; }
    },
    alternarCaixa(p, opcao) {
      const lista = Array.isArray(this.r[p.id]) ? [...this.r[p.id]] : [];
      const i = lista.indexOf(opcao);
      if (i >= 0) lista.splice(i, 1); else lista.push(opcao);
      this.r[p.id] = lista;
    },
    async enviar() {
      this.erro = "";
      this.faltando = this.f.perguntas.filter((p) => p.obrigatoria && respostaVazia(p, this.r)).map((p) => p.id);
      if (this.faltando.length) {
        this.erro = `Faltam ${this.faltando.length} resposta(s) obrigatória(s).`;
        this.$nextTick(() => this.$el.querySelector(".pergunta.falta")?.scrollIntoView({ behavior: "smooth", block: "center" }));
        return;
      }
      this.salvando = true;
      try {
        const r = {};
        for (const p of this.f.perguntas) if (!respostaVazia(p, this.r)) r[p.id] = this.r[p.id];
        const agora = new Date().toISOString();
        await setDoc(doc(db, "formularios", this.id, "respostas", this.uid), {
          uid: this.uid, nome: store.membro.nome, r, em: serverTimestamp(), emISO: agora,
        });
        // marca no formulário que esta pessoa respondeu (é o que fecha a DDL)
        await updateDoc(doc(db, "formularios", this.id), { [`respondentes.${this.uid}`]: agora });
        this.jaRespondeu = true; this.editando = false;
        window.scrollTo({ top: 0, behavior: "smooth" });
      } catch (err) { this.erro = mensagemErro(err); }
      finally { this.salvando = false; }
    },
  },
  template: `
  <div class="form-resposta">
    <router-link to="/formularios" class="btn pequeno" style="margin-bottom:12px"><span v-html="ICONES.voltar"></span> Formulários</router-link>
    <p class="vazio" v-if="!f">Carregando formulário…</p>
    <template v-else>
      <section class="cartao form-cabeca">
        <h1>{{ f.titulo }}</h1>
        <p class="form-desc" v-if="f.descricao">{{ f.descricao }}</p>
        <div class="linha" style="gap:6px;margin-top:10px">
          <span class="selo neutro">por {{ f.autorNome }}</span>
          <span class="selo" :class="situacaoPrazo(f.prazo).classe === 'atrasado' ? 'erro' : 'aviso'" v-if="f.prazo">DDL · {{ rotuloPrazo(f.prazo) }}</span>
          <span class="selo neutro" v-if="!aberto">não aceita mais respostas</span>
        </div>
      </section>

      <div class="aviso" v-if="!destinatario">Este formulário é para um grupo do qual você não faz parte.</div>

      <section class="cartao respondido" v-else-if="jaRespondeu && !editando">
        <div class="respondido-icone">✓</div>
        <div>
          <h2>Sua resposta foi enviada.</h2>
          <p class="dica" style="margin:4px 0 0">{{ aberto ? "Quer alterar suas respostas?" : "O formulário não aceita mais alterações." }}</p>
        </div>
        <button class="btn destaque" v-if="aberto" @click="editando = true">Alterar respostas</button>
      </section>

      <template v-else-if="aberto">
        <section class="cartao">
          <div class="pergunta" v-for="p in f.perguntas" :key="p.id" :class="{ falta: faltando.includes(p.id) }">
            <div class="pergunta-texto">{{ p.texto }}<span class="obrig" v-if="p.obrigatoria">*</span></div>
            <input v-if="p.tipo === 'curta'" class="entrada" v-model="r[p.id]">
            <textarea v-else-if="p.tipo === 'paragrafo'" v-model="r[p.id]" rows="3"></textarea>
            <input v-else-if="p.tipo === 'numero'" class="entrada" type="number" v-model="r[p.id]" style="max-width:180px">
            <input v-else-if="p.tipo === 'data'" class="entrada" type="date" v-model="r[p.id]" style="max-width:200px">
            <div v-else-if="p.tipo === 'multipla'" class="opcoes-resp">
              <label class="check" v-for="o in p.opcoes" :key="o"><input type="radio" :name="p.id" :value="o" v-model="r[p.id]"> {{ o }}</label>
            </div>
            <div v-else-if="p.tipo === 'caixas'" class="opcoes-resp">
              <label class="check" v-for="o in p.opcoes" :key="o"><input type="checkbox" :checked="(r[p.id] || []).includes(o)" @change="alternarCaixa(p, o)"> {{ o }}</label>
            </div>
            <select v-else-if="p.tipo === 'lista'" class="entrada" v-model="r[p.id]" style="max-width:360px">
              <option value="">Escolha…</option><option v-for="o in p.opcoes" :key="o" :value="o">{{ o }}</option>
            </select>
            <div v-else-if="p.tipo === 'escala'">
              <Escala v-model="r[p.id]" :min="p.min" :max="p.max" />
              <div class="escala-rotulos" v-if="p.rotuloMin || p.rotuloMax"><span>{{ p.rotuloMin }}</span><span>{{ p.rotuloMax }}</span></div>
            </div>
          </div>
        </section>
        <div class="barra-acoes">
          <button class="btn destaque" @click="enviar" :disabled="salvando">{{ salvando ? "Enviando…" : jaRespondeu ? "Atualizar resposta" : "Enviar resposta" }}</button>
          <button class="btn" v-if="jaRespondeu" @click="editando = false">Cancelar</button>
          <p class="erro" v-if="erro" style="margin:0">{{ erro }}</p>
        </div>
      </template>
      <div class="aviso" v-else>Este formulário não aceita mais respostas.</div>
    </template>
  </div>`,
};
