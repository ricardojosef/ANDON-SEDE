import { store, semestreAtivo, processosDoMembro } from "../lib/store.js";
import { db, doc, getDoc, setDoc, updateDoc, serverTimestamp, mensagemErro } from "../lib/firebase.js";
import { semanaAtual, idSemana } from "../lib/semana.js";
import { num, arred, fmt, slug } from "../lib/util.js";
import { TIPOS, FEELINGS } from "../lib/constantes.js";
import { ICONES } from "../components/Icones.js";
import SeletorSemana from "../components/SeletorSemana.js";

const linhaVazia = () => ({ atividade: "", planejado: "", realizado: "" });
const linhasVazias = () => Object.fromEntries(TIPOS.map((t) => [t.id, []]));

export default {
  components: { SeletorSemana },
  data() {
    return {
      store, TIPOS, FEELINGS, ICONES,
      semana: semanaAtual(semestreAtivo()),
      linhas: linhasVazias(),
      feeling: { cor: "verde", motivo: "Dentro do esperado" },
      existente: false, carregando: true, salvando: false, erro: "", ok: "",
    };
  },
  computed: {
    semestre() { return semestreAtivo(); },
    uid() { return store.membro.id; },
    motivos() { return (FEELINGS.find((f) => f.cor === this.feeling.cor) || FEELINGS[1]).motivos; },
    totais() {
      const t = { geral: { p: 0, r: 0 } };
      for (const tipo of TIPOS) {
        const p = this.linhas[tipo.id].reduce((s, l) => s + num(l.planejado), 0);
        const r = this.linhas[tipo.id].reduce((s, l) => s + num(l.realizado), 0);
        t[tipo.id] = { p, r };
        t.geral.p += p; t.geral.r += r;
      }
      return t;
    },
  },
  watch: {
    semana() { this.carregar(); },
    "store.semestres"(novo, antigo) { if (!antigo.length && novo.length) { this.semana = semanaAtual(semestreAtivo()); this.carregar(); } },
  },
  created() { this.carregar(); },
  methods: {
    fmt,
    corCss: (cor) => `var(--st-${cor})`,
    idDoc(semana = this.semana) { return idSemana(this.semestre.id, semana, this.uid); },
    agrupar(atividades) {
      const linhas = linhasVazias();
      for (const a of atividades || []) {
        const tipo = linhas[a.tipo] ? a.tipo : TIPOS[0].id;
        linhas[tipo].push({ atividade: a.atividade || "", planejado: a.planejado ?? "", realizado: a.realizado ?? "" });
      }
      return linhas;
    },
    async carregar() {
      this.erro = ""; this.ok = "";
      if (!this.semestre) { this.carregando = false; return; }
      this.carregando = true;
      try {
        const s = await getDoc(doc(db, "gig", this.idDoc()));
        if (s.exists()) {
          const d = s.data();
          this.linhas = this.agrupar(d.atividades);
          this.feeling = { cor: (d.feeling && d.feeling.cor) || "verde", motivo: (d.feeling && d.feeling.motivo) || "Dentro do esperado" };
          this.existente = true;
        } else {
          this.linhas = this.agrupar((store.membro.padroes || []).map((p) => ({ ...p, realizado: "" })));
          this.feeling = { cor: "verde", motivo: "Dentro do esperado" };
          this.existente = false;
        }
      } catch (err) {
        this.erro = mensagemErro(err);
      } finally {
        this.carregando = false;
      }
    },
    sugestoes(tipo) {
      const modulo = store.membro.modulo;
      const meus = processosDoMembro();
      const lista = store.atividades.filter((a) =>
        a.tipo === tipo && a.ativo !== false && (!a.modulos || !a.modulos.length || !modulo || a.modulos.includes(modulo)));
      if (tipo !== "processos" || !meus.length) return lista;
      // as atividades dos processos do membro vêm primeiro
      const meu = (a) => (a.processo && meus.includes(slug(a.processo)) ? 0 : 1);
      return [...lista].sort((a, b) => meu(a) - meu(b) || a.nome.localeCompare(b.nome));
    },
    adicionar(tipo) { this.linhas[tipo].push(linhaVazia()); },
    remover(tipo, i) { this.linhas[tipo].splice(i, 1); },
    escolherFeeling(f) { this.feeling = { cor: f.cor, motivo: f.motivos[0] }; },
    atividadesPlanas() {
      return TIPOS.flatMap((t) => this.linhas[t.id]
        .filter((l) => String(l.atividade || "").trim())
        .map((l) => ({ tipo: t.id, atividade: String(l.atividade).trim(), planejado: arred(l.planejado), realizado: arred(l.realizado) })));
    },
    async salvar() {
      this.erro = ""; this.ok = ""; this.salvando = true;
      try {
        const atividades = this.atividadesPlanas();
        const porTipo = Object.fromEntries(TIPOS.map((t) => [t.id, { planejado: arred(this.totais[t.id].p), realizado: arred(this.totais[t.id].r) }]));
        await setDoc(doc(db, "gig", this.idDoc()), {
          semestre: this.semestre.id, semana: this.semana, uid: this.uid,
          nome: store.membro.nome, modulo: store.membro.modulo || "",
          processos: processosDoMembro(),
          atividades,
          totais: { planejado: arred(this.totais.geral.p), realizado: arred(this.totais.geral.r), porTipo },
          feeling: { ...this.feeling },
          atualizadoEm: serverTimestamp(),
        });
        this.existente = true;
        this.ok = "Semana salva.";
      } catch (err) { this.erro = mensagemErro(err); }
      finally { this.salvando = false; }
    },
    async salvarPadrao() {
      this.erro = ""; this.ok = ""; this.salvando = true;
      try {
        const padroes = this.atividadesPlanas().map(({ tipo, atividade, planejado }) => ({ tipo, atividade, planejado }));
        await updateDoc(doc(db, "membros", this.uid), { padroes });
        this.ok = "Atividades padrão salvas: as próximas semanas já começam com elas.";
      } catch (err) { this.erro = mensagemErro(err); }
      finally { this.salvando = false; }
    },
    async copiarAnterior() {
      this.erro = ""; this.ok = "";
      try {
        const s = await getDoc(doc(db, "gig", this.idDoc(this.semana - 1)));
        if (!s.exists()) { this.erro = "A semana anterior não foi preenchida."; return; }
        this.linhas = this.agrupar((s.data().atividades || []).map((a) => ({ ...a, realizado: "" })));
        this.ok = "Atividades da semana anterior copiadas (horas realizadas zeradas). Salve para gravar.";
      } catch (err) { this.erro = mensagemErro(err); }
    },
  },
  template: `
  <div>
    <header class="cabecalho">
      <div><h1>GIG semanal</h1><p class="sub">Planejado × realizado da sua semana, por tipo de atividade.</p></div>
      <SeletorSemana v-model="semana" :semestre="semestre" v-if="semestre" />
    </header>

    <div class="aviso" v-if="!semestre">Nenhum semestre ativo. Peça à liderança para configurar em Membros → Semestres.</div>
    <template v-else>
      <div class="aviso" v-if="!existente && !carregando">
        Esta semana ainda não foi salva. As linhas abaixo vêm das suas atividades padrão
        <span v-if="!(store.membro.padroes || []).length">(você ainda não tem nenhuma: preencha e use "Salvar como minhas atividades padrão")</span>.
      </div>

      <div class="gig-grade">
        <section class="cartao gig-tipo" v-for="t in TIPOS" :key="t.id">
          <h3>{{ t.nome }} <small>{{ fmt(totais[t.id].p) }}h → {{ fmt(totais[t.id].r) }}h</small></h3>
          <div class="gig-cab"><span>Atividade</span><span>Plan.</span><span>Real.</span><span></span></div>
          <div class="gig-linha" v-for="(l, i) in linhas[t.id]" :key="i">
            <input v-model="l.atividade" :list="'cat-' + t.id" placeholder="Atividade">
            <input class="horas" v-model="l.planejado" inputmode="decimal" placeholder="0">
            <input class="horas" v-model="l.realizado" inputmode="decimal" placeholder="0">
            <button class="remover" @click="remover(t.id, i)" title="Remover linha">×</button>
          </div>
          <datalist :id="'cat-' + t.id"><option v-for="a in sugestoes(t.id)" :key="a.id" :value="a.nome"></option></datalist>
          <button class="btn pequeno" @click="adicionar(t.id)"><span v-html="ICONES.mais"></span> linha</button>
        </section>
      </div>

      <section class="cartao" style="margin-top:16px">
        <div class="cartao-titulo">Como foi a sua semana? <small style="font-weight:500;color:var(--texto-fraco)">Feeling de sobrecarga</small></div>
        <div class="feeling">
          <button v-for="f in FEELINGS" :key="f.cor" :class="{ sel: feeling.cor === f.cor }" :style="{ color: corCss(f.cor) }" @click="escolherFeeling(f)">
            <span class="ponto" :class="f.cor"></span><span style="color:var(--texto)">{{ f.nome }}</span>
          </button>
        </div>
        <div class="campo" style="margin:12px 0 0;max-width:360px" v-if="motivos.length > 1">
          <span>Motivo</span>
          <select v-model="feeling.motivo"><option v-for="m in motivos" :key="m">{{ m }}</option></select>
        </div>
      </section>

      <section class="cartao" style="margin-top:16px">
        <div class="totais">
          <div><b>{{ fmt(totais.geral.p) }}h</b><span>planejado</span></div>
          <div><b>{{ fmt(totais.geral.r) }}h</b><span>realizado</span></div>
        </div>
        <div class="linha" style="margin-top:16px">
          <button class="btn destaque" @click="salvar" :disabled="salvando || carregando"><span v-html="ICONES.salvar"></span> Salvar semana</button>
          <button class="btn" @click="salvarPadrao" :disabled="salvando || carregando">Salvar como minhas atividades padrão</button>
          <button class="btn" @click="copiarAnterior" :disabled="semana <= 1 || salvando"><span v-html="ICONES.copiar"></span> Copiar semana anterior</button>
        </div>
        <p class="erro" v-if="erro">{{ erro }}</p>
        <p class="sucesso" v-if="ok">{{ ok }}</p>
      </section>
    </template>
  </div>`,
};
