import { store, semestreAtivo, processosDoMembro } from "../lib/store.js";
import { db, doc, getDoc, setDoc, updateDoc, serverTimestamp, mensagemErro } from "../lib/firebase.js";
import { semanaAtual, idSemana } from "../lib/semana.js";
import { num, arred, fmt, slug } from "../lib/util.js";
import { TIPOS, FEELINGS } from "../lib/constantes.js";
import { ICONES } from "../components/Icones.js";
import SeletorSemana from "../components/SeletorSemana.js";

const linhaVazia = () => ({ atividade: "", planejado: "", realizado: "" });
const linhasVazias = () => Object.fromEntries(TIPOS.map((t) => [t.id, []]));
const MIN_LINHAS = 8; // como na planilha: sempre há linhas em branco para preencher
const vazia = (l) => !String(l.atividade || "").trim() && l.planejado === "" && l.realizado === "";
// Cores da planilha do GIG
export const CORES_FEELING = { azul: "#6fa8dc", verde: "#70ad47", amarelo: "#ffff66", vermelho: "#c00000" };

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
    // mantém as quatro colunas com o mesmo número de linhas e sempre uma em branco no fim
    linhas: { deep: true, handler() { this.completarLinhas(); } },
    "store.semestres"(novo, antigo) { if (!antigo.length && novo.length) { this.semana = semanaAtual(semestreAtivo()); this.carregar(); } },
  },
  created() { this.carregar(); },
  methods: {
    fmt,
    corFeeling: (cor) => CORES_FEELING[cor] || "#fff",
    textoFeeling: (cor) => (cor === "vermelho" ? "#fff" : "#1d1d1d"),
    completarLinhas() {
      const ls = this.linhas;
      const usadas = Math.max(0, ...TIPOS.map((t) => {
        const a = ls[t.id]; let n = a.length;
        while (n > 0 && vazia(a[n - 1])) n--;
        return n;
      }));
      const alvo = Math.max(MIN_LINHAS, usadas + 1);
      for (const t of TIPOS) {
        const a = ls[t.id];
        while (a.length < alvo) a.push(linhaVazia());
        // remove sobras em branco no fim (quando alguém apaga linhas)
        while (a.length > alvo && vazia(a[a.length - 1])) a.pop();
      }
    },
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
    preenchida(l) { return !vazia(l); },
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

      <div class="planilha-gig" :class="{ carregando }">
        <!-- coluna da esquerda, como na planilha: status (feeling) e totais -->
        <div class="pg-resumo">
          <div class="pg-cab-resumo">Status</div>
          <div class="pg-status" :style="{ background: corFeeling(feeling.cor), color: textoFeeling(feeling.cor) }">
            <b>{{ (FEELINGS.find(f => f.cor === feeling.cor) || {}).nome }}</b>
            <small v-if="feeling.motivo !== (FEELINGS.find(f => f.cor === feeling.cor) || {}).nome">{{ feeling.motivo }}</small>
          </div>
          <div class="pg-cab-resumo">Planejado</div>
          <div class="pg-valor">{{ fmt(totais.geral.p) }}<small>h</small></div>
          <div class="pg-cab-resumo">Realizado</div>
          <div class="pg-valor">{{ fmt(totais.geral.r) }}<small>h</small></div>
        </div>

        <div class="pg-bloco" v-for="t in TIPOS" :key="t.id" :class="'pg-' + t.id">
          <div class="pg-titulo">{{ t.nome }}</div>
          <div class="pg-cab"><span>Atividade</span><span>P</span><span>R</span></div>
          <div class="pg-linha" v-for="(l, i) in linhas[t.id]" :key="i" :class="{ vazia: !preenchida(l) }">
            <input v-model="l.atividade" :list="'cat-' + t.id" :aria-label="t.nome + ' linha ' + (i + 1)">
            <input class="horas" v-model="l.planejado" inputmode="decimal" aria-label="Planejado">
            <input class="horas" v-model="l.realizado" inputmode="decimal" aria-label="Realizado">
            <button class="pg-remover" v-if="preenchida(l)" @click="remover(t.id, i)" title="Apagar linha">×</button>
          </div>
          <div class="pg-total"><span>Total</span><span>{{ fmt(totais[t.id].p) }}</span><span>{{ fmt(totais[t.id].r) }}</span></div>
          <datalist :id="'cat-' + t.id"><option v-for="a in sugestoes(t.id)" :key="a.id" :value="a.nome"></option></datalist>
        </div>
      </div>
      <p class="dica" style="margin:8px 2px 0">Digite nas linhas em branco: novas linhas aparecem sozinhas. As sugestões vêm do catálogo de atividades (filtrado pelo seu módulo).</p>

      <section class="cartao" style="margin-top:16px">
        <div class="cartao-titulo"><span>Como será a sua semana? <small style="font-weight:500;color:var(--texto-fraco)">Feeling de sobrecarga</small></span></div>
        <div class="feeling">
          <button v-for="f in FEELINGS" :key="f.cor" :class="{ sel: feeling.cor === f.cor }" :style="{ '--cor': corFeeling(f.cor) }" @click="escolherFeeling(f)">
            <span class="ponto" :style="{ background: corFeeling(f.cor) }"></span><span>{{ f.nome }}</span>
          </button>
        </div>
        <div class="campo" style="margin:12px 0 0;max-width:360px" v-if="motivos.length > 1">
          <span>Motivo</span>
          <select v-model="feeling.motivo"><option v-for="m in motivos" :key="m">{{ m }}</option></select>
        </div>
      </section>

      <section class="cartao" style="margin-top:16px">
        <div class="linha">
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
