// ---------------------------------------------------------------------------
// Configuração do Firebase, compartilhada por todo o site
// ---------------------------------------------------------------------------
// Um único projeto ("andon-sede") atende:
//   - Andon da sede     → Realtime Database, nó /andon
//   - Cuckoo            → Realtime Database, nó /cuckoo/sessoes
//   - Plataforma GIG    → Authentication (Google) + Cloud Firestore
//
// Chaves web do Firebase não são segredo: são identificadores públicos. A
// proteção vem das regras desta pasta (database.rules.json e firestore.rules),
// publicadas no Console do Firebase.
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
