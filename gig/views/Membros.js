import { store, semestreAtivo } from "../lib/store.js";
import { db, doc, setDoc, updateDoc, deleteDoc, writeBatch, serverTimestamp, mensagemErro } from "../lib/firebase.js";
import { slug, hojeISO } from "../lib/util.js";
import { TIPOS, PAPEIS, MODULOS_PADRAO, nomePapel, nomeTipo } from "../lib/constantes.js";
import { semearCatalogos, CARGOS_PADRAO } from "../lib/seed.js";
import { ICONES } from "../components/Icones.js";

export default {
  data() {
    return {
      store, TIPOS, PAPEIS, ICONES,
      aba: "membros", erro: "", ok: "", salvando: false,
      sel: null,                      // membro em edição (cópia)
      novoCargo: { processo: "", cargo: "" },
      proc: null,                     // processo em edição
      ativ: null, filtroTipo: "", buscaAtiv: "",
      sem: null,
      configQuedas: null,
    };
  },
  computed: {
    semestre() { return semestreAtivo(); },
    modulos() { return (this.semestre && this.semestre.modulos && this.semestre.modulos.length) ? this.semestre.modulos : MODULOS_PADRAO; },
    membrosOrdenados() { return [...store.membros].sort((a, b) => (a.nome || "").localeCompare(b.nome || "")); },
    atividadesFiltradas() {
      const b = this.buscaAtiv.trim().toLowerCase();
      return store.atividades.filter((a) => (!this.filtroTipo || a.tipo === this.filtroTipo) && (!b || a.nome.toLowerCase().includes(b)));
    },
    cargosDoProcesso() {
      const p = store.processos.find((x) => x.id === this.novoCargo.processo);
      return (p && p.cargos && p.cargos.length) ? p.cargos : CARGOS_PADRAO;
    },
    catalogosVazios() { return !store.processos.length && !store.atividades.length; },
  },
  methods: {
    nomePapel, nomeTipo,
    nomeProcesso(id) { return (store.processos.find((p) => p.id === id) || {}).nome || id; },
    limpar() { this.erro = ""; this.ok = ""; },
    // ---- membros ----
    editar(m) { this.limpar(); this.sel = JSON.parse(JSON.stringify({ cargos: [], ...m })); this.novoCargo = { processo: "", cargo: "" }; },
    addCargo() {
      if (!this.novoCargo.processo || !this.novoCargo.cargo) return;
      this.sel.cargos.push({ processo: this.novoCargo.processo, processoNome: this.nomeProcesso(this.novoCargo.processo), cargo: this.novoCargo.cargo });
      this.novoCargo = { processo: "", cargo: "" };
    },
    async salvarMembro() {
      this.limpar(); this.salvando = true;
      try {
        const { id, nome, modulo, papel, ativo, cargos } = this.sel;
        await updateDoc(doc(db, "membros", id), { nome, modulo: modulo || "", papel, ativo: ativo !== false, cargos, atualizadoEm: serverTimestamp() });
        this.ok = `${nome} atualizado.`; this.sel = null;
      } catch (err) { this.erro = mensagemErro(err); }
      finally { this.salvando = false; }
    },
    // ---- processos ----
    novoProcesso() { this.limpar(); this.proc = { id: "", nome: "", cargosTexto: CARGOS_PADRAO.join(", "), ativo: true }; },
    editarProcesso(p) { this.limpar(); this.proc = { id: p.id, nome: p.nome, cargosTexto: (p.cargos || []).join(", "), ativo: p.ativo !== false }; },
    async salvarProcesso() {
      this.limpar();
      if (!this.proc.nome.trim()) { this.erro = "Dê um nome ao processo."; return; }
      this.salvando = true;
      try {
        const id = this.proc.id || slug(this.proc.nome);
        const cargos = this.proc.cargosTexto.split(",").map((c) => c.trim()).filter(Boolean);
        await setDoc(doc(db, "processos", id), { nome: this.proc.nome.trim(), cargos, ativo: this.proc.ativo }, { merge: true });
        this.ok = "Processo salvo."; this.proc = null;
      } catch (err) { this.erro = mensagemErro(err); }
      finally { this.salvando = false; }
    },
    // ---- atividades ----
    novaAtividade() { this.limpar(); this.ativ = { id: "", nome: "", tipo: this.filtroTipo || "gerais", modulos: [], processo: "", descricao: "", ativo: true }; },
    editarAtividade(a) { this.limpar(); this.ativ = { modulos: [], processo: "", descricao: "", ...JSON.parse(JSON.stringify(a)) }; },
    async salvarAtividade() {
      this.limpar();
      if (!this.ativ.nome.trim()) { this.erro = "Dê um nome à atividade."; return; }
      this.salvando = true;
      try {
        const { id, ...dados } = this.ativ;
        dados.nome = dados.nome.trim();
        await setDoc(doc(db, "atividades", id || slug(dados.nome)), dados, { merge: true });
        this.ok = "Atividade salva."; this.ativ = null;
      } catch (err) { this.erro = mensagemErro(err); }
      finally { this.salvando = false; }
    },
    async excluirAtividade() {
      if (!this.ativ.id || !confirm(`Excluir "${this.ativ.nome}" do catálogo?`)) return;
      try { await deleteDoc(doc(db, "atividades", this.ativ.id)); this.ativ = null; }
      catch (err) { this.erro = mensagemErro(err); }
    },
    async semear() {
      this.limpar(); this.salvando = true;
      try {
        const n = await semearCatalogos({ processos: store.processos, atividades: store.atividades });
        this.ok = `${n} itens carregados (processos, atividades e motivos de queda).`;
      } catch (err) { this.erro = mensagemErro(err); }
      finally { this.salvando = false; }
    },
    // ---- semestres ----
    novoSemestre() {
      this.limpar();
      const ano = new Date().getFullYear(), per = new Date().getMonth() < 6 ? 1 : 2;
      this.sem = { id: `${ano}.${per}`, inicio: hojeISO(), semanas: 15, modulosTexto: MODULOS_PADRAO.join(", "), ativo: !store.semestres.length };
    },
    editarSemestre(s) { this.limpar(); this.sem = { id: s.id, inicio: s.inicio, semanas: s.semanas, modulosTexto: (s.modulos || MODULOS_PADRAO).join(", "), ativo: Boolean(s.ativo), existente: true }; },
    async salvarSemestre() {
      this.limpar();
      if (!/^\d{4}\.[12]$/.test(this.sem.id)) { this.erro = "O id do semestre tem o formato 2026.2."; return; }
      if (!this.sem.inicio) { this.erro = "Informe a segunda-feira da semana 1."; return; }
      this.salvando = true;
      try {
        const lote = writeBatch(db);
        if (this.sem.ativo) for (const s of store.semestres) if (s.id !== this.sem.id && s.ativo) lote.update(doc(db, "semestres", s.id), { ativo: false });
        lote.set(doc(db, "semestres", this.sem.id), {
          nome: this.sem.id, inicio: this.sem.inicio, semanas: Number(this.sem.semanas) || 15,
          modulos: this.sem.modulosTexto.split(",").map((m) => m.trim()).filter(Boolean), ativo: this.sem.ativo,
        }, { merge: true });
        await lote.commit();
        this.ok = "Semestre salvo."; this.sem = null;
      } catch (err) { this.erro = mensagemErro(err); }
      finally { this.salvando = false; }
    },
    // ---- quedas (config) ----
    editarQuedas() { this.limpar(); this.configQuedas = JSON.parse(JSON.stringify(store.configQuedas)); },
    async salvarQuedas() {
      this.limpar(); this.salvando = true;
      try {
        const motivos = this.configQuedas.motivos.filter((m) => m.nome.trim()).map((m) => ({ nome: m.nome.trim(), pct: Number(m.pct) || 0.05 }));
        await setDoc(doc(db, "config", "quedas"), { motivos, farol: { amarelo: Number(this.configQuedas.farol.amarelo) || 0.9, verde: Number(this.configQuedas.farol.verde) || 1 } });
        this.ok = "Motivos de queda salvos."; this.configQuedas = null;
      } catch (err) { this.erro = mensagemErro(err); }
      finally { this.salvando = false; }
    },
  },
  template: `
  <div>
    <header class="cabecalho"><div><h1>Membros e cadastros</h1><p class="sub">Só a liderança vê esta tela.</p></div></header>

    <div class="abas">
      <button class="aba" :class="{ ativa: aba === 'membros' }" @click="aba = 'membros'">Membros <span class="cont">{{ store.membros.length }}</span></button>
      <button class="aba" :class="{ ativa: aba === 'processos' }" @click="aba = 'processos'">Processos</button>
      <button class="aba" :class="{ ativa: aba === 'atividades' }" @click="aba = 'atividades'">Catálogo de atividades</button>
      <button class="aba" :class="{ ativa: aba === 'semestres' }" @click="aba = 'semestres'">Semestres</button>
      <button class="aba" :class="{ ativa: aba === 'quedas' }" @click="aba = 'quedas'">Motivos de queda</button>
    </div>

    <p class="erro" v-if="erro">{{ erro }}</p>
    <p class="sucesso" v-if="ok">{{ ok }}</p>

    <div class="aviso" v-if="catalogosVazios">
      Os catálogos estão vazios. <button class="btn pequeno destaque" @click="semear" :disabled="salvando">Carregar catálogos iniciais</button>
      (processos, ~120 atividades e os motivos de queda das planilhas do GIG).
    </div>

    <!-- ================= MEMBROS ================= -->
    <template v-if="aba === 'membros'">
      <section class="cartao" v-if="sel">
        <div class="cartao-titulo">Editar {{ sel.nome }} <button class="btn pequeno" @click="sel = null">fechar</button></div>
        <div class="linha">
          <label class="campo"><span>Nome</span><input v-model="sel.nome"></label>
          <label class="campo curto"><span>Módulo</span><select v-model="sel.modulo"><option value="">—</option><option v-for="m in modulos" :key="m">{{ m }}</option></select></label>
          <label class="campo"><span>Papel na plataforma</span><select v-model="sel.papel"><option v-for="p in PAPEIS" :key="p.id" :value="p.id">{{ p.nome }}</option></select></label>
          <label class="check" style="margin-bottom:14px"><input type="checkbox" v-model="sel.ativo"> Ativo</label>
        </div>
        <div class="campo">
          <span>Cargos por processo</span>
          <div class="linha" style="gap:6px" v-for="(c, i) in sel.cargos" :key="i">
            <span class="selo">{{ nomeProcesso(c.processo) }} · {{ c.cargo }}</span>
            <button class="remover" @click="sel.cargos.splice(i, 1)">×</button>
          </div>
          <div class="linha">
            <label class="campo" style="margin:0"><select v-model="novoCargo.processo"><option value="">Processo…</option><option v-for="p in store.processos.filter(p => p.ativo !== false)" :key="p.id" :value="p.id">{{ p.nome }}</option></select></label>
            <label class="campo" style="margin:0"><select v-model="novoCargo.cargo"><option value="">Cargo…</option><option v-for="c in cargosDoProcesso" :key="c">{{ c }}</option></select></label>
            <button class="btn" @click="addCargo">Adicionar cargo</button>
          </div>
        </div>
        <button class="btn destaque" @click="salvarMembro" :disabled="salvando">Salvar</button>
      </section>
      <section class="cartao">
        <div class="tabela-caixa"><table class="tabela">
          <thead><tr><th></th><th>Nome</th><th>E-mail</th><th>Módulo</th><th>Papel</th><th>Cargos</th><th></th></tr></thead>
          <tbody>
            <tr v-for="m in membrosOrdenados" :key="m.id" :style="m.ativo === false ? 'opacity:.5' : ''">
              <td><img class="avatar" :src="m.foto || '../assets/favicon_glean.png'" alt=""></td>
              <td><b>{{ m.nome }}</b><span class="selo neutro" v-if="m.ativo === false" style="margin-left:6px">inativo</span></td>
              <td style="font-size:13px;color:var(--texto-fraco)">{{ m.email }}</td>
              <td>{{ m.modulo || "—" }}</td>
              <td>{{ nomePapel(m.papel) }}</td>
              <td><span class="selo" v-for="(c, i) in (m.cargos || [])" :key="i" style="margin:2px">{{ nomeProcesso(c.processo) }} · {{ c.cargo }}</span></td>
              <td><button class="btn pequeno" @click="editar(m)">Editar</button></td>
            </tr>
          </tbody>
        </table></div>
      </section>
    </template>

    <!-- ================= PROCESSOS ================= -->
    <template v-if="aba === 'processos'">
      <section class="cartao" v-if="proc">
        <div class="cartao-titulo">{{ proc.id ? "Editar processo" : "Novo processo" }} <button class="btn pequeno" @click="proc = null">fechar</button></div>
        <div class="linha">
          <label class="campo"><span>Nome</span><input v-model="proc.nome"></label>
          <label class="campo" style="flex:2"><span>Cargos (separados por vírgula)</span><input v-model="proc.cargosTexto"></label>
          <label class="check" style="margin-bottom:14px"><input type="checkbox" v-model="proc.ativo"> Ativo</label>
        </div>
        <button class="btn destaque" @click="salvarProcesso" :disabled="salvando">Salvar</button>
      </section>
      <section class="cartao">
        <div class="cartao-titulo">Processos <button class="btn pequeno destaque" @click="novoProcesso"><span v-html="ICONES.mais"></span> novo</button></div>
        <div class="tabela-caixa"><table class="tabela">
          <thead><tr><th>Nome</th><th>Cargos</th><th>Ativo</th><th></th></tr></thead>
          <tbody><tr v-for="p in store.processos" :key="p.id">
            <td><b>{{ p.nome }}</b></td><td>{{ (p.cargos || []).join(", ") }}</td><td>{{ p.ativo === false ? "não" : "sim" }}</td>
            <td><button class="btn pequeno" @click="editarProcesso(p)">Editar</button></td>
          </tr></tbody>
        </table></div>
      </section>
    </template>

    <!-- ================= ATIVIDADES ================= -->
    <template v-if="aba === 'atividades'">
      <section class="cartao" v-if="ativ">
        <div class="cartao-titulo">{{ ativ.id ? "Editar atividade" : "Nova atividade" }} <button class="btn pequeno" @click="ativ = null">fechar</button></div>
        <div class="linha">
          <label class="campo" style="flex:2"><span>Nome</span><input v-model="ativ.nome"></label>
          <label class="campo"><span>Tipo</span><select v-model="ativ.tipo"><option v-for="t in TIPOS" :key="t.id" :value="t.id">{{ t.nome }}</option></select></label>
          <label class="campo"><span>Processo (opcional)</span><input v-model="ativ.processo" placeholder="Ex.: Kikai"></label>
        </div>
        <div class="campo"><span>Restrita aos módulos (nenhum marcado = todos)</span>
          <div class="linha" style="gap:6px 16px"><label class="check" v-for="m in modulos" :key="m"><input type="checkbox" :value="m" v-model="ativ.modulos"> {{ m }}</label></div>
        </div>
        <label class="campo"><span>Descrição</span><input v-model="ativ.descricao"></label>
        <label class="check" style="margin-bottom:14px"><input type="checkbox" v-model="ativ.ativo"> Ativa (aparece nas sugestões do GIG)</label>
        <div class="linha"><button class="btn destaque" @click="salvarAtividade" :disabled="salvando">Salvar</button><button class="btn perigo" v-if="ativ.id" @click="excluirAtividade">Excluir</button></div>
      </section>
      <div class="filtros">
        <input v-model="buscaAtiv" placeholder="Buscar atividade">
        <select v-model="filtroTipo"><option value="">Todos os tipos</option><option v-for="t in TIPOS" :key="t.id" :value="t.id">{{ t.nome }}</option></select>
        <button class="btn destaque" @click="novaAtividade"><span v-html="ICONES.mais"></span> nova atividade</button>
      </div>
      <section class="cartao">
        <div class="tabela-caixa"><table class="tabela">
          <thead><tr><th>Atividade</th><th>Tipo</th><th>Módulos</th><th>Processo</th><th></th></tr></thead>
          <tbody><tr v-for="a in atividadesFiltradas" :key="a.id" :style="a.ativo === false ? 'opacity:.5' : ''">
            <td><b>{{ a.nome }}</b><div class="dica" style="margin:0" v-if="a.descricao">{{ a.descricao }}</div></td>
            <td>{{ nomeTipo(a.tipo) }}</td><td>{{ (a.modulos || []).join(", ") || "todos" }}</td><td>{{ a.processo }}</td>
            <td><button class="btn pequeno" @click="editarAtividade(a)">Editar</button></td>
          </tr></tbody>
        </table></div>
      </section>
    </template>

    <!-- ================= SEMESTRES ================= -->
    <template v-if="aba === 'semestres'">
      <section class="cartao" v-if="sem">
        <div class="cartao-titulo">{{ sem.existente ? "Editar semestre" : "Novo semestre" }} <button class="btn pequeno" @click="sem = null">fechar</button></div>
        <div class="linha">
          <label class="campo curto"><span>Semestre</span><input v-model="sem.id" placeholder="2026.2" :disabled="sem.existente"></label>
          <label class="campo"><span>Segunda-feira da semana 1</span><input type="date" v-model="sem.inicio"></label>
          <label class="campo curto"><span>Nº de semanas</span><input type="number" min="1" max="30" v-model="sem.semanas"></label>
          <label class="campo"><span>Módulos (separados por vírgula)</span><input v-model="sem.modulosTexto"></label>
          <label class="check" style="margin-bottom:14px"><input type="checkbox" v-model="sem.ativo"> Semestre ativo</label>
        </div>
        <p class="dica">Só um semestre fica ativo por vez; marcar este desativa os outros.</p>
        <button class="btn destaque" @click="salvarSemestre" :disabled="salvando">Salvar</button>
      </section>
      <section class="cartao">
        <div class="cartao-titulo">Semestres <button class="btn pequeno destaque" @click="novoSemestre"><span v-html="ICONES.mais"></span> novo</button></div>
        <p class="vazio" v-if="!store.semestres.length">Nenhum semestre cadastrado. Crie o primeiro para liberar o GIG e a pesquisinha.</p>
        <div class="tabela-caixa" v-else><table class="tabela">
          <thead><tr><th>Semestre</th><th>Início</th><th>Semanas</th><th>Módulos</th><th>Ativo</th><th></th></tr></thead>
          <tbody><tr v-for="s in store.semestres" :key="s.id">
            <td><b>{{ s.id }}</b></td><td>{{ s.inicio }}</td><td>{{ s.semanas }}</td><td>{{ (s.modulos || []).join(", ") }}</td>
            <td><span class="selo ok" v-if="s.ativo">ativo</span></td>
            <td><button class="btn pequeno" @click="editarSemestre(s)">Editar</button></td>
          </tr></tbody>
        </table></div>
      </section>
    </template>

    <!-- ================= QUEDAS ================= -->
    <template v-if="aba === 'quedas'">
      <section class="cartao" v-if="configQuedas">
        <div class="cartao-titulo">Motivos e pesos <button class="btn pequeno" @click="configQuedas = null">fechar</button></div>
        <div class="linha" v-for="(m, i) in configQuedas.motivos" :key="i" style="margin-bottom:6px">
          <label class="campo" style="margin:0;flex:3"><input v-model="m.nome"></label>
          <label class="campo curto" style="margin:0"><input type="number" step="0.01" min="0" max="1" v-model="m.pct"></label>
          <button class="remover" @click="configQuedas.motivos.splice(i, 1)">×</button>
        </div>
        <button class="btn pequeno" @click="configQuedas.motivos.push({ nome: '', pct: 0.05 })"><span v-html="ICONES.mais"></span> motivo</button>
        <div class="linha" style="margin-top:14px">
          <label class="campo curto"><span>Amarelo a partir de</span><input type="number" step="0.01" v-model="configQuedas.farol.amarelo"></label>
          <label class="campo curto"><span>Verde a partir de</span><input type="number" step="0.01" v-model="configQuedas.farol.verde"></label>
        </div>
        <button class="btn destaque" @click="salvarQuedas" :disabled="salvando">Salvar</button>
      </section>
      <section class="cartao">
        <div class="cartao-titulo">Motivos de queda no ID <button class="btn pequeno" @click="editarQuedas">Editar</button></div>
        <table class="tabela"><thead><tr><th>Motivo</th><th class="num">Desconto por queda</th></tr></thead>
          <tbody><tr v-for="m in store.configQuedas.motivos" :key="m.nome"><td>{{ m.nome }}</td><td class="num">{{ Math.round(m.pct * 100) }}%</td></tr></tbody></table>
        <p class="dica" style="margin-top:10px">Farol: verde com ID ≥ {{ store.configQuedas.farol.verde }}, amarelo a partir de {{ store.configQuedas.farol.amarelo }}, vermelho abaixo.</p>
      </section>
    </template>
  </div>`,
};
