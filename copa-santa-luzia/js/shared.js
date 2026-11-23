/* ============================================================
   TELAS COMPARTILHADAS (usuário e admin):
   elenco do clube e "mapa" (ficha) do jogador com gols e cartões.
   O CPF só aparece quando a sessão é de administrador.
   ============================================================ */
(function () {
  const { esc, badge, Cpf } = UI;
  const D = () => Store.data;
  const team = (id) => Store.get("teams", id);
  const player = (id) => Store.get("players", id);
  const isAdmin = () => !!(window.Shared && window.Shared.showCpf);

  const icon = { gol: "⚽", gol_contra: "⚽ <small class=\"muted\">(contra)</small>", amarelo: '<span class="card-y"></span>', vermelho: '<span class="card-r"></span>' };
  const evLabel = { gol: "Gol", gol_contra: "Gol contra", amarelo: "Cartão amarelo", vermelho: "Cartão vermelho" };

  function roster(teamId) {
    const admin = isAdmin(), t = team(teamId);
    if (!t) return "";
    const ps = D().players.filter(p => p.team_id === teamId)
      .sort((a, b) => (a.number ?? 999) - (b.number ?? 999) || a.name.localeCompare(b.name));
    const rows = ps.map(p => ({ p, s: Stats.playerSummary(D(), p.id) }));
    const tot = rows.reduce((a, r) => ({ g: a.g + r.s.gols, y: a.y + r.s.amarelos, r: a.r + r.s.vermelhos }), { g: 0, y: 0, r: 0 });
    const body = rows.map(({ p, s }, index) => `<tr>
        <td>${String(index + 1).padStart(2, "0")}</td>
        <td class="l"><button class="linkbtn" data-player="${p.id}">${esc(p.name)}</button></td>
        ${admin ? `<td class="l">${p.cpf ? esc(Cpf.format(p.cpf)) : '<span class="pill red">sem CPF</span>'}</td>` : ""}
        <td>${s.gols}</td><td>${s.amarelos}</td><td>${s.vermelhos}</td>
        ${admin ? `<td><button class="btn ghost sm" data-act="edit-player" data-id="${p.id}">Editar</button></td>` : ""}</tr>`).join("");
    return `<div class="team-cell" style="margin-bottom:6px">${badge(t)}<h2 style="margin:0">${esc(t.name)}</h2>
        ${t.grp ? `<span class="tag">Grupo ${esc(t.grp)}</span>` : ""}</div>
      <p class="muted small">${ps.length} jogador(es) · ${tot.g} gol(s) · ${tot.y} 🟨 · ${tot.r} 🟥 · toque no nome para ver a ficha</p>
      ${ps.length ? `<div class="table-wrap"><table><thead><tr><th>Nº</th><th class="l">Jogador</th>${admin ? '<th class="l">CPF</th>' : ""}<th>⚽</th><th>🟨</th><th>🟥</th>${admin ? "<th></th>" : ""}</tr></thead><tbody>${body}</tbody></table></div>`
        : '<p class="muted">Nenhum jogador cadastrado neste clube.</p>'}
      <div class="toolbar" style="margin:14px 0 0"><span class="spacer"></span><button class="btn ghost" data-dlgclose>Fechar</button></div>`;
  }

  function playerCard(pid) {
    const admin = isAdmin(), p = player(pid);
    if (!p) return "";
    const t = team(p.team_id), s = Stats.playerSummary(D(), pid);
    const susp = D().suspensions.find(x => x.player_id === pid && x.active);
    const log = s.log.map(({ event: e, match: m }) => {
      const h = m && team(m.home_id), a = m && team(m.away_id);
      const where = m ? (m.stage === "mata-mata" ? esc(m.phase || "Mata-mata") : "Rodada " + esc(m.round ?? "-")) : "—";
      return `<tr><td class="l">${where}</td><td class="l">${m ? esc(h?.name) + " x " + esc(a?.name) : "—"}</td>
        <td>${e.minute != null ? esc(e.minute) + "'" : ""}</td><td class="l">${icon[e.type] || ""} ${esc(evLabel[e.type] || e.type)}</td></tr>`;
    }).join("");
    return `<div class="team-cell" style="margin-bottom:4px">${badge(t)}<div>
        <h2 style="margin:0">${p.number != null ? "#" + esc(p.number) + " " : ""}${esc(p.name)}</h2>
        <div class="muted small">${esc(t?.name || "")}${p.position ? " · " + esc(p.position) : ""}</div></div></div>
      ${admin ? `<p class="small" style="margin:6px 0"><span class="muted">CPF:</span> ${p.cpf ? esc(Cpf.format(p.cpf)) : '<span class="pill red">não informado</span>'}</p>` : ""}
      ${susp ? `<p><span class="pill red">Suspenso</span> <span class="muted small">${esc(susp.reason || "")}</span></p>` : ""}
      <div class="stats3">
        <div class="stat"><b>${s.gols}</b><span>⚽ Gols</span></div>
        <div class="stat"><b>${s.amarelos}</b><span><i class="card-y"></i> Amarelos</span></div>
        <div class="stat"><b>${s.vermelhos}</b><span><i class="card-r"></i> Vermelhos</span></div>
      </div>
      ${s.contra ? `<p class="muted small">Gols contra: ${s.contra}</p>` : ""}
      <h3 style="margin-top:14px">Histórico</h3>
      ${log ? `<div class="table-wrap"><table><thead><tr><th class="l">Fase</th><th class="l">Jogo</th><th>Min</th><th class="l">Evento</th></tr></thead><tbody>${log}</tbody></table></div>`
        : '<p class="muted small">Nenhum gol ou cartão registrado até agora.</p>'}
      <div class="toolbar" style="margin:14px 0 0"><button class="btn ghost" data-roster="${p.team_id}">← Elenco</button><span class="spacer"></span><button class="btn ghost" data-dlgclose>Fechar</button></div>`;
  }

  const open = (html) => { const d = document.getElementById("dlg"); d.innerHTML = html; if (!d.open) d.showModal(); };

  document.addEventListener("click", (e) => {
    const r = e.target.closest("[data-roster]");
    if (r) { open(roster(r.dataset.roster)); return; }
    const p = e.target.closest("[data-player]");
    if (p) { open(playerCard(p.dataset.player)); return; }
    if (e.target.closest("[data-dlgclose]")) { const d = document.getElementById("dlg"); if (d && d.open) d.close(); }
  });

  window.Shared = { roster, playerCard, open, icon, evLabel, showCpf: false };
})();
