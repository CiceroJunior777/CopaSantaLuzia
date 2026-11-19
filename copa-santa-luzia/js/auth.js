/* ============================================================
   AUTENTICAÇÃO
   - Usuário comum: login com Google OU modo convidado
   - Administrador: usuário + senha (vinculado ao e-mail em CONFIG.adminEmail)
   ============================================================ */
(function () {
  const KEY = "campeonato_session";

  const sha256 = async (text) => {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
    return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
  };

  const parseJwt = (token) => {
    const base = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(atob(base).split("").map(c => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2)).join(""));
    return JSON.parse(json);
  };

  const Auth = {
    session() {
      try { return JSON.parse(localStorage.getItem(KEY)); } catch (e) { return null; }
    },
    set(s) { localStorage.setItem(KEY, JSON.stringify(s)); },
    logout() { localStorage.removeItem(KEY); if (CONFIG.dataMode === "supabase" && window.supabaseClient) window.supabaseClient.auth.signOut(); },
    isAdmin() { const s = this.session(); return !!s && s.role === "admin"; },
    authHeader() { const s = this.session(); return s && s.token ? { Authorization: "Bearer " + s.token } : {}; },

    guest() { this.set({ role: "guest", name: "Convidado" }); },

    /* Admin: usuário + senha */
    async adminLogin(username, password) {
      if (CONFIG.dataMode === "supabase") {
        const client = window.supabaseClient || (window.supabaseClient = window.supabase.createClient(CONFIG.supabaseUrl, CONFIG.supabasePublishableKey));
        const email = String(username).includes("@") ? String(username).trim() : CONFIG.adminEmail;
        if (!email) throw new Error("Informe o e-mail do administrador em js/config.js ou no campo Usuário.");
        const { data, error } = await client.auth.signInWithPassword({ email, password });
        if (error) return false;
        if (!data.user || !data.user.app_metadata || data.user.app_metadata.role !== "admin") { await client.auth.signOut(); throw new Error("Esta conta não possui permissão de administrador no Supabase."); }
        this.set({ role: "admin", name: data.user.user_metadata?.name || email, email, token: data.session.access_token });
        return true;
      }
      if (CONFIG.dataMode === "api") {
        // O servidor valida e devolve { token, email }
        const res = await fetch(CONFIG.apiBaseUrl + "/auth/admin", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, password })
        });
        if (!res.ok) return false;
        const data = await res.json();
        this.set({ role: "admin", name: username, email: data.email || CONFIG.adminEmail, token: data.token });
        return true;
      }
      const ok = username === CONFIG.admin.username && (await sha256(password)) === CONFIG.admin.passwordSha256;
      if (ok) this.set({ role: "admin", name: username, email: CONFIG.adminEmail });
      return ok;
    },

    /* Google Identity Services */
    renderGoogleButton(container, onDone) {
      if (!CONFIG.googleClientId) {
        container.innerHTML = '<p class="muted small">Login com Google ainda não configurado.<br>Preencha <code>googleClientId</code> em <code>js/config.js</code>.</p>';
        return;
      }
      let tries = 0;
      const timer = setInterval(() => {
        if (window.google && google.accounts && google.accounts.id) {
          clearInterval(timer);
          google.accounts.id.initialize({
            client_id: CONFIG.googleClientId,
            callback: async (resp) => {
              try {
                if (CONFIG.dataMode === "api") {
                  // O servidor valida o token do Google e devolve a sessão
                  const r = await fetch(CONFIG.apiBaseUrl + "/auth/google", {
                    method: "POST", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ credential: resp.credential })
                  });
                  if (!r.ok) throw new Error("Falha ao validar login");
                  const d = await r.json();
                  Auth.set({ role: "user", name: d.name, email: d.email, picture: d.picture, token: d.token });
                } else {
                  const p = parseJwt(resp.credential);
                  Auth.set({ role: "user", name: p.name, email: p.email, picture: p.picture });
                }
                onDone();
              } catch (e) { alert("Não foi possível entrar com o Google: " + e.message); }
            }
          });
          google.accounts.id.renderButton(container, { theme: "outline", size: "large", text: "signin_with", locale: "pt-BR", width: 280 });
        } else if (++tries > 40) {
          clearInterval(timer);
          container.innerHTML = '<p class="muted small">Não foi possível carregar o login do Google (verifique a conexão).</p>';
        }
      }, 250);
    }
  };

  window.Auth = Auth;
})();
