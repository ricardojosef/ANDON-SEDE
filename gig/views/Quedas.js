import { store, semestreAtivo, membrosAtivos, nomeDoMembro, ehGestao } from "../lib/store.js";
import { db, doc, collection, addDoc, deleteDoc, listar, where, serverTimestamp, mensagemErro } from "../lib/firebase.js";
import { semanaAtual, listaSemanas } from "../lib/semana.js";
import { calcularID } from "../lib/id.js";
import { fmt } from "../lib/util.js";
import { ICONES } from "../components/Icones.js";

export default {
  data() {
    return {
      store, ICONES, quedas: [], carregando: true, erro: "", ok: "", salvando: false,
      filtroSemana: "todas",
      nova: { uid: "", semana: semanaAtual(semestreAtivo()), motivo: "", quantidade: 1, obs: "" },
    };
  },
  computed: {
    semestre() { return semestreAtivo(); },
    gestao() { return ehGestao(); },
    membros() { return membrosAtivos(); },
    semanas() { return listaSemanas(this.semestre); },
    motivos() { return store.configQuedas.motivos || []; },
    quadro() {
      return this.membros.map((m) => {
        const minhas = this.quedas.filter((q) => q.uid === m.id);
        const semana = this.filtroSemana === "todas" ? minhas : minhas.filter((q) => q.semana === Number(this.filtroSemana));
        return { ...m, ...calcularID(minhas, store.configQuedas), nestaSemana: semana.reduce((s, q) => s + (Number(q.quantidade) || 1), 0) };
      });
    },
    lista() {
      const l = this.filtroSemana === "todas" ? this.quedas : this.quedas.filter((q) => q.semana === Number(this.filtroSemana));
      return [...l].sort((a, b) => b.semana - a.semana || (a.nome || "").localeCompare(b.nome || ""));
    },
    totalQuedas() { return this.lista.reduce((s, q) => s + (Number(q.quantidade) || 1), 0); },
  },
  watch: { "store.semestres": "carregar", "store.configQuedas": { handler() { if (!this.nova.motivo && this.motivos.length) this.nova.motivo = this.motivos[0].nome; }, immediate: true } },
  created() { this.carregar(); },
  methods: {
    fmt, nomeDoMembro,
    async carregar() {
      this.erro = "";
      if (!this.semestre) { this.carregando = false; return; }
      try { this.quedas = await listar("quedas", where("semestre", "==", this.semestre.id)); }
      catch (err) { this.erro = mensagemErro(err); }
      finally { this.carregando = false; }
    },
    async registrar() {
      this.erro = ""; this.ok = "";
      if (!this.nova.uid) { this.erro = "Escolha o membro."; return; }
      this.salvando = true;
      try {
        const dados = {
          semestre: this.semestre.id, semana: Number(this.nova.semana), uid: this.nova.uid, nome: nomeDoMembro(this.nova.uid),
          motivo: this.nova.motivo, quantidade: Number(this.nova.quantidade) || 1, obs: this.nova.obs.trim(),
          registradoPor: store.membro.id, registradoPorNome: store.membro.nome, em: serverTimestamp(),
        };
        const ref = await addDoc(collection(db, "quedas"), dados);
        this.quedas.push({ id: ref.id, ...dados });
        this.ok = `Queda registrada para ${dados.nome}.`;
        this.nova.obs = ""; this.nova.quantidade = 1;
      } catch (err) { this.erro = mensagemErro(err); }
      finally { this.salvando = false; }
    },
    async excluir(q) {
      if (!confirm(`Remover a queda "${q.motivo}" de ${q.nome}?`)) return;
      try { await deleteDoc(doc(db, "quedas", q.id)); this.quedas = this.quedas.filter((x) => x.id !== q.id); }
      catch (err) { this.erro = mensagemErro(err); }
    },
  },
  template: `
  <div>
    <header class="cabecalho">
      <div><h1>Quedas no ID</h1><p class="sub">Índice de Desempenho do semestre: começa em 1,0 e cada queda desconta o peso do motivo.</p></div>
      <div class="filtros" style="margin:0">
        <select v-model="filtroSemana"><option value="todas">Semestre inteiro</option><option v-for="n in semanas" :key="n" :value="n">Semana {{ n }}</option></select>
      </div>
    </header>

    <div class="aviso" v-if="!semestre">Nenhum semestre ativo.</div>
    <template v-else>
      <section class="cartao" v-if="gestao" style="margin-bottom:16px">
        <div class="cartao-titulo">Registrar queda</div>
        <div class="linha">
          <label class="campo"><span>Membro</span><select v-model="nova.uid"><option value="">—</option><option v-for="m in membros" :key="m.id" :value="m.id">{{ m.nome }}</option></select></label>
          <label class="campo curto"><span>Semana</span><select v-model="nova.semana"><option v-for="n in semanas" :key="n" :value="n">{{ n }}</option></select></label>
          <label class="campo"><span>Motivo</span><select v-model="nova.motivo"><option v-for="m in motivos" :key="m.nome" :value="m.nome">{{ m.nome }} ({{ Math.round(m.pct * 100) }}%)</option></select></label>
          <label class="campo curto"><span>Quantidade</span><input type="number" min="1" v-model="nova.quantidade"></label>
          <label class="campo"><span>Observação</span><input v-model="nova.obs" placeholder="opcional"></label>
          <button class="btn destaque" style="margin-bottom:14px" @click="registrar" :disabled="salvando">Registrar</button>
        </div>
        <p class="erro" v-if="erro">{{ erro }}</p>
        <p class="sucesso" v-if="ok">{{ ok }}</p>
      </section>

      <div class="grade grade-2">
        <section class="cartao">
          <div class="cartao-titulo">Quadro do ID</div>
          <div class="tabela-caixa"><table class="tabela">
            <thead><tr><th></th><th>Membro</th><th class="num">Quedas</th><th class="num" v-if="filtroSemana !== 'todas'">Na semana</th><th class="num">ID</th></tr></thead>
            <tbody><tr v-for="m in quadro" :key="m.id">
              <td><span class="farol" :class="'bg-' + m.cor" :title="m.cor"></span></td>
              <td><b>{{ m.nome }}</b> <small style="color:var(--texto-fraco)">{{ m.modulo }}</small></td>
              <td class="num">{{ m.quantidade }}</td>
              <td class="num" v-if="filtroSemana !== 'todas'">{{ m.nestaSemana }}</td>
              <td class="num"><b>{{ fmt(m.id * 100, 0) }}%</b></td>
            </tr></tbody>
          </table></div>
        </section>

        <section class="cartao">
          <div class="cartao-titulo">Quedas registradas <span class="selo neutro">{{ totalQuedas }}</span></div>
          <p class="vazio" v-if="carregando">Carregando…</p>
          <p class="vazio" v-else-if="!lista.length">Nenhuma queda. 🎉</p>
          <div class="tabela-caixa" v-else><table class="tabela">
            <thead><tr><th>Sem.</th><th>Membro</th><th>Motivo</th><th class="num">Qtd</th><th v-if="gestao"></th></tr></thead>
            <tbody><tr v-for="q in lista" :key="q.id">
              <td>{{ q.semana }}</td><td>{{ q.nome }}</td>
              <td>{{ q.motivo }}<div class="dica" style="margin:0" v-if="q.obs">{{ q.obs }}</div></td>
              <td class="num">{{ q.quantidade }}</td>
              <td v-if="gestao"><button class="remover" @click="excluir(q)" title="Remover">×</button></td>
            </tr></tbody>
          </table></div>
        </section>
      </div>
    </template>
  </div>`,
};
