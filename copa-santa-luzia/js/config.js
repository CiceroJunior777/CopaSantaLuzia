/* ============================================================
   CONFIGURAÇÃO DO SITE
   Tudo que muda entre "teste local" e "produção" fica aqui.
   ============================================================ */
window.CONFIG = {
  appName: "Copa Santa Luzia",

  /* "local" = salva no navegador (localStorage), ótimo para testar.
     "api"   = conversa com o seu backend/banco de dados (veja README.md). */
  dataMode: "supabase",

  /* Chaves públicas (publishable) podem ficar no navegador. */
  supabaseUrl: "https://cioftvnvwwpvlzogiehn.supabase.co",
  supabasePublishableKey: "sb_publishable_XAc5gGd4wAQRbvshRrzqGQ_4y4x1vBg",

  /* Usado somente quando dataMode = "api".
     Endpoints esperados: GET/POST /teams, PUT/DELETE /teams/:id, POST /teams/bulk ... */
  apiBaseUrl: "https://SEU-BACKEND.exemplo.com/api",

  /* Login com Google (Google Identity Services).
     Crie um "OAuth Client ID" (tipo Web) em console.cloud.google.com e cole aqui. */
  googleClientId: "",

  /* E-mail ao qual a conta de administrador fica vinculada. */
  adminEmail: "",

  /* Administrador (modo local). Usuário padrão: admin  |  senha padrão: admin123
     Troque a senha gerando um novo hash SHA-256 (veja README.md).
     IMPORTANTE: em produção a verificação deve acontecer no servidor (dataMode "api"). */
  admin: {
    username: "admin",
    passwordSha256: "240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9"
  },

  /* Regras da competição */
  rules: {
    pointsWin: 3,
    pointsDraw: 1,
    pointsLoss: 0,
    yellowsForSuspension: 2   // amarelos acumulados que geram suspensão
  }
};
