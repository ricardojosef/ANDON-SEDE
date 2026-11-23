// Chat do GIG: conversas diretas e grupos, com texto, figurinhas e anexos.
//
// Modelo (Firestore):
//   conversas/{id}                       tipo "direta" (id dm_<uidA>_<uidB>) ou "grupo";
//                                        membros, admins, nome/emoji/cor (grupo),
//                                        ultima (resumo da última mensagem), lidas.{uid}
//   conversas/{id}/mensagens/{mid}       autor, tipo (texto | figurinha | anexo), …
//   conversas/{id}/anexos/{aid}/partes/{n}  o arquivo em pedaços de ~600 KB (base64)
//   figurinhas/{id}                      figurinhas criadas pelos membros (imagem pequena)
//
// Os anexos ficam no próprio Firestore (sem Firebase Storage, que exige o
// plano pago): limite de 5 MB por arquivo; fotos grandes são comprimidas.
import { watch } from "vue";
import { store } from "./store.js";
import {
  db, doc, collection, getDoc, getDocs, setDoc, addDoc, updateDoc, serverTimestamp,
} from "./firebase.js";
import { figurinhaDoPacote } from "./figurinhas.js";

export const LIMITE_ANEXO = 5 * 1024 * 1024;
const PARTE = 600 * 1024;                 // bytes por pedaço (≈ 800 KB em base64, abaixo do 1 MB do documento)
const LADO_FOTO = 1920;                   // fotos maiores são reduzidas a este lado
const LADO_MINIATURA = 360;

export const EMOJIS_GRUPO = ["💬", "🚀", "📚", "🛠️", "🎯", "🤝", "🏭", "📊", "🎉", "☕", "🧠", "🔥"];
export const CORES_GRUPO = ["#2e8bc0", "#123a5c", "#2fa36b", "#e8a317", "#d93025", "#7b61ff", "#e8618c", "#14a3a3"];

const agoraISO = () => new Date().toISOString();
const eu = () => store.membro;

// ---------------------------------------------------------------------------
// conversas
// ---------------------------------------------------------------------------
export const idDireta = (a, b) => "dm_" + [a, b].sort().join("_");

export function outroMembro(c) { return c.tipo === "direta" ? (c.membros || []).find((u) => u !== eu().id) || eu().id : null; }
export function membroPorId(uid) { return store.membros.find((m) => m.id === uid) || { id: uid, nome: "Ex-membro" }; }

export function tituloDaConversa(c) {
  if (!c) return "";
  if (c.tipo === "grupo") return c.nome || "Grupo";
  const outro = outroMembro(c);
  return outro === eu().id ? `${eu().nome} (você)` : membroPorId(outro).nome;
}

export function naoLida(c, uid = eu() && eu().id) {
  if (!c || !c.ultima || !c.ultima.em || c.ultima.autor === uid) return false;
  return !(c.lidas && c.lidas[uid] && c.lidas[uid] >= c.ultima.em);
}
export const totalNaoLidas = () => store.conversas.filter((c) => naoLida(c)).length;

// Abre (criando se preciso) a conversa direta com alguém.
export async function abrirDireta(uid) {
  const id = idDireta(eu().id, uid);
  const ref = doc(db, "conversas", id);
  const s = await getDoc(ref);
  if (!s.exists()) {
    const membros = [...new Set([eu().id, uid])];
    await setDoc(ref, {
      tipo: "direta", membros, admins: [], criadoPor: eu().id, criadoEm: serverTimestamp(),
      atualizadoEm: agoraISO(), lidas: {}, ultima: null,
    });
  }
  return id;
}

export async function criarGrupo({ nome, descricao = "", emoji = "💬", cor = CORES_GRUPO[0], membros }) {
  const todos = [...new Set([eu().id, ...membros])];
  const ref = await addDoc(collection(db, "conversas"), {
    tipo: "grupo", nome: nome.trim(), descricao: descricao.trim(), emoji, cor,
    membros: todos, admins: [eu().id], criadoPor: eu().id, criadoEm: serverTimestamp(),
    atualizadoEm: agoraISO(), lidas: {}, ultima: null,
  });
  await mensagemDeSistema(ref.id, `${eu().nome} criou o grupo "${nome.trim()}"`);
  return ref.id;
}

