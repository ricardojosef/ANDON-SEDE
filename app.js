// ===========================================================================
// Andon GLean — painel da sede
// ===========================================================================
import {
  FIREBASE_CONFIG, SENHA_MEMBROS, LOCAL,
  SLOTS_PLANTAO, MEMBROS_INICIAIS, HORA_RELOAD_DIARIO,
} from "./config.js";

const $ = (id) => document.getElementById(id);
const STATUS = ["azul", "verde", "amarelo", "vermelho"];
const CHAVE_LOCAL = "andon-glean";

// A escala de sede é fixada por semestre e vale de segunda a sexta. As chaves
// seguem o índice de Date.getDay() (1 = segunda … 5 = sexta).
const DIAS = [
  { chave: "seg", nome: "Segunda", curto: "Seg", diaSemana: 1 },
  { chave: "ter", nome: "Terça", curto: "Ter", diaSemana: 2 },
  { chave: "qua", nome: "Quarta", curto: "Qua", diaSemana: 3 },
  { chave: "qui", nome: "Quinta", curto: "Qui", diaSemana: 4 },
  { chave: "sex", nome: "Sexta", curto: "Sex", diaSemana: 5 },
];

// Dia útil de hoje; no fim de semana cai em segunda, que é o próximo a valer.
function diaDeHoje(agora = new Date()) {
  return DIAS.find((d) => d.diaSemana === agora.getDay()) || DIAS[0];
}

// ---------------------------------------------------------------------------
// Estado inicial
// ---------------------------------------------------------------------------
function eventoPadrao(texto) {
  return {
    texto, cor: "#123a5c", fonte: "sans", tamanho: 100,
    piscar: false, confete: false,
    imagem: "",       // data URL do arquivo enviado pelo usuário
    imagemNome: "",   // nome original, só para exibir no editor
  };
}

function estadoPadrao() {
  const plantao = {};
  DIAS.forEach(({ chave }) => {
    plantao[chave] = {};
    SLOTS_PLANTAO.forEach(([inicio]) => { plantao[chave][inicio] = ""; });
  });

  const membros = [];
  for (let i = 1; i <= MEMBROS_INICIAIS; i++) {
    membros.push({ id: "m" + i, nome: "Membro " + i, status: "verde", nota: "", foto: "" });
  }

  return {
    reuniao: {
      ativa: false,
      atualizadoEm: 0,
      // Período opcional que liga o aviso sozinho, sem precisar de ninguém
      // clicando no switch. "ativa" continua valendo como o controle manual.
      agendamento: { ativo: false, inicio: "", fim: "" },
    },
    letreiro: { texto: "", modo: "off", exibidoEm: 0 },
    plantao,
    membros,
    eventos: { terca: eventoPadrao(""), quinta: eventoPadrao("") },
    volume: { limiar: 0.12, calibradoEm: 0 },
    atualizadoEm: 0,
  };
}

// Normaliza o que vem do banco: o Firebase omite chaves vazias e pode devolver
// arrays como objetos, então tudo é reconstruído sobre o padrão.
function normalizar(bruto) {
  const base = estadoPadrao();
  if (!bruto || typeof bruto !== "object") return base;

  const est = {
    reuniao: {
      ...base.reuniao,
      ...(bruto.reuniao || {}),
      agendamento: { ...base.reuniao.agendamento, ...((bruto.reuniao || {}).agendamento || {}) },
    },
    letreiro: { ...base.letreiro, ...(bruto.letreiro || {}) },
    plantao: base.plantao,
    membros: base.membros,
    eventos: {
      terca: { ...base.eventos.terca, ...((bruto.eventos || {}).terca || {}) },
      quinta: { ...base.eventos.quinta, ...((bruto.eventos || {}).quinta || {}) },
    },
    volume: { ...base.volume, ...(bruto.volume || {}) },
    atualizadoEm: bruto.atualizadoEm || 0,
  };

  if (bruto.plantao) {
    // Formato antigo: uma escala única, com os horários na raiz. Aproveita esses
    // nomes replicando-os em todos os dias, para não perder o que já foi
    // preenchido antes da escala passar a ser por dia da semana.
    const ehFormatoAntigo = SLOTS_PLANTAO.some(
      ([inicio]) => typeof bruto.plantao[inicio] === "string"
    );

    for (const { chave } of DIAS) {
      const origem = ehFormatoAntigo ? bruto.plantao : bruto.plantao[chave];
      if (!origem || typeof origem !== "object") continue;
      for (const [inicio] of SLOTS_PLANTAO) {
        if (typeof origem[inicio] === "string") est.plantao[chave][inicio] = origem[inicio];
      }
    }

    // Sinaliza para regravar no formato novo e apagar a escala antiga da raiz.
    est._migrarPlantao = ehFormatoAntigo;
  }

  if (bruto.membros) {
    const lista = Array.isArray(bruto.membros)
      ? bruto.membros
      : Object.values(bruto.membros);
    const limpos = lista
      .filter((m) => m && typeof m === "object")
      .map((m, i) => ({
        id: String(m.id || "m" + (i + 1)),
        nome: String(m.nome || "Membro " + (i + 1)),
        status: STATUS.includes(m.status) ? m.status : "verde",
        nota: String(m.nota || ""),
        foto: String(m.foto || ""),
      }));
    if (limpos.length) est.membros = limpos;
  }

  return est;
}

let estado = estadoPadrao();

// ---------------------------------------------------------------------------
// Camada de sincronização: Firebase, com queda para localStorage
// ---------------------------------------------------------------------------
const sync = {
  modo: "local",   // "firebase" | "local"
  _db: null,
  _ref: null,
  _fb: null,
};

function configValida() {
  return Boolean(FIREBASE_CONFIG.databaseURL && FIREBASE_CONFIG.apiKey);
}

function marcarConexao(texto, classe) {
  const el = $("statusConexao");
  el.textContent = texto;
  el.className = "selo" + (classe ? " " + classe : "");
}

