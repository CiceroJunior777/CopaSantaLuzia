/* ============================================================
   PÁGINA DO USUÁRIO (somente leitura)
   Classificação por grupo · Jogos (ao vivo) · Mata-mata ·
   Artilharia · Cartões · Suspensos · Clubes/jogadores · Avisos
   O CPF dos atletas nunca é carregado nem exibido aqui.
   ============================================================ */
(function () {
  const { esc, fmtDate, badge, empty, statusPill } = UI;
  const rules = CONFIG.rules;
  const $ = (id) => document.getElementById(id);
  const D = () => Store.data;
  const T = () => Store.tournament();
  const team = (id) => Store.get("teams", id);
  const player = (id) => Store.get("players", id);
  let current = "classificacao", jf = "todos";

  function tabList() {
    const t = T();
    const hasGroups = t.format === "grupos" || D().matches.some(m => !Stats.isKO(m));
    const list = [];
    if (hasGroups) list.push(["classificacao", "Classificação"]);
    list.push(["jogos", "Jogos"], ["matamata", "Mata-mata"], ["artilharia", "Artilharia"], ["cartoes", "Cartões"],
      ["suspensos", "Suspensos"], ["clubes", "Clubes"], ["avisos", "Avisos"]);
    return list;
  }

  /* ---------- cartão de partida ---------- */
  function matchCard(m) {
    const h = team(m.home_id), a = team(m.away_id), st = Stats.started(m);
    const evs = D().events.filter(e => e.match_id === m.id).sort((x, y) => (x.minute || 0) - (y.minute || 0));
    const where = Stats.isKO(m) ? esc(m.phase || "Mata-mata") : (m.grp ? "Grupo " + esc(m.grp) + " · " : "") + "Rodada " + esc(m.round ?? "-");
    const pen = m.home_pen != null && m.away_pen != null ? `<div class="muted small" style="text-align:center">Pênaltis: ${esc(m.home_pen)} x ${esc(m.away_pen)}</div>` : "";
    return `<div class="card match ${m.status === "em_andamento" ? "live" : ""}">
      <div class="match-head"><span>${where} · ${fmtDate(m.date)}</span>${statusPill(m.status)}</div>
      <div class="match-body">
        <div class="mteam">${badge(h)}<span>${esc(h?.name || "?")}</span></div>
        <div class="score ${st ? "" : "pending"}">${st ? `${esc(m.home_score ?? 0)} x ${esc(m.away_score ?? 0)}` : "vs"}</div>
        <div class="mteam away"><span>${esc(a?.name || "?")}</span>${badge(a)}</div>
      </div>${pen}
      ${st && evs.length ? `<div class="events">${evs.map(e => `<div class="ev"><span class="min">${e.minute != null ? esc(e.minute) + "'" : ""}</span>
        ${Shared.icon[e.type] || ""}<span>${esc(player(e.player_id)?.name || "?")}</span><span class="muted">(${esc(team(e.team_id)?.short || team(e.team_id)?.name || "")})</span></div>`).join("")}</div>` : ""}
      ${m.notes ? `<div class="match-notes">📝 ${esc(m.notes)}</div>` : ""}
    </div>`;
  }

  /* partida compacta do mata-mata */
  function kMatch(m) {
    const h = team(m.home_id), a = team(m.away_id), st = Stats.started(m), w = Stats.winnerOf(m);
    const line = (tm, sc, pen, id) => `<div class="kline ${w && w === id ? "win" : ""}">${badge(tm)}<span class="nm">${esc(tm?.name || "A definir")}</span>
      <span class="sc">${st ? esc(sc ?? 0) : ""}${pen != null ? ` <small class="muted">(${esc(pen)})</small>` : ""}</span></div>`;
    return `<div class="kmatch ${m.status === "em_andamento" ? "live" : ""}">
      ${line(h, m.home_score, m.home_pen, m.home_id)}${line(a, m.away_score, m.away_pen, m.away_id)}
      <div class="kmeta"><span>${fmtDate(m.date)}</span>${statusPill(m.status)}</div></div>`;
  }

  /* ---------- telas ---------- */
  const views = {
    classificacao() {
      const t = T();
      if (!D().teams.length) return empty("Nenhum clube cadastrado ainda.");
      const adv = t.format === "grupos" ? t.advance : 0;
      const groups = Stats.standingsByGroup(D(), rules, t.tiebreakers);
      const tables = groups.map(g => `<h2 style="margin:16px 0 8px">${g.group ? "Grupo " + esc(g.group) : "Classificação geral"}</h2>
        <div class="table-wrap standings-wrap"><table class="standings-table">
        <thead><tr><th class="pos-col">#</th><th class="l team-col">Clube</th><th>P</th><th>J</th><th>V</th><th>E</th><th>D</th><th>GP</th><th>GC</th><th>SG</th></tr></thead>
        <tbody>${g.rows.map((r, i) => `<tr class="${i < adv ? "top" : ""}">
          <td>${i + 1}</td><td class="l team-col"><div class="team-cell standings-team">${badge(r.team)}<strong class="standings-team-name">${esc(r.team.name)}</strong></div></td>
          <td class="pts">${r.p}</td><td>${r.j}</td><td>${r.v}</td><td>${r.e}</td><td>${r.d}</td>
          <td>${r.gp}</td><td>${r.gc}</td><td>${r.sg > 0 ? "+" : ""}${r.sg}</td></tr>`).join("")}</tbody></table></div>`).join("");
      const crit = t.tiebreakers.map((k, i) => `${i + 1}º ${esc(Stats.TB_INFO[k].label)}`).join(" · ");
      return (adv ? `<p class="muted small" style="margin-top:0">🟢 Os ${adv} melhor(es) de cada grupo avançam para o mata-mata.</p>` : "") + tables +
        `<div class="card" style="margin-top:16px"><h3>Critérios de desempate</h3><p class="muted small" style="margin:0">Em caso de empate em pontos: ${crit}.</p></div>
        <p class="muted small">P = pontos · J = jogos · V/E/D = vitórias/empates/derrotas · GP/GC = gols pró/contra · SG = saldo de gols</p>`;
    },

    jogos() {
      const F = { todos: () => true, ao_vivo: m => m.status === "em_andamento", proximos: m => m.status === "nao_iniciado", encerrados: m => m.status === "concluido" };
      const chips = `<div class="chips">${[["todos", "Todos"], ["ao_vivo", "🔴 Ao vivo"], ["proximos", "Não iniciados"], ["encerrados", "Concluídos"]]
        .map(([k, l]) => `<button class="chip ${jf === k ? "active" : ""}" data-jf="${k}">${l}</button>`).join("")}</div>`;
      const ms = D().matches.filter(F[jf]);
      if (!ms.length) return chips + empty(D().matches.length ? "Nenhum jogo nesta categoria." : "Nenhum jogo cadastrado ainda.");
      const cmp = (a, b) => (a.round || 0) - (b.round || 0) || String(a.date).localeCompare(String(b.date));
      const live = ms.filter(m => m.status === "em_andamento");
      const rest = jf === "todos" ? ms.filter(m => m.status !== "em_andamento") : ms;
      let html = chips;
      if (jf === "todos" && live.length) html += `<h2>🔴 Ao vivo agora</h2>` + live.map(matchCard).join("");
      const gm = rest.filter(m => !Stats.isKO(m)).sort(cmp);
      [...new Set(gm.map(m => m.round || 0))].forEach(r => {
        html += `<h2 style="margin-top:14px">${r ? "Rodada " + r : "Jogos"}</h2>` + gm.filter(m => (m.round || 0) === r).map(matchCard).join("");
      });
      const km = rest.filter(Stats.isKO);
      [...new Set(km.map(m => m.phase_no || 1))].sort((a, b) => a - b).forEach(n => {
        const list = km.filter(m => (m.phase_no || 1) === n);
        html += `<h2 style="margin-top:14px">${esc(list[0].phase || "Mata-mata")}</h2>` + list.map(matchCard).join("");
      });
      return html;
    },

    matamata() {
      const t = T(), phases = Stats.koPhases(D()), champ = Stats.champion(D(), t.ko_byes);
      let html = "";
      if (champ) html += `<div class="card champion"><div class="trophy">🏆</div><h2 style="margin:4px 0">Campeão</h2>
        <div class="team-cell" style="justify-content:center">${badge(champ)}<strong style="font-size:1.3rem">${esc(champ.name)}</strong></div></div>`;
      if (!phases.length) {
        html += empty("O mata-mata ainda não foi definido.");
        if (t.format === "grupos" && D().matches.some(m => Stats.finished(m))) {
          const q = Stats.qualifiers(D(), rules, t.tiebreakers, t.advance);
          html += `<div class="card" style="margin-top:14px"><h3>Classificados no momento</h3><p class="muted small">Os ${t.advance} melhor(es) de cada grupo, de acordo com a tabela atual.</p>
            ${q.map(x => `<div class="team-cell" style="margin:6px 0">${badge(x.team)}<strong>${esc(x.team.name)}</strong>
              <span class="tag">${x.group ? "Grupo " + esc(x.group) + " · " : ""}${x.pos}º</span></div>`).join("")}</div>`;
        }
        return html;
      }
      html += `<div class="bracket">${phases.map(p => `<div class="phase-col"><h3>${esc(p.label)}</h3>${p.matches.map(kMatch).join("")}
        ${p.no === 1 && t.ko_byes.length ? `<div class="kmatch"><div class="muted small">Avançam direto (folga)</div>${t.ko_byes.map(id =>
          `<div class="kline">${badge(team(id))}<span class="nm">${esc(team(id)?.name || "?")}</span></div>`).join("")}</div>` : ""}</div>`).join("")}</div>`;
      return html;
    },

    artilharia() {
      const rows = Stats.scorers(D());
      if (!rows.length) return empty("Ainda não há gols registrados.");
      return `<div class="table-wrap"><table>
        <thead><tr><th>#</th><th class="l">Jogador</th><th class="l">Clube</th><th>Gols</th></tr></thead>
        <tbody>${rows.map((r, i) => `<tr><td>${i + 1}</td>
          <td class="l"><button class="linkbtn" data-player="${r.player.id}">${esc(r.player.name)}</button></td>
          <td class="l"><div class="team-cell">${badge(r.team)}${esc(r.team ? r.team.name : "")}</div></td>
          <td class="pts">${r.gols}</td></tr>`).join("")}</tbody></table></div>`;
    },

    cartoes() {
      const rows = Stats.cards(D());
      const hang = Stats.hanging(D(), rules.yellowsForSuspension);
      const hangHtml = hang.length ? `<div class="card"><h2>⚠️ Pendurados</h2>
        <p class="muted small">A um cartão amarelo de suspensão (limite: ${rules.yellowsForSuspension}).</p>
        ${hang.map(h => `<div class="team-cell" style="margin:6px 0">${badge(h.team)}<strong>${esc(h.player.name)}</strong>
          <span class="muted">${esc(h.team ? h.team.name : "")}</span><span class="pill yellow">${h.amarelos} 🟨</span></div>`).join("")}</div>` : "";
      if (!rows.length) return empty("Ainda não há cartões registrados.");
      return hangHtml + `<div class="table-wrap"><table>
        <thead><tr><th class="l">Jogador</th><th class="l">Clube</th><th>🟨</th><th>🟥</th></tr></thead>
        <tbody>${rows.map(r => `<tr><td class="l"><button class="linkbtn" data-player="${r.player.id}">${esc(r.player.name)}</button></td>
          <td class="l"><div class="team-cell">${badge(r.team)}${esc(r.team ? r.team.name : "")}</div></td>
          <td>${r.amarelos}</td><td>${r.vermelhos}</td></tr>`).join("")}</tbody></table></div>`;
    },

    suspensos() {
      const rows = Stats.suspended(D());
      if (!rows.length) return empty("Nenhum jogador suspenso no momento. 🎉");
      return `<div class="table-wrap"><table>
        <thead><tr><th class="l">Jogador</th><th class="l">Clube</th><th class="l">Motivo</th><th>Jogos</th></tr></thead>
        <tbody>${rows.map(r => `<tr><td class="l"><button class="linkbtn" data-player="${r.player.id}">${esc(r.player.name)}</button></td>
          <td class="l"><div class="team-cell">${badge(r.team)}${esc(r.team ? r.team.name : "")}</div></td>
          <td class="l" style="white-space:normal">${esc(r.reason || "—")}</td>
          <td><span class="pill red">${esc(r.games || 1)}</span></td></tr>`).join("")}</tbody></table></div>`;
    },

    clubes() {
      const ts = [...D().teams].sort((a, b) => (a.grp || "").localeCompare(b.grp || "") || a.name.localeCompare(b.name));
      if (!ts.length) return empty("Nenhum clube cadastrado ainda.");
      return `<div class="grid two">${ts.map(t => {
        const n = D().players.filter(p => p.team_id === t.id).length;
        return `<div class="card"><div class="team-cell" style="margin-bottom:8px">${badge(t)}<h2 style="margin:0">${esc(t.name)}</h2>
          ${t.grp ? `<span class="tag">Grupo ${esc(t.grp)}</span>` : ""}</div>
          <p class="muted small" style="margin:0 0 10px">${n} jogador(es)</p>
          <button class="btn ghost sm" data-roster="${t.id}">Ver jogadores</button></div>`;
      }).join("")}</div>`;
    },

    avisos() {
      const sorted = [...D().notes].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
      const matchNotes = D().matches.filter(m => m.notes).map(m =>
        `<div class="card note"><h3>${esc(team(m.home_id)?.name)} x ${esc(team(m.away_id)?.name)}</h3>
         <div class="muted small">${Stats.isKO(m) ? esc(m.phase) : "Rodada " + esc(m.round || "-")}</div><p style="margin:6px 0 0">${esc(m.notes)}</p></div>`).join("");
      if (!sorted.length && !matchNotes) return empty("Sem observações por enquanto.");
      return sorted.map(n => `<div class="card note"><h3>${esc(n.title || "Aviso")}</h3>
        <p style="margin:0;white-space:pre-wrap">${esc(n.text)}</p></div>`).join("") +
        (matchNotes ? `<h2 style="margin-top:18px">Observações dos jogos</h2>${matchNotes}` : "");
    }
  };

  /* ---------- navegação ---------- */
  function render() {
    const tabs = tabList();
    if (!tabs.some(([k]) => k === current)) current = tabs[0][0];
    $("tabs").innerHTML = tabs.map(([k, label]) => `<button class="tab ${k === current ? "active" : ""}" data-tab="${k}">${label}</button>`).join("");
    $("view").innerHTML = views[current]();
  }

  async function showApp() {
    const s = Auth.session();
    $("login-screen").hidden = true; $("app").hidden = false;
    $("who-name").textContent = s.role === "guest" ? "Convidado" : s.role === "admin" ? "Administrador (visualizando)" : (s.name || s.email || "");
    if (s.picture) { $("who-pic").src = s.picture; $("who-pic").hidden = false; }
    try { await Store.load(); render(); }
    catch (e) { $("view").innerHTML = empty("Não foi possível carregar os dados: " + e.message); }
  }

  function showLogin() {
    $("app").hidden = true; $("login-screen").hidden = false;
    Auth.renderGoogleButton($("google-btn"), showApp);
  }

  document.title = CONFIG.appName + " — Tabela, jogos e artilharia";
  $("login-title").textContent = CONFIG.appName;
  $("app-name").textContent = CONFIG.appName;
  $("guest-btn").onclick = () => { Auth.guest(); showApp(); };
  $("logout-btn").onclick = () => { Auth.logout(); location.reload(); };
  $("tabs").addEventListener("click", (e) => {
    const b = e.target.closest("[data-tab]"); if (!b) return;
    current = b.dataset.tab; render(); window.scrollTo({ top: 0 });
  });
  $("view").addEventListener("click", (e) => {
    const b = e.target.closest("[data-jf]"); if (!b) return;
    jf = b.dataset.jf; render();
  });

  /* atualiza sozinho (placar ao vivo) quando a página está visível */
  setInterval(async () => {
    if ($("app").hidden || $("dlg").open || document.visibilityState !== "visible") return;
    try { await Store.load(); render(); } catch (e) { /* tenta de novo no próximo ciclo */ }
  }, 30000);

  const s = Auth.session();
  if (s) showApp(); else showLogin();
})();
