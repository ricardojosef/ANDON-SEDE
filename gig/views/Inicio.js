import { store, semestreAtivo, ehGestao, membrosAtivos } from "../lib/store.js";
import { db, doc, getDoc, updateDoc, listar, where, mensagemErro } from "../lib/firebase.js";
import { ddlsPendentes, situacaoPrazo } from "../lib/ddl.js";
import { ICONES } from "../components/Icones.js";
import { semanaAtual, datasDaSemana, idSemana } from "../lib/semana.js";
import { formatarData, diasAte, primeiroNome, fmt } from "../lib/util.js";
import { FEELINGS, nomeStatus } from "../lib/constantes.js";

export default {
  data() {
    return { store, ICONES, gig: null, encs: [], resumo: null, carregando: true, erro: "" };
  },
  computed: {
    semestre() { return semestreAtivo(); },
    semana() { return semanaAtual(this.semestre); },
    datas() {
      const d = datasDaSemana(this.semestre, this.semana);
      return d.inicio ? `${formatarData(d.inicio)} – ${formatarData(d.fim)}` : "";
    },
    nome() { return primeiroNome(store.membro.nome); },
    feeling() {
      const cor = this.gig && this.gig.feeling && this.gig.feeling.cor;
      return FEELINGS.find((f) => f.cor === cor) || null;
    },
    // a pesquisinha já é acompanhada pelo store (store.climaDaSemana)
    clima() { return store.climaDaSemana; },
    ddls() { return ddlsPendentes(store.membro.id); },
    abertos() {
      return this.encs
        .filter((e) => ["aberto", "andamento"].includes(e.status))
        .sort((a, b) => (a.prazo || "9999").localeCompare(b.prazo || "9999"));
    },
  },
  watch: { "store.semestres": "carregar" },
  created() { this.carregar(); },
  methods: {
    fmt, formatarData, nomeStatus, situacaoPrazo,
    async marcarFeita(d) {
      try { await updateDoc(doc(db, "ddls", d.id), { [`concluidos.${store.membro.id}`]: new Date().toISOString() }); }
      catch (err) { this.erro = mensagemErro(err); }
    },
    atrasado(e) { return Boolean(e.prazo) && diasAte(e.prazo) < 0; },
    prazoTexto(e) {
      if (!e.prazo) return "sem prazo";
      const d = diasAte(e.prazo);
      if (d < 0) return `atrasado ${-d} dia${d === -1 ? "" : "s"}`;
      if (d === 0) return "vence hoje";
      if (d === 1) return "vence amanhã";
      return `vence em ${d} dias (${formatarData(e.prazo)})`;
    },
    async carregar() {
      this.erro = "";
      try {
        const uid = store.membro.id;
        this.encs = await listar("encaminhamentos", where("responsavel", "==", uid));
        if (!this.semestre) return;
        const sem = this.semestre.id, n = this.semana;
        const g = await getDoc(doc(db, "gig", idSemana(sem, n, uid)));
        this.gig = g.exists() ? g.data() : null;
        if (ehGestao()) {
          const [gigs, climas] = await Promise.all([
            listar("gig", where("semestre", "==", sem), where("semana", "==", n)),
            listar("clima", where("semestre", "==", sem), where("semana", "==", n)),
          ]);
          this.resumo = { gig: gigs.length, clima: climas.length, total: membrosAtivos().length };
        }
      } catch (err) {
        this.erro = mensagemErro(err);
      } finally {
        this.carregando = false;
      }
    },
  },
  template: `
  <div>
    <header class="cabecalho">
      <div>
        <h1>Olá, {{ nome }}</h1>
        <p class="sub" v-if="semestre">{{ semestre.nome || semestre.id }} · Semana {{ semana }} · {{ datas }}</p>
        <p class="sub" v-else>Nenhum semestre ativo ainda.</p>
      </div>
    </header>

    <p class="erro" v-if="erro">{{ erro }}</p>

    <div class="grade grade-3" v-if="semestre">
      <router-link to="/gig" class="cartao indicador" style="text-decoration:none">
        <span>GIG da semana {{ semana }}</span>
        <b v-if="gig">{{ fmt(gig.totais && gig.totais.realizado) }}h <small style="font-size:13px;font-weight:600;color:#2fa36b">preenchido</small></b>
        <b v-else style="color:#e8a317">pendente</b>
        <span v-if="feeling"><i class="ponto" :class="feeling.cor"></i> {{ gig.feeling.motivo || feeling.nome }}</span>
        <span v-else>Clique para preencher</span>
      </router-link>
      <router-link to="/clima" class="cartao indicador" style="text-decoration:none">
        <span>Pesquisinha da semana {{ semana }}</span>
        <b v-if="clima" style="color:#2fa36b">respondida</b>
        <b v-else style="color:#e8a317">pendente</b>
        <span>{{ clima ? "Você ainda pode alterar até a semana virar" : "DDL de quinta, 23:59 · leva uns 5 minutos" }}</span>
      </router-link>
      <div class="cartao indicador" v-if="resumo">
        <span>Preenchimento do grupo nesta semana</span>
        <b>{{ resumo.gig }}/{{ resumo.total }} <small style="font-size:13px;font-weight:600">GIG</small></b>
        <span>{{ resumo.clima }}/{{ resumo.total }} responderam a pesquisinha</span>
      </div>
    </div>

    <div class="grade grade-2 inicio-listas">
      <section class="cartao">
        <div class="cartao-titulo">
          <span>Minhas DDLs <span class="selo" :class="ddls.some(d => situacaoPrazo(d.prazo).classe === 'atrasado') ? 'erro' : 'aviso'" v-if="ddls.length">{{ ddls.length }} pendente{{ ddls.length > 1 ? "s" : "" }}</span></span>
          <router-link to="/ddls" class="btn pequeno">Ver todas</router-link>
        </div>
        <p class="vazio" v-if="!ddls.length">Nenhuma DDL pendente. 🎉</p>
        <div v-else>
          <div class="ddl" v-for="d in ddls.slice(0, 6)" :key="d.tipo + d.id" :class="situacaoPrazo(d.prazo).classe">
            <span class="ddl-tipo" :class="'tipo-' + d.tipo" v-html="d.tipo === 'tarefa' ? ICONES.ddl : ICONES.form"></span>
            <div class="ddl-corpo">
              <div class="titulo">{{ d.titulo }}</div>
              <div class="meta"><span class="prazo">{{ situacaoPrazo(d.prazo).texto }}</span><span v-if="d.criadoPorNome">por {{ d.criadoPorNome }}</span></div>
            </div>
            <div class="acoes">
              <button class="btn pequeno destaque" v-if="d.tipo === 'tarefa'" @click="marcarFeita(d)">Feita</button>
              <router-link class="btn pequeno destaque" v-else :to="d.link">Responder</router-link>
            </div>
          </div>
          <router-link to="/ddls" class="dica" v-if="ddls.length > 6" style="display:block;margin:8px 0 0">+ {{ ddls.length - 6 }} em DDLs</router-link>
        </div>
      </section>

      <section class="cartao">
        <div class="cartao-titulo">
          <span>Meus encaminhamentos <span class="selo" v-if="abertos.length">{{ abertos.length }} aberto{{ abertos.length > 1 ? "s" : "" }}</span></span>
          <router-link to="/encaminhamentos" class="btn pequeno">Ver todos</router-link>
        </div>
        <p class="vazio" v-if="carregando">Carregando…</p>
        <p class="vazio" v-else-if="!abertos.length">Nenhum encaminhamento aberto para você. 🎉</p>
        <div v-else>
          <div class="enc" v-for="e in abertos" :key="e.id" :class="{ atrasado: atrasado(e) }">
            <span class="status-ponto" :class="'status-' + e.status"></span>
            <div>
              <div class="titulo">{{ e.titulo }}</div>
              <div class="meta">
                <span class="prazo">{{ prazoTexto(e) }}</span>
                <span>{{ nomeStatus(e.status) }}</span>
                <router-link v-if="e.origem && e.origem.tipo === 'ata'" :to="'/atas/' + e.origem.id">{{ e.origem.titulo || "ata" }}</router-link>
              </div>
            </div>
            <div></div>
          </div>
        </div>
      </section>
    </div>
  </div>`,
};
