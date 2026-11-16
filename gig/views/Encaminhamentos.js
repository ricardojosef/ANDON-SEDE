import { store, semestreAtivo, membrosAtivos, nomeDoMembro, ehLider } from "../lib/store.js";
import { db, doc, collection, addDoc, updateDoc, deleteDoc, listar, where, serverTimestamp, mensagemErro } from "../lib/firebase.js";
import { formatarData, diasAte, hojeISO } from "../lib/util.js";
import { STATUS_ENC, nomeStatus } from "../lib/constantes.js";
import { ICONES } from "../components/Icones.js";

export default {
  data() {
    return {
      store, STATUS_ENC, ICONES,
      aba: "meus", meus: [], todos: [], carregando: true, erro: "", ok: "",
      filtroStatus: "ativos", filtroPessoa: "", filtroOrigem: "",
      mostrarNovo: false, salvando: false,
      novo: { titulo: "", descricao: "", responsavel: store.membro.id, prazo: "" },
    };
  },
  computed: {
    semestre() { return semestreAtivo(); },
    membros() { return membrosAtivos(); },
    lista() {
      let base = this.aba === "meus" ? this.meus : this.todos;
      if (this.filtroStatus === "ativos") base = base.filter((e) => ["aberto", "andamento"].includes(e.status));
      else if (this.filtroStatus !== "todos") base = base.filter((e) => e.status === this.filtroStatus);
      if (this.aba === "todos" && this.filtroPessoa) base = base.filter((e) => e.responsavel === this.filtroPessoa);
      if (this.filtroOrigem) base = base.filter((e) => (e.origem && e.origem.tipo) === this.filtroOrigem);
      const peso = (e) => (["aberto", "andamento"].includes(e.status) ? 0 : 1);
      return [...base].sort((a, b) => peso(a) - peso(b) || (a.prazo || "9999").localeCompare(b.prazo || "9999"));
    },
    contagemMeus() { return this.meus.filter((e) => ["aberto", "andamento"].includes(e.status)).length; },
  },
  watch: { "store.semestres": "carregar" },
  created() { this.carregar(); },
  methods: {
    nomeStatus, nomeDoMembro, formatarData,
    atrasado(e) { return ["aberto", "andamento"].includes(e.status) && Boolean(e.prazo) && diasAte(e.prazo) < 0; },
    podeExcluir(e) { return ehLider() || e.criadoPor === store.membro.id; },
    async carregar() {
      this.erro = "";
      try {
        const uid = store.membro.id;
        const [meus, todos] = await Promise.all([
          listar("encaminhamentos", where("responsavel", "==", uid)),
          listar("encaminhamentos", where("semestre", "==", this.semestre ? this.semestre.id : "")),
        ]);
        this.meus = meus; this.todos = todos;
      } catch (err) { this.erro = mensagemErro(err); }
      finally { this.carregando = false; }
    },
    async mudarStatus(e, status) {
      this.erro = "";
      try {
        const dados = { status, atualizadoEm: serverTimestamp() };
        if (status === "concluido") dados.concluidoEm = hojeISO();
        await updateDoc(doc(db, "encaminhamentos", e.id), dados);
        e.status = status;
        if (status === "concluido") e.concluidoEm = dados.concluidoEm;
      } catch (err) { this.erro = mensagemErro(err); }
    },
    async excluir(e) {
      if (!confirm(`Excluir "${e.titulo}"?`)) return;
      try {
        await deleteDoc(doc(db, "encaminhamentos", e.id));
        this.meus = this.meus.filter((x) => x.id !== e.id);
        this.todos = this.todos.filter((x) => x.id !== e.id);
      } catch (err) { this.erro = mensagemErro(err); }
    },
    async criar() {
      this.erro = ""; this.ok = "";
      if (!this.novo.titulo.trim()) { this.erro = "Dê um título ao encaminhamento."; return; }
      if (!this.novo.responsavel) { this.erro = "Escolha o responsável."; return; }
      this.salvando = true;
      try {
        const dados = {
          titulo: this.novo.titulo.trim(), descricao: this.novo.descricao.trim(),
          responsavel: this.novo.responsavel, responsavelNome: nomeDoMembro(this.novo.responsavel),
          prazo: this.novo.prazo || "", status: "aberto",
          origem: { tipo: "manual" },
          criadoPor: store.membro.id, criadoPorNome: store.membro.nome,
          criadoEm: serverTimestamp(), semestre: this.semestre ? this.semestre.id : "",
        };
        const ref = await addDoc(collection(db, "encaminhamentos"), dados);
        const novo = { id: ref.id, ...dados };
        this.todos.unshift(novo);
        if (novo.responsavel === store.membro.id) this.meus.unshift(novo);
        this.novo = { titulo: "", descricao: "", responsavel: store.membro.id, prazo: "" };
        this.mostrarNovo = false;
        this.ok = "Encaminhamento criado.";
      } catch (err) { this.erro = mensagemErro(err); }
      finally { this.salvando = false; }
    },
  },
  template: `
  <div>
    <header class="cabecalho">
      <div><h1>Encaminhamentos</h1><p class="sub">Tudo o que foi combinado em reuniões, treinamentos e processos, num lugar só.</p></div>
      <div class="acoes"><button class="btn destaque" @click="mostrarNovo = !mostrarNovo"><span v-html="ICONES.mais"></span> Novo encaminhamento</button></div>
    </header>

    <section class="cartao" v-if="mostrarNovo" style="margin-bottom:16px">
      <div class="cartao-titulo">Novo encaminhamento</div>
      <div class="linha">
        <label class="campo" style="flex:2"><span>Título</span><input v-model="novo.titulo" placeholder="O que precisa ser feito" @keyup.enter="criar"></label>
        <label class="campo"><span>Responsável</span><select v-model="novo.responsavel"><option v-for="m in membros" :key="m.id" :value="m.id">{{ m.nome }}</option></select></label>
        <label class="campo curto"><span>Prazo</span><input type="date" v-model="novo.prazo"></label>
      </div>
      <label class="campo"><span>Detalhes (opcional)</span><textarea v-model="novo.descricao" rows="2"></textarea></label>
      <div class="linha"><button class="btn destaque" @click="criar" :disabled="salvando">Criar</button><button class="btn" @click="mostrarNovo = false">Cancelar</button></div>
    </section>

    <div class="abas">
      <button class="aba" :class="{ ativa: aba === 'meus' }" @click="aba = 'meus'">Meus <span class="cont">{{ contagemMeus }}</span></button>
      <button class="aba" :class="{ ativa: aba === 'todos' }" @click="aba = 'todos'">Todos do semestre</button>
    </div>

    <div class="filtros">
      <select v-model="filtroStatus">
        <option value="ativos">Abertos e em andamento</option>
        <option v-for="s in STATUS_ENC" :key="s.id" :value="s.id">{{ s.nome }}</option>
        <option value="todos">Todos os status</option>
      </select>
      <select v-model="filtroPessoa" v-if="aba === 'todos'">
        <option value="">Todas as pessoas</option>
        <option v-for="m in membros" :key="m.id" :value="m.id">{{ m.nome }}</option>
      </select>
      <select v-model="filtroOrigem">
        <option value="">Qualquer origem</option>
        <option value="ata">De atas</option>
        <option value="manual">Criados à mão</option>
      </select>
    </div>

    <p class="erro" v-if="erro">{{ erro }}</p>
    <p class="sucesso" v-if="ok">{{ ok }}</p>

    <section class="cartao">
      <p class="vazio" v-if="carregando">Carregando…</p>
      <p class="vazio" v-else-if="!lista.length">Nada por aqui.</p>
      <div v-else>
        <div class="enc" v-for="e in lista" :key="e.id" :class="{ atrasado: atrasado(e), concluido: e.status === 'concluido' || e.status === 'cancelado' }">
          <span class="status-ponto" :class="'status-' + e.status" :title="nomeStatus(e.status)"></span>
          <div>
            <div class="titulo">{{ e.titulo }}</div>
            <div class="meta">
              <span>{{ e.responsavelNome || nomeDoMembro(e.responsavel) }}</span>
              <span class="prazo" v-if="e.prazo">prazo {{ formatarData(e.prazo, true) }}</span>
              <span>{{ nomeStatus(e.status) }}</span>
              <router-link v-if="e.origem && e.origem.tipo === 'ata'" :to="'/atas/' + e.origem.id">📄 {{ e.origem.titulo || "ata" }}</router-link>
              <span v-else-if="e.criadoPorNome">criado por {{ e.criadoPorNome }}</span>
            </div>
            <div class="dica" style="margin:4px 0 0" v-if="e.descricao">{{ e.descricao }}</div>
          </div>
          <div class="acoes">
            <button class="btn pequeno" v-if="e.status === 'aberto'" @click="mudarStatus(e, 'andamento')">Iniciar</button>
            <button class="btn pequeno destaque" v-if="e.status === 'aberto' || e.status === 'andamento'" @click="mudarStatus(e, 'concluido')">Concluir</button>
            <button class="btn pequeno" v-if="e.status === 'concluido' || e.status === 'cancelado'" @click="mudarStatus(e, 'aberto')">Reabrir</button>
            <button class="btn pequeno" v-if="e.status === 'aberto' || e.status === 'andamento'" @click="mudarStatus(e, 'cancelado')">Cancelar</button>
            <button class="btn pequeno perigo" v-if="podeExcluir(e)" @click="excluir(e)">Excluir</button>
          </div>
        </div>
      </div>
    </section>
  </div>`,
};
