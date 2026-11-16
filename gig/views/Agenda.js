import { store, semestreAtivo, membrosAtivos, nomeDoMembro, ehLider } from "../lib/store.js";
import {
  db, doc, collection, addDoc, updateDoc, setDoc, listar, where, serverTimestamp, mensagemErro,
} from "../lib/firebase.js";
import {
  agenda, clientId, conectar, desconectar, listarAgendas, listarEventos, criarEvento, atualizarEvento,
  excluirEvento, tempoDoEvento, rotuloHorario, dataDoEvento, linkMeet, formDoEvento, eventoDoForm,
  descricaoComAta,
} from "../lib/agenda.js";
import { hojeISO, somarDias, deISO, paraISO, formatarData } from "../lib/util.js";
import { nomeStatus } from "../lib/constantes.js";
import { ICONES } from "../components/Icones.js";

const CHAVE_SELECAO = "gig-agenda-selecao";
const DIAS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

function segundaDe(iso) {
  const d = deISO(iso);
  const dia = (d.getDay() + 6) % 7;          // 0 = segunda
  d.setDate(d.getDate() - dia);
  return paraISO(d);
}

export default {
  data() {
    return {
      store, agenda, ICONES, DIAS,
      inicioSemana: segundaDe(hojeISO()),
      agendas: [], selecionadas: [], eventos: [], atas: [],
      carregando: false, erro: "", ok: "",
      sel: null, encsSel: [], novoEnc: { titulo: "", responsavel: "", prazo: "" }, ataParaVincular: "",
      form: null, modo: "", salvando: false, outroEmail: "",
      config: { clientId: "", agendaGrupo: "" }, mostrarConfig: false,
    };
  },
  computed: {
    lider() { return ehLider(); },
    configurado() { return Boolean(clientId()); },
    membros() { return membrosAtivos(); },
    dias() {
      const hoje = hojeISO();
      return DIAS.map((nome, i) => {
        const iso = somarDias(this.inicioSemana, i);
        return { iso, nome, hoje: iso === hoje, eventos: this.eventos.filter((e) => this.cobre(e, iso)) };
      });
    },
    tituloSemana() {
      const fim = somarDias(this.inicioSemana, 6);
      return `${formatarData(this.inicioSemana)} – ${formatarData(fim)}`;
    },
    ataPorEvento() {
      const m = {};
      for (const a of this.atas) if (a.evento && a.evento.eventId) m[a.evento.eventId] = a;
      return m;
    },
    agendasEditaveis() { return this.agendas.filter((a) => a.podeEditar); },
    ataDoSel() { return this.sel ? this.ataPorEvento[this.sel.id] || null : null; },
    atasLivres() { return this.atas.filter((a) => !a.evento || !a.evento.eventId).sort((x, y) => (y.data || "").localeCompare(x.data || "")); },
    emailsMembros() { return new Set(this.membros.map((m) => (m.email || "").toLowerCase())); },
    convidadosExternos() { return this.form ? this.form.convidados.filter((e) => !this.emailsMembros.has(e)) : []; },
  },
  watch: {
    "store.configAgenda": { immediate: true, handler(c) { this.config = { clientId: (c && c.clientId) || "", agendaGrupo: (c && c.agendaGrupo) || "" }; } },
  },
  created() { if (agenda.conectado) this.iniciar(); },
  methods: {
    formatarData, rotuloHorario, linkMeet, nomeDoMembro, nomeStatus, dataDoEvento,
    cobre(e, iso) {
      const t = tempoDoEvento(e);
      const ini = paraISO(t.inicio);
      if (!t.diaInteiro) return ini === iso;
      const fim = paraISO(new Date(t.fim.getTime() - 86400000));
      return iso >= ini && iso <= fim;
    },
    nomeMembroPorEmail(email) {
      const m = this.membros.find((x) => (x.email || "").toLowerCase() === email);
      return m ? m.nome : email;
    },
    async entrar() {
      this.erro = "";
      try { await conectar(); await this.iniciar(); } catch (err) { this.erro = err.message; }
    },
    sairDaAgenda() { desconectar(); this.eventos = []; this.agendas = []; },
    async iniciar() {
      this.erro = "";
      try {
        this.agendas = await listarAgendas();
        let salvas = [];
        try { salvas = JSON.parse(localStorage.getItem(CHAVE_SELECAO) || "[]"); } catch {}
        const existe = (id) => this.agendas.some((a) => a.id === id);
        this.selecionadas = salvas.filter(existe);
        if (!this.selecionadas.length) {
          const primaria = this.agendas.find((a) => a.primaria);
          if (primaria) this.selecionadas.push(primaria.id);
          if (this.config.agendaGrupo && existe(this.config.agendaGrupo)) this.selecionadas.push(this.config.agendaGrupo);
        }
        await this.carregar();
      } catch (err) { this.erro = err.message; }
    },
    alternarAgenda(id) {
      const i = this.selecionadas.indexOf(id);
      if (i >= 0) this.selecionadas.splice(i, 1); else this.selecionadas.push(id);
      try { localStorage.setItem(CHAVE_SELECAO, JSON.stringify(this.selecionadas)); } catch {}
      this.carregar();
    },
    mudarSemana(n) { this.inicioSemana = n === 0 ? segundaDe(hojeISO()) : somarDias(this.inicioSemana, 7 * n); this.carregar(); },
    async carregar() {
      if (!agenda.conectado) return;
      this.carregando = true; this.erro = "";
      try {
        const fim = somarDias(this.inicioSemana, 7);
        const listas = await Promise.all(this.selecionadas.map(async (id) => {
          const ag = this.agendas.find((a) => a.id === id) || {};
          const itens = await listarEventos(id, this.inicioSemana, fim);
          // Dá para editar quando a agenda é editável E o evento é dela (quem
          // organizou foi a própria pessoa ou a própria agenda); um convite
          // recebido só é editável se o organizador liberou para convidados.
          return itens.map((e) => {
            const organizador = (e.organizer && e.organizer.email) || "";
            const daAgenda = (e.organizer && e.organizer.self) || organizador === id || e.guestsCanModify;
            return { ...e, agendaId: id, cor: ag.cor, podeEditar: Boolean(ag.podeEditar && daAgenda) };
          });
        }));
        // O mesmo evento aparece em várias agendas (ex.: convite na pessoal e
        // original na do grupo): fica uma cópia só, de preferência a editável.
        const porChave = new Map();
        for (const e of listas.flat()) {
          const chave = (e.iCalUID || e.id) + "|" + ((e.start && (e.start.dateTime || e.start.date)) || "");
          const atual = porChave.get(chave);
          if (!atual || (!atual.podeEditar && e.podeEditar)) porChave.set(chave, e);
        }
        this.eventos = [...porChave.values()].sort((a, b) => tempoDoEvento(a).inicio - tempoDoEvento(b).inicio);
        const sem = semestreAtivo();
        this.atas = sem ? await listar("atas", where("semestre", "==", sem.id)) : [];
        if (this.sel) this.sel = this.eventos.find((e) => e.id === this.sel.id) || null;
      } catch (err) { this.erro = err.message || mensagemErro(err); }
      finally { this.carregando = false; }
    },

    // ---------------- painel do evento ----------------
    async abrir(e) {
      this.sel = e; this.form = null; this.encsSel = []; this.ataParaVincular = "";
      this.novoEnc = { titulo: "", responsavel: "", prazo: "" };
      await this.carregarEncs();
    },
    async carregarEncs() {
      const ata = this.ataDoSel;
      this.encsSel = ata ? await listar("encaminhamentos", where("origem.id", "==", ata.id)).catch(() => []) : [];
    },
    fechar() { this.sel = null; this.form = null; },
    criarAta(e) {
      const emails = (e.attendees || []).map((a) => (a.email || "").toLowerCase()).filter(Boolean);
      this.$router.push({
        path: "/atas/nova",
        query: {
          evento: e.id, agenda: e.agendaId, titulo: e.summary || "", data: dataDoEvento(e),
          link: e.htmlLink || "", emails: emails.join(","),
        },
      });
    },
    async vincular() {
      const ata = this.atas.find((a) => a.id === this.ataParaVincular);
      if (!ata || !this.sel) return;
      this.erro = "";
      try {
        const evento = { eventId: this.sel.id, calendarId: this.sel.agendaId, htmlLink: this.sel.htmlLink || "", titulo: this.sel.summary || "", data: dataDoEvento(this.sel) };
        await updateDoc(doc(db, "atas", ata.id), { evento });
        ata.evento = evento;
        await this.anotarAtaNoEvento(this.sel, ata.id);
        await this.carregarEncs();
        this.ok = "Ata vinculada à reunião.";
      } catch (err) { this.erro = mensagemErro(err); }
    },
    async desvincular() {
      const ata = this.ataDoSel;
      if (!ata || !confirm("Desvincular a ata desta reunião? A ata continua existindo.")) return;
      try { await updateDoc(doc(db, "atas", ata.id), { evento: null }); ata.evento = null; this.encsSel = []; }
      catch (err) { this.erro = mensagemErro(err); }
    },
    // Coloca o link da ata na descrição do evento (só se der para editá-lo).
    async anotarAtaNoEvento(e, ataId) {
      if (!e.podeEditar) return;
      try { await atualizarEvento(e.agendaId, e.id, { description: descricaoComAta(e.description, ataId) }, { notificar: false }); }
      catch (err) { console.warn("não foi possível anotar a ata no evento", err); }
    },
    async addEnc() {
      const ata = this.ataDoSel;
      if (!ata || !this.novoEnc.titulo.trim() || !this.novoEnc.responsavel) { this.erro = "Preencha o encaminhamento e o responsável."; return; }
      this.erro = "";
      try {
        await addDoc(collection(db, "encaminhamentos"), {
          titulo: this.novoEnc.titulo.trim(), descricao: "",
          responsavel: this.novoEnc.responsavel, responsavelNome: nomeDoMembro(this.novoEnc.responsavel),
          prazo: this.novoEnc.prazo || "", status: "aberto",
          origem: { tipo: "ata", id: ata.id, titulo: ata.titulo },
          criadoPor: store.membro.id, criadoPorNome: store.membro.nome,
          criadoEm: serverTimestamp(), semestre: ata.semestre || "",
        });
        this.novoEnc = { titulo: "", responsavel: "", prazo: "" };
        await this.carregarEncs();
      } catch (err) { this.erro = mensagemErro(err); }
    },

    // ---------------- criar / editar ----------------
    nova(dia) {
      const padrao = this.agendasEditaveis.find((a) => a.id === this.config.agendaGrupo) || this.agendasEditaveis.find((a) => a.primaria) || this.agendasEditaveis[0];
      if (!padrao) { this.erro = "Você não tem permissão de edição em nenhuma das suas agendas."; return; }
      this.sel = null; this.modo = "novo";
      this.form = {
        titulo: "", agendaId: padrao.id, data: dia || hojeISO(), dataFim: dia || hojeISO(),
        inicio: "14:00", fim: "15:00", diaInteiro: false, local: "", descricao: "",
        convidados: [], meet: true, notificar: true, criarAta: false,
      };
    },
    editar(e) {
      this.modo = "editar";
      this.form = { ...formDoEvento(e), agendaId: e.agendaId, notificar: true, meetJaExiste: Boolean(linkMeet(e)) };
      this.sel = e;
    },
    alternarConvidado(email) {
      const i = this.form.convidados.indexOf(email);
      if (i >= 0) this.form.convidados.splice(i, 1); else this.form.convidados.push(email);
    },
    convidarTodos() { this.form.convidados = [...new Set([...this.form.convidados, ...this.membros.map((m) => (m.email || "").toLowerCase()).filter(Boolean)])]; },
    addOutroEmail() {
      const e = this.outroEmail.trim().toLowerCase();
      if (/^\S+@\S+\.\S+$/.test(e) && !this.form.convidados.includes(e)) this.form.convidados.push(e);
      this.outroEmail = "";
    },
    async salvar() {
      const f = this.form;
      this.erro = ""; this.ok = "";
      if (!f.titulo.trim()) { this.erro = "Dê um título à reunião."; return; }
      if (!f.diaInteiro && f.fim <= f.inicio) { this.erro = "O fim precisa ser depois do início."; return; }
      this.salvando = true;
      try {
        const corpo = eventoDoForm(f);
        let ev;
        if (this.modo === "novo") {
          ev = await criarEvento(f.agendaId, corpo, { meet: f.meet, notificar: f.notificar });
        } else {
          ev = await atualizarEvento(f.agendaId, this.sel.id, corpo, { meet: f.meet && !f.meetJaExiste, notificar: f.notificar });
        }
        const criarAta = this.modo === "novo" && f.criarAta;
        this.form = null;
        this.ok = this.modo === "novo" ? "Reunião criada na agenda." : "Reunião atualizada.";
        if (criarAta) { this.criarAta({ ...ev, agendaId: f.agendaId }); return; }
        await this.carregar();
        this.sel = this.eventos.find((e) => e.id === ev.id) || null;
      } catch (err) { this.erro = err.message; }
      finally { this.salvando = false; }
    },
    async excluir(e) {
      if (!confirm(`Excluir “${e.summary || "(sem título)"}” da agenda? Os convidados serão avisados.`)) return;
      try { await excluirEvento(e.agendaId, e.id); this.sel = null; await this.carregar(); this.ok = "Reunião excluída."; }
      catch (err) { this.erro = err.message; }
    },

    // ---------------- configuração (liderança) ----------------
    async salvarConfig() {
      this.erro = ""; this.ok = "";
      try {
        await setDoc(doc(db, "config", "agenda"), { clientId: this.config.clientId.trim(), agendaGrupo: this.config.agendaGrupo.trim() }, { merge: true });
        this.ok = "Configuração da agenda salva."; this.mostrarConfig = false;
      } catch (err) { this.erro = mensagemErro(err); }
    },
  },
  template: `
  <div>
    <header class="cabecalho">
      <div><h1>Agenda</h1><p class="sub">Suas agendas do Google, com as atas e os encaminhamentos de cada reunião.</p></div>
      <div class="acoes" v-if="agenda.conectado">
        <div class="filtros" style="margin:0">
          <button class="btn icone" @click="mudarSemana(-1)" v-html="ICONES.voltar" title="Semana anterior"></button>
          <button class="btn pequeno" @click="mudarSemana(0)">Hoje</button>
          <button class="btn icone" @click="mudarSemana(1)" v-html="ICONES.seta" title="Próxima semana"></button>
          <b style="min-width:110px">{{ tituloSemana }}</b>
        </div>
        <button class="btn destaque" @click="nova()"><span v-html="ICONES.mais"></span> Nova reunião</button>
      </div>
    </header>

    <p class="erro" v-if="erro">{{ erro }}</p>
    <p class="sucesso" v-if="ok">{{ ok }}</p>

    <!-- configuração: só a liderança -->
    <section class="cartao" v-if="lider && (mostrarConfig || !configurado)" style="margin-bottom:16px">
      <div class="cartao-titulo">Configurar integração com o Google Agenda
        <button class="btn pequeno" v-if="configurado" @click="mostrarConfig = false">fechar</button></div>
      <p class="dica">O Client ID é o identificador OAuth do tipo "Aplicativo da Web" do projeto no Google Cloud (o mesmo do Firebase). Não é segredo. Passo a passo no README.</p>
      <label class="campo"><span>Client ID</span><input v-model="config.clientId" placeholder="123456789-abc.apps.googleusercontent.com"></label>
      <label class="campo"><span>Agenda do grupo (opcional)</span>
        <select v-model="config.agendaGrupo" v-if="agendas.length"><option value="">— nenhuma —</option><option v-for="a in agendas" :key="a.id" :value="a.id">{{ a.nome }}</option></select>
        <input v-else v-model="config.agendaGrupo" placeholder="id da agenda compartilhada do GLean (…@group.calendar.google.com)">
      </label>
      <p class="dica">A agenda do grupo vem marcada para todos e é onde as novas reuniões são criadas por padrão.</p>
      <button class="btn destaque" @click="salvarConfig">Salvar</button>
    </section>

    <div class="aviso" v-if="!configurado && !lider">A integração com o Google Agenda ainda não foi configurada pela liderança.</div>

    <section class="cartao" v-else-if="configurado && !agenda.conectado" style="text-align:center;padding:36px 22px">
      <div style="width:56px;height:56px;margin:0 auto 12px;color:var(--azul)" v-html="ICONES.agenda"></div>
      <h2 style="font-size:20px;margin-bottom:6px">Conecte o seu Google Agenda</h2>
      <p class="dica" style="max-width:460px;margin:0 auto 18px">Uma janela do Google vai pedir permissão para ver e editar eventos das suas agendas. A conexão vale por cerca de uma hora; depois é só clicar de novo.</p>
      <button class="btn destaque" @click="entrar" :disabled="agenda.conectando">{{ agenda.conectando ? "Conectando…" : "Conectar Google Agenda" }}</button>
      <p class="erro" v-if="agenda.erro">{{ agenda.erro }}</p>
    </section>

    <template v-if="agenda.conectado">
      <div class="filtros">
        <button v-for="a in agendas" :key="a.id" class="chip-agenda" :class="{ sel: selecionadas.includes(a.id) }" @click="alternarAgenda(a.id)" :style="{ '--cor': a.cor }">
          <i></i>{{ a.nome }}<small v-if="a.id === config.agendaGrupo">grupo</small>
        </button>
        <span style="flex:1"></span>
        <button class="btn pequeno" v-if="lider" @click="mostrarConfig = true">Configurar</button>
        <button class="btn pequeno" @click="sairDaAgenda">Desconectar</button>
      </div>

      <div class="semana" :class="{ carregando }">
        <div class="dia" v-for="d in dias" :key="d.iso" :class="{ hoje: d.hoje }">
          <div class="dia-cab"><span>{{ d.nome }}</span><b>{{ formatarData(d.iso) }}</b>
            <button class="dia-mais" @click="nova(d.iso)" title="Nova reunião neste dia">+</button></div>
          <button class="evento" v-for="e in d.eventos" :key="e.agendaId + e.id" @click="abrir(e)" :style="{ '--cor': e.cor }" :class="{ sel: sel && sel.id === e.id }">
            <small>{{ rotuloHorario(e) }}</small>
            <b>{{ e.summary || "(sem título)" }}</b>
            <span class="evento-selos">
              <span class="selo ok" v-if="ataPorEvento[e.id]">ata</span>
              <span class="selo neutro" v-if="linkMeet(e)">Meet</span>
            </span>
          </button>
          <p class="dia-vazio" v-if="!d.eventos.length">—</p>
        </div>
      </div>
    </template>

    <!-- ================= painel do evento ================= -->
    <div class="modal-fundo" v-if="sel && !form" @click.self="fechar">
      <div class="modal-caixa">
        <div class="cartao-titulo" style="align-items:flex-start">
          <div><h2 style="font-size:20px">{{ sel.summary || "(sem título)" }}</h2>
            <p class="dica" style="margin:4px 0 0">{{ formatarData(dataDoEvento(sel), true) }} · {{ rotuloHorario(sel) }}<span v-if="sel.location"> · {{ sel.location }}</span></p></div>
          <button class="remover" @click="fechar" title="Fechar">×</button>
        </div>

        <div class="linha" style="gap:8px;margin-bottom:12px">
          <a class="btn pequeno destaque" v-if="linkMeet(sel)" :href="linkMeet(sel)" target="_blank" rel="noopener">Entrar no Meet</a>
          <a class="btn pequeno" :href="sel.htmlLink" target="_blank" rel="noopener">Abrir no Google Agenda</a>
          <button class="btn pequeno" v-if="sel.podeEditar" @click="editar(sel)">Editar</button>
          <button class="btn pequeno perigo" v-if="sel.podeEditar" @click="excluir(sel)">Excluir</button>
        </div>

        <div class="dica" v-if="(sel.attendees || []).length">
          Convidados: {{ sel.attendees.map(a => nomeMembroPorEmail((a.email || '').toLowerCase())).join(", ") }}
        </div>
        <div v-if="sel.description" class="descricao-evento">{{ sel.description }}</div>

        <section class="bloco-ata">
          <template v-if="ataDoSel">
            <div class="cartao-titulo" style="margin-bottom:6px">📄 {{ ataDoSel.titulo }}
              <span class="linha" style="gap:6px"><router-link class="btn pequeno" :to="'/atas/' + ataDoSel.id">Abrir ata</router-link>
              <button class="btn pequeno" @click="desvincular">Desvincular</button></span></div>
            <b style="font-size:13px">Encaminhamentos</b>
            <p class="vazio" v-if="!encsSel.length" style="padding:6px 0">Nenhum ainda.</p>
            <div class="enc" v-for="x in encsSel" :key="x.id" style="padding:8px 0">
              <span class="status-ponto" :class="'status-' + x.status"></span>
              <div><div class="titulo">{{ x.titulo }}</div><div class="meta"><span>{{ x.responsavelNome }}</span><span v-if="x.prazo">prazo {{ formatarData(x.prazo, true) }}</span><span>{{ nomeStatus(x.status) }}</span></div></div>
              <div></div>
            </div>
            <div class="linha" style="margin-top:8px">
              <label class="campo" style="flex:2;margin:0"><input v-model="novoEnc.titulo" placeholder="Novo encaminhamento" @keyup.enter="addEnc"></label>
              <label class="campo" style="margin:0"><select v-model="novoEnc.responsavel"><option value="">Responsável…</option><option v-for="m in membros" :key="m.id" :value="m.id">{{ m.nome }}</option></select></label>
              <label class="campo curto" style="margin:0"><input type="date" v-model="novoEnc.prazo"></label>
              <button class="btn pequeno destaque" @click="addEnc">Adicionar</button>
            </div>
          </template>
          <template v-else>
            <div class="cartao-titulo" style="margin-bottom:6px">Ata desta reunião</div>
            <p class="dica">Crie a ata já com título, data e participantes da reunião, ou vincule uma ata que já existe. Os encaminhamentos da ata aparecem aqui.</p>
            <div class="linha">
              <button class="btn destaque" @click="criarAta(sel)">Criar ata</button>
              <label class="campo" style="margin:0" v-if="atasLivres.length"><select v-model="ataParaVincular"><option value="">Vincular ata existente…</option><option v-for="a in atasLivres" :key="a.id" :value="a.id">{{ formatarData(a.data) }} · {{ a.titulo }}</option></select></label>
              <button class="btn" v-if="ataParaVincular" @click="vincular">Vincular</button>
            </div>
          </template>
        </section>
      </div>
    </div>

    <!-- ================= formulário ================= -->
    <div class="modal-fundo" v-if="form" @click.self="form = null">
      <div class="modal-caixa">
        <div class="cartao-titulo"><h2 style="font-size:20px">{{ modo === "novo" ? "Nova reunião" : "Editar reunião" }}</h2>
          <button class="remover" @click="form = null" title="Fechar">×</button></div>
        <label class="campo"><span>Título</span><input v-model="form.titulo" placeholder="Ex.: Reunião de Kikai"></label>
        <div class="linha">
          <label class="campo" v-if="modo === 'novo'"><span>Agenda</span><select v-model="form.agendaId"><option v-for="a in agendasEditaveis" :key="a.id" :value="a.id">{{ a.nome }}</option></select></label>
          <label class="campo curto"><span>Data</span><input type="date" v-model="form.data"></label>
          <template v-if="!form.diaInteiro">
            <label class="campo curto"><span>Início</span><input type="time" v-model="form.inicio"></label>
            <label class="campo curto"><span>Fim</span><input type="time" v-model="form.fim"></label>
          </template>
          <label class="campo curto" v-else><span>Até</span><input type="date" v-model="form.dataFim"></label>
          <label class="check" style="margin-bottom:14px"><input type="checkbox" v-model="form.diaInteiro"> Dia inteiro</label>
        </div>
        <label class="campo"><span>Local</span><input v-model="form.local" placeholder="Sede, sala, endereço…"></label>
        <label class="campo"><span>Descrição / pauta</span><textarea v-model="form.descricao" rows="3"></textarea></label>
        <div class="campo">
          <span>Convidados <button class="btn pequeno" style="margin-left:8px" @click="convidarTodos">convidar todos</button></span>
          <div class="linha" style="gap:6px 16px">
            <label class="check" v-for="m in membros" :key="m.id"><input type="checkbox" :checked="form.convidados.includes((m.email || '').toLowerCase())" @change="alternarConvidado((m.email || '').toLowerCase())"> {{ m.nome }}</label>
          </div>
          <div class="linha" style="gap:6px;margin-top:8px">
            <span class="selo neutro" v-for="e in convidadosExternos" :key="e">{{ e }} <button class="remover" style="padding:0 2px;font-size:14px" @click="alternarConvidado(e)">×</button></span>
            <input class="entrada" style="max-width:260px" v-model="outroEmail" placeholder="outro e-mail" @keyup.enter="addOutroEmail">
          </div>
        </div>
        <div class="linha" style="gap:8px 20px;margin-bottom:12px">
          <label class="check" v-if="!form.meetJaExiste"><input type="checkbox" v-model="form.meet"> Adicionar link do Google Meet</label>
          <label class="check"><input type="checkbox" v-model="form.notificar"> Enviar convite/aviso por e-mail</label>
          <label class="check" v-if="modo === 'novo'"><input type="checkbox" v-model="form.criarAta"> Já criar a ata</label>
        </div>
        <div class="linha">
          <button class="btn destaque" @click="salvar" :disabled="salvando">{{ salvando ? "Salvando…" : "Salvar na agenda" }}</button>
          <button class="btn" @click="form = null">Cancelar</button>
        </div>
      </div>
    </div>
  </div>`,
};
