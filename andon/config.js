// ---------------------------------------------------------------------------
// Configuração do Andon GLean
// ---------------------------------------------------------------------------
// Edite este arquivo depois de criar seu projeto no Firebase.
// Enquanto os campos estiverem em branco, o painel roda em "modo local":
// funciona normalmente, mas os dados ficam só neste navegador.
// Veja o passo a passo no README.md.
// ---------------------------------------------------------------------------
export const FIREBASE_CONFIG = {
  apiKey: "AIzaSyDJ8cfkl0PYOaD0DG-Fhws-lMyK2tp3-o4",
  authDomain: "andon-sede.firebaseapp.com",
  databaseURL: "https://andon-sede-default-rtdb.firebaseio.com",
  projectId: "andon-sede",
  storageBucket: "andon-sede.firebasestorage.app",
  messagingSenderId: "534532168528",
  appId: "1:534532168528:web:1fe70c653b18ad6067ea55"
};
// (app.js já inicializa o Firebase a partir desta config — não é preciso
// chamar initializeApp aqui.)

// Senha simples pedida apenas ao abrir "Gerenciar membros" (renomear, adicionar
// ou remover pessoas). Trocar a cor/status de alguém NÃO pede senha.
export const SENHA_MEMBROS = "glean";

// Coordenadas usadas na temperatura (Open-Meteo, sem cadastro).
// Padrão: Florianópolis - SC (UFSC).
export const LOCAL = {
  nome: "Florianópolis",
  latitude: -27.5954,
  longitude: -48.548,
};

// Horário de sede: começa às 09:10, pausa entre 12:00 e 13:30, termina às 17:00.
// Cada item é [início, fim]. Ajuste aqui se a regra do grupo mudar.
export const SLOTS_PLANTAO = [
  ["09:10", "10:10"],
  ["10:10", "11:00"],
  ["11:00", "12:00"],
  ["13:30", "14:20"],
  ["14:20", "15:10"],
  ["15:10", "16:20"],
  ["16:20", "17:00"],
];

// Quantidade de membros criada na primeira execução (é editável depois).
export const MEMBROS_INICIAIS = 16;

// Hora (0-23) do recarregamento diário automático, para uma tela que fica
// ligada por semanas seguidas.
export const HORA_RELOAD_DIARIO = 4;
