/* ============================================================
   CAMADA DE DADOS
   Toda a aplicação lê/grava SOMENTE por aqui (window.Store).
   Para trocar de banco, basta usar dataMode "api" ou escrever
   um novo adaptador com os mesmos métodos.
   Os nomes de campos são iguais às colunas de db/schema.sql.
   ============================================================ */
(function () {
  const COLLECTIONS = ["teams", "players", "matches", "events", "suspensions", "notes", "tournament"];
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

  const DEFAULT_TOURNAMENT = {
    format: "grupos",              // "grupos" (fase de grupos + mata-mata) | "mata-mata" (direto)
    group_size: 4,
    advance: 2,                    // classificados por grupo
    legs: "ida",                   // "ida" (só ida) | "ida-volta"
    tiebreakers: ["wins", "goal_diff", "goals_for", "head_to_head", "fair_play"],
    ko_byes: []                    // clubes que folgaram na 1ª fase do mata-mata
  };

  /* ---------- Adaptador 1: localStorage (testes) ---------- */
  const LocalAdapter = {
    key: "campeonato_db_v1",
    read() { try { return JSON.parse(localStorage.getItem(this.key)) || {}; } catch (e) { return {}; } },
    write(db) { localStorage.setItem(this.key, JSON.stringify(db)); },
    async list(c) { return this.read()[c] || []; },
    async create(c, obj) {
      const db = this.read(); db[c] = db[c] || [];
      const item = { ...obj, id: obj.id || uid() };
      db[c].push(item); this.write(db); return item;
    },
    async bulkCreate(c, arr) {
      const db = this.read(); db[c] = db[c] || [];
      const items = arr.map(o => ({ ...o, id: o.id || uid() }));
      db[c].push(...items); this.write(db); return items;
    },
    async update(c, id, patch) {
      const db = this.read(); const list = db[c] || [];
      const i = list.findIndex(x => x.id === id);
      if (i < 0) throw new Error("Registro não encontrado");
      list[i] = { ...list[i], ...patch }; db[c] = list; this.write(db); return list[i];
    },
    async remove(c, id) {
      const db = this.read(); db[c] = (db[c] || []).filter(x => x.id !== id); this.write(db);
    },
    async clearAll() { localStorage.removeItem(this.key); }
  };

  /* ---------- Adaptador 2: API REST (seu banco de dados) ---------- */
  const RestAdapter = {
    async req(method, path, body) {
      const res = await fetch(CONFIG.apiBaseUrl + path, {
        method,
        headers: Object.assign({ "Content-Type": "application/json" }, window.Auth ? Auth.authHeader() : {}),
        body: body ? JSON.stringify(body) : undefined
      });
      if (!res.ok) throw new Error("Erro " + res.status + " em " + method + " " + path);
      return res.status === 204 ? null : res.json();
    },
    list(c) { return RestAdapter.req("GET", "/" + c); },
    create(c, obj) { return RestAdapter.req("POST", "/" + c, obj); },
    bulkCreate(c, arr) { return RestAdapter.req("POST", "/" + c + "/bulk", arr); },
    update(c, id, patch) { return RestAdapter.req("PUT", "/" + c + "/" + id, patch); },
    remove(c, id) { return RestAdapter.req("DELETE", "/" + c + "/" + id); },
    async clearAll() { throw new Error("Limpar tudo não é permitido via API pelo painel."); }
  };

  /* ---------- Adaptador 3: Supabase ---------- */
  const SupabaseAdapter = {
    client() {
      if (!window.supabaseClient) {
        if (!window.supabase || !CONFIG.supabaseUrl || !CONFIG.supabasePublishableKey) {
          throw new Error("Supabase não configurado. Confira js/config.js e a biblioteca supabase-js.");
        }
        window.supabaseClient = window.supabase.createClient(CONFIG.supabaseUrl, CONFIG.supabasePublishableKey);
      }
      return window.supabaseClient;
    },
    table(c) { return c === "players" && !Store.keepCpf ? "players_public" : c; },
    async list(c) {
      const { data, error } = await this.client().from(this.table(c)).select("*");
      if (error) throw error;
      return data || [];
    },
    async create(c, obj) {
      const { data, error } = await this.client().from(c).insert(obj).select("*").single();
      if (error) throw error;
      return data;
    },
    async bulkCreate(c, arr) {
      const { data, error } = await this.client().from(c).insert(arr).select("*");
      if (error) throw error;
      return data || [];
    },
    async update(c, id, patch) {
      const { data, error } = await this.client().from(c).update(patch).eq("id", id).select("*").single();
      if (error) throw error;
      return data;
    },
    async remove(c, id) {
      const { error } = await this.client().from(c).delete().eq("id", id);
      if (error) throw error;
    },
    async clearAll() { throw new Error("Limpeza total desativada no Supabase para evitar apagar dados de produção."); }
  };

  const adapter = () => (CONFIG.dataMode === "api" ? RestAdapter : CONFIG.dataMode === "supabase" ? SupabaseAdapter : LocalAdapter);
  const LEGACY_STATUS = { agendado: "nao_iniciado", encerrado: "concluido" };

  const Store = {
    data: { teams: [], players: [], matches: [], events: [], suspensions: [], notes: [], tournament: [] },
    COLLECTIONS,
    keepCpf: false,   // só o painel do administrador liga isto

    async load() {
      for (const c of COLLECTIONS) this.data[c] = await adapter().list(c);
      /* compatibilidade com dados antigos */
      this.data.matches.forEach(m => {
        if (LEGACY_STATUS[m.status]) m.status = LEGACY_STATUS[m.status];
        if (!m.status) m.status = "nao_iniciado";
        if (!m.stage) m.stage = "grupos";
      });
      /* o CPF nunca vai para quem não é administrador (o servidor também deve omiti-lo) */
      if (!this.keepCpf) this.data.players.forEach(p => { delete p.cpf; });
      return this.data;
    },
    get(c, id) { return this.data[c].find(x => x.id === id); },

    async add(c, obj) {
      const item = await adapter().create(c, obj);
      this.data[c].push(item); return item;
    },
    async addMany(c, arr) {
      if (!arr.length) return [];
      const items = await adapter().bulkCreate(c, arr);
      this.data[c].push(...items); return items;
    },
    async update(c, id, patch) {
      const item = await adapter().update(c, id, patch);
      const i = this.data[c].findIndex(x => x.id === id);
      if (i >= 0) this.data[c][i] = item; return item;
    },
    async remove(c, id) {
      await adapter().remove(c, id);
      this.data[c] = this.data[c].filter(x => x.id !== id);
    },

    /* Configuração do campeonato (um único registro) */
    tournament() {
      const t = Object.assign({}, DEFAULT_TOURNAMENT, this.data.tournament[0] || {});
      t.tiebreakers = window.Stats ? Stats.normTB(t.tiebreakers) : t.tiebreakers;
      return t;
    },
    async saveTournament(patch) {
      const cur = this.data.tournament[0];
      return cur ? this.update("tournament", cur.id, patch) : this.add("tournament", { ...DEFAULT_TOURNAMENT, ...patch });
    },

    /* Remoções em cascata (no banco, use ON DELETE CASCADE – ver schema.sql) */
    async removeTeam(id) {
      const playerIds = this.data.players.filter(p => p.team_id === id).map(p => p.id);
      const matchIds = this.data.matches.filter(m => m.home_id === id || m.away_id === id).map(m => m.id);
      for (const e of this.data.events.filter(e => matchIds.includes(e.match_id) || e.team_id === id)) await this.remove("events", e.id);
      for (const s of this.data.suspensions.filter(s => playerIds.includes(s.player_id))) await this.remove("suspensions", s.id);
      for (const m of matchIds) await this.remove("matches", m);
      for (const p of playerIds) await this.remove("players", p);
      await this.remove("teams", id);
    },
    async removePlayer(id) {
      for (const e of this.data.events.filter(e => e.player_id === id)) await this.remove("events", e.id);
      for (const s of this.data.suspensions.filter(s => s.player_id === id)) await this.remove("suspensions", s.id);
      await this.remove("players", id);
    },
    async removeMatch(id) {
      for (const e of this.data.events.filter(e => e.match_id === id)) await this.remove("events", e.id);
      await this.remove("matches", id);
    },

    async clearAll() {
      await adapter().clearAll();
      for (const c of COLLECTIONS) this.data[c] = [];
    },

    /* Backup / restauração em JSON */
    exportJSON() { return JSON.stringify(this.data, null, 2); },
    async importJSON(text) {
      const obj = JSON.parse(text);
      await this.clearAll();
      for (const c of COLLECTIONS) {
        if (Array.isArray(obj[c]) && obj[c].length) this.data[c] = await adapter().bulkCreate(c, obj[c]);
      }
    },

    /* Dados de exemplo (CPFs fictícios, válidos só no formato) */
    async seedDemo() {
      await this.clearAll();
      const defs = [["Tigres FC", "TIG", "#e67e22"], ["Águias United", "AGU", "#2980b9"], ["Leões do Norte", "LEO", "#c0392b"], ["Estrela Verde", "EVE", "#27ae60"],
        ["Real Sertão", "RSE", "#8e44ad"], ["Atlético Serra", "ASE", "#16a085"], ["Guerreiros EC", "GUE", "#d35400"], ["Cruzeiro do Vale", "CVA", "#2c3e50"]];
      const teams = [];
      for (let i = 0; i < defs.length; i++) teams.push(await this.add("teams", { name: defs[i][0], short: defs[i][1], color: defs[i][2], grp: i < 4 ? "A" : "B" }));
      const first = ["Carlos", "Diego", "Rafael", "Bruno", "Lucas", "Mateus", "Pedro", "Thiago", "João", "André"];
      const last = ["Silva", "Souza", "Lima", "Costa", "Alves", "Rocha", "Dias", "Melo"];
      const pos = ["Goleiro", "Zagueiro", "Meia", "Atacante", "Atacante"];
      const players = [];
      for (let ti = 0; ti < teams.length; ti++) {
        for (let n = 0; n < 5; n++) {
          const k = ti * 5 + n;
          players.push(await this.add("players", {
            team_id: teams[ti].id, name: first[(k * 3) % first.length] + " " + last[(k * 5 + ti) % last.length],
            cpf: UI.Cpf.make(123456000 + k * 7919), number: n + 1, position: pos[n]
          }));
        }
      }
      const P = (ti, n) => players[ti * 5 + n];
      await this.saveTournament({ format: "grupos", advance: 2, legs: "ida" });

      await this.addMany("matches", Tournament.groupMatches(this.data.teams, { legs: "ida", start: "2026-11-08T16:00", intervalDays: 7 }));
      const ms = this.data.matches;
      const evAdd = (m, p, type, minute) => this.add("events", { match_id: m.id, player_id: p.id, team_id: p.team_id, type, minute });
      const tIdx = (id) => teams.findIndex(t => t.id === id);

      /* rodada 1: concluída, com gols e cartões */
      const scores = [[2, 1], [0, 0], [3, 1], [1, 2]];
      const r1 = ms.filter(m => m.round === 1);
      for (let i = 0; i < r1.length; i++) {
        const m = r1[i], [hs, as] = scores[i % scores.length];
        await this.update("matches", m.id, { home_score: hs, away_score: as, status: "concluido", notes: i === 0 ? "Jogo equilibrado, decidido nos minutos finais." : "" });
        for (let g = 0; g < hs; g++) await evAdd(m, P(tIdx(m.home_id), 3 + (g % 2)), "gol", 18 + g * 31);
        for (let g = 0; g < as; g++) await evAdd(m, P(tIdx(m.away_id), 3 + (g % 2)), "gol", 40 + g * 25);
        if (i % 2 === 0) await evAdd(m, P(tIdx(m.home_id), 1), "amarelo", 60);
        if (i === 1) await evAdd(m, P(tIdx(m.away_id), 2), "vermelho", 85);
      }
      /* rodada 2: um jogo em andamento (1 x 0) */
      const live = ms.filter(m => m.round === 2)[0];
      if (live) {
        await this.update("matches", live.id, { status: "em_andamento", home_score: 1, away_score: 0, date: "2026-11-16T10:00" });
        await evAdd(live, P(tIdx(live.home_id), 4), "gol", 12);
      }
      const red = this.data.events.find(e => e.type === "vermelho");
      if (red) await this.add("suspensions", { player_id: red.player_id, reason: "Cartão vermelho na rodada 1", games: 1, active: true });
      await this.add("notes", { title: "Bem-vindo!", text: "Rodada 2 neste domingo. Chegue 30 minutos antes para a súmula.", created_at: new Date().toISOString() });
    }
  };

  window.Store = Store;
})();
