import { store, ehGestao, nomeDoMembro, semestreAtivo } from "../lib/store.js";
import { db, doc, collection, addDoc, updateDoc, deleteDoc, serverTimestamp, mensagemErro } from "../lib/firebase.js";
import {
  ddlsDoMembro, ehDestinatario, resolverDestinatarios, rotuloPublico, rotuloPrazo, situacaoPrazo, prazoDe,
  proximas, HORA_PADRAO,
} from "../lib/ddl.js";
import { lembretes, pedirPermissao } from "../lib/lembretes.js";
import { agenda, criarEvento } from "../lib/agenda.js";
import { formatarData, deISO } from "../lib/util.js";
import { ICONES } from "../components/Icones.js";
import Destinatarios, { publicoVazio } from "../components/Destinatarios.js";
import SeletorPrazo from "../components/SeletorPrazo.js";

const DIA_SEMANA = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const ROTULO_TIPO = { tarefa: "Tarefa", formulario: "Formulário", pesquisinha: "Pesquisinha" };
const novaDdl = () => ({ titulo: "", descricao: "", publico: publicoVazio(), prazo: { categoria: "quinta", data: proximas(4, 1)[0], hora: HORA_PADRAO }, convite: false });

export default {
  components: { Destinatarios, SeletorPrazo },
  data() {
    return {
      store, lembretes, agenda, ICONES, ROTULO_TIPO,
      aba: "minhas", mostrarFeitas: false, mostrarNova: false, nova: novaDdl(),
      abertaFaltando: "", salvando: false, erro: "", ok: "",
    };
  },
  computed: {
    uid() { return store.membro.id; },
    gestao() { return ehGestao(); },
    minhas() { return ddlsDoMembro(this.uid); },
    pendentes() { return this.minhas.filter((d) => !d.feito); },
    feitas() { return this.minhas.filter((d) => d.feito).reverse(); },
    // pendentes agrupadas por dia do prazo
    grupos() {
      const mapa = new Map();
      for (const d of this.pendentes) {
        const dia = (d.prazo || "").split("T")[0] || "sem-prazo";
        if (!mapa.has(dia)) mapa.set(dia, []);
        mapa.get(dia).push(d);
      }
      return [...mapa.entries()].map(([dia, itens]) => ({ dia, titulo: this.tituloDia(dia), itens }));
    },
    // DDLs criadas (tarefas + formulários com prazo), com o andamento de cada uma
    criadas() {
      const minhasOuTodas = (autor) => this.aba === "todas" || autor === this.uid;
      const tarefas = store.ddls.filter((d) => minhasOuTodas(d.criadoPor)).map((d) => this.andamento({ ...d, tipo: "tarefa" }, d.concluidos));
      const forms = store.formularios.filter((f) => f.prazo && minhasOuTodas(f.autor))
        .map((f) => this.andamento({ id: f.id, tipo: "formulario", titulo: f.titulo, prazo: f.prazo, publico: f.publico, destinatarios: f.destinatarios, criadoPorNome: f.autorNome, link: `/formularios/${f.id}/respostas` }, f.respondentes));
      return [...tarefas, ...forms].sort((a, b) => (b.prazo || "").localeCompare(a.prazo || ""));
    },
    podeConvidar() { return agenda.conectado && Boolean(store.configAgenda && store.configAgenda.agendaGrupo); },
    suportaNotificacao() { return lembretes.permissao !== "indisponivel"; },
  },
  methods: {
    formatarData, rotuloPrazo, situacaoPrazo, rotuloPublico, nomeDoMembro,
    tituloDia(dia) {
      if (dia === "sem-prazo") return "Sem prazo";
      const d = deISO(dia);
      return `${DIA_SEMANA[d.getDay()]}, ${formatarData(dia)}`;
    },
    andamento(item, mapaFeitos) {
      const destinatarios = item.publico && item.publico.tipo !== "todos" ? (item.destinatarios || []) : resolverDestinatarios(item.publico);
      const feitos = destinatarios.filter((u) => mapaFeitos && mapaFeitos[u]);
      return { ...item, total: destinatarios.length, feitos: feitos.length, faltando: destinatarios.filter((u) => !(mapaFeitos && mapaFeitos[u])) };
    },
    abrir(d) { if (d.link) this.$router.push(d.link); },
    async marcar(d, feito) {
      this.erro = "";
      try {
        await updateDoc(doc(db, "ddls", d.id), { [`concluidos.${this.uid}`]: feito ? new Date().toISOString() : null });
      } catch (err) { this.erro = mensagemErro(err); }
    },
    async criar() {
      this.erro = ""; this.ok = "";
      const n = this.nova;
      if (!n.titulo.trim()) { this.erro = "Dê um título à DDL."; return; }
      if (!n.prazo || !n.prazo.data) { this.erro = "Escolha o prazo."; return; }
      const destinatarios = resolverDestinatarios(n.publico);
      if (!destinatarios.length) { this.erro = "Escolha pelo menos uma pessoa."; return; }
      this.salvando = true;
      try {
        const prazo = prazoDe(n.prazo.data, n.prazo.hora);
        const dados = {
          titulo: n.titulo.trim(), descricao: n.descricao.trim(),
          prazo, categoria: n.prazo.categoria,
          publico: n.publico, destinatarios: n.publico.tipo === "todos" ? [] : destinatarios,
          concluidos: {},
          criadoPor: this.uid, criadoPorNome: store.membro.nome, criadoEm: serverTimestamp(),
          semestre: (semestreAtivo() || {}).id || "",
        };
        const ref = await addDoc(collection(db, "ddls"), dados);
        if (n.convite && this.podeConvidar) await this.convidar(ref.id, dados, destinatarios);
        this.nova = novaDdl(); this.mostrarNova = false; this.aba = "criadas";
        this.ok = "DDL criada." + (n.convite && this.podeConvidar ? " Os destinatários receberam o convite na agenda." : "");
      } catch (err) { this.erro = mensagemErro(err); }
      finally { this.salvando = false; }
    },
    // Evento de dia inteiro na agenda do grupo, com os destinatários
    // convidados: o Google avisa por e-mail e nas notificações de cada um.
    async convidar(id, dados, destinatarios) {
      const emails = destinatarios.map((u) => (store.membros.find((m) => m.id === u) || {}).email).filter(Boolean);
      const dia = dados.prazo.split("T")[0];
      const fim = new Date(deISO(dia).getTime() + 86400000);
      const fimISO = `${fim.getFullYear()}-${String(fim.getMonth() + 1).padStart(2, "0")}-${String(fim.getDate()).padStart(2, "0")}`;
      try {
        await criarEvento(store.configAgenda.agendaGrupo, {
          summary: `DDL: ${dados.titulo} (até ${dados.prazo.split("T")[1]})`,
          description: `${dados.descricao ? dados.descricao + "\n\n" : ""}Marque como feita no GIG: ${location.origin}${location.pathname}#/ddls`,
          start: { date: dia }, end: { date: fimISO },
          attendees: emails.map((email) => ({ email })),
          colorId: "11",
        }, { notificar: true });
      } catch (err) {
        this.erro = "A DDL foi criada, mas o convite na agenda falhou: " + err.message;
      }
    },
    async excluir(item) {
      if (item.tipo !== "tarefa") { this.$router.push(`/formularios/${item.id}/editar`); return; }
      if (!confirm(`Excluir a DDL "${item.titulo}"?`)) return;
      try { await deleteDoc(doc(db, "ddls", item.id)); } catch (err) { this.erro = mensagemErro(err); }
    },
    ativarNotificacoes: pedirPermissao,
  },
  template: `
  <div>
    <header class="cabecalho">
      <div><h1>DDLs</h1><p class="sub">Entregas com prazo: terça ou quinta às 23:59, ou um prazo excepcional.</p></div>
      <div class="acoes">
        <router-link to="/formularios/novo?prazo=1" class="btn"><span v-html="ICONES.form"></span> Formulário com prazo</router-link>
        <button class="btn destaque" @click="mostrarNova = !mostrarNova"><span v-html="ICONES.mais"></span> Nova DDL</button>
      </div>
    </header>

    <p class="erro" v-if="erro">{{ erro }}</p>
    <p class="sucesso" v-if="ok">{{ ok }}</p>

    <section class="cartao" v-if="mostrarNova">
      <div class="cartao-titulo">Nova DDL para um grupo</div>
      <label class="campo"><span>O que deve ser entregue</span><input v-model="nova.titulo" placeholder="Ex.: Enviar A3 pessoal revisada"></label>
      <label class="campo"><span>Detalhes (opcional)</span><textarea v-model="nova.descricao" rows="2"></textarea></label>
      <div class="campo"><span>Para quem</span><Destinatarios v-model="nova.publico" /></div>
      <div class="campo"><span>Prazo</span><SeletorPrazo v-model="nova.prazo" /></div>
      <label class="check" v-if="podeConvidar" style="margin-bottom:14px"><input type="checkbox" v-model="nova.convite"> Convidar os destinatários na agenda do grupo (avisa por e-mail e no Google Agenda)</label>
      <p class="dica" v-else-if="agenda && !agenda.conectado">Para mandar convite na agenda junto com a DDL, conecte o Google Agenda na tela Agenda.</p>
      <div class="linha"><button class="btn destaque" @click="criar" :disabled="salvando">Criar DDL</button><button class="btn" @click="mostrarNova = false">Cancelar</button></div>
    </section>

    <div class="abas">
      <button class="aba" :class="{ ativa: aba === 'minhas' }" @click="aba = 'minhas'">Para mim <span class="cont">{{ pendentes.length }}</span></button>
      <button class="aba" :class="{ ativa: aba === 'criadas' }" @click="aba = 'criadas'">Criadas por mim</button>
      <button class="aba" v-if="gestao" :class="{ ativa: aba === 'todas' }" @click="aba = 'todas'">Todas</button>
    </div>

    <template v-if="aba === 'minhas'">
      <section class="cartao" v-if="!pendentes.length"><p class="vazio">Nenhuma DDL pendente. 🎉</p></section>
      <section class="cartao" v-for="g in grupos" :key="g.dia">
        <div class="cartao-titulo">{{ g.titulo }} <span class="selo" :class="g.itens.some(d => situacaoPrazo(d.prazo).classe === 'atrasado') ? 'erro' : 'aviso'">{{ g.itens.length }} pendente{{ g.itens.length > 1 ? "s" : "" }}</span></div>
        <div class="ddl" v-for="d in g.itens" :key="d.tipo + d.id" :class="situacaoPrazo(d.prazo).classe">
          <span class="ddl-tipo" :class="'tipo-' + d.tipo" v-html="d.tipo === 'tarefa' ? ICONES.ddl : ICONES.form"></span>
          <div class="ddl-corpo">
            <div class="titulo">{{ d.titulo }}</div>
            <div class="meta"><span class="prazo">{{ situacaoPrazo(d.prazo).texto }}</span><span>{{ ROTULO_TIPO[d.tipo] }}</span><span v-if="d.criadoPorNome">por {{ d.criadoPorNome }}</span></div>
            <div class="dica" style="margin:3px 0 0" v-if="d.descricao && d.tipo === 'tarefa'">{{ d.descricao }}</div>
          </div>
          <div class="acoes">
            <button class="btn pequeno destaque" v-if="d.tipo === 'tarefa'" @click="marcar(d, true)">Marcar como feita</button>
            <button class="btn pequeno destaque" v-else @click="abrir(d)">Responder</button>
          </div>
        </div>
      </section>

      <button class="btn pequeno" v-if="feitas.length" @click="mostrarFeitas = !mostrarFeitas">{{ mostrarFeitas ? "Esconder" : "Mostrar" }} feitas ({{ feitas.length }})</button>
      <section class="cartao" v-if="mostrarFeitas && feitas.length" style="margin-top:12px">
        <div class="ddl feito" v-for="d in feitas" :key="'f' + d.tipo + d.id">
          <span class="ddl-tipo tipo-ok">✓</span>
          <div class="ddl-corpo"><div class="titulo">{{ d.titulo }}</div><div class="meta"><span>{{ rotuloPrazo(d.prazo) }}</span><span>{{ ROTULO_TIPO[d.tipo] }}</span></div></div>
          <div class="acoes">
            <button class="btn pequeno" v-if="d.tipo === 'tarefa'" @click="marcar(d, false)">Desfazer</button>
            <button class="btn pequeno" v-else @click="abrir(d)">Ver</button>
          </div>
        </div>
      </section>
    </template>

    <template v-else>
      <section class="cartao" v-if="!criadas.length"><p class="vazio">{{ aba === 'todas' ? "Nenhuma DDL criada ainda." : "Você ainda não criou DDLs." }}</p></section>
      <section class="cartao" v-else>
        <div class="ddl" v-for="d in criadas" :key="'c' + d.tipo + d.id" :class="situacaoPrazo(d.prazo).classe">
          <span class="ddl-tipo" :class="'tipo-' + d.tipo" v-html="d.tipo === 'tarefa' ? ICONES.ddl : ICONES.form"></span>
          <div class="ddl-corpo">
            <div class="titulo">{{ d.titulo }}</div>
            <div class="meta"><span>{{ rotuloPrazo(d.prazo) }}</span><span>{{ rotuloPublico(d.publico) }}</span><span v-if="aba === 'todas'">por {{ d.criadoPorNome }}</span></div>
            <div class="progresso"><i :style="{ width: (d.total ? d.feitos / d.total * 100 : 0) + '%' }"></i></div>
            <button class="link-faltando" v-if="d.faltando.length" @click="abertaFaltando = abertaFaltando === d.id ? '' : d.id">
              {{ d.feitos }}/{{ d.total }} entregaram · {{ abertaFaltando === d.id ? "esconder" : "ver quem falta" }}
            </button>
            <span class="dica" v-else style="margin:0">Todos entregaram ✓</span>
            <div class="dica" style="margin:4px 0 0" v-if="abertaFaltando === d.id">Faltam: {{ d.faltando.map(nomeDoMembro).join(", ") }}</div>
          </div>
          <div class="acoes">
            <router-link v-if="d.tipo === 'formulario'" class="btn pequeno" :to="d.link">Respostas</router-link>
            <button class="btn pequeno perigo" v-if="d.tipo === 'tarefa'" @click="excluir(d)">Excluir</button>
          </div>
        </div>
      </section>
    </template>

    <section class="cartao notificacoes">
      <div class="cartao-titulo">Avisos de DDL</div>
      <p class="dica">Nos dias de DDL (terça, quinta ou um prazo excepcional) aparece uma faixa no topo do GIG e o item DDLs mostra quantas faltam. Com as notificações do navegador ligadas, você também recebe um aviso de manhã e à noite enquanto o GIG estiver aberto em alguma aba.</p>
      <div class="linha" style="align-items:center">
        <span class="selo ok" v-if="lembretes.permissao === 'granted'">Notificações ligadas neste navegador</span>
        <span class="selo erro" v-else-if="lembretes.permissao === 'denied'">Notificações bloqueadas: libere nas configurações do site, no cadeado da barra de endereço</span>
        <span class="selo neutro" v-else-if="!suportaNotificacao">Este navegador não suporta notificações</span>
        <button class="btn" v-else @click="ativarNotificacoes">Ligar notificações neste navegador</button>
      </div>
    </section>
  </div>`,
};
