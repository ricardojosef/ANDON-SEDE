// =========================================================================
// GIG — arranque: autenticação, rotas e componente raiz
// =========================================================================
import { createApp } from "vue";
import { createRouter, createWebHashHistory } from "vue-router";
import {
  auth, db, doc, getDoc, setDoc, serverTimestamp, onAuthStateChanged, emailPermitido, sair, mensagemErro,
} from "./lib/firebase.js";
import { store, iniciarStore, pararStore } from "./lib/store.js";
import Nav from "./components/Nav.js";
import AvisoDdl from "./components/AvisoDdl.js";
import { iniciarLembretes } from "./lib/lembretes.js";
import { layout } from "./lib/tema.js"; // modo claro/escuro e menu recolhido
import Login from "./views/Login.js";
import Inicio from "./views/Inicio.js";
import Gig from "./views/Gig.js";
import Clima from "./views/Clima.js";
import Encaminhamentos from "./views/Encaminhamentos.js";
import Atas from "./views/Atas.js";
import Agenda from "./views/Agenda.js";
import AtaEditar from "./views/AtaEditar.js";
import Membros from "./views/Membros.js";
import Quedas from "./views/Quedas.js";
import Dashboards from "./views/Dashboards.js";
import Perfil from "./views/Perfil.js";
import Ddls from "./views/Ddls.js";
import Formularios from "./views/Formularios.js";
import FormularioEditar from "./views/FormularioEditar.js";
import FormularioResponder from "./views/FormularioResponder.js";
import FormularioRespostas from "./views/FormularioRespostas.js";
import Chat from "./views/Chat.js";
import { iniciarAvisosDoChat } from "./lib/chat.js";

const rotas = [
  { path: "/login", component: Login, meta: { publica: true } },
  { path: "/", component: Inicio },
  { path: "/gig", component: Gig },
  { path: "/clima", component: Clima },
  { path: "/ddls", component: Ddls },
  { path: "/formularios", component: Formularios },
  { path: "/formularios/novo", component: FormularioEditar },
  { path: "/formularios/:id/editar", component: FormularioEditar, props: true },
  { path: "/formularios/:id/respostas", component: FormularioRespostas, props: true },
  { path: "/formularios/:id", component: FormularioResponder, props: true },
  { path: "/chat", component: Chat },
  { path: "/chat/:id", component: Chat, props: true },
  { path: "/encaminhamentos", component: Encaminhamentos },
  { path: "/agenda", component: Agenda },
  { path: "/atas", component: Atas },
  { path: "/atas/nova", component: AtaEditar },
  { path: "/atas/:id", component: AtaEditar, props: true },
  { path: "/quedas", component: Quedas },
  { path: "/dashboards", component: Dashboards, meta: { papeis: ["lider", "gp"] } },
  { path: "/membros", component: Membros, meta: { papeis: ["lider"] } },
  { path: "/perfil", component: Perfil },
  { path: "/:resto(.*)", redirect: "/" },
];

const router = createRouter({ history: createWebHashHistory(), routes: rotas });

// A primeira resposta do Firebase Auth demora um instante; as rotas esperam
// por ela para não mandar um usuário logado para a tela de login.
let resolverAuth;
const authPronta = new Promise((r) => { resolverAuth = r; });

// No primeiro acesso o membro é cadastrado como "membro" sem cargos; a
// liderança ajusta módulo, papel e cargos depois, na tela de Membros.
async function garantirMembro(user) {
  const ref = doc(db, "membros", user.uid);
  const s = await getDoc(ref);
  if (s.exists()) { store.membro = { id: s.id, ...s.data() }; return; }
  const novo = {
    nome: user.displayName || user.email.split("@")[0],
    email: user.email,
    foto: user.photoURL || "",
    modulo: "",
    papel: "membro",
    ativo: true,
    cargos: [],
    padroes: [],
    criadoEm: serverTimestamp(),
  };
  await setDoc(ref, novo);
  store.membro = { id: user.uid, ...novo };
}

onAuthStateChanged(auth, async (user) => {
  try {
    if (user && !emailPermitido(user.email)) {
      store.erroLogin = `Só contas @glean.ufsc.br entram na plataforma. Você tentou com ${user.email}.`;
      await sair();
      return;
    }
    if (user) {
      store.erroLogin = "";
      await garantirMembro(user);
      store.user = user;
      iniciarStore(user.uid);
      iniciarLembretes();
      iniciarAvisosDoChat(router);
      if (router.currentRoute.value.path === "/login") router.replace("/");
    } else {
      store.user = null;
      pararStore();
      if (store.pronto && !router.currentRoute.value.meta.publica) router.replace("/login");
    }
  } catch (err) {
    console.error(err);
    store.erroLogin = "Não foi possível carregar seu cadastro: " + mensagemErro(err);
    await sair();
  } finally {
    store.pronto = true;
    resolverAuth();
  }
});

// Rede lenta ou bloqueio de armazenamento: a tela de login aparece mesmo que
// o Auth demore; se ele responder depois com um usuário, o fluxo acima segue.
setTimeout(() => { if (!store.pronto) { store.pronto = true; resolverAuth(); } }, 6000);

router.beforeEach(async (to) => {
  await authPronta;
  if (to.meta.publica) return store.user ? "/" : true;
  if (!store.user) return "/login";
  if (to.meta.papeis && !(store.membro && to.meta.papeis.includes(store.membro.papel))) return "/";
  return true;
});

const App = {
  components: { Nav, AvisoDdl },
  data() { return { store, layout }; },
  template: `
    <div v-if="!store.pronto" class="tela-cheia"><p class="carregando">Carregando…</p></div>
    <div v-else-if="store.user && store.membro" class="app" :class="{ 'menu-recolhido': layout.menuRecolhido, 'tela-chat': $route.path.startsWith('/chat') }">
      <Nav />
      <main class="conteudo">
        <div class="aviso" v-if="store.membro.ativo === false">
          Sua conta está marcada como inativa. Fale com a liderança.
        </div>
        <AvisoDdl v-if="!$route.path.startsWith('/chat')" />
        <router-view :key="$route.fullPath" />
      </main>
    </div>
    <router-view v-else />`,
};

createApp(App).use(router).mount("#app");
