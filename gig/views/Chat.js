// Chat do GIG: lista de conversas à esquerda e a conversa aberta à direita
// (no celular, uma de cada vez). Lógica de dados em lib/chat.js.
import { store, membrosAtivos, ehLider } from "../lib/store.js";
import { db, collection, query, orderBy, limitToLast, onSnapshot, comId, deleteDoc, doc, mensagemErro } from "../lib/firebase.js";
import {
  abrirDireta, criarGrupo, atualizarGrupo, sairDoGrupo, marcarLida, naoLida, tituloDaConversa, outroMembro,
  membroPorId, enviarTexto, enviarFigurinha, enviarAnexo, apagarMensagem, baixarAnexo, salvarArquivo,
  encaminhar, criarFigurinha, guardarFigurinha, srcFigurinha, tamanhoLegivel, LIMITE_ANEXO, EMOJIS_GRUPO, CORES_GRUPO,
} from "../lib/chat.js";
import { PACOTE_GLEAN, figurinhaDoPacote } from "../lib/figurinhas.js";
import { coresDosCargos } from "../lib/constantes.js";
import { ICONES } from "../components/Icones.js";

const LOTE = 60;
const DIAS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
const CORES_AUTOR = ["#1f7fb8", "#2f9a63", "#c2399b", "#d9661f", "#7b61ff", "#14a3a3", "#b8860b", "#d93025"];
const hash = (s) => [...String(s)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
const escapar = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const iniciais = (nome) => String(nome || "?").trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join("").toUpperCase();

export default {
  props: { id: String },
  data() {
    return {
      store, ICONES, PACOTE_GLEAN, EMOJIS_GRUPO, CORES_GRUPO,
      busca: "", mensagens: [], limite: LOTE, desligar: null, carregando: false,
      texto: "", respostaA: null, enviando: [], erro: "",
      painelFigurinhas: false, abaFigurinhas: "glean",
      modal: "", novo: null, buscaModal: "", encaminhando: null, destinos: [],
      editGrupo: null, adicionar: [],
      foto: null, // { url, nome, m }
    };
  },
  computed: {
    uid() { return store.membro.id; },
    conversa() { return this.id ? store.conversas.find((c) => c.id === this.id) || null : null; },
    ehGrupo() { return this.conversa && this.conversa.tipo === "grupo"; },
    souAdmin() { return this.ehGrupo && ((this.conversa.admins || []).includes(this.uid) || ehLider()); },
    conversasFiltradas() {
      const b = this.busca.trim().toLowerCase();
      return store.conversas.filter((c) => !b || tituloDaConversa(c).toLowerCase().includes(b));
    },
    // pessoas que batem com a busca e ainda não têm conversa direta comigo
    pessoasNaBusca() {
      const b = this.busca.trim().toLowerCase();
      if (!b) return [];
      const comConversa = new Set(store.conversas.filter((c) => c.tipo === "direta").map((c) => outroMembro(c)));
      return membrosAtivos().filter((m) => m.id !== this.uid && !comConversa.has(m.id) && m.nome.toLowerCase().includes(b));
    },
    pessoasModal() {
      const b = this.buscaModal.trim().toLowerCase();
      return membrosAtivos().filter((m) => m.id !== this.uid && (!b || m.nome.toLowerCase().includes(b)));
    },
    subtitulo() {
      const c = this.conversa;
      if (!c) return "";
      if (c.tipo === "grupo") {
        const nomes = c.membros.map((u) => (u === this.uid ? "você" : membroPorId(u).nome.split(" ")[0]));
        return `${c.membros.length} membros · ${nomes.join(", ")}`;
      }
      const m = membroPorId(outroMembro(c));
      return [m.modulo, m.email].filter(Boolean).join(" · ");
    },
    podeMais() { return this.mensagens.length >= this.limite; },
    figurinhasDoGrupo() { return store.figurinhas; },
  },
  watch: {
    id: { immediate: true, handler() { this.abrirConversa(); } },
    "conversa.ultima.em"() { this.lerSeVisivel(); },
  },
  mounted() {
    this.aoVoltar = () => { if (!document.hidden) this.lerSeVisivel(); };
    document.addEventListener("visibilitychange", this.aoVoltar);
  },
  beforeUnmount() {
    if (this.desligar) this.desligar();
    document.removeEventListener("visibilitychange", this.aoVoltar);
    if (this.foto) URL.revokeObjectURL(this.foto.url);
  },
  methods: {
    naoLida, tituloDaConversa, srcFigurinha, tamanhoLegivel, figurinhaDoPacote, coresDosCargos,
    // ------------------------------------------------ aparência
    avatar(c) {
      if (c.tipo === "grupo") return { emoji: c.emoji || "💬", cor: c.cor || CORES_GRUPO[0] };
      const m = membroPorId(outroMembro(c));
      return { foto: m.foto, iniciais: iniciais(m.nome), cor: CORES_GRUPO[hash(m.id) % CORES_GRUPO.length] };
    },
    avatarPessoa(m) { return { foto: m.foto, iniciais: iniciais(m.nome), cor: CORES_GRUPO[hash(m.id) % CORES_GRUPO.length] }; },
    corDoAutor(uid) { return CORES_AUTOR[hash(uid) % CORES_AUTOR.length]; },
    hora(iso) { return iso ? new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : ""; },
    horaCurta(iso) {
      if (!iso) return "";
      const d = new Date(iso), hoje = new Date();
      const dias = Math.floor((new Date(hoje.toDateString()) - new Date(d.toDateString())) / 864e5);
      if (dias === 0) return this.hora(iso);
      if (dias === 1) return "ontem";
      if (dias < 7) return DIAS[d.getDay()];
      return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
    },
    rotuloDia(iso) {
      const d = new Date(iso), hoje = new Date();
      const dias = Math.floor((new Date(hoje.toDateString()) - new Date(d.toDateString())) / 864e5);
      if (dias === 0) return "Hoje";
      if (dias === 1) return "Ontem";
      if (dias < 7) return DIAS[d.getDay()][0].toUpperCase() + DIAS[d.getDay()].slice(1);
      return d.toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" });
    },
    novoDia(i) { return i === 0 || (this.mensagens[i - 1].emISO || "").slice(0, 10) !== (this.mensagens[i].emISO || "").slice(0, 10); },
    seguida(i) {
      const a = this.mensagens[i - 1], m = this.mensagens[i];
      return Boolean(a && !this.novoDia(i) && a.tipo !== "sistema" && a.autor === m.autor && new Date(m.emISO) - new Date(a.emISO) < 5 * 60e3);
    },
    previa(c) {
      if (!c.ultima) return c.tipo === "grupo" ? "Grupo criado" : "Diga oi 👋";
      const quem = c.ultima.tipo === "sistema" ? "" : c.ultima.autor === this.uid ? "Você: " : c.tipo === "grupo" ? c.ultima.autorNome.split(" ")[0] + ": " : "";
      return quem + c.ultima.texto;
    },
    // *negrito*, _itálico_, links e quebras de linha (com HTML escapado)
    formatar(t) {
      return escapar(t)
        .replace(/(https?:\/\/[^\s<]+[^\s<.,;:!?)\]])/g, '<a href="$1" target="_blank" rel="noopener">$1</a>')
        .replace(/(^|\s)\*([^*\n]+)\*(?=\s|$|[.,!?])/g, "$1<b>$2</b>")
        .replace(/(^|\s)_([^_\n]+)_(?=\s|$|[.,!?])/g, "$1<i>$2</i>")
        .replace(/\n/g, "<br>");
    },
    // ✓✓ azul quando todos os outros já leram
    foiLida(m) {
      const c = this.conversa;
      const outros = c.membros.filter((u) => u !== this.uid);
      return outros.length > 0 && outros.every((u) => c.lidas && c.lidas[u] && c.lidas[u] >= m.emISO);
    },
    estiloFoto(a) {
      if (!a.largura || !a.altura) return {};
      const r = a.altura / a.largura;
      return { aspectRatio: `${a.largura} / ${a.altura}`, width: r > 1.3 ? "220px" : "300px" };
    },
    iconeArquivo(tipo = "", nome = "") {
      if (/pdf/.test(tipo)) return { rotulo: "PDF", cor: "#d93025" };
      if (/sheet|excel|csv/.test(tipo) || /\.(xlsx?|csv)$/i.test(nome)) return { rotulo: "XLS", cor: "#1e8e3e" };
      if (/presentation|powerpoint/.test(tipo) || /\.pptx?$/i.test(nome)) return { rotulo: "PPT", cor: "#d9661f" };
      if (/word|document/.test(tipo) || /\.docx?$/i.test(nome)) return { rotulo: "DOC", cor: "#1f6fd1" };
      if (/zip|rar|7z|compressed/.test(tipo)) return { rotulo: "ZIP", cor: "#7b61ff" };
      if (tipo.startsWith("audio/")) return { rotulo: "ÁUDIO", cor: "#c2399b" };
      if (tipo.startsWith("video/")) return { rotulo: "VÍDEO", cor: "#123a5c" };
      return { rotulo: (nome.split(".").pop() || "ARQ").slice(0, 4).toUpperCase(), cor: "#62809a" };
    },
    // ------------------------------------------------ conversa aberta
    abrirConversa() {
      if (this.desligar) { this.desligar(); this.desligar = null; }
      this.mensagens = []; this.limite = LOTE; this.respostaA = null; this.painelFigurinhas = false; this.erro = "";
      if (!this.id) return;
      this.assinar(true);
    },
    assinar(rolarAoFim) {
      if (this.desligar) this.desligar();
      this.carregando = true;
      const q = query(collection(db, "conversas", this.id, "mensagens"), orderBy("emISO"), limitToLast(this.limite));
      let primeira = true;
      this.desligar = onSnapshot(q, (s) => {
        const lista = this.$refs.lista;
        const pertoDoFim = !lista || lista.scrollHeight - lista.scrollTop - lista.clientHeight < 140;
        const alturaAntes = lista ? lista.scrollHeight : 0, topoAntes = lista ? lista.scrollTop : 0;
        const ultimaMinha = s.docs.length && s.docs[s.docs.length - 1].data().autor === this.uid;
        this.mensagens = s.docs.map(comId);
        this.carregando = false;
        this.$nextTick(() => {
          const l = this.$refs.lista;
          if (!l) return;
          if ((primeira && rolarAoFim) || pertoDoFim || ultimaMinha) l.scrollTop = l.scrollHeight;
          else if (primeira) l.scrollTop = topoAntes + (l.scrollHeight - alturaAntes);   // "carregar anteriores" mantém a posição
          primeira = false;
        });
        this.lerSeVisivel();
      }, (err) => { this.erro = mensagemErro(err); this.carregando = false; });
    },
    carregarAnteriores() { this.limite += LOTE; this.assinar(false); },
    lerSeVisivel() { if (this.conversa && !document.hidden) marcarLida(this.conversa).catch(() => {}); },
    irPara(mid) {
      const el = document.getElementById("m-" + mid);
      if (!el) return;
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("destacada"); setTimeout(() => el.classList.remove("destacada"), 1600);
    },
    focar() { this.$nextTick(() => this.$refs.campo && this.$refs.campo.focus()); },
    ajustarAltura() { const t = this.$refs.campo; if (t) { t.style.height = "auto"; t.style.height = Math.min(t.scrollHeight, 160) + "px"; } },
    // ------------------------------------------------ enviar
    async enviar() {
      const t = this.texto.trim();
      if (!t || !this.conversa) return;
      const resposta = this.respostaA;
      this.texto = ""; this.respostaA = null; this.$nextTick(this.ajustarAltura);
      try { await enviarTexto(this.id, t, resposta); }
      catch (err) { this.texto = t; this.erro = mensagemErro(err); }
    },
    async mandarFigurinha(f) {
      this.painelFigurinhas = false;
      const resposta = this.respostaA; this.respostaA = null;
      try { await enviarFigurinha(this.id, f.chave ? { pacote: "glean", chave: f.chave } : { id: f.id, dados: f.dados }, resposta); }
      catch (err) { this.erro = mensagemErro(err); }
    },
    escolherArquivos() { this.$refs.arquivos.click(); },
    aoEscolher(e) { this.mandarArquivos([...e.target.files]); e.target.value = ""; },
    soltar(e) { if (e.dataTransfer && e.dataTransfer.files.length) this.mandarArquivos([...e.dataTransfer.files]); },
    colar(e) {
      const arquivos = [...((e.clipboardData && e.clipboardData.files) || [])];
      if (arquivos.length) { e.preventDefault(); this.mandarArquivos(arquivos); }
    },
    async mandarArquivos(arquivos) {
      this.erro = "";
      const resposta = this.respostaA; this.respostaA = null;
      for (const a of arquivos) {
        if (!a.type.startsWith("image/") && a.size > LIMITE_ANEXO) { this.erro = `"${a.name}" passa de ${tamanhoLegivel(LIMITE_ANEXO)}, o limite por anexo.`; continue; }
        const envio = { nome: a.name, progresso: 0 };
        this.enviando.push(envio);
        try { await enviarAnexo(this.id, a, { respostaA: resposta, aoProgresso: (p) => { envio.progresso = p; } }); }
        catch (err) { this.erro = err.message || mensagemErro(err); }
        finally { this.enviando.splice(this.enviando.indexOf(envio), 1); }
      }
    },
    // ------------------------------------------------ ações nas mensagens
    responder(m) { this.respostaA = m; this.focar(); },
    async apagar(m) {
      if (!confirm("Apagar esta mensagem para todos?")) return;
      try { await apagarMensagem(this.id, m); } catch (err) { this.erro = mensagemErro(err); }
    },
    async verAnexo(m) {
      try {
        const blob = await baixarAnexo(this.id, m.anexo);
        if (this.foto) URL.revokeObjectURL(this.foto.url);
        this.foto = { url: URL.createObjectURL(blob), nome: m.anexo.nome, m };
      } catch (err) { this.erro = err.message; }
    },
    async abrirArquivo(m) {
      try {
        const blob = await baixarAnexo(this.id, m.anexo);
        window.open(URL.createObjectURL(blob), "_blank", "noopener");
      } catch (err) { this.erro = err.message; }
    },
    async baixar(m) { try { await salvarArquivo(this.id, m.anexo); } catch (err) { this.erro = err.message; } },
    async guardar(m) {
      try { this.erro = (await guardarFigurinha(m.figurinha)) ? "" : "Essa figurinha já está na biblioteca."; }
      catch (err) { this.erro = mensagemErro(err); }
    },
    abrirEncaminhar(m) { this.encaminhando = m; this.destinos = []; this.buscaModal = ""; this.modal = "encaminhar"; },
    async confirmarEncaminhar() {
      const m = this.encaminhando, destinos = [...this.destinos];
      this.modal = ""; this.encaminhando = null;
      try { await encaminhar(this.id, m, destinos); }
      catch (err) { this.erro = "Não foi possível encaminhar: " + (err.message || mensagemErro(err)); }
      if (destinos.length === 1 && destinos[0] !== this.id) this.$router.push("/chat/" + destinos[0]);
    },
    // ------------------------------------------------ figurinhas
    escolherImagemFigurinha() { this.$refs.figurinhaArquivo.click(); },
    async aoEscolherFigurinha(e) {
      const a = e.target.files[0]; e.target.value = "";
      if (!a) return;
      if (!a.type.startsWith("image/")) { this.erro = "Escolha uma imagem (PNG com fundo transparente fica ótima)."; return; }
      try { await criarFigurinha(a); this.abaFigurinhas = "grupo"; }
      catch (err) { this.erro = mensagemErro(err); }
    },
    podeApagarFigurinha(f) { return f.criadoPor === this.uid || ehLider(); },
    async apagarFigurinha(f) {
      if (!confirm("Tirar esta figurinha da biblioteca? (As mensagens já enviadas continuam com ela.)")) return;
      try { await deleteDoc(doc(db, "figurinhas", f.id)); } catch (err) { this.erro = mensagemErro(err); }
    },
    // ------------------------------------------------ nova conversa / grupo
    abrirNova(tipo) {
      this.buscaModal = "";
      this.novo = { tipo, nome: "", descricao: "", emoji: EMOJIS_GRUPO[0], cor: CORES_GRUPO[0], membros: [] };
      this.modal = "nova";
    },
    async conversarCom(uid) {
      this.modal = ""; this.busca = "";
      try { this.$router.push("/chat/" + (await abrirDireta(uid))); } catch (err) { this.erro = mensagemErro(err); }
    },
    alternar(lista, uid) { const i = lista.indexOf(uid); if (i >= 0) lista.splice(i, 1); else lista.push(uid); },
    async confirmarGrupo() {
      const n = this.novo;
      if (!n.nome.trim()) { this.erro = "Dê um nome ao grupo."; return; }
      if (!n.membros.length) { this.erro = "Escolha pelo menos uma pessoa."; return; }
      this.erro = "";
      try { const id = await criarGrupo(n); this.modal = ""; this.$router.push("/chat/" + id); }
      catch (err) { this.erro = mensagemErro(err); }
    },
    // ------------------------------------------------ informações do grupo
    abrirInfo() {
      const c = this.conversa;
      this.editGrupo = c.tipo === "grupo" ? { nome: c.nome, descricao: c.descricao || "", emoji: c.emoji, cor: c.cor } : null;
      this.adicionar = []; this.buscaModal = ""; this.modal = "info";
    },
    async salvarGrupo() {
      const e = this.editGrupo, c = this.conversa;
      if (!e.nome.trim()) return;
      const mudou = e.nome.trim() !== c.nome;
      try {
        await atualizarGrupo(c.id, { nome: e.nome.trim(), descricao: e.descricao.trim(), emoji: e.emoji, cor: e.cor },
          mudou ? `${store.membro.nome} mudou o nome do grupo para "${e.nome.trim()}"` : "");
      } catch (err) { this.erro = mensagemErro(err); }
    },
    async adicionarMembros() {
      const c = this.conversa, novos = this.adicionar.filter((u) => !c.membros.includes(u));
      if (!novos.length) return;
      const nomes = novos.map((u) => membroPorId(u).nome.split(" ")[0]).join(", ");
      try { await atualizarGrupo(c.id, { membros: [...c.membros, ...novos] }, `${store.membro.nome} adicionou ${nomes}`); this.adicionar = []; }
      catch (err) { this.erro = mensagemErro(err); }
    },
    async removerMembro(uid) {
      const c = this.conversa;
      if (!confirm(`Remover ${membroPorId(uid).nome} do grupo?`)) return;
      try {
        await atualizarGrupo(c.id, { membros: c.membros.filter((u) => u !== uid), admins: (c.admins || []).filter((u) => u !== uid) },
          `${store.membro.nome} removeu ${membroPorId(uid).nome.split(" ")[0]}`);
      } catch (err) { this.erro = mensagemErro(err); }
    },
    async alternarAdmin(uid) {
      const c = this.conversa, admins = c.admins || [];
      const novo = admins.includes(uid) ? admins.filter((u) => u !== uid) : [...admins, uid];
      if (!novo.length) { this.erro = "O grupo precisa de pelo menos um administrador."; return; }
      try { await atualizarGrupo(c.id, { admins: novo }); } catch (err) { this.erro = mensagemErro(err); }
    },
    async sair() {
      if (!confirm("Sair deste grupo? Você deixa de ver as mensagens.")) return;
      const c = this.conversa;
      this.modal = "";
      try { await sairDoGrupo(c); this.$router.push("/chat"); } catch (err) { this.erro = mensagemErro(err); }
    },
    membroPorId,
  },
  template: `
  <div class="chat" :class="{ 'com-conversa': id }">
    <!-- ================= lista de conversas ================= -->
    <aside class="chat-lista">
      <div class="chat-lista-topo">
        <h1>Chat</h1>
        <div class="chat-lista-acoes">
          <button class="btn pequeno" @click="abrirNova('grupo')"><span v-html="ICONES.grupo"></span> Novo grupo</button>
          <button class="btn icone destaque" @click="abrirNova('direta')" title="Nova conversa" v-html="ICONES.mais"></button>
        </div>
      </div>
      <div class="chat-busca"><input v-model="busca" placeholder="Pesquisar conversa ou pessoa"></div>
      <div class="chat-itens">
        <router-link v-for="c in conversasFiltradas" :key="c.id" :to="'/chat/' + c.id" class="chat-item"
                     :class="{ ativo: c.id === id, 'nao-lida': naoLida(c) }">
          <span class="chat-avatar" :style="{ background: avatar(c).cor }">
            <img v-if="avatar(c).foto" :src="avatar(c).foto" alt="">
            <template v-else>{{ avatar(c).emoji || avatar(c).iniciais }}</template>
          </span>
          <span class="chat-item-corpo">
            <span class="chat-item-l1"><b>{{ tituloDaConversa(c) }}</b><small>{{ horaCurta(c.ultima ? c.ultima.em : c.atualizadoEm) }}</small></span>
            <span class="chat-item-l2"><span>{{ previa(c) }}</span><i v-if="naoLida(c)"></i></span>
          </span>
        </router-link>
        <template v-if="pessoasNaBusca.length">
          <p class="chat-secao">Pessoas</p>
          <button class="chat-item" v-for="m in pessoasNaBusca" :key="m.id" @click="conversarCom(m.id)">
            <span class="chat-avatar" :style="{ background: avatarPessoa(m).cor }"><img v-if="m.foto" :src="m.foto" alt=""><template v-else>{{ avatarPessoa(m).iniciais }}</template></span>
            <span class="chat-item-corpo"><span class="chat-item-l1"><b>{{ m.nome }}</b></span><span class="chat-item-l2"><span>Começar conversa</span></span></span>
          </button>
        </template>
        <div class="chat-lista-vazia" v-if="!conversasFiltradas.length && !pessoasNaBusca.length">
          <p v-if="busca">Nada encontrado para "{{ busca }}".</p>
          <template v-else>
            <p>Nenhuma conversa ainda.</p>
            <button class="btn pequeno destaque" @click="abrirNova('direta')">Começar uma conversa</button>
          </template>
        </div>
      </div>
    </aside>

    <!-- ================= conversa ================= -->
    <section class="chat-conversa" v-if="conversa">
      <header class="chat-topo">
        <router-link to="/chat" class="btn icone chat-voltar" title="Voltar" v-html="ICONES.voltar"></router-link>
        <button class="chat-topo-quem" @click="abrirInfo" title="Informações">
          <span class="chat-avatar" :style="{ background: avatar(conversa).cor }">
            <img v-if="avatar(conversa).foto" :src="avatar(conversa).foto" alt="">
            <template v-else>{{ avatar(conversa).emoji || avatar(conversa).iniciais }}</template>
          </span>
          <span><b>{{ tituloDaConversa(conversa) }}</b><small>{{ subtitulo }}</small></span>
        </button>
        <button class="btn icone" @click="abrirInfo" :title="ehGrupo ? 'Dados do grupo' : 'Dados do contato'" v-html="ICONES.info"></button>
      </header>

      <div class="chat-mensagens" ref="lista" @dragover.prevent @drop.prevent="soltar">
        <div class="chat-mais" v-if="podeMais"><button class="btn pequeno" @click="carregarAnteriores">Carregar mensagens anteriores</button></div>
        <p class="chat-sistema" v-if="!carregando && !mensagens.length">{{ ehGrupo ? "O grupo está pronto. Mande a primeira mensagem!" : "Nenhuma mensagem ainda. Diga oi 👋" }}</p>
        <template v-for="(m, i) in mensagens" :key="m.id">
          <div class="chat-dia" v-if="novoDia(i)"><span>{{ rotuloDia(m.emISO) }}</span></div>
          <p class="chat-sistema" v-if="m.tipo === 'sistema'">{{ m.texto }}</p>
          <div v-else class="msg" :id="'m-' + m.id"
               :class="{ minha: m.autor === uid, seguida: seguida(i), 'so-figurinha': m.tipo === 'figurinha' && !m.apagada, 'so-foto': m.tipo === 'anexo' && m.anexo.miniatura && !m.apagada }">
            <div class="msg-balao" tabindex="0">
              <b class="msg-autor" v-if="ehGrupo && m.autor !== uid && !seguida(i)" :style="{ color: corDoAutor(m.autor) }">{{ m.autorNome }}</b>
              <div class="msg-encaminhada" v-if="m.encaminhada && !m.apagada"><span v-html="ICONES.encaminhar"></span> Encaminhada</div>
              <button class="msg-citacao" v-if="m.respostaA && !m.apagada" @click="irPara(m.respostaA.id)">
                <b>{{ m.respostaA.autorNome }}</b><span>{{ m.respostaA.resumo }}</span>
              </button>
              <p class="msg-apagada" v-if="m.apagada">🚫 Mensagem apagada</p>
              <p class="msg-texto" v-else-if="m.tipo === 'texto'" v-html="formatar(m.texto)"></p>
              <img v-else-if="m.tipo === 'figurinha'" class="msg-figurinha" :src="srcFigurinha(m.figurinha)" alt="Figurinha">
              <template v-else-if="m.tipo === 'anexo'">
                <button v-if="m.anexo.miniatura" class="msg-foto" @click="verAnexo(m)" :title="m.anexo.nome">
                  <img :src="m.anexo.miniatura" :style="estiloFoto(m.anexo)" alt="">
                </button>
                <div class="msg-arquivo" v-else>
                  <span class="msg-arquivo-icone" :style="{ background: iconeArquivo(m.anexo.tipo, m.anexo.nome).cor }">{{ iconeArquivo(m.anexo.tipo, m.anexo.nome).rotulo }}</span>
                  <span class="msg-arquivo-dados"><b>{{ m.anexo.nome }}</b><small>{{ tamanhoLegivel(m.anexo.tamanho) }}</small></span>
                  <button class="btn icone" v-if="/pdf|image|text|video|audio/.test(m.anexo.tipo)" @click="abrirArquivo(m)" title="Abrir" v-html="ICONES.arquivo"></button>
                  <button class="btn icone" @click="baixar(m)" title="Baixar" v-html="ICONES.baixar"></button>
                </div>
              </template>
              <span class="msg-hora">{{ hora(m.emISO) }}<span v-if="m.autor === uid && !m.apagada" class="msg-visto" :class="{ lida: foiLida(m) }" :title="foiLida(m) ? 'Lida' : 'Enviada'">✓✓</span></span>
            </div>
            <div class="msg-acoes" v-if="!m.apagada">
              <button @click="responder(m)" title="Responder" v-html="ICONES.responder"></button>
              <button @click="abrirEncaminhar(m)" title="Encaminhar" v-html="ICONES.encaminhar"></button>
              <button v-if="m.tipo === 'anexo'" @click="baixar(m)" title="Baixar" v-html="ICONES.baixar"></button>
              <button v-if="m.tipo === 'figurinha' && !m.figurinha.pacote && m.autor !== uid" @click="guardar(m)" title="Guardar na biblioteca de figurinhas" v-html="ICONES.figurinha"></button>
              <button v-if="m.autor === uid" @click="apagar(m)" title="Apagar" v-html="ICONES.lixo"></button>
            </div>
          </div>
        </template>
      </div>

      <footer class="chat-envio">
        <p class="erro chat-erro" v-if="erro">{{ erro }} <button class="remover" @click="erro = ''">×</button></p>
        <div class="chat-enviando" v-for="(e, i) in enviando" :key="i">
          <span>Enviando {{ e.nome }}</span><span class="barra-trilho"><i :style="{ width: Math.round(e.progresso * 100) + '%' }"></i></span>
        </div>
        <div class="chat-respondendo" v-if="respostaA">
          <div><b>Respondendo a {{ respostaA.autor === uid ? "você" : respostaA.autorNome }}</b>
            <span>{{ respostaA.tipo === 'texto' ? respostaA.texto : respostaA.tipo === 'figurinha' ? '🖼️ Figurinha' : '📎 ' + respostaA.anexo.nome }}</span></div>
          <button class="remover" @click="respostaA = null" title="Cancelar">×</button>
        </div>

        <div class="chat-figurinhas" v-if="painelFigurinhas">
          <div class="chat-figurinhas-abas">
            <button :class="{ sel: abaFigurinhas === 'glean' }" @click="abaFigurinhas = 'glean'">GLean</button>
            <button :class="{ sel: abaFigurinhas === 'grupo' }" @click="abaFigurinhas = 'grupo'">Do grupo <small>{{ figurinhasDoGrupo.length }}</small></button>
            <span style="flex:1"></span>
            <button class="btn pequeno" @click="escolherImagemFigurinha"><span v-html="ICONES.mais"></span> Criar figurinha</button>
            <input type="file" accept="image/*" ref="figurinhaArquivo" hidden @change="aoEscolherFigurinha">
          </div>
          <div class="chat-figurinhas-grade" v-if="abaFigurinhas === 'glean'">
            <button v-for="f in PACOTE_GLEAN" :key="f.chave" @click="mandarFigurinha(f)" :title="f.texto"><img :src="figurinhaDoPacote(f.chave)" :alt="f.texto"></button>
          </div>
          <div class="chat-figurinhas-grade" v-else>
            <p class="dica" v-if="!figurinhasDoGrupo.length" style="grid-column:1/-1">Nenhuma ainda. Use "Criar figurinha" com qualquer imagem (PNG com fundo transparente fica ótima): ela fica disponível para todos.</p>
            <div class="fig-grupo" v-for="f in figurinhasDoGrupo" :key="f.id">
              <button @click="mandarFigurinha(f)" :title="f.nome + ' · por ' + f.criadoPorNome"><img :src="f.dados" :alt="f.nome"></button>
              <button class="fig-apagar" v-if="podeApagarFigurinha(f)" @click="apagarFigurinha(f)" title="Tirar da biblioteca">×</button>
            </div>
          </div>
        </div>

        <div class="chat-compositor">
          <button class="btn icone" :class="{ ativo: painelFigurinhas }" @click="painelFigurinhas = !painelFigurinhas" title="Figurinhas" v-html="ICONES.figurinha"></button>
          <button class="btn icone" @click="escolherArquivos" title="Anexar arquivos (até 5 MB cada)" v-html="ICONES.clipe"></button>
          <input type="file" multiple ref="arquivos" hidden @change="aoEscolher">
          <textarea ref="campo" v-model="texto" rows="1" placeholder="Mensagem" @input="ajustarAltura"
                    @keydown.enter.exact.prevent="enviar" @paste="colar"></textarea>
          <button class="btn icone destaque" @click="enviar" :disabled="!texto.trim()" title="Enviar (Enter)" v-html="ICONES.enviar"></button>
        </div>
      </footer>
    </section>

    <section class="chat-vazio" v-else>
      <div class="chat-vazio-icone" v-html="ICONES.chat"></div>
      <h2>Chat do GLean</h2>
      <p>Converse com qualquer membro ou crie grupos. Mande figurinhas e anexos (fotos, PDFs, planilhas) e encaminhe mensagens entre conversas.</p>
      <div class="linha" style="justify-content:center"><button class="btn destaque" @click="abrirNova('direta')">Nova conversa</button><button class="btn" @click="abrirNova('grupo')">Novo grupo</button></div>
    </section>

    <!-- ================= nova conversa / novo grupo ================= -->
    <div class="modal-fundo" v-if="modal === 'nova'" @click.self="modal = ''">
      <div class="modal-caixa">
        <div class="cartao-titulo"><h2 style="font-size:20px">{{ novo.tipo === 'grupo' ? "Novo grupo" : "Nova conversa" }}</h2><button class="remover" @click="modal = ''">×</button></div>
        <template v-if="novo.tipo === 'grupo'">
          <div class="grupo-cab">
            <span class="chat-avatar grande" :style="{ background: novo.cor }">{{ novo.emoji }}</span>
            <div style="flex:1;min-width:0">
              <label class="campo"><span>Nome do grupo</span><input v-model="novo.nome" placeholder="Ex.: Kikai 26.2" maxlength="60"></label>
              <label class="campo" style="margin:0"><span>Descrição (opcional)</span><input v-model="novo.descricao" maxlength="160"></label>
            </div>
          </div>
          <div class="grupo-escolhas">
            <button v-for="e in EMOJIS_GRUPO" :key="e" class="grupo-emoji" :class="{ sel: novo.emoji === e }" @click="novo.emoji = e">{{ e }}</button>
          </div>
          <div class="grupo-escolhas">
            <button v-for="c in CORES_GRUPO" :key="c" class="cor-evento" :class="{ sel: novo.cor === c }" :style="{ '--cor': c }" @click="novo.cor = c"></button>
          </div>
          <p class="dica" style="margin:10px 0 6px">Participantes: {{ novo.membros.length }} selecionado(s) + você</p>
        </template>
        <div class="chat-busca" style="padding:0 0 8px"><input v-model="buscaModal" placeholder="Pesquisar pessoa"></div>
        <div class="lista-pessoas">
          <component :is="novo.tipo === 'grupo' ? 'label' : 'button'" v-for="m in pessoasModal" :key="m.id" class="pessoa"
                     @click="novo.tipo === 'direta' && conversarCom(m.id)">
            <input type="checkbox" v-if="novo.tipo === 'grupo'" :checked="novo.membros.includes(m.id)" @change="alternar(novo.membros, m.id)">
            <span class="chat-avatar" :style="{ background: avatarPessoa(m).cor }"><img v-if="m.foto" :src="m.foto" alt=""><template v-else>{{ avatarPessoa(m).iniciais }}</template></span>
            <span class="pessoa-nome"><b>{{ m.nome }}</b><small>{{ [m.modulo, ...(m.cargos || []).map(c => c.cargo)].filter(Boolean).join(" · ") }}</small></span>
          </component>
        </div>
        <div class="linha" style="margin-top:14px" v-if="novo.tipo === 'grupo'">
          <button class="btn destaque" @click="confirmarGrupo">Criar grupo</button>
          <button class="btn" @click="modal = ''">Cancelar</button>
          <p class="erro" v-if="erro" style="margin:0">{{ erro }}</p>
        </div>
      </div>
    </div>

    <!-- ================= encaminhar ================= -->
    <div class="modal-fundo" v-if="modal === 'encaminhar'" @click.self="modal = ''">
      <div class="modal-caixa">
        <div class="cartao-titulo"><h2 style="font-size:20px">Encaminhar para…</h2><button class="remover" @click="modal = ''">×</button></div>
        <div class="chat-busca" style="padding:0 0 8px"><input v-model="buscaModal" placeholder="Pesquisar conversa"></div>
        <div class="lista-pessoas">
          <label class="pessoa" v-for="c in store.conversas.filter(c => !buscaModal || tituloDaConversa(c).toLowerCase().includes(buscaModal.toLowerCase()))" :key="c.id">
            <input type="checkbox" :checked="destinos.includes(c.id)" @change="alternar(destinos, c.id)">
            <span class="chat-avatar" :style="{ background: avatar(c).cor }"><img v-if="avatar(c).foto" :src="avatar(c).foto" alt=""><template v-else>{{ avatar(c).emoji || avatar(c).iniciais }}</template></span>
            <span class="pessoa-nome"><b>{{ tituloDaConversa(c) }}</b><small>{{ c.tipo === 'grupo' ? c.membros.length + ' membros' : 'conversa' }}</small></span>
          </label>
        </div>
        <div class="linha" style="margin-top:14px">
          <button class="btn destaque" :disabled="!destinos.length" @click="confirmarEncaminhar"><span v-html="ICONES.encaminhar"></span> Encaminhar{{ destinos.length ? " (" + destinos.length + ")" : "" }}</button>
          <button class="btn" @click="modal = ''">Cancelar</button>
        </div>
      </div>
    </div>

    <!-- ================= dados do grupo / contato ================= -->
    <div class="modal-fundo" v-if="modal === 'info' && conversa" @click.self="modal = ''">
      <div class="modal-caixa">
        <div class="cartao-titulo"><h2 style="font-size:20px">{{ ehGrupo ? "Dados do grupo" : "Dados do contato" }}</h2><button class="remover" @click="modal = ''">×</button></div>
        <template v-if="ehGrupo">
          <div class="grupo-cab">
            <span class="chat-avatar grande" :style="{ background: editGrupo.cor }">{{ editGrupo.emoji }}</span>
            <div style="flex:1;min-width:0" v-if="souAdmin">
              <label class="campo"><span>Nome do grupo</span><input v-model="editGrupo.nome" maxlength="60"></label>
              <label class="campo" style="margin:0"><span>Descrição</span><input v-model="editGrupo.descricao" maxlength="160"></label>
            </div>
            <div v-else><h3 style="font-size:18px">{{ conversa.nome }}</h3><p class="dica" style="margin:4px 0 0">{{ conversa.descricao || "Sem descrição" }}</p></div>
          </div>
          <template v-if="souAdmin">
            <div class="grupo-escolhas"><button v-for="e in EMOJIS_GRUPO" :key="e" class="grupo-emoji" :class="{ sel: editGrupo.emoji === e }" @click="editGrupo.emoji = e">{{ e }}</button></div>
            <div class="grupo-escolhas"><button v-for="c in CORES_GRUPO" :key="c" class="cor-evento" :class="{ sel: editGrupo.cor === c }" :style="{ '--cor': c }" @click="editGrupo.cor = c"></button></div>
            <button class="btn pequeno destaque" style="margin-top:10px" @click="salvarGrupo">Salvar</button>
          </template>
          <p class="chat-secao" style="margin-top:18px">{{ conversa.membros.length }} participantes</p>
          <div class="lista-pessoas">
            <div class="pessoa" v-for="u in conversa.membros" :key="u">
              <span class="chat-avatar" :style="{ background: avatarPessoa(membroPorId(u)).cor }"><img v-if="membroPorId(u).foto" :src="membroPorId(u).foto" alt=""><template v-else>{{ avatarPessoa(membroPorId(u)).iniciais }}</template></span>
              <span class="pessoa-nome"><b>{{ membroPorId(u).nome }}{{ u === uid ? " (você)" : "" }}</b><small>{{ membroPorId(u).modulo }}</small></span>
              <span class="selo ok" v-if="(conversa.admins || []).includes(u)">admin</span>
              <template v-if="souAdmin && u !== uid">
                <button class="btn pequeno" @click="alternarAdmin(u)">{{ (conversa.admins || []).includes(u) ? "Tirar admin" : "Tornar admin" }}</button>
                <button class="btn pequeno perigo" @click="removerMembro(u)">Remover</button>
              </template>
            </div>
          </div>
          <template v-if="souAdmin">
            <p class="chat-secao" style="margin-top:16px">Adicionar pessoas</p>
            <div class="chat-busca" style="padding:0 0 8px"><input v-model="buscaModal" placeholder="Pesquisar pessoa"></div>
            <p class="dica" v-if="!pessoasModal.some(m => !conversa.membros.includes(m.id))">{{ buscaModal ? "Ninguém fora do grupo com esse nome." : "Todos os membros ativos já estão no grupo." }}</p>
            <div class="lista-pessoas curta" v-else>
              <label class="pessoa" v-for="m in pessoasModal.filter(m => !conversa.membros.includes(m.id))" :key="m.id">
                <input type="checkbox" :checked="adicionar.includes(m.id)" @change="alternar(adicionar, m.id)">
                <span class="pessoa-nome"><b>{{ m.nome }}</b><small>{{ m.modulo }}</small></span>
              </label>
            </div>
            <button class="btn pequeno" style="margin-top:8px" v-if="adicionar.length" @click="adicionarMembros">Adicionar ({{ adicionar.length }})</button>
          </template>
          <div style="margin-top:18px;padding-top:14px;border-top:1px solid var(--linha)"><button class="btn perigo" @click="sair">Sair do grupo</button></div>
        </template>
        <template v-else>
          <div class="grupo-cab" v-for="m in [membroPorId(conversa.membros.find(u => u !== uid) || uid)]" :key="m.id">
            <span class="chat-avatar grande" :style="{ background: avatarPessoa(m).cor }"><img v-if="m.foto" :src="m.foto" alt=""><template v-else>{{ avatarPessoa(m).iniciais }}</template></span>
            <div>
              <h3 style="font-size:18px">{{ m.nome }}</h3>
              <p class="dica" style="margin:2px 0 8px">{{ m.email }}{{ m.modulo ? " · " + m.modulo : "" }}</p>
              <span class="selo cargo" v-for="(c, i) in (m.cargos || [])" :key="i" :style="coresDosCargos(m.cargos)[i]">{{ (store.processos.find(p => p.id === c.processo) || {}).nome || c.processo }} · {{ c.cargo }}</span>
            </div>
          </div>
        </template>
      </div>
    </div>

    <!-- ================= foto em tela cheia ================= -->
    <div class="chat-foto" v-if="foto" @click.self="foto = null">
      <div class="chat-foto-topo">
        <span>{{ foto.nome }}</span>
        <button class="btn icone" @click="baixar(foto.m)" title="Baixar" v-html="ICONES.baixar"></button>
        <button class="btn icone" @click="foto = null" title="Fechar" v-html="ICONES.fechar"></button>
      </div>
      <img :src="foto.url" :alt="foto.nome" @click.self="foto = null">
    </div>
  </div>`,
};
