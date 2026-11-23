// Firebase da plataforma. O projeto é o mesmo do Andon da sede, então a
// configuração vem de um lugar só (firebase/config.js).
import { FIREBASE_CONFIG } from "../../firebase/config.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore, collection, doc, getDoc, getDocs, setDoc, addDoc, updateDoc, deleteDoc,
  onSnapshot, query, where, writeBatch, serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

export const app = initializeApp(FIREBASE_CONFIG);
export const auth = getAuth(app);
export const db = getFirestore(app);

export {
  onAuthStateChanged, collection, doc, getDoc, getDocs, setDoc, addDoc, updateDoc, deleteDoc,
  onSnapshot, query, where, writeBatch, serverTimestamp,
};

// Só contas do Google Workspace do grupo entram. O front checa aqui e as
// regras do Firestore checam de novo (firebase/firestore.rules).
export const DOMINIO = "glean.ufsc.br";
export const emailPermitido = (email) =>
  typeof email === "string" && email.toLowerCase().endsWith("@" + DOMINIO);

export function entrarComGoogle() {
  const provedor = new GoogleAuthProvider();
  provedor.setCustomParameters({ hd: DOMINIO, prompt: "select_account" });
  return signInWithPopup(auth, provedor);
}
export const sair = () => signOut(auth);

// Atalhos de leitura: devolvem objetos com `id` já embutido.
export const comId = (snap) => ({ id: snap.id, ...snap.data() });
export async function listar(nomeColecao, ...filtros) {
  const ref = collection(db, nomeColecao);
  const q = filtros.length ? query(ref, ...filtros) : ref;
  return (await getDocs(q)).docs.map(comId);
}
export async function ler(nomeColecao, id) {
  const s = await getDoc(doc(db, nomeColecao, id));
  return s.exists() ? comId(s) : null;
}

// Mensagem amigável para os erros mais comuns.
export function mensagemErro(err) {
  const codigo = String((err && err.code) || "");
  if (codigo.includes("permission-denied")) return "Você não tem permissão para esta ação.";
  if (codigo.includes("unavailable") || codigo.includes("network")) return "Sem conexão com o banco. Tente de novo.";
  if (codigo.includes("failed-precondition")) return "O banco precisa de um índice para esta consulta (veja o console do navegador).";
  return (err && err.message) || "Algo deu errado.";
}