async function iniciarSync(aoMudar) {
  if (configValida()) {
    try {
      const [{ initializeApp }, dbMod] = await Promise.all([
        import("https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js"),
        import("https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js"),
      ]);

      const app = initializeApp(FIREBASE_CONFIG);
      const db = dbMod.getDatabase(app);
      sync.modo = "firebase";
      sync._fb = dbMod;
      sync._db = db;
      sync._ref = dbMod.ref(db, "andon");

      // Semeia o nó na primeira execução, sem apagar o que já existe.
      const inicial = await dbMod.get(sync._ref);
      if (!inicial.exists()) {
        await dbMod.set(sync._ref, { ...estadoPadrao(), atualizadoEm: Date.now() });
      }

      dbMod.onValue(sync._ref, (snap) => aoMudar(normalizar(snap.val())));

      dbMod.onValue(dbMod.ref(db, ".info/connected"), (snap) => {
        if (snap.val()) marcarConexao("sincronizado", "ok");
        else marcarConexao("reconectando…", "aviso");
      });
      return;
    } catch (err) {
      console.error("Firebase indisponível, usando modo local:", err);
    }
  }

  // ---- modo local ----
  sync.modo = "local";
  marcarConexao("modo local — sem sincronização", "aviso");
  try {
    const salvo = localStorage.getItem(CHAVE_LOCAL);
    aoMudar(normalizar(salvo ? JSON.parse(salvo) : null));
  } catch {
    aoMudar(estadoPadrao());
  }
  // Outra aba no mesmo navegador ainda se mantém em dia.
  window.addEventListener("storage", (e) => {
    if (e.key !== CHAVE_LOCAL || !e.newValue) return;
    try { aoMudar(normalizar(JSON.parse(e.newValue))); } catch {}
  });
}

// Grava uma subárvore (ex.: "reuniao", "membros") sem tocar nas demais.
async function gravar(caminho, valor) {
  const alvo = caminho.split("/").reduce((o, k) => (o ? o[k] : undefined), estado);
  const mesclado = (valor && typeof valor === "object" && !Array.isArray(valor) && alvo)
    ? { ...alvo, ...valor }
    : valor;

  if (sync.modo === "firebase") {
    const { ref, set, update } = sync._fb;
    await set(ref(sync._db, "andon/" + caminho), mesclado);
    await update(sync._ref, { atualizadoEm: Date.now() });
  } else {
    const partes = caminho.split("/");
    let no = estado;
    for (let i = 0; i < partes.length - 1; i++) no = no[partes[i]];
    no[partes[partes.length - 1]] = mesclado;
    estado.atualizadoEm = Date.now();
    localStorage.setItem(CHAVE_LOCAL, JSON.stringify(estado));
    aplicarEstado(estado);
  }
}

// ---------------------------------------------------------------------------
// Utilidades de horário
// ---------------------------------------------------------------------------
const paraMinutos = (hhmm) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

function slotAtualIndice(agora = new Date()) {
  const dia = agora.getDay();
  if (dia === 0 || dia === 6) return -1;            // sem plantão no fim de semana
  const min = agora.getHours() * 60 + agora.getMinutes();
  return SLOTS_PLANTAO.findIndex(([i, f]) => min >= paraMinutos(i) && min < paraMinutos(f));
}

function proximoSlotIndice(agora = new Date()) {
  const dia = agora.getDay();
  if (dia === 0 || dia === 6) return -1;
  const min = agora.getHours() * 60 + agora.getMinutes();
  return SLOTS_PLANTAO.findIndex(([i]) => paraMinutos(i) > min);
}

// ---------------------------------------------------------------------------
// Render
// ---------------------------------------------------------------------------
let plantaoMigrado = false;

function aplicarEstado(novo) {
  const precisaMigrar = novo._migrarPlantao;
  delete novo._migrarPlantao;
  estado = novo;

  // Escala no formato antigo (única, sem dias): regrava já convertida, uma vez
  // só, para que o banco não fique preso ao formato anterior.
  if (precisaMigrar && !plantaoMigrado) {
    plantaoMigrado = true;
    gravar("plantao", estado.plantao);
  }

  renderReuniao();
  renderPlantao();
  renderAjuda();
  renderEventos();
  renderLetreiro();
  renderStatusEdicao();
  if (modalAberto()) renderFormularios();
}

// A reunião aparece ativa se o switch manual estiver ligado OU se um período
// agendado estiver em curso agora — calculado localmente em cada tela, sem
// precisar que ninguém grave nada no banco na hora exata em que o período abre.
function reuniaoEstaAtiva(agora = new Date()) {
  const r = estado.reuniao;
  if (r.ativa) return true;

  const ag = r.agendamento;
  if (!ag || !ag.ativo || !ag.inicio || !ag.fim) return false;

  const min = agora.getHours() * 60 + agora.getMinutes();
  const ini = paraMinutos(ag.inicio);
  const fim = paraMinutos(ag.fim);
  // período pode virar a meia-noite (ex.: 23:00–01:00)
  return ini <= fim ? (min >= ini && min < fim) : (min >= ini || min < fim);
}

function renderReuniao() {
  const ativa = reuniaoEstaAtiva();
  $("placaReuniao").classList.toggle("ativa", ativa);
  $("placaReuniaoTexto").textContent = ativa
    ? "ESTÁ HAVENDO REUNIÃO NA SEDE"
    : "NÃO ESTÁ HAVENDO REUNIÃO";
}

function renderPlantao() {
  const agora = new Date();
  const iAtual = slotAtualIndice(agora);
  const iProx = proximoSlotIndice(agora);
  const min = agora.getHours() * 60 + agora.getMinutes();

  // O painel mostra sempre a escala do dia corrente.
  const escalaHoje = estado.plantao[diaDeHoje(agora).chave] || {};
  const nomeDe = (i) => (i >= 0 ? (escalaHoje[SLOTS_PLANTAO[i][0]] || "").trim() : "");

  if (iAtual >= 0) {
    const nome = nomeDe(iAtual);
    $("plantaoAgoraNome").textContent = nome || "sem responsável";
    $("plantaoAgoraNome").style.opacity = nome ? "1" : ".5";
    $("plantaoAgoraFaixa").textContent = SLOTS_PLANTAO[iAtual].join(" – ");
  } else {
    const fds = agora.getDay() === 0 || agora.getDay() === 6;
    $("plantaoAgoraNome").textContent = fds ? "fim de semana" : "fora do horário";
    $("plantaoAgoraNome").style.opacity = ".5";
    $("plantaoAgoraFaixa").textContent = "";
  }

  if (iProx >= 0) {
    const nome = nomeDe(iProx);
    $("plantaoProximoNome").textContent = nome || "sem responsável";
    $("plantaoProximoFaixa").textContent = SLOTS_PLANTAO[iProx].join(" – ");
  } else {
    $("plantaoProximoNome").textContent = "—";
    $("plantaoProximoFaixa").textContent = "";
  }

  $("plantaoGrade").innerHTML = SLOTS_PLANTAO.map(([inicio, fim], i) => {
    const nome = (escalaHoje[inicio] || "").trim();
    const classes = [];
    if (i === iAtual) classes.push("atual");
    else if (paraMinutos(fim) <= min && iAtual !== -1) classes.push("passado");
    return `<li class="${classes.join(" ")}">
      <span class="hora">${inicio}–${fim}</span>
      <span class="nome ${nome ? "" : "vazio"}">${escapar(nome) || "livre"}</span>
    </li>`;
  }).join("");
}

