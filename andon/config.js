// ---------------------------------------------------------------------------
// Configuração do Andon GLean
// ---------------------------------------------------------------------------
// O Firebase é o mesmo para todo o site e fica em firebase/config.js; aqui ele
// só é reexportado. Se aqueles campos estiverem em branco, o painel roda em
// "modo local": funciona, mas os dados ficam só neste navegador.
// Veja o passo a passo em andon/README.md.
// ---------------------------------------------------------------------------
export { FIREBASE_CONFIG } from "../firebase/config.js";
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
