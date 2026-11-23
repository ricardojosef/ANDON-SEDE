import { store, ehLider, semestreAtivo } from "../lib/store.js";
import { db, doc, collection, addDoc, updateDoc, deleteDoc, serverTimestamp, mensagemErro } from "../lib/firebase.js";
import { TIPOS_PERGUNTA, temOpcoes, novaPergunta, duplicarPergunta } from "../lib/formularios.js";
import { resolverDestinatarios, prazoDe, proximas, HORA_PADRAO } from "../lib/ddl.js";
import { ICONES } from "../components/Icones.js";
import Destinatarios, { publicoVazio } from "../components/Destinatarios.js";
import SeletorPrazo from "../components/SeletorPrazo.js";

export default {
  components: { Destinatarios, SeletorPrazo },
  props: { id: String },
  data() {
    const comPrazo = this.$route.query.prazo === "1";
    return {
      store, ICONES, TIPOS_PERGUNTA,
      f: {
        titulo: "", descricao: "", perguntas: [novaPergunta("curta")],
        publico: publicoVazio(), aberto: true,
        prazo: comPrazo ? { categoria: "quinta", data: proximas(4, 1)[0], hora: HORA_PADRAO } : null,
      },
      original: null, carregando: Boolean(this.id), salvando: false, erro: "",
    };
  },
  computed: {
    novo() { return !this.id; },
    nRespostas() { return this.original ? Object.values(this.original.respondentes || {}).filter(Boolean).length : 0; },
    podeEditar() { return this.novo || (this.original && (this.original.autor === store.membro.id || ehLider())); },
  },
  watch: {
    "store.formularios": { immediate: true, handler() { if (this.id && !this.original) this.carregar(); } },
  },
  methods: {
    temOpcoes,
    carregar() {
      const o = store.formularios.find((x) => x.id === this.id);
      if (!o) return;
      this.original = o;
      const [data, hora] = (o.prazo || "").split("T");
      this.f = {
        titulo: o.titulo || "", descricao: o.descricao || "",
        perguntas: JSON.parse(JSON.stringify(o.perguntas || [])),
        publico: { ...publicoVazio(), ...(o.publico || {}) }, aberto: o.aberto !== false,
        prazo: o.prazo ? { categoria: o.categoria || "excepcional", data, hora } : null,
      };
      this.carregando = false;
    },
    adicionar(tipo = "multipla") { this.f.perguntas.push(novaPergunta(tipo)); this.$nextTick(() => { const els = this.$el.querySelectorAll(".pergunta-ed"); els[els.length - 1]?.scrollIntoView({ behavior: "smooth", block: "center" }); }); },
    mover(i, d) { const p = this.f.perguntas; const j = i + d; if (j < 0 || j >= p.length) return; [p[i], p[j]] = [p[j], p[i]]; },
    duplicar(i) { this.f.perguntas.splice(i + 1, 0, duplicarPergunta(this.f.perguntas[i])); },
    remover(i) { this.f.perguntas.splice(i, 1); },
    mudarTipo(p, tipo) {
      p.tipo = tipo;
      if (temOpcoes(tipo) && !(p.opcoes || []).length) p.opcoes = ["Opção 1"];
      if (tipo === "escala" && !(p.max > p.min)) { p.min = 1; p.max = 5; }
    },
    addOpcao(p) { p.opcoes.push(`Opção ${p.opcoes.length + 1}`); },
    async salvar() {
      this.erro = "";
      const f = this.f;
      if (!f.titulo.trim()) { this.erro = "Dê um título ao formulário."; return; }
      if (!f.perguntas.length) { this.erro = "Adicione pelo menos uma pergunta."; return; }
      if (f.perguntas.some((p) => !p.texto.trim())) { this.erro = "Toda pergunta precisa de um texto."; return; }
      if (f.perguntas.some((p) => temOpcoes(p.tipo) && !(p.opcoes || []).filter((o) => o.trim()).length)) { this.erro = "Perguntas de escolha precisam de opções."; return; }
      const destinatarios = resolverDestinatarios(f.publico);
      if (!destinatarios.length) { this.erro = "Escolha para quem é o formulário."; return; }
      this.salvando = true;
      try {
        const perguntas = f.perguntas.map((p) => ({
          ...p, texto: p.texto.trim(),
          opcoes: temOpcoes(p.tipo) ? [...new Set(p.opcoes.map((o) => o.trim()).filter(Boolean))] : [],
          min: Number(p.min), max: Number(p.max),
        }));
        const dados = {
          titulo: f.titulo.trim(), descricao: f.descricao.trim(), perguntas,
          publico: f.publico, destinatarios: f.publico.tipo === "todos" ? [] : destinatarios,
          prazo: f.prazo && f.prazo.data ? prazoDe(f.prazo.data, f.prazo.hora) : "",
          categoria: f.prazo ? f.prazo.categoria : "",
          aberto: f.aberto, atualizadoEm: serverTimestamp(),
        };
        let id = this.id;
        if (this.novo) {
          const ref = await addDoc(collection(db, "formularios"), {
            ...dados, respondentes: {},
            autor: store.membro.id, autorNome: store.membro.nome,
            criadoEm: serverTimestamp(), criadoEmISO: new Date().toISOString(),
            semestre: (semestreAtivo() || {}).id || "",
          });
          id = ref.id;
        } else {
          await updateDoc(doc(db, "formularios", id), dados);
        }
        this.$router.replace(`/formularios/${id}/respostas`);
      } catch (err) { this.erro = mensagemErro(err); }
      finally { this.salvando = false; }
    },
    async excluir() {
      if (!confirm("Excluir este formulário? As respostas deixam de aparecer na plataforma.")) return;
      try { await deleteDoc(doc(db, "formularios", this.id)); this.$router.replace("/formularios"); }
      catch (err) { this.erro = mensagemErro(err); }
    },
  },
  template: `
  <div class="form-editor">
    <header class="cabecalho">
      <div>
        <router-link to="/formularios" class="btn pequeno" style="margin-bottom:8px"><span v-html="ICONES.voltar"></span> Formulários</router-link>
        <h1>{{ novo ? "Novo formulário" : "Editar formulário" }}</h1>
      </div>
      <div class="acoes" v-if="!novo && podeEditar"><button class="btn perigo" @click="excluir">Excluir</button></div>
    </header>

    <p class="vazio" v-if="carregando">Carregando…</p>
    <div class="aviso" v-else-if="!podeEditar">Só quem criou o formulário (ou a liderança) pode editá-lo.</div>
    <template v-else>
      <div class="aviso" v-if="nRespostas">Este formulário já tem {{ nRespostas }} resposta(s). Mudar ou remover perguntas pode deixar respostas antigas sem a pergunta correspondente.</div>

      <section class="cartao form-cabeca">
        <input class="form-titulo-ed" v-model="f.titulo" placeholder="Título do formulário">
        <textarea class="form-desc-ed" v-model="f.descricao" rows="2" placeholder="Descrição (opcional)"></textarea>
      </section>

      <section class="cartao pergunta-ed" v-for="(p, i) in f.perguntas" :key="p.id">
        <div class="pergunta-ed-topo">
          <input class="entrada pergunta-ed-texto" v-model="p.texto" :placeholder="'Pergunta ' + (i + 1)">
          <select class="entrada pergunta-ed-tipo" :value="p.tipo" @change="mudarTipo(p, $event.target.value)">
            <option v-for="t in TIPOS_PERGUNTA" :key="t.id" :value="t.id">{{ t.nome }}</option>
          </select>
        </div>

        <div v-if="temOpcoes(p.tipo)" class="opcoes-ed">
          <div class="opcao-ed" v-for="(o, j) in p.opcoes" :key="j">
            <span class="marcador" :class="p.tipo"></span>
            <input class="entrada" v-model="p.opcoes[j]">
            <button class="remover" v-if="p.opcoes.length > 1" @click="p.opcoes.splice(j, 1)" title="Remover opção">×</button>
          </div>
          <button class="btn pequeno" @click="addOpcao(p)"><span v-html="ICONES.mais"></span> opção</button>
        </div>
        <div v-else-if="p.tipo === 'escala'" class="linha escala-ed">
          <label class="campo curto"><span>De</span><select v-model.number="p.min"><option :value="0">0</option><option :value="1">1</option></select></label>
          <label class="campo curto"><span>Até</span><select v-model.number="p.max"><option v-for="n in [3,4,5,6,7,8,9,10]" :key="n" :value="n">{{ n }}</option></select></label>
          <label class="campo"><span>Rótulo do mínimo</span><input v-model="p.rotuloMin" placeholder="Ex.: Nada"></label>
          <label class="campo"><span>Rótulo do máximo</span><input v-model="p.rotuloMax" placeholder="Ex.: Muito"></label>
        </div>
        <p class="dica" v-else style="margin:6px 0 0">{{ p.tipo === 'paragrafo' ? 'Resposta longa, em várias linhas.' : p.tipo === 'curta' ? 'Resposta em uma linha.' : p.tipo === 'numero' ? 'Aceita só números.' : 'Seletor de data.' }}</p>

        <div class="pergunta-ed-rodape">
          <label class="check"><input type="checkbox" v-model="p.obrigatoria"> Obrigatória</label>
          <span style="flex:1"></span>
          <button class="btn icone" title="Subir" @click="mover(i, -1)" :disabled="i === 0">↑</button>
          <button class="btn icone" title="Descer" @click="mover(i, 1)" :disabled="i === f.perguntas.length - 1">↓</button>
          <button class="btn icone" title="Duplicar" @click="duplicar(i)" v-html="ICONES.copiar"></button>
          <button class="btn icone perigo" title="Excluir pergunta" @click="remover(i)">×</button>
        </div>
      </section>

      <div class="linha" style="margin:16px 0">
        <button class="btn" @click="adicionar('multipla')"><span v-html="ICONES.mais"></span> Múltipla escolha</button>
        <button class="btn" @click="adicionar('curta')"><span v-html="ICONES.mais"></span> Resposta curta</button>
        <button class="btn" @click="adicionar('escala')"><span v-html="ICONES.mais"></span> Escala</button>
        <button class="btn" @click="adicionar('paragrafo')"><span v-html="ICONES.mais"></span> Parágrafo</button>
      </div>

      <section class="cartao">
        <div class="cartao-titulo">Quem responde</div>
        <Destinatarios v-model="f.publico" />
      </section>
      <section class="cartao">
        <div class="cartao-titulo">Prazo</div>
        <p class="dica">Com prazo, o formulário vira uma DDL: aparece em DDLs e no Início de cada destinatário até ser respondido.</p>
        <SeletorPrazo v-model="f.prazo" permite-sem-prazo />
      </section>
      <section class="cartao">
        <label class="check"><input type="checkbox" v-model="f.aberto"> Aceitando respostas</label>
      </section>

      <div class="barra-acoes">
        <button class="btn destaque" @click="salvar" :disabled="salvando">{{ salvando ? "Salvando…" : novo ? "Publicar formulário" : "Salvar alterações" }}</button>
        <router-link to="/formularios" class="btn">Cancelar</router-link>
        <p class="erro" v-if="erro" style="margin:0">{{ erro }}</p>
      </div>
    </template>
  </div>`,
};
