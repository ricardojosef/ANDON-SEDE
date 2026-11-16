import { store, semestreAtivo, nomeDoMembro } from "../lib/store.js";
import { listar, where, mensagemErro } from "../lib/firebase.js";
import { formatarData } from "../lib/util.js";
import { TIPOS_ATA } from "../lib/constantes.js";
import { ICONES } from "../components/Icones.js";

export default {
  data() { return { store, TIPOS_ATA, ICONES, atas: [], carregando: true, erro: "", filtroTipo: "", filtroProcesso: "", busca: "" }; },
  computed: {
    semestre() { return semestreAtivo(); },
    lista() {
      const b = this.busca.trim().toLowerCase();
      return this.atas
        .filter((a) => !this.filtroTipo || a.tipo === this.filtroTipo)
        .filter((a) => !this.filtroProcesso || a.processo === this.filtroProcesso)
        .filter((a) => !b || (a.titulo || "").toLowerCase().includes(b) || (a.texto || "").toLowerCase().includes(b))
        .sort((x, y) => (y.data || "").localeCompare(x.data || ""));
    },
  },
  watch: { "store.semestres": "carregar" },
  created() { this.carregar(); },
  methods: {
    formatarData, nomeDoMembro,
    nomeProcesso(id) { return (store.processos.find((p) => p.id === id) || {}).nome || ""; },
    async carregar() {
      this.erro = "";
      try {
        this.atas = await listar("atas", where("semestre", "==", this.semestre ? this.semestre.id : ""));
      } catch (err) { this.erro = mensagemErro(err); }
      finally { this.carregando = false; }
    },
  },
  template: `
  <div>
    <header class="cabecalho">
      <div><h1>Atas</h1><p class="sub">Registro das reuniões e os encaminhamentos que saíram delas.</p></div>
      <div class="acoes"><router-link to="/atas/nova" class="btn destaque"><span v-html="ICONES.mais"></span> Nova ata</router-link></div>
    </header>

    <div class="filtros">
      <input v-model="busca" placeholder="Buscar no título ou no texto">
      <select v-model="filtroTipo"><option value="">Todos os tipos</option><option v-for="t in TIPOS_ATA" :key="t">{{ t }}</option></select>
      <select v-model="filtroProcesso"><option value="">Todos os processos</option><option v-for="p in store.processos" :key="p.id" :value="p.id">{{ p.nome }}</option></select>
    </div>
    <p class="erro" v-if="erro">{{ erro }}</p>

    <section class="cartao">
      <p class="vazio" v-if="carregando">Carregando…</p>
      <p class="vazio" v-else-if="!lista.length">Nenhuma ata neste semestre ainda.</p>
      <div class="tabela-caixa" v-else>
        <table class="tabela">
          <thead><tr><th>Data</th><th>Título</th><th>Tipo</th><th>Processo</th><th>Autor</th></tr></thead>
          <tbody>
            <tr v-for="a in lista" :key="a.id">
              <td style="white-space:nowrap">{{ formatarData(a.data, true) }}</td>
              <td><router-link :to="'/atas/' + a.id" style="font-weight:700;text-decoration:none">{{ a.titulo }}</router-link></td>
              <td>{{ a.tipo }}</td>
              <td>{{ nomeProcesso(a.processo) }}</td>
              <td>{{ a.autorNome || nomeDoMembro(a.autor) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>`,
};