// Iniciais como fallback quando o membro ainda não tem foto.
function iniciaisDe(nome) {
  const partes = String(nome).trim().split(/\s+/).filter(Boolean);
  if (!partes.length) return "?";
  const primeira = partes[0][0] || "";
  const ultima = partes.length > 1 ? partes[partes.length - 1][0] : "";
  return (primeira + ultima).toUpperCase();
}

function cartaoMembro(m) {
  const foto = m.foto
    ? `<img class="m-foto" src="${escapar(m.foto)}" alt="">`
    : `<div class="m-foto iniciais">${escapar(iniciaisDe(m.nome))}</div>`;
  return `
    <div class="membro st-${m.status}">
      ${foto}
      <div class="m-nome">${escapar(m.nome)}</div>
      ${m.nota ? `<div class="m-nota">${escapar(m.nota)}</div>` : ""}
    </div>`;
}

function renderAjuda() {
  const grade = $("ajudaGrade");

  // A seção mostra quem precisa de ajuda: vermelhos e amarelos sempre; os azuis
  // (disponíveis para ajudar) entram como apoio, e só até o espaço permitir.
  const porStatus = (s) => estado.membros.filter((m) => m.status === s);
  const alerta = [...porStatus("vermelho"), ...porStatus("amarelo")];
  const azuis = porStatus("azul");

  if (!alerta.length && !azuis.length) {
    grade.innerHTML = `<p class="ajuda-tudo-bem">Ninguém precisando de ajuda agora
      <span>a cadeia de ajuda está tranquila</span></p>`;
    return;
  }

  grade.innerHTML =
    alerta.map(cartaoMembro).join("") +
    (azuis.length
      ? `<div class="ajuda-apoio">Disponíveis para ajudar</div>` + azuis.map(cartaoMembro).join("")
      : "");

  ajustarApoio(grade);

  // As fotos entram como data URL e só alteram a altura medida depois que o
  // navegador as decodifica. Um segundo encaixe no frame seguinte corrige o
  // caso em que a primeira medição aconteceu cedo demais.
  const fotos = [...grade.querySelectorAll("img.m-foto")];
  if (fotos.length) {
    Promise.all(fotos.map((img) => (img.decode ? img.decode().catch(() => {}) : Promise.resolve())))
      .then(() => requestAnimationFrame(() => {
        // Refaz o encaixe sobre a marcação atual; se azuis foram descartados
        // por uma medição precoce, o render completo os traz de volta.
        if (grade.querySelectorAll(".membro.st-azul").length < azuis.length) renderAjuda();
        else ajustarApoio(grade);
      }));
  }
}

// Encaixa a grade na altura disponível. Encolher um pouco os cartões é melhor
// que descartar gente, então essa é a primeira tentativa; os azuis (apoio,
// dispensável) só saem quando o encolhimento já não resolve, e o corte final
// garante que ninguém apareça pela metade.
function ajustarApoio(grade) {
  const cabe = () => grade.scrollHeight <= grade.clientHeight + 1;
  const base = grade.clientHeight;

  const escalar = (f) => grade.style.setProperty("--h", base * f + "px");
  escalar(1);
  if (cabe()) return;

  // 1) encolhe até 70% do tamanho natural, mantendo todo mundo visível
  for (const f of [0.92, 0.84, 0.77, 0.7]) {
    escalar(f);
    if (cabe()) return;
  }

  // 2) ainda não coube: devolve o tamanho cheio e descarta os azuis do fim
  escalar(1);
  const apoio = grade.querySelector(".ajuda-apoio");
  if (apoio) {
    let ultimo = grade.lastElementChild;
    while (ultimo && ultimo !== apoio && !cabe()) {
      ultimo.remove();
      ultimo = grade.lastElementChild;
    }
    if (grade.lastElementChild === apoio) apoio.remove();
    if (cabe()) return;
  }

  // 3) só vermelhos e amarelos restaram e ainda não cabem: encolhe sem limite
  for (let i = 0, f = 1; i < 12 && !cabe(); i++) {
    f *= 0.88;
    escalar(f);
  }
}

const FONTES = {
  sans: '"Segoe UI", system-ui, sans-serif',
  serif: 'Georgia, "Times New Roman", serif',
  mono: '"Consolas", "Courier New", monospace',
  display: '"Impact", "Haettenschweiler", sans-serif',
};

function renderEventos() {
  for (const dia of ["terca", "quinta"]) {
    const ev = estado.eventos[dia];
    const alvo = $("evento" + (dia === "terca" ? "Terca" : "Quinta"));
    const url = (ev.imagem || "").trim();

    if (url) {
      alvo.innerHTML = `<img src="${escapar(url)}" alt="">`;
      alvo.classList.remove("vazio");
    } else if ((ev.texto || "").trim()) {
      alvo.textContent = ev.texto;
      alvo.classList.remove("vazio");
    } else {
      alvo.textContent = "sem evento definido";
      alvo.classList.add("vazio");
    }

    alvo.style.color = url ? "" : (ev.cor || "#123a5c");
    alvo.style.fontFamily = FONTES[ev.fonte] || FONTES.sans;
    // tamanho 100 = referência; escala com a altura da tela para ler de longe
    alvo.style.fontSize = url ? "" : `clamp(14px, ${(Number(ev.tamanho) || 100) * 0.042}vh, 90px)`;
    alvo.classList.toggle("piscando", Boolean(ev.piscar) && !alvo.classList.contains("vazio"));

    confete(dia, Boolean(ev.confete) && !alvo.classList.contains("vazio"));
  }
}

