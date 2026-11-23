import { store } from "../lib/store.js";
import { db, doc, updateDoc, serverTimestamp, mensagemErro } from "../lib/firebase.js";
import { TIPOS, nomePapel, coresDosCargos } from "../lib/constantes.js";
import { arred, fmt } from "../lib/util.js";
import { ICONES } from "../components/Icones.js";

export default {
  data() {
    const m = store.membro;
    return {
      store, TIPOS, ICONES, nome: m.nome, salvando: false, erro: "", ok: "",
      padroes: Object.fromEntries(TIPOS.map((t) => [t.id, (m.padroes || []).filter((p) => p.tipo === t.id).map((p) => ({ atividade: p.atividade, planejado: p.planejado }))])),
    };
  },
  computed: {
    totalPadrao() { return TIPOS.reduce((s, t) => s + this.padroes[t.id].reduce((x, p) => x + arred(p.planejado), 0), 0); },
  },
  methods: {
    fmt, nomePapel, coresDosCargos,
    nomeProcesso(id) { return (store.processos.find((p) => p.id === id) || {}).nome || id; },
    sugestoes(tipo) { return store.atividades.filter((a) => a.tipo === tipo && a.ativo !== false); },
    async salvar() {
      this.erro = ""; this.ok = ""; this.salvando = true;
      try {
        const padroes = TIPOS.flatMap((t) => this.padroes[t.id].filter((p) => String(p.atividade || "").trim())
          .map((p) => ({ tipo: t.id, atividade: String(p.atividade).trim(), planejado: arred(p.planejado) })));
        await updateDoc(doc(db, "membros", store.membro.id), { nome: this.nome.trim() || store.membro.nome, padroes, atualizadoEm: serverTimestamp() });
        this.ok = "Perfil salvo.";
      } catch (err) { this.erro = mensagemErro(err); }
      finally { this.salvando = false; }
    },
  },
  template: `
  <div>
    <header class="cabecalho"><div><h1>Meu perfil</h1><p class="sub">Seus dados e as atividades padrão com que cada semana do GIG começa.</p></div></header>

    <div class="grade grade-2">
      <section class="cartao">
        <div style="display:flex;gap:16px;align-items:center;margin-bottom:16px">
          <img class="avatar" :src="store.membro.foto || '../assets/marca/favicon_glean.png'" alt="" style="width:64px;height:64px">
          <div><b style="font-size:18px">{{ store.membro.nome }}</b><div class="dica" style="margin:0">{{ store.membro.email }}</div></div>
        </div>
        <label class="campo"><span>Nome exibido</span><input v-model="nome"></label>
        <div class="linha">
          <div class="campo"><span>Módulo</span><div>{{ store.membro.modulo || "não definido" }}</div></div>
          <div class="campo"><span>Papel</span><div>{{ nomePapel(store.membro.papel) }}</div></div>
        </div>
        <div class="campo"><span>Cargos</span>
          <div v-if="(store.membro.cargos || []).length"><span class="selo cargo" v-for="(c, i) in store.membro.cargos" :key="i" :style="coresDosCargos(store.membro.cargos)[i]">{{ nomeProcesso(c.processo) }} · {{ c.cargo }}</span></div>
          <div class="dica" v-else style="margin:0">Nenhum cargo atribuído ainda (quem atribui é a liderança).</div>
        </div>
      </section>

      <section class="cartao">
        <div class="cartao-titulo">Atividades padrão <span class="selo neutro">{{ fmt(totalPadrao) }}h planejadas</span></div>
        <p class="dica">Cada semana nova do GIG já nasce com estas linhas. Você também pode gerá-las direto do GIG com "Salvar como minhas atividades padrão".</p>
        <div v-for="t in TIPOS" :key="t.id" style="margin-bottom:12px">
          <b style="font-size:13px">{{ t.nome }}</b>
          <div class="gig-linha" v-for="(p, i) in padroes[t.id]" :key="i" style="grid-template-columns:1fr 70px 30px">
            <input v-model="p.atividade" :list="'pad-' + t.id" placeholder="Atividade">
            <input class="horas" v-model="p.planejado" inputmode="decimal" placeholder="h">
            <button class="remover" @click="padroes[t.id].splice(i, 1)">×</button>
          </div>
          <datalist :id="'pad-' + t.id"><option v-for="a in sugestoes(t.id)" :key="a.id" :value="a.nome"></option></datalist>
          <button class="btn pequeno" @click="padroes[t.id].push({ atividade: '', planejado: '' })"><span v-html="ICONES.mais"></span> linha</button>
        </div>
      </section>
    </div>

    <section class="cartao" style="margin-top:16px">
      <button class="btn destaque" @click="salvar" :disabled="salvando"><span v-html="ICONES.salvar"></span> Salvar perfil</button>
      <p class="erro" v-if="erro">{{ erro }}</p><p class="sucesso" v-if="ok">{{ ok }}</p>
    </section>
  </div>`,
};
