/* ============================================================
   CÁLCULOS: classificação por grupo (com critérios de desempate),
   mata-mata, artilharia, cartões, suspensões, ficha do jogador.
   Funções puras: recebem os dados e devolvem resultados.
   ============================================================ */
(function () {
  /* ---- Critérios de desempate (ordem padrão = futebol profissional) ---- */
  const DEFAULT_TB = ["wins", "goal_diff", "goals_for", "head_to_head", "fair_play"];
  const TB_INFO = {
    wins:         { label: "Número de vitórias", desc: "Quem venceu mais jogos fica à frente." },
    goal_diff:    { label: "Saldo de gols", desc: "Gols marcados menos gols sofridos." },
    goals_for:    { label: "Gols marcados", desc: "Maior número de gols pró." },
    head_to_head: { label: "Confronto direto", desc: "Resultado dos jogos entre os clubes empatados." },
    fair_play:    { label: "Fair play", desc: "Menos cartões (o vermelho pesa mais que o amarelo)." }
  };
  const normTB = (tb) => {
    const out = [];
    (Array.isArray(tb) ? tb : []).forEach(k => { if (TB_INFO[k] && !out.includes(k)) out.push(k); });
    DEFAULT_TB.forEach(k => { if (!out.includes(k)) out.push(k); });
    return out.slice(0, 5);
  };

  /* ---- Partidas ---- */
  const hasScore = (m) => m.home_score != null && m.away_score != null;
  const finished = (m) => m.status === "concluido" && hasScore(m);
  const started = (m) => m.status === "em_andamento" || m.status === "concluido";
  const isKO = (m) => m.stage === "mata-mata";

  function winnerOf(m) {
    if (!finished(m)) return null;
    const h = +m.home_score, a = +m.away_score;
    if (h > a) return m.home_id;
    if (a > h) return m.away_id;
    if (m.home_pen != null && m.away_pen != null) {
      if (+m.home_pen > +m.away_pen) return m.home_id;
      if (+m.away_pen > +m.home_pen) return m.away_id;
    }
    return null;
  }

  /* Gol conta para o time do jogador; gol contra para o adversário */
  function benefitTeam(match, ev) {
    if (ev.type === "gol") return ev.team_id;
    if (ev.type === "gol_contra") return ev.team_id === match.home_id ? match.away_id : match.home_id;
    return null;
  }
  function scoreFromEvents(match, events) {
    let home = 0, away = 0;
    events.filter(e => e.match_id === match.id).forEach(e => {
      const t = benefitTeam(match, e);
      if (t === match.home_id) home++; else if (t === match.away_id) away++;
    });
    return { home, away };
  }

  /* ---- Classificação de um grupo ---- */
  const METRIC = {
    wins: r => r.v,
    goal_diff: r => r.sg,
    goals_for: r => r.gp,
    fair_play: r => -(r.reds * 100 + r.yellows)   // maior = melhor (menos cartões)
  };

  function splitEqual(sorted, keyFn) {
    const out = [];
    sorted.forEach(x => {
      const k = keyFn(x), last = out[out.length - 1];
      if (last && last.k === k) last.items.push(x); else out.push({ k, items: [x] });
    });
    return out.map(o => o.items);
  }

  function rank(rows, matches, rules, crits) {
    const resolve = (group, list) => {
      if (group.length < 2) return group;
      if (!list.length) return [...group].sort((a, b) => a.team.name.localeCompare(b.team.name));
      const [c, ...rest] = list;
      let keyFn;
      if (c === "head_to_head") {
        const ids = new Set(group.map(r => r.team.id));
        const mini = {};
        group.forEach(r => (mini[r.team.id] = { p: 0, gp: 0, gc: 0 }));
        matches.filter(m => ids.has(m.home_id) && ids.has(m.away_id)).forEach(m => {
          const h = mini[m.home_id], a = mini[m.away_id], hs = +m.home_score, as = +m.away_score;
          h.gp += hs; h.gc += as; a.gp += as; a.gc += hs;
          if (hs > as) h.p += rules.pointsWin; else if (as > hs) a.p += rules.pointsWin;
          else { h.p += rules.pointsDraw; a.p += rules.pointsDraw; }
        });
        keyFn = r => { const x = mini[r.team.id]; return x.p * 1e6 + (x.gp - x.gc + 500) * 1e3 + x.gp; };
      } else keyFn = METRIC[c];
      const sorted = [...group].sort((a, b) => keyFn(b) - keyFn(a));
      return splitEqual(sorted, keyFn).flatMap(g => (g.length === group.length ? resolve(g, rest) : resolve(g, list)));
    };
    const byPts = splitEqual([...rows].sort((a, b) => b.p - a.p), r => r.p);
    return byPts.flatMap(g => resolve(g, crits));
  }

  function groupTable(teams, matches, events, rules, tb) {
    const rows = {};
    teams.forEach(t => (rows[t.id] = { team: t, p: 0, j: 0, v: 0, e: 0, d: 0, gp: 0, gc: 0, sg: 0, yellows: 0, reds: 0 }));
    const counted = matches.filter(m => finished(m) && rows[m.home_id] && rows[m.away_id]);
    counted.forEach(m => {
      const h = rows[m.home_id], a = rows[m.away_id], hs = +m.home_score, as = +m.away_score;
      h.j++; a.j++; h.gp += hs; h.gc += as; a.gp += as; a.gc += hs;
      if (hs > as) { h.v++; a.d++; h.p += rules.pointsWin; a.p += rules.pointsLoss; }
      else if (hs < as) { a.v++; h.d++; a.p += rules.pointsWin; h.p += rules.pointsLoss; }
      else { h.e++; a.e++; h.p += rules.pointsDraw; a.p += rules.pointsDraw; }
    });
    const ids = new Set(counted.map(m => m.id));
    events.filter(e => ids.has(e.match_id) && rows[e.team_id]).forEach(e => {
      if (e.type === "amarelo") rows[e.team_id].yellows++;
      else if (e.type === "vermelho") rows[e.team_id].reds++;
    });
    const list = Object.values(rows).map(r => ({ ...r, sg: r.gp - r.gc }));
    return rank(list, counted, rules, normTB(tb)).map((r, i) => ({ ...r, pos: i + 1 }));
  }

  /* Uma tabela por grupo. Sem grupos definidos, uma tabela geral. */
  function standingsByGroup(data, rules, tb) {
    const names = [...new Set(data.teams.map(t => t.grp || "").filter(Boolean))].sort();
    const groups = names.length ? names : [""];
    return groups.map(g => {
      const teams = names.length ? data.teams.filter(t => (t.grp || "") === g) : data.teams;
      const ids = new Set(teams.map(t => t.id));
      const ms = data.matches.filter(m => !isKO(m) && ids.has(m.home_id) && ids.has(m.away_id));
      return { group: g, rows: groupTable(teams, ms, data.events, rules, tb) };
    });
  }

  /* Classificados: os N melhores de cada grupo */
  function qualifiers(data, rules, tb, advance) {
    const out = [];
    standingsByGroup(data, rules, tb).forEach(g => g.rows.slice(0, advance).forEach(r => out.push({ group: g.group, rank: r.pos, ...r })));
    return out;
  }

  /* ---- Mata-mata ---- */
  function koPhases(data) {
    const map = {};
    data.matches.filter(isKO).forEach(m => {
      const no = m.phase_no || 1;
      (map[no] = map[no] || { no, label: m.phase || "Mata-mata", matches: [] }).matches.push(m);
    });
    return Object.values(map).sort((a, b) => a.no - b.no)
      .map(p => ({ ...p, matches: p.matches.sort((x, y) => String(x.date).localeCompare(String(y.date)) || String(x.id).localeCompare(String(y.id))) }));
  }
  function champion(data, byes) {
    const ph = koPhases(data), last = ph[ph.length - 1];
    if (!last || last.matches.length !== 1 || (byes && byes.length)) return null;
    const w = winnerOf(last.matches[0]);
    return w ? data.teams.find(t => t.id === w) || null : null;
  }

  /* ---- Jogadores ---- */
  function playerSummary(data, pid) {
    const log = data.events.filter(e => e.player_id === pid)
      .map(e => ({ event: e, match: data.matches.find(m => m.id === e.match_id) }))
      .sort((a, b) => ((a.match && a.match.round) || 0) - ((b.match && b.match.round) || 0) || (a.event.minute || 0) - (b.event.minute || 0));
    const count = (t) => log.filter(x => x.event.type === t).length;
    return { gols: count("gol"), contra: count("gol_contra"), amarelos: count("amarelo"), vermelhos: count("vermelho"), log };
  }

  function playerTotals(data) {
    const tot = {};
    data.events.forEach(e => {
      const t = tot[e.player_id] || (tot[e.player_id] = { gols: 0, amarelos: 0, vermelhos: 0 });
      if (e.type === "gol") t.gols++; else if (e.type === "amarelo") t.amarelos++; else if (e.type === "vermelho") t.vermelhos++;
    });
    return tot;
  }
  function withPlayer(data, totals, filter, sorter) {
    return Object.entries(totals).map(([pid, t]) => {
      const player = data.players.find(p => p.id === pid);
      return player ? { player, team: data.teams.find(x => x.id === player.team_id), ...t } : null;
    }).filter(r => r && filter(r)).sort(sorter);
  }
  const scorers = (data) => withPlayer(data, playerTotals(data), r => r.gols > 0,
    (a, b) => b.gols - a.gols || a.player.name.localeCompare(b.player.name));
  const cards = (data) => withPlayer(data, playerTotals(data), r => r.amarelos + r.vermelhos > 0,
    (a, b) => b.vermelhos - a.vermelhos || b.amarelos - a.amarelos || a.player.name.localeCompare(b.player.name));
  const hanging = (data, limit) => withPlayer(data, playerTotals(data), r => limit > 1 && r.amarelos % limit === limit - 1,
    (a, b) => b.amarelos - a.amarelos);

  function suspended(data) {
    return data.suspensions.filter(s => s.active).map(s => {
      const player = data.players.find(p => p.id === s.player_id);
      return player ? { ...s, player, team: data.teams.find(t => t.id === player.team_id) } : null;
    }).filter(Boolean);
  }

  window.Stats = {
    DEFAULT_TB, TB_INFO, normTB, finished, started, isKO, winnerOf, benefitTeam, scoreFromEvents,
    groupTable, standingsByGroup, qualifiers, koPhases, champion,
    playerSummary, scorers, cards, hanging, suspended
  };
})();