export async function atualizarGrupo(cid, mudancas, aviso) {
  await updateDoc(doc(db, "conversas", cid), { ...mudancas, atualizadoEm: agoraISO() });
  if (aviso) await mensagemDeSistema(cid, aviso);
}

export async function sairDoGrupo(c) {
  const membros = c.membros.filter((u) => u !== eu().id);
  let admins = (c.admins || []).filter((u) => u !== eu().id);
  // o grupo nunca fica sem administrador
  if (!admins.length && membros.length) admins = [membros[0]];
  await mensagemDeSistema(c.id, `${eu().nome} saiu do grupo`);
  await updateDoc(doc(db, "conversas", c.id), { membros, admins, atualizadoEm: agoraISO() });
}

export async function marcarLida(c) {
  if (!naoLida(c)) return;
  await updateDoc(doc(db, "conversas", c.id), { [`lidas.${eu().id}`]: agoraISO() });
}

// ---------------------------------------------------------------------------
// mensagens
// ---------------------------------------------------------------------------
function resumo(m) {
  if (m.tipo === "figurinha") return "🖼️ Figurinha";
  if (m.tipo === "anexo") return (m.anexo.tipo || "").startsWith("image/") ? "📷 Foto" : `📎 ${m.anexo.nome}`;
  if (m.tipo === "sistema") return m.texto;
  return m.texto.length > 90 ? m.texto.slice(0, 90) + "…" : m.texto;
}

async function gravarMensagem(cid, dados) {
  const em = agoraISO();
  const m = { autor: eu().id, autorNome: eu().nome, em: serverTimestamp(), emISO: em, ...dados };
  const ref = await addDoc(collection(db, "conversas", cid, "mensagens"), m);
  await updateDoc(doc(db, "conversas", cid), {
    ultima: { texto: resumo(m), autor: eu().id, autorNome: eu().nome, em, tipo: m.tipo },
    atualizadoEm: em, [`lidas.${eu().id}`]: em,
  });
  return ref.id;
}

const mensagemDeSistema = (cid, texto) => gravarMensagem(cid, { tipo: "sistema", texto });

const citacao = (r) => (r ? { id: r.id, autorNome: r.autorNome, resumo: resumo(r) } : null);

export const enviarTexto = (cid, texto, respostaA) =>
  gravarMensagem(cid, { tipo: "texto", texto: texto.trim(), respostaA: citacao(respostaA) });

// figurinha: { pacote, chave } (do pacote do GLean) ou { id, dados } (criada por um membro)
export const enviarFigurinha = (cid, figurinha, respostaA) =>
  gravarMensagem(cid, { tipo: "figurinha", figurinha, respostaA: citacao(respostaA) });

export async function apagarMensagem(cid, m) {
  await updateDoc(doc(db, "conversas", cid, "mensagens", m.id), { apagada: true, texto: "", figurinha: null, anexo: m.anexo ? { ...m.anexo, miniatura: "" } : null });
}

// ---------------------------------------------------------------------------
// anexos: arquivo → (compressão) → pedaços base64 → mensagem
// ---------------------------------------------------------------------------
const lerImagem = (blob) => new Promise((ok, erro) => {
  const url = URL.createObjectURL(blob);
  const img = new Image();
  img.onload = () => { URL.revokeObjectURL(url); ok(img); };
  img.onerror = () => { URL.revokeObjectURL(url); erro(new Error("Imagem inválida")); };
  img.src = url;
});

function desenhar(img, lado) {
  const escala = Math.min(1, lado / Math.max(img.naturalWidth, img.naturalHeight));
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(img.naturalWidth * escala));
  c.height = Math.max(1, Math.round(img.naturalHeight * escala));
  c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
  return c;
}
const paraBlob = (canvas, tipo, q) => new Promise((ok) => canvas.toBlob(ok, tipo, q));

