import { store, semestreAtivo, membrosAtivos, nomeDoMembro, ehLider } from "../lib/store.js";
import {
  db, doc, collection, addDoc, updateDoc, deleteDoc, ler, listar, where, serverTimestamp, mensagemErro,
} from "../lib/firebase.js";
import { hojeISO, formatarData } from "../lib/util.js";
import { TIPOS_ATA, nomeStatus } from "../lib/constantes.js";
import { ICONES } from "../components/Icones.js";
import { agenda, lerEvento, atualizarEvento, descricaoComAta } from "../lib/agenda.js";

const novoEnc = () => ({ titulo: "", responsavel: "", prazo: "" });

export default {
  props: { id: String },
  data() {
    return {
      store, TIPOS_ATA, ICONES,
      ata: { titulo: "", tipo: "Reunião Geral", processo: "", data: hojeISO(), participantes: [], texto: "" },
      encs: [], novos: [novoEnc()],
      carregando: Boolean(this.id), salvando: false, erro: "", ok: "", editando: !this.id,
    };
  },
  computed: {
    semestre() { return semestreAtivo(); },
    membros() { return membrosAtivos(); },
    nova() { return !this.id; },
    podeEditar() { return this.nova || ehLider() || this.ata.autor === store.membro.id; },
  },
  created() {
    if (this.id) this.carregar();
    else this.preencherDaReuniao();
  },
  methods: {
    nomeDoMembro, nomeStatus, formatarData,
    async carregar() {
      this.erro = "";
      try {
        const a = await ler("atas", this.id);
        if (!a) { this.erro = "Ata não encontrada."; return; }
        this.ata = { participantes: [], ...a };
        this.encs = await listar("encaminhamentos", where("origem.id", "==", this.id));
      } catch (err) { this.erro = mensagemErro(err); }
      finally { this.carregando = false; }
    },
    // Vindo da Agenda ("Criar ata"): título, data e participantes já vêm da
    // reunião, e a ata fica vinculada ao evento.
    preencherDaReuniao() {
      const q = this.$route.query || {};
      if (!q.evento) return;
      if (!this.membros.length) {
        const parar = this.$watch(() => store.membros.length, (n) => { if (n) { parar(); this.preencherDaReuniao(); } });
        return;
      }
      const emails = String(q.emails || "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
      const participantes = this.membros.filter((m) => emails.includes((m.email || "").toLowerCase())).map((m) => m.id);
      if (store.membro && !participantes.includes(store.membro.id)) participantes.push(store.membro.id);
      this.ata.titulo = String(q.titulo || "");
      if (q.data) this.ata.data = String(q.data);
      this.ata.participantes = participantes;
      this.ata.evento = {
        eventId: String(q.evento), calendarId: String(q.agenda || ""), htmlLink: String(q.link || ""),
        titulo: String(q.titulo || ""), data: String(q.data || ""),
      };
    },
    // Põe o link da ata na descrição do evento, para quem abre direto no Google.
    // Só funciona com a agenda conectada e permissão de edição; se não der, a
    // ata continua vinculada do lado da plataforma.
    async anotarNoEvento(ataId, evento) {
      if (!agenda.conectado || !evento || !evento.calendarId) return;
      try {
        const e = await lerEvento(evento.calendarId, evento.eventId);
        await atualizarEvento(evento.calendarId, evento.eventId, { description: descricaoComAta(e.description, ataId) }, { notificar: false });
      } catch (err) { console.warn("não foi possível anotar a ata no evento", err); }
    },
    marcarTodos() { this.ata.participantes = this.membros.map((m) => m.id); },
    addNovo() { this.novos.push(novoEnc()); },
    removerNovo(i) { this.novos.splice(i, 1); },
    async salvar() {
      this.erro = ""; this.ok = "";
      if (!this.ata.titulo.trim()) { this.erro = "Dê um título à ata."; return; }
      const pendentes = this.novos.filter((n) => n.titulo.trim());
      if (pendentes.some((n) => !n.responsavel)) { this.erro = "Todo encaminhamento precisa de um responsável."; return; }
      this.salvando = true;
      try {
        const dados = {
          titulo: this.ata.titulo.trim(), tipo: this.ata.tipo, processo: this.ata.processo || "",
          data: this.ata.data || hojeISO(), participantes: this.ata.participantes || [], texto: this.ata.texto || "",
          semestre: this.semestre ? this.semestre.id : "", atualizadoEm: serverTimestamp(),
          evento: this.ata.evento || null,
        };
        let id = this.id;
        if (this.nova) {
          const ref = await addDoc(collection(db, "atas"), {
            ...dados, autor: store.membro.id, autorNome: store.membro.nome, criadoEm: serverTimestamp(),
          });
          id = ref.id;
          await this.anotarNoEvento(id, dados.evento);
        } else {
          await updateDoc(doc(db, "atas", id), dados);
        }
        for (const n of pendentes) {
          await addDoc(collection(db, "encaminhamentos"), {
            titulo: n.titulo.trim(), descricao: "",
            responsavel: n.responsavel, responsavelNome: nomeDoMembro(n.responsavel),
            prazo: n.prazo || "", status: "aberto",
            origem: { tipo: "ata", id, titulo: dados.titulo },
            criadoPor: store.membro.id, criadoPorNome: store.membro.nome,
            criadoEm: serverTimestamp(), semestre: dados.semestre,
          });
        }
        this.novos = [novoEnc()];
        if (this.nova) { this.$router.replace("/atas/" + id); return; }
        this.editando = false;
        this.ok = "Ata salva.";
        await this.carregar();
      } catch (err) { this.erro = mensagemErro(err); }
      finally { this.salvando = false; }
    },
    async excluir() {
      if (!confirm("Excluir esta ata? Os encaminhamentos criados a partir dela continuam existindo.")) return;
      try {
        await deleteDoc(doc(db, "atas", this.id));
        this.$router.replace("/atas");
      } catch (err) { this.erro = mensagemErro(err); }
    },
  },
  template: `
  <div>
    <header class="cabecalho">
      <div>
        <router-link to="/atas" class="btn pequeno" style="margin-bottom:8px"><span v-html="ICONES.voltar"></span> Atas</router-link>
        <h1>{{ nova ? "Nova ata" : ata.titulo }}</h1>
        <p class="sub" v-if="!nova">{{ formatarData(ata.data, true) }} · {{ ata.tipo }} · {{ ata.autorNome || nomeDoMembro(ata.autor) }}</p>
        <p class="sub" v-if="ata.evento && ata.evento.eventId">
          📅 Reunião na agenda<span v-if="ata.evento.titulo">: {{ ata.evento.titulo }}</span>
          · <router-link to="/agenda">ver na Agenda</router-link>
          <template v-if="ata.evento.htmlLink"> · <a :href="ata.evento.htmlLink" target="_blank" rel="noopener">abrir no Google Agenda</a></template>
        </p>
      </div>
      <div class="acoes" v-if="!nova && podeEditar && !editando">
        <button class="btn" @click="editando = true">Editar</button>
        <button class="btn perigo" @click="excluir">Excluir</button>
      </div>
    </header>

    <p class="erro" v-if="erro">{{ erro }}</p>
    <p class="sucesso" v-if="ok">{{ ok }}</p>
    <p class="vazio" v-if="carregando">Carregando…</p>

    <template v-else-if="editando && podeEditar">
      <section class="cartao">
        <div class="linha">
          <label class="campo" style="flex:2"><span>Título</span><input v-model="ata.titulo" placeholder="Ex.: Reunião Geral — semana 5"></label>
          <label class="campo"><span>Tipo</span><select v-model="ata.tipo"><option v-for="t in TIPOS_ATA" :key="t">{{ t }}</option></select></label>
          <label class="campo"><span>Processo (opcional)</span><select v-model="ata.processo"><option value="">—</option><option v-for="p in store.processos" :key="p.id" :value="p.id">{{ p.nome }}</option></select></label>
          <label class="campo curto"><span>Data</span><input type="date" v-model="ata.data"></label>
        </div>
        <div class="campo">
          <span>Participantes <button class="btn pequeno" style="margin-left:8px" @click="marcarTodos">marcar todos</button></span>
          <div class="linha" style="gap:6px 16px">
            <label class="check" v-for="m in membros" :key="m.id"><input type="checkbox" :value="m.id" v-model="ata.participantes"> {{ m.nome }}</label>
          </div>
        </div>
        <label class="campo"><span>Conteúdo</span><textarea v-model="ata.texto" rows="12" placeholder="Pauta, decisões, observações…"></textarea></label>
      </section>

      <section class="cartao">
        <div class="cartao-titulo">Encaminhamentos desta ata</div>
        <div v-if="encs.length" style="margin-bottom:14px">
          <div class="enc" v-for="e in encs" :key="e.id">
            <span class="status-ponto" :class="'status-' + e.status"></span>
            <div><div class="titulo">{{ e.titulo }}</div><div class="meta"><span>{{ e.responsavelNome }}</span><span v-if="e.prazo">prazo {{ formatarData(e.prazo, true) }}</span><span>{{ nomeStatus(e.status) }}</span></div></div>
            <div></div>
          </div>
        </div>
        <p class="dica">Novos encaminhamentos: cada linha vira um item na lista da pessoa responsável.</p>
        <div class="linha" v-for="(n, i) in novos" :key="i" style="margin-bottom:6px">
          <label class="campo" style="flex:2;margin:0"><input v-model="n.titulo" placeholder="O que foi combinado"></label>
          <label class="campo" style="margin:0"><select v-model="n.responsavel"><option value="">Responsável…</option><option v-for="m in membros" :key="m.id" :value="m.id">{{ m.nome }}</option></select></label>
          <label class="campo curto" style="margin:0"><input type="date" v-model="n.prazo"></label>
          <button class="remover" @click="removerNovo(i)" title="Remover">×</button>
        </div>
        <button class="btn pequeno" @click="addNovo"><span v-html="ICONES.mais"></span> encaminhamento</button>
      </section>

      <section class="cartao">
        <div class="linha">
          <button class="btn destaque" @click="salvar" :disabled="salvando"><span v-html="ICONES.salvar"></span> Salvar ata</button>
          <button class="btn" v-if="!nova" @click="editando = false; carregar()">Cancelar</button>
          <router-link v-else to="/atas" class="btn">Cancelar</router-link>
        </div>
      </section>
    </template>

    <template v-else>
      <section class="cartao">
        <div class="dica" v-if="ata.participantes && ata.participantes.length">
          Participantes: {{ ata.participantes.map(nomeDoMembro).join(", ") }}
        </div>
        <div style="white-space:pre-wrap;line-height:1.6">{{ ata.texto || "(sem conteúdo)" }}</div>
      </section>
      <section class="cartao">
        <div class="cartao-titulo">Encaminhamentos <router-link to="/encaminhamentos" class="btn pequeno">Ver meus</router-link></div>
        <p class="vazio" v-if="!encs.length">Nenhum encaminhamento nesta ata.</p>
        <div class="enc" v-for="e in encs" :key="e.id">
          <span class="status-ponto" :class="'status-' + e.status"></span>
          <div><div class="titulo">{{ e.titulo }}</div><div class="meta"><span>{{ e.responsavelNome }}</span><span v-if="e.prazo">prazo {{ formatarData(e.prazo, true) }}</span><span>{{ nomeStatus(e.status) }}</span></div></div>
          <div></div>
        </div>
      </section>
    </template>
  </div>`,
};