function renderLetreiro() {
  const { texto, modo, exibidoEm } = estado.letreiro;
  const limpo = (texto || "").trim();

  const rodape = $("letreiroRodape");
  const mostraRodape = limpo && modo === "rodape";
  rodape.hidden = !mostraRodape;
  if (mostraRodape) {
    const el = $("letreiroRodapeTexto");
    if (el.textContent !== limpo) el.textContent = limpo;
  }

  if (limpo && modo === "fullscreen") mostrarLetreiroCheio(limpo, exibidoEm);
}

// A exibição em tela cheia acontece uma única vez, sincronizada entre as telas
// pelo carimbo `exibidoEm` — quem já mostrou aquele carimbo não repete.
let ultimoCheioVisto = 0;
let timerCheio = null;
function mostrarLetreiroCheio(texto, carimbo) {
  if (!carimbo || carimbo === ultimoCheioVisto) return;
  ultimoCheioVisto = carimbo;

  // Ignora exibições antigas (ex.: tela aberta depois do anúncio).
  if (Date.now() - carimbo > 60000) return;

  $("letreiroCheioTexto").textContent = texto;
  $("letreiroCheio").hidden = false;
  clearTimeout(timerCheio);
  timerCheio = setTimeout(() => {
    $("letreiroCheio").hidden = true;
    // Só quem disparou devolve o modo ao normal, evitando escrita em duplicata.
    if (disparouCheio) {
      disparouCheio = false;
      gravar("letreiro", { modo: "rodape" });
    }
  }, 5000);
}
let disparouCheio = false;

function renderStatusEdicao() {
  const el = $("statusEdicao");
  if (!estado.atualizadoEm) { el.hidden = true; return; }
  el.hidden = false;
  const d = new Date(estado.atualizadoEm);
  el.textContent = "última edição: " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function escapar(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
  ));
}

// ---------------------------------------------------------------------------
// Imagens enviadas pelo usuário
// ---------------------------------------------------------------------------
// As imagens são guardadas no próprio banco como data URL, então precisam ser
// reduzidas antes: fotos viram um quadrado de 400x400 (recorte central) e as
// imagens de evento apenas cabem dentro de um limite, preservando a proporção.
const FOTO_PX = 400;
const EVENTO_PX = 1000;
const LIMITE_BYTES = 700 * 1024;

function lerArquivoComoImagem(arquivo) {
  return new Promise((resolve, reject) => {
    if (!arquivo.type.startsWith("image/")) {
      reject(new Error("O arquivo escolhido não é uma imagem."));
      return;
    }
    const url = URL.createObjectURL(arquivo);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Não foi possível abrir a imagem.")); };
    img.src = url;
  });
}

async function processarFoto(arquivo) {
  const img = await lerArquivoComoImagem(arquivo);
  const lado = Math.min(img.naturalWidth, img.naturalHeight);   // recorte central
  const sx = (img.naturalWidth - lado) / 2;
  const sy = (img.naturalHeight - lado) / 2;

  const c = document.createElement("canvas");
  c.width = c.height = FOTO_PX;
  const ctx = c.getContext("2d");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, sx, sy, lado, lado, 0, 0, FOTO_PX, FOTO_PX);
  return comprimir(c);
}

async function processarImagemEvento(arquivo) {
  const img = await lerArquivoComoImagem(arquivo);
  const escala = Math.min(1, EVENTO_PX / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * escala));
  const h = Math.max(1, Math.round(img.naturalHeight * escala));

  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const ctx = c.getContext("2d");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, w, h);
  // PNG preserva transparência (logos); vale a pena se não ficar pesado demais.
  const png = c.toDataURL("image/png");
  if (png.length * 0.75 <= LIMITE_BYTES) return png;
  return comprimir(c);
}

// Baixa a qualidade do JPEG até o data URL caber no limite.
function comprimir(canvas) {
  for (const q of [0.85, 0.75, 0.65, 0.55, 0.45]) {
    const url = canvas.toDataURL("image/jpeg", q);
    if (url.length * 0.75 <= LIMITE_BYTES) return url;
  }
  return canvas.toDataURL("image/jpeg", 0.4);
}

// Abre o seletor de arquivos do sistema e devolve o arquivo escolhido.
function escolherArquivo(accept = "image/*") {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept;
    input.style.display = "none";
    document.body.appendChild(input);
    const terminar = (arq) => { input.remove(); resolve(arq || null); };
    input.addEventListener("change", () => terminar(input.files && input.files[0]), { once: true });
    input.addEventListener("cancel", () => terminar(null), { once: true });
    input.click();
  });
}

// ---------------------------------------------------------------------------
// Confete (canvas leve, sem biblioteca)
// ---------------------------------------------------------------------------
const confetes = {};
function confete(dia, ligar) {
  const canvas = $("confete" + (dia === "terca" ? "Terca" : "Quinta"));
  const atual = confetes[dia];

  if (!ligar) {
    if (atual) { cancelAnimationFrame(atual.raf); canvas.classList.remove("ativo"); delete confetes[dia]; }
    return;
  }
  if (atual) return;

  canvas.classList.add("ativo");
  const ctx = canvas.getContext("2d");
  const cores = ["#2e8bc0", "#123a5c", "#6fd3a0", "#e8a317", "#ffffff"];
  let pecas = [];

  const semear = () => {
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;
    pecas = Array.from({ length: 34 }, () => novaPeca(canvas, cores, true));
  };

  const estado_ = { raf: 0, semear };
  confetes[dia] = estado_;
  semear();

  const passo = () => {
    if (canvas.width !== canvas.clientWidth || canvas.height !== canvas.clientHeight) semear();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const p of pecas) {
      p.y += p.vy; p.x += p.vx; p.rot += p.vr;
      if (p.y > canvas.height + 12) Object.assign(p, novaPeca(canvas, cores, false));
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.cor;
      ctx.globalAlpha = 0.85;
      ctx.fillRect(-p.t / 2, -p.t / 2, p.t, p.t * 0.55);
      ctx.restore();
    }
    estado_.raf = requestAnimationFrame(passo);
  };
  estado_.raf = requestAnimationFrame(passo);
}

function novaPeca(canvas, cores, espalhar) {
  return {
    x: Math.random() * canvas.width,
    y: espalhar ? Math.random() * canvas.height : -12,
    vx: (Math.random() - 0.5) * 0.6,
    vy: 0.5 + Math.random() * 1.2,
    rot: Math.random() * Math.PI,
    vr: (Math.random() - 0.5) * 0.09,
    t: 5 + Math.random() * 7,
    cor: cores[(Math.random() * cores.length) | 0],
  };
}