// Fotos: reduz para LADO_FOTO e recomprime quando ficam grandes; gera miniatura.
async function prepararImagem(arquivo) {
  if (!/^image\/(jpeg|png|webp|bmp)$/.test(arquivo.type)) {
    // GIF (animado) e SVG vão como estão; a miniatura é a própria imagem se for pequena
    return { blob: arquivo, miniatura: arquivo.size < 150 * 1024 ? await paraDataURL(arquivo) : "", largura: 0, altura: 0 };
  }
  const img = await lerImagem(arquivo);
  let blob = arquivo;
  if (arquivo.size > 1.2 * 1024 * 1024 || Math.max(img.naturalWidth, img.naturalHeight) > LADO_FOTO) {
    const c = desenhar(img, LADO_FOTO);
    blob = (await paraBlob(c, "image/webp", 0.82)) || (await paraBlob(c, "image/jpeg", 0.82));
  }
  const mini = desenhar(img, LADO_MINIATURA);
  return { blob, miniatura: mini.toDataURL("image/webp", 0.6), largura: img.naturalWidth, altura: img.naturalHeight };
}

const paraDataURL = (blob) => new Promise((ok) => { const r = new FileReader(); r.onload = () => ok(r.result); r.readAsDataURL(blob); });

function base64(bytes) {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

async function gravarPartes(cid, aid, bytes, aoProgresso) {
  const partes = Math.max(1, Math.ceil(bytes.length / PARTE));
  for (let n = 0; n < partes; n++) {
    await setDoc(doc(db, "conversas", cid, "anexos", aid, "partes", String(n)), {
      n, dados: base64(bytes.subarray(n * PARTE, (n + 1) * PARTE)), autor: eu().id,
    });
    if (aoProgresso) aoProgresso((n + 1) / partes);
  }
  return partes;
}

export async function enviarAnexo(cid, arquivo, { aoProgresso, respostaA } = {}) {
  let blob = arquivo, miniatura = "", largura = 0, altura = 0;
  const ehImagem = arquivo.type.startsWith("image/");
  if (ehImagem) ({ blob, miniatura, largura, altura } = await prepararImagem(arquivo));
  if (blob.size > LIMITE_ANEXO) throw new Error(`"${arquivo.name}" tem ${tamanhoLegivel(blob.size)}; o limite é ${tamanhoLegivel(LIMITE_ANEXO)}.`);
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const aid = doc(collection(db, "conversas", cid, "anexos")).id;
  const nome = ehImagem && blob !== arquivo ? arquivo.name.replace(/\.\w+$/, "") + (blob.type === "image/webp" ? ".webp" : ".jpg") : arquivo.name;
  const partes = await gravarPartes(cid, aid, bytes, aoProgresso);
  return gravarMensagem(cid, {
    tipo: "anexo", respostaA: citacao(respostaA),
    anexo: { id: aid, nome, tipo: blob.type || "application/octet-stream", tamanho: bytes.length, partes, miniatura, largura, altura },
  });
}

// Junta as partes num Blob (com cache, para não baixar duas vezes).
const cache = new Map();
export async function baixarAnexo(cid, anexo) {
  const chave = cid + "/" + anexo.id;
  if (cache.has(chave)) return cache.get(chave);
  const snaps = await getDocs(collection(db, "conversas", cid, "anexos", anexo.id, "partes"));
  const partes = snaps.docs.map((d) => d.data()).sort((a, b) => a.n - b.n);
  if (partes.length < (anexo.partes || 1)) throw new Error("O anexo ainda está sendo enviado ou foi perdido.");
  const pedacos = partes.map((p) => Uint8Array.from(atob(p.dados), (c) => c.charCodeAt(0)));
  const blob = new Blob(pedacos, { type: anexo.tipo });
  cache.set(chave, blob);
  return blob;
}

export async function salvarArquivo(cid, anexo) {
  const blob = await baixarAnexo(cid, anexo);
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = anexo.nome; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

export function tamanhoLegivel(b) {
  if (b < 1024) return b + " B";
  if (b < 1024 * 1024) return Math.round(b / 1024) + " KB";
  return (b / 1024 / 1024).toFixed(1).replace(".", ",") + " MB";
}

// ---------------------------------------------------------------------------
// encaminhar: copia a mensagem (e, se for anexo, os pedaços) para outras conversas
// ---------------------------------------------------------------------------
export async function encaminhar(cidOrigem, m, destinos) {
  for (const cid of destinos) {
    if (m.tipo === "texto") await gravarMensagem(cid, { tipo: "texto", texto: m.texto, encaminhada: true });
    else if (m.tipo === "figurinha") await gravarMensagem(cid, { tipo: "figurinha", figurinha: m.figurinha, encaminhada: true });
    else if (m.tipo === "anexo") {
      const blob = await baixarAnexo(cidOrigem, m.anexo);
      const aid = doc(collection(db, "conversas", cid, "anexos")).id;
      const partes = await gravarPartes(cid, aid, new Uint8Array(await blob.arrayBuffer()));
      await gravarMensagem(cid, { tipo: "anexo", anexo: { ...m.anexo, id: aid, partes }, encaminhada: true });
    }
  }
}

// ---------------------------------------------------------------------------
// figurinhas criadas pelos membros: imagem quadrada de 256 px em WebP
// ---------------------------------------------------------------------------
export async function criarFigurinha(arquivo, nome = "") {
  const img = await lerImagem(arquivo);
  const lado = 256;
  const c = document.createElement("canvas");
  c.width = c.height = lado;
  const ctx = c.getContext("2d");
  const escala = Math.min(lado / img.naturalWidth, lado / img.naturalHeight);
  const w = img.naturalWidth * escala, h = img.naturalHeight * escala;
  ctx.drawImage(img, (lado - w) / 2, (lado - h) / 2, w, h);   // mantém transparência (PNG)
  let dados = c.toDataURL("image/webp", 0.85);
  if (dados.length > 180000) dados = c.toDataURL("image/webp", 0.6);
  const ref = await addDoc(collection(db, "figurinhas"), {
    nome: nome.trim() || arquivo.name.replace(/\.\w+$/, ""), dados,
    criadoPor: eu().id, criadoPorNome: eu().nome, criadoEm: serverTimestamp(), criadoEmISO: agoraISO(),
  });
  return { id: ref.id, dados };
}

// salva na biblioteca do grupo uma figurinha recebida
export async function guardarFigurinha(f) {
  if (f.pacote || store.figurinhas.some((x) => x.dados === f.dados)) return false;
  await addDoc(collection(db, "figurinhas"), {
    nome: "Figurinha", dados: f.dados,
    criadoPor: eu().id, criadoPorNome: eu().nome, criadoEm: serverTimestamp(), criadoEmISO: agoraISO(),
  });
  return true;
}

// imagem (src) de uma figurinha de mensagem
export const srcFigurinha = (f) => (!f ? "" : f.pacote ? figurinhaDoPacote(f.chave) : f.dados || "");


// ---------------------------------------------------------------------------
// aviso de mensagem nova: notificação do navegador quando a aba está em
// segundo plano (usa a mesma permissão das DDLs, ligada na tela DDLs).
// ---------------------------------------------------------------------------
export function iniciarAvisosDoChat(router) {
  const vistas = new Map();
  let primeira = true;
  watch(() => store.conversas.map((c) => c.id + "|" + (c.ultima ? c.ultima.em : "")).join(","), () => {
    for (const c of store.conversas) {
      const em = c.ultima ? c.ultima.em : "";
      const antes = vistas.get(c.id);
      vistas.set(c.id, em);
      if (primeira || !em || em === antes || !naoLida(c)) continue;
      const aberta = router.currentRoute.value.path === "/chat/" + c.id;
      if (aberta && !document.hidden) continue;
      if (!("Notification" in window) || Notification.permission !== "granted" || !document.hidden) continue;
      const n = new Notification(tituloDaConversa(c), {
        body: (c.tipo === "grupo" ? c.ultima.autorNome.split(" ")[0] + ": " : "") + c.ultima.texto,
        tag: "gig-chat-" + c.id, icon: "../assets/marca/gig-icone.svg",
      });
      n.onclick = () => { window.focus(); router.push("/chat/" + c.id); n.close(); };
    }
    if (store.membro) primeira = false;
  });
}