// ---------------------------------------------------------------------------
// Relógio, data e temperatura
// ---------------------------------------------------------------------------
function tiquetaque() {
  const agora = new Date();
  $("relogio").textContent = agora.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  $("data").textContent = agora.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" });
  renderPlantao();
  renderReuniao();   // reflete o agendamento de reunião assim que o período abre/fecha

  // Recarrega de madrugada: a tela fica ligada por semanas.
  if (agora.getHours() === HORA_RELOAD_DIARIO && agora.getMinutes() === 0 && agora.getSeconds() < 2) {
    location.reload();
  }
}

async function buscarTemperatura() {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${LOCAL.latitude}`
    + `&longitude=${LOCAL.longitude}&current=temperature_2m&timezone=auto`;
  try {
    const r = await fetch(url);
    if (!r.ok) throw new Error("HTTP " + r.status);
    const dados = await r.json();
    const t = Math.round(dados.current.temperature_2m);
    $("temperatura").textContent = `${t}°C`;
    localStorage.setItem("andon-temp", JSON.stringify({ t, em: Date.now() }));
  } catch (err) {
    console.warn("Temperatura indisponível:", err);
    // Mantém o último valor conhecido em vez de deixar o campo vazio.
    try {
      const cache = JSON.parse(localStorage.getItem("andon-temp") || "null");
      if (cache && Date.now() - cache.em < 6 * 3600e3) $("temperatura").textContent = `${cache.t}°C`;
      else $("temperatura").textContent = "—";
    } catch { $("temperatura").textContent = "—"; }
  }
}

// ---------------------------------------------------------------------------
// Microfone
// ---------------------------------------------------------------------------
const mic = {
  ativo: false,
  nivel: 0,        // média móvel do RMS, 0..1
  _ctx: null,
  _analisador: null,
  _buffer: null,
  _stream: null,
};

let acimaDesde = 0, abaixoDesde = 0, alertaLigado = false;

async function ligarMicrofone() {
  if (mic.ativo) return true;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    });
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const fonte = ctx.createMediaStreamSource(stream);
    const analisador = ctx.createAnalyser();
    analisador.fftSize = 1024;
    fonte.connect(analisador);

    Object.assign(mic, {
      ativo: true, _ctx: ctx, _analisador: analisador,
      _buffer: new Float32Array(analisador.fftSize), _stream: stream,
    });

    $("statusMic").textContent = "microfone ativo";
    $("statusMic").className = "selo ok";
    $("btnLigarMic").textContent = "Microfone ligado ✓";
    $("btnLigarMic").disabled = true;
    $("btnCalibNormal").disabled = false;
    $("btnCalibAlto").disabled = false;

    medir();
    return true;
  } catch (err) {
    console.warn("Microfone negado:", err);
    $("statusMic").textContent = "microfone bloqueado";
    $("statusMic").className = "selo erro";
    return false;
  }
}

function medir() {
  if (!mic.ativo) return;
  mic._analisador.getFloatTimeDomainData(mic._buffer);

  let soma = 0;
  for (let i = 0; i < mic._buffer.length; i++) soma += mic._buffer[i] ** 2;
  const rms = Math.sqrt(soma / mic._buffer.length);

  // Média móvel: sobe rápido, desce devagar — uma porta batendo não dispara,
  // mas conversa alta sustentada sim.
  mic.nivel = rms > mic.nivel ? mic.nivel * 0.7 + rms * 0.3 : mic.nivel * 0.94 + rms * 0.06;

  avaliarAlerta();
  if (modalAberto()) atualizarMedidor();
  requestAnimationFrame(medir);
}

function avaliarAlerta() {
  const limiar = Number(estado.volume.limiar) || 0.12;
  const agora = performance.now();

  if (mic.nivel >= limiar) {
    abaixoDesde = 0;
    if (!acimaDesde) acimaDesde = agora;
    if (!alertaLigado && agora - acimaDesde > 2000) {   // 2s acima para ligar
      alertaLigado = true;
      $("alertaVolume").hidden = false;
    }
  } else {
    acimaDesde = 0;
    if (!abaixoDesde) abaixoDesde = agora;
    if (alertaLigado && agora - abaixoDesde > 3000) {   // 3s abaixo para desligar
      alertaLigado = false;
      $("alertaVolume").hidden = true;
    }
  }
}

function atualizarMedidor() {
  const limiar = Number(estado.volume.limiar) || 0.12;
  const escala = (v) => Math.min(100, (v / 0.6) * 100);
  $("medidorNivel").style.width = escala(mic.nivel) + "%";
  $("medidorLimiar").style.left = escala(limiar) + "%";
  $("medidorValor").textContent = mic.nivel.toFixed(3);
  $("medidorLimiarValor").textContent = limiar.toFixed(3);
}

// Mede o pico sustentado durante alguns segundos (usado na calibração).
function amostrar(segundos, aoTerminar) {
  const amostras = [];
  const fim = performance.now() + segundos * 1000;
  const passo = () => {
    amostras.push(mic.nivel);
    if (performance.now() < fim) requestAnimationFrame(passo);
    else {
      amostras.sort((a, b) => a - b);
      // percentil 80: ignora silêncios pontuais sem se prender a um pico isolado
      aoTerminar(amostras[Math.floor(amostras.length * 0.8)] || 0);
    }
  };
  passo();
}

let calibNormal = null, calibAlto = null;

// ---------------------------------------------------------------------------
// Modo de edição
// ---------------------------------------------------------------------------
const modalAberto = () => !$("modal").hidden;
let membrosDestravados = false;
// Ligada enquanto os campos de horário da reunião estão sendo editados, para
// que a re-renderização não apague o que ainda não foi gravado.
let editandoHorarioAgenda = false;
// Dia da semana aberto na aba de escala; o modal sempre abre no dia de hoje.
let diaEscalaAberto = diaDeHoje().chave;

function abrirModal() {
  $("modal").hidden = false;
  document.body.classList.add("editando");
  diaEscalaAberto = diaDeHoje().chave;   // abre sempre no dia de hoje
  renderFormularios();
}

function fecharModal() {
  $("modal").hidden = true;
  document.body.classList.remove("editando");
  membrosDestravados = false;
  editandoHorarioAgenda = false;
  $("edMembros").hidden = true;
  $("membrosDestravado").hidden = true;
}

// Um temporizador por slot: digitar em dois campos seguidos não pode fazer o
// segundo cancelar a gravação pendente do primeiro.
const temporizadoresSlot = new Map();
function agendarGravacaoSlot(dia, slot, valor) {
  const chave = dia + "/" + slot;
  clearTimeout(temporizadoresSlot.get(chave));
  temporizadoresSlot.set(chave, setTimeout(() => {
    temporizadoresSlot.delete(chave);
    gravar("plantao/" + chave, valor);
  }, 450));
}

// Monta o seletor de dias e a escala do dia aberto. O slot atual só ganha
// destaque quando o dia mostrado é realmente o de hoje.
function renderEditorPlantao() {
  const hoje = diaDeHoje().chave;
  const escala = estado.plantao[diaEscalaAberto] || {};

  $("edPlantaoDias").innerHTML = DIAS.map(({ chave, curto }) => {
    const doDia = estado.plantao[chave] || {};
    const preenchidos = SLOTS_PLANTAO.filter(([i]) => (doDia[i] || "").trim()).length;
    return `<button data-dia="${chave}" class="${chave === diaEscalaAberto ? "sel" : ""}">
      <span>${curto}</span>
      ${chave === hoje ? '<span class="marca-hoje">hoje</span>'
        : `<span class="preenchidos">${preenchidos}/${SLOTS_PLANTAO.length}</span>`}
    </button>`;
  }).join("");

  const iAtual = diaEscalaAberto === hoje ? slotAtualIndice() : -1;

  // Preserva o campo em digitação: sem isso, a gravação de um slot redesenharia
  // a lista e tiraria o cursor de onde o usuário está escrevendo.
  const focado = document.activeElement;
  const slotFocado = focado && focado.dataset && focado.dataset.slot ? focado.dataset.slot : null;
  const posCursor = slotFocado ? focado.selectionStart : 0;

  $("edPlantao").innerHTML = SLOTS_PLANTAO.map(([inicio, fim], i) => `
    <div class="linha ${i === iAtual ? "atual" : ""}">
      <span class="hora">${inicio}–${fim}</span>
      <input type="text" data-slot="${inicio}" placeholder="livre"
             value="${escapar(escala[inicio] || "")}">
    </div>`).join("");

  if (slotFocado) {
    const campo = $("edPlantao").querySelector(`input[data-slot="${slotFocado}"]`);
    if (campo) {
      campo.focus();
      campo.setSelectionRange(posCursor, posCursor);
    }
  }
}

function renderFormularios() {
  // --- geral ---
  $("edReuniao").checked = Boolean(estado.reuniao.ativa);

  const ag = estado.reuniao.agendamento || {};
  $("edReuniaoAgendaAtiva").checked = Boolean(ag.ativo);
  $("edReuniaoAgendaCampos").hidden = !ag.ativo;
  if (!editandoHorarioAgenda) {
    $("edReuniaoInicio").value = ag.inicio || "";
    $("edReuniaoFim").value = ag.fim || "";
  }
  if (document.activeElement !== $("edLetreiroTexto")) {
    $("edLetreiroTexto").value = estado.letreiro.texto || "";
  }
  document.querySelectorAll('input[name=letreiroModo]').forEach((r) => {
    r.checked = r.value === (estado.letreiro.modo || "off");
  });

  // --- plantão ---
  renderEditorPlantao();

  // --- cadeia de ajuda ---
  $("edAjuda").innerHTML = estado.membros.map((m, i) => `
    <div class="item" data-i="${i}">
      <div class="nome">${escapar(m.nome)}</div>
      <div class="cores">
        ${STATUS.map((s) => `<button data-st="${s}" class="${m.status === s ? "sel" : ""}"
            title="${rotuloStatus(s)}"></button>`).join("")}
      </div>
      <input type="text" class="nota" placeholder="nota (opcional)" value="${escapar(m.nota || "")}">
    </div>`).join("");

  if (membrosDestravados) renderListaMembros();

  // --- eventos ---
  $("edEventos").innerHTML = ["terca", "quinta"].map((dia) => {
    const ev = estado.eventos[dia];
    return `
    <fieldset data-dia="${dia}">
      <legend>${dia === "terca" ? "Terça" : "Quinta"}</legend>
      <label class="campo">
        <span>Texto</span>
        <textarea rows="2" data-c="texto">${escapar(ev.texto || "")}</textarea>
      </label>
      <div class="grupo-controles">
        <label class="campo" style="flex:none">
          <span>Cor</span>
          <input type="color" data-c="cor" value="${escapar(ev.cor || "#123a5c")}">
        </label>
        <label class="campo">
          <span>Fonte</span>
          <select data-c="fonte">
            ${Object.keys(FONTES).map((f) =>
              `<option value="${f}" ${ev.fonte === f ? "selected" : ""}>${nomeFonte(f)}</option>`).join("")}
          </select>
        </label>
        <label class="campo">
          <span>Tamanho (${ev.tamanho || 100}%)</span>
          <input type="range" data-c="tamanho" min="50" max="220" step="5" value="${ev.tamanho || 100}">
        </label>
      </div>
      <div class="checks">
        <label><input type="checkbox" data-c="piscar" ${ev.piscar ? "checked" : ""}> Piscar</label>
        <label><input type="checkbox" data-c="confete" ${ev.confete ? "checked" : ""}> Confete</label>
      </div>
      <div class="ed-imagem">
        ${ev.imagem ? `<img src="${escapar(ev.imagem)}" alt="">` : ""}
        <div class="ed-imagem-info">
          ${ev.imagem
            ? `Imagem ativa${ev.imagemNome ? ": " + escapar(ev.imagemNome) : ""} — substitui o texto.`
            : "Nenhuma imagem. O texto acima é exibido."}
        </div>
        <button class="btn" data-img="enviar" data-dia="${dia}">${ev.imagem ? "Trocar…" : "Enviar imagem…"}</button>
        ${ev.imagem ? `<button class="btn" data-img="remover" data-dia="${dia}">Remover</button>` : ""}
      </div>
    </fieldset>`;
  }).join("");

  // --- volume ---
  $("edLimiar").value = Number(estado.volume.limiar) || 0.12;
  atualizarMedidor();
}

const rotuloStatus = (s) => ({
  azul: "Disponível para ajudar",
  verde: "Tranquilo, mas sem tanta disponibilidade",
  amarelo: "Ocupado, mas não delegável",
  vermelho: "Ocupado e preciso de ajuda",
}[s]);

const nomeFonte = (f) => ({ sans: "Padrão", serif: "Serifada", mono: "Monoespaçada", display: "Display" }[f]);

function renderListaMembros() {
  // Uma atualização vinda de outra tela não pode roubar o campo em digitação.
  const focado = document.activeElement;
  const emEdicao = focado && focado.classList.contains("nome-membro")
    ? { i: Number(focado.closest(".linha").dataset.i), pos: focado.selectionStart }
    : null;

  $("edMembrosLista").innerHTML = estado.membros.map((m, i) => `
    <div class="linha" data-i="${i}">
      ${m.foto
        ? `<img class="ed-foto" src="${escapar(m.foto)}" alt="">`
        : `<div class="ed-foto-vazia">${escapar(iniciaisDe(m.nome))}</div>`}
      <input type="text" class="nome-membro" value="${escapar(m.nome)}">
      <div class="ed-foto-acoes">
        <button class="btn foto-enviar">${m.foto ? "Trocar foto" : "Enviar foto"}</button>
        ${m.foto ? `<button class="btn foto-remover">Remover foto</button>` : ""}
      </div>
      <button class="btn remover" title="Remover membro">✕</button>
    </div>`).join("");

  if (emEdicao) {
    const campo = $("edMembrosLista")
      .querySelector(`.linha[data-i="${emEdicao.i}"] .nome-membro`);
    if (campo) {
      campo.focus();
      campo.setSelectionRange(emEdicao.pos, emEdicao.pos);
    }
  }
}

// ---------------------------------------------------------------------------
// Eventos de interface
// ---------------------------------------------------------------------------
function ligarInterface() {
  $("btnEditar").addEventListener("click", () => (modalAberto() ? fecharModal() : abrirModal()));
  $("btnFechar").addEventListener("click", fecharModal);
  $("btnConcluir").addEventListener("click", fecharModal);
  $("modal").addEventListener("click", (e) => { if (e.target === $("modal")) fecharModal(); });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modalAberto()) fecharModal();
    if (e.key.toLowerCase() === "e" && !modalAberto() && !/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) {
      abrirModal();
    }
  });

  // abas
  document.querySelectorAll(".aba").forEach((aba) => {
    aba.addEventListener("click", () => {
      document.querySelectorAll(".aba").forEach((a) => a.classList.toggle("ativa", a === aba));
      document.querySelectorAll(".painel-aba").forEach((p) => {
        p.classList.toggle("ativa", p.dataset.aba === aba.dataset.aba);
      });
    });
  });

  // atalho: clicar na placa durante a edição alterna a reunião
  $("placaReuniao").addEventListener("click", () => {
    if (document.body.classList.contains("editando")) {
      gravar("reuniao", { ativa: !estado.reuniao.ativa, atualizadoEm: Date.now() });
    }
  });

  // --- geral ---
  $("edReuniao").addEventListener("change", (e) => {
    gravar("reuniao", { ativa: e.target.checked, atualizadoEm: Date.now() });
  });

  $("edReuniaoAgendaAtiva").addEventListener("change", (e) => {
    const ativo = e.target.checked;
    $("edReuniaoAgendaCampos").hidden = !ativo;
    gravar("reuniao", {
      agendamento: { ...estado.reuniao.agendamento, ativo },
    });
  });

  const gravarHorarioAgenda = debounce(() => {
    editandoHorarioAgenda = false;
    gravar("reuniao", {
      agendamento: {
        ...estado.reuniao.agendamento,
        inicio: $("edReuniaoInicio").value,
        fim: $("edReuniaoFim").value,
      },
    });
  }, 400);
  // Enquanto os horários estão sendo digitados, o render não pode devolver os
  // valores antigos por cima: o campo sem foco seria apagado no meio da edição.
  const marcarEdicaoHorario = () => { editandoHorarioAgenda = true; gravarHorarioAgenda(); };
  $("edReuniaoInicio").addEventListener("input", marcarEdicaoHorario);
  $("edReuniaoFim").addEventListener("input", marcarEdicaoHorario);

  $("edLetreiroTexto").addEventListener("input", debounce((e) => {
    gravar("letreiro", { texto: e.target.value });
  }, 450));

  document.querySelectorAll('input[name=letreiroModo]').forEach((r) => {
    r.addEventListener("change", () => {
      if (!r.checked) return;
      if (r.value === "fullscreen") {
        // carimbo novo => todas as telas exibem a mesma passagem, uma vez só
        disparouCheio = true;
        gravar("letreiro", { modo: "fullscreen", exibidoEm: Date.now() });
      } else {
        gravar("letreiro", { modo: r.value });
      }
    });
  });

  // --- plantão ---
  // O dia é lido no disparo (e não no debounce) para que trocar de aba logo
  // depois de digitar não grave o nome no dia errado.
  $("edPlantao").addEventListener("input", (e) => {
    const slot = e.target.dataset.slot;
    if (!slot) return;
    const dia = diaEscalaAberto;
    const valor = e.target.value;
    agendarGravacaoSlot(dia, slot, valor);
  });

  $("edPlantaoDias").addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-dia]");
    if (!btn) return;
    diaEscalaAberto = btn.dataset.dia;
    renderEditorPlantao();
  });

  $("btnCopiarDia").addEventListener("click", () => {
    const origem = DIAS.find((d) => d.chave === diaEscalaAberto);
    const outros = DIAS.filter((d) => d.chave !== diaEscalaAberto);
    if (!confirm(
      `Copiar a escala de ${origem.nome} para ${outros.map((d) => d.nome).join(", ")}?\n\n`
      + "O conteúdo atual desses dias será substituído."
    )) return;

    const plantao = { ...estado.plantao };
    for (const { chave } of outros) plantao[chave] = { ...estado.plantao[origem.chave] };
    gravar("plantao", plantao);
  });

  // --- cadeia de ajuda ---
  $("edAjuda").addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-st]");
    if (!btn) return;
    const i = Number(btn.closest(".item").dataset.i);
    const membros = estado.membros.map((m, j) => (j === i ? { ...m, status: btn.dataset.st } : m));
    gravar("membros", membros);
  });

  $("edAjuda").addEventListener("input", debounce((e) => {
    if (!e.target.classList.contains("nota")) return;
    const i = Number(e.target.closest(".item").dataset.i);
    const membros = estado.membros.map((m, j) => (j === i ? { ...m, nota: e.target.value } : m));
    gravar("membros", membros);
  }, 450));

  $("btnGerenciarMembros").addEventListener("click", () => {
    if (!membrosDestravados) {
      const senha = prompt("Senha para gerenciar membros:");
      if (senha === null) return;
      if (senha !== SENHA_MEMBROS) { alert("Senha incorreta."); return; }
      membrosDestravados = true;
      $("membrosDestravado").hidden = false;
      renderListaMembros();
    }
    $("edMembros").hidden = !$("edMembros").hidden;
  });

  $("edMembrosLista").addEventListener("input", debounce((e) => {
    if (!e.target.classList.contains("nome-membro")) return;
    const i = Number(e.target.closest(".linha").dataset.i);
    const membros = estado.membros.map((m, j) => (j === i ? { ...m, nome: e.target.value } : m));
    gravar("membros", membros);
  }, 450));

  $("edMembrosLista").addEventListener("click", async (e) => {
    const linha = e.target.closest(".linha");
    if (!linha) return;
    const i = Number(linha.dataset.i);

    if (e.target.classList.contains("remover")) {
      if (!confirm(`Remover "${estado.membros[i].nome}"?`)) return;
      gravar("membros", estado.membros.filter((_, j) => j !== i));
      return;
    }

    if (e.target.classList.contains("foto-remover")) {
      gravar("membros", estado.membros.map((m, j) => (j === i ? { ...m, foto: "" } : m)));
      return;
    }

    if (e.target.classList.contains("foto-enviar")) {
      const arquivo = await escolherArquivo();
      if (!arquivo) return;
      const btn = e.target;
      btn.disabled = true;
      btn.textContent = "Processando…";
      try {
        const foto = await processarFoto(arquivo);
        await gravar("membros", estado.membros.map((m, j) => (j === i ? { ...m, foto } : m)));
      } catch (err) {
        console.error(err);
        alert("Não foi possível usar essa imagem: " + err.message);
        btn.disabled = false;
        btn.textContent = "Enviar foto";
      }
    }
  });

  $("btnAddMembro").addEventListener("click", () => {
    const novo = {
      id: "m" + Date.now(),
      nome: "Membro " + (estado.membros.length + 1),
      status: "verde", nota: "", foto: "",
    };
    gravar("membros", [...estado.membros, novo]);
  });

  // --- eventos ---
  const alterarEvento = (e) => {
    const campo = e.target.dataset.c;
    if (!campo) return;
    const dia = e.target.closest("fieldset").dataset.dia;
    const valor = e.target.type === "checkbox" ? e.target.checked
      : e.target.type === "range" ? Number(e.target.value)
      : e.target.value;
    gravar("eventos/" + dia, { [campo]: valor });
  };
  $("edEventos").addEventListener("input", debounce(alterarEvento, 350));
  $("edEventos").addEventListener("change", alterarEvento);

  $("edEventos").addEventListener("click", async (e) => {
    const acao = e.target.dataset.img;
    if (!acao) return;
    const dia = e.target.dataset.dia;

    if (acao === "remover") {
      gravar("eventos/" + dia, { imagem: "", imagemNome: "" });
      return;
    }

    const arquivo = await escolherArquivo();
    if (!arquivo) return;
    e.target.disabled = true;
    e.target.textContent = "Processando…";
    try {
      const imagem = await processarImagemEvento(arquivo);
      await gravar("eventos/" + dia, { imagem, imagemNome: arquivo.name });
    } catch (err) {
      console.error(err);
      alert("Não foi possível usar essa imagem: " + err.message);
      e.target.disabled = false;
      e.target.textContent = "Enviar imagem…";
    }
  });

  // --- volume ---
  $("btnLigarMic").addEventListener("click", ligarMicrofone);

  $("edLimiar").addEventListener("input", debounce((e) => {
    gravar("volume", { limiar: Number(e.target.value) });
  }, 250));

  $("btnCalibNormal").addEventListener("click", (e) => {
    e.target.disabled = true;
    $("calibNormalValor").textContent = "medindo…";
    amostrar(5, (v) => {
      calibNormal = v;
      $("calibNormalValor").textContent = v.toFixed(3);
      e.target.disabled = false;
      avaliarCalibracao();
    });
  });

  $("btnCalibAlto").addEventListener("click", (e) => {
    e.target.disabled = true;
    $("calibAltoValor").textContent = "medindo…";
    amostrar(5, (v) => {
      calibAlto = v;
      $("calibAltoValor").textContent = v.toFixed(3);
      e.target.disabled = false;
      avaliarCalibracao();
    });
  });

  $("btnCalibAplicar").addEventListener("click", () => {
    const sugerido = limiarSugerido();
    gravar("volume", { limiar: sugerido, calibradoEm: Date.now() });
    $("edLimiar").value = sugerido;
    alert(`Limiar definido em ${sugerido.toFixed(3)}.`);
  });
}

function limiarSugerido() {
  // 60% do caminho entre o normal e o alto: mais perto do alto, para não
  // disparar com a conversa cotidiana da sede.
  return Math.max(0.02, calibNormal + (calibAlto - calibNormal) * 0.6);
}

function avaliarCalibracao() {
  const ok = calibNormal !== null && calibAlto !== null && calibAlto > calibNormal;
  $("btnCalibAplicar").disabled = !ok;
  $("btnCalibAplicar").textContent = ok
    ? `Aplicar limiar sugerido (${limiarSugerido().toFixed(3)})`
    : "Aplicar limiar sugerido";
}

function debounce(fn, ms) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

// ---------------------------------------------------------------------------
// Arranque
// ---------------------------------------------------------------------------
ligarInterface();
// O encaixe da cadeia de ajuda depende da altura medida, então refaz o cálculo
// quando a janela muda de tamanho.
window.addEventListener("resize", debounce(renderAjuda, 200));
tiquetaque();
setInterval(tiquetaque, 1000);
buscarTemperatura();
setInterval(buscarTemperatura, 15 * 60 * 1000);
iniciarSync(aplicarEstado);
