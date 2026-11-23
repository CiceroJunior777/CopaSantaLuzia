/* ============================================================
   PAINEL DO ADMINISTRADOR
   Campeonato (formato, grupos, desempate, sorteio de jogos) ·
   Clubes · Jogadores (CPF) · Importar planilha · Jogos e resultados
   (não iniciado / em andamento / concluído) · Mata-mata ·
   Suspensões · Observações · Dados e banco
   ============================================================ */
(function () {
  const { esc, fmtDate, badge, toast, empty, statusPill, Cpf } = UI;
  const $ = (id) => document.getElementById(id);
  const D = () => Store.data;
  const T = () => Store.tournament();
  const team = (id) => Store.get("teams", id);
  const player = (id) => Store.get("players", id);
  const rules = CONFIG.rules;

  /* Só o painel do administrador enxerga o CPF */
  Shared.showCpf = true;
  Store.keepCpf = true;

  const TABS = [
    ["campeonato", "Campeonato"], ["clubes", "Clubes"], ["jogadores", "Jogadores"], ["importar", "Adicionar jogador"],
    ["jogos", "Jogos e resultados"], ["matamata", "Mata-mata"], ["suspensoes", "Suspensões"], ["obs", "Observações"], ["dados", "Dados e banco"]
  ];
  let current = "campeonato";
  let filterTeam = "", q = "", fStage = "todos", fStatus = "todos";
  let importRows = null;

  /* ---------- helpers ---------- */
  const int = (v) => { if (v === "" || v == null) return null; const n = parseInt(v, 10); return isNaN(n) ? null : n; };
  const norm = (s) => String(s == null ? "" : s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
  const teamOptions = (sel, withAll) => (withAll ? `<option value="">Todos os clubes</option>` : `<option value="">Selecione…</option>`) +
    D().teams.map(t => `<option value="${t.id}" ${t.id === sel ? "selected" : ""}>${esc(t.name)}</option>`).join("");
  const sortedTeams = () => [...D().teams].sort((a, b) => a.name.localeCompare(b.name));
  const openDialog = (html) => { const d = $("dlg"); d.innerHTML = html; if (!d.open) d.showModal(); };
  const closeDialog = () => { const d = $("dlg"); if (d.open) d.close(); };

  function openTeamLogoEditor(teamId) {
    const t = team(teamId);
    if (!t) return;
    openDialog("<div class='logo-editor'><h2>" + (t.logo ? "Alterar escudo" : "Adicionar escudo") + " · " + esc(t.name) + "</h2>" +
      "<p class='muted small'>Escolha uma imagem. Arraste para posicionar e use o zoom até enquadrar como deseja.</p>" +
      "<label class='logo-file-label'>Escolher imagem<input id='team-logo-file' type='file' accept='image/*'></label>" +
      "<div class='logo-crop-stage'><canvas id='team-logo-canvas' width='320' height='320'></canvas></div>" +
      "<label class='logo-zoom-label'>Zoom <input id='team-logo-zoom' type='range' min='1' max='3' step='0.01' value='1' disabled></label>" +
      "<p class='muted small logo-hint'>A prévia circular representa como o escudo aparecerá no site.</p>" +
      "<div class='row-actions logo-actions'><button class='btn ghost' type='button' data-act='close'>Cancelar</button>" +
      (t.logo ? "<button class='btn danger' type='button' id='team-logo-remove'>Remover logo</button>" : "") +
      "<button class='btn' type='button' id='team-logo-save' disabled>Salvar escudo</button></div></div>");
    const canvas = $("team-logo-canvas"), ctx = canvas.getContext("2d");
    const file = $("team-logo-file"), zoomControl = $("team-logo-zoom"), save = $("team-logo-save"), size = canvas.width;
    let img = null, zoom = 1, offsetX = 0, offsetY = 0, dragging = false, lastX = 0, lastY = 0;
    const baseScale = () => Math.max(size / img.width, size / img.height);
    const dimensions = () => ({ w: img.width * baseScale() * zoom, h: img.height * baseScale() * zoom });
    const clamp = () => {
      const d = dimensions();
      offsetX = Math.max(-(d.w - size) / 2, Math.min((d.w - size) / 2, offsetX));
      offsetY = Math.max(-(d.h - size) / 2, Math.min((d.h - size) / 2, offsetY));
    };
    const draw = () => {
      ctx.clearRect(0, 0, size, size);
      if (!img) { ctx.fillStyle = "#17251d"; ctx.fillRect(0,0,size,size); ctx.fillStyle = "#9ca3af"; ctx.font = "15px system-ui"; ctx.textAlign = "center"; ctx.fillText("Escolha uma imagem",size/2,size/2); return; }
      clamp(); const d = dimensions();
      ctx.fillStyle = "#101a14"; ctx.fillRect(0,0,size,size);
      ctx.drawImage(img,(size-d.w)/2+offsetX,(size-d.h)/2+offsetY,d.w,d.h);
    };
    file.addEventListener("change", () => {
      const selected = file.files && file.files[0]; if (!selected) return;
      if (!selected.type.startsWith("image/")) { toast("Escolha um arquivo de imagem.",true); return; }
      if (selected.size > 12*1024*1024) { toast("A imagem deve ter no máximo 12 MB.",true); file.value=""; return; }
      const url=URL.createObjectURL(selected), next=new Image();
      next.onload=()=>{ if(img && img.src.startsWith("blob:")) URL.revokeObjectURL(img.src); img=next; zoom=1; offsetX=0; offsetY=0; zoomControl.value="1"; zoomControl.disabled=false; save.disabled=false; draw(); };
      next.onerror=()=>toast("Não foi possível abrir essa imagem.",true); next.src=url;
    });
    zoomControl.addEventListener("input",()=>{zoom=Number(zoomControl.value);draw();});
    canvas.addEventListener("pointerdown",e=>{if(!img)return;dragging=true;lastX=e.clientX;lastY=e.clientY;canvas.setPointerCapture(e.pointerId);});
    canvas.addEventListener("pointermove",e=>{if(!dragging)return;const factor=size/canvas.getBoundingClientRect().width;offsetX+=(e.clientX-lastX)*factor;offsetY+=(e.clientY-lastY)*factor;lastX=e.clientX;lastY=e.clientY;draw();});
    canvas.addEventListener("pointerup",()=>{dragging=false;});
    canvas.addEventListener("pointercancel",()=>{dragging=false;});
    draw();
    if (t.logo) {
      const existing = new Image();
      existing.onload = () => { img = existing; zoomControl.disabled = false; save.disabled = false; draw(); };
      existing.src = t.logo;
    }
    save.addEventListener("click",async()=>{
      if(!img){toast("Escolha uma imagem primeiro.",true);return;}
      const output=document.createElement("canvas");output.width=output.height=512;
      const out=output.getContext("2d"),d=dimensions(),ratio=512/size;
      out.drawImage(img,((size-d.w)/2+offsetX)*ratio,((size-d.h)/2+offsetY)*ratio,d.w*ratio,d.h*ratio);
      try{await Store.update("teams",teamId,{logo:output.toDataURL("image/webp",0.84)});closeDialog();render();toast("Escudo do clube salvo.");}
      catch(err){toast(err.message||"Não foi possível salvar o escudo.",true);}
    });
    const remove=$("team-logo-remove");
    if(remove)remove.addEventListener("click",async()=>{
      if(!confirm("Remover o escudo deste clube?"))return;
      try{await Store.update("teams",teamId,{logo:null});closeDialog();render();toast("Escudo removido.");}
      catch(err){toast(err.message||"Não foi possível remover o escudo.",true);}
    });
  }

  const download = (name, text, mime) => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([text], { type: mime || "text/plain;charset=utf-8" }));
    a.download = name; document.body.appendChild(a); a.click(); a.remove();
  };

  /* Gera a relação de atletas no padrão do documento oficial enviado. */
  async function rosterLogoData() {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
          canvas.getContext("2d").drawImage(img, 0, 0);
          resolve(canvas.toDataURL("image/png"));
        } catch (_) { resolve(null); }
      };
      img.onerror = () => resolve(null);
      img.src = "assets/Emblema%20Copa%20Santa%20Luzia%20em%20PNG%20transparente.png";
    });
  }

  async function downloadRosterPdf(teamId) {
    const t = team(teamId);
    if (!t) throw new Error("Clube não encontrado.");
    const athletes = D().players.filter(p => p.team_id === teamId)
      .sort((a, b) => (a.number == null ? 9999 : Number(a.number)) - (b.number == null ? 9999 : Number(b.number)) || a.name.localeCompare(b.name, "pt-BR"));
    if (!athletes.length) throw new Error("Este clube ainda não possui atletas cadastrados.");
    if (!window.jspdf || !window.jspdf.jsPDF) throw new Error("Não foi possível carregar o gerador de PDF. Verifique sua conexão e tente novamente.");

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const pageW = 297, pageH = 210, margin = 8, tableW = pageW - margin * 2;
    const cols = [18, 137, 76, 50];
    const logo = await rosterLogoData();
    const drawHeader = () => {
      if (logo) {
        doc.addImage(logo, "PNG", margin + 2, 6, 31, 31, undefined, "FAST");
        doc.addImage(logo, "PNG", pageW - margin - 33, 6, 31, 31, undefined, "FAST");
      }
      doc.setTextColor(15, 15, 15);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(18);
      doc.text("COPA SANTA LUZIA DE FUTEBOL", pageW / 2, 14, { align: "center" });
      doc.setFontSize(10);
      doc.text("Rua Manoel José Vitorino, Sítio Lagoa – Barbalha – Ceará", pageW / 2, 21, { align: "center" });
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.text("CAMPEONATO DE FUTEBOL AMADOR MASCULINO 2026", pageW / 2, 31, { align: "center" });
      doc.setFontSize(16);
      doc.text("RELAÇÃO DE ATLETAS", pageW / 2, 46, { align: "center" });

      let metaY = 58;
      const meta = (label, value) => {
        const h = 7;
        doc.setLineWidth(0.25);
        doc.rect(margin, metaY, 63, h);
        doc.rect(margin + 63, metaY, tableW - 63, h);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.text(label, margin + 1.2, metaY + 4.8);
        if (value) doc.text(value, margin + 63 + (tableW - 63) / 2, metaY + 4.8, { align: "center" });
        metaY += h;
      };
      meta("NOME DO CLUBE:", t.name.toLocaleUpperCase("pt-BR"));
      meta("DIRETOR:", "");
      const labels = ["N°", "NOME DO ATLETA", "DOC. IDENTIFICAÇÃO", "N° ATLETA"];
      let x = margin;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      labels.forEach((label, i) => {
        doc.rect(x, metaY, cols[i], 7);
        doc.text(label, x + cols[i] / 2, metaY + 4.8, { align: "center" });
        x += cols[i];
      });
      return metaY + 7;
    };

    let y = drawHeader();
    const rowH = 5.8;
    athletes.forEach((p, index) => {
      if (y + rowH > pageH - 7) { doc.addPage(); y = drawHeader(); }
      let x = margin;
      const values = [
        String(index + 1).padStart(2, "0"),
        String(p.name || "").toLocaleUpperCase("pt-BR"),
        p.cpf ? Cpf.clean(p.cpf) : "",
        p.number == null ? "" : String(p.number)
      ];
      values.forEach((value, i) => {
        doc.rect(x, y, cols[i], rowH);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        const text = i === 1 ? doc.splitTextToSize(value, cols[i] - 3)[0] : value;
        doc.text(text, i === 1 ? x + 2 : x + cols[i] / 2, y + 4, i === 1 ? {} : { align: "center" });
        x += cols[i];
      });
      y += rowH;
    });
    const safeName = t.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase();
    doc.save("relacao-atletas-" + (safeName || "clube") + ".pdf");
  }

  const csvCell = (v) => { v = String(v == null ? "" : v); return /[;"\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
  const stamp = (start, i) => { if (!start) return null; const d = new Date(start); d.setHours(d.getHours() + i * 2); return Tournament.fmtLocal(d); };
  const cmpMatch = (a, b) => (Number(Stats.isKO(a)) - Number(Stats.isKO(b))) || ((a.phase_no || 0) - (b.phase_no || 0)) ||
    ((a.round || 0) - (b.round || 0)) || String(a.date).localeCompare(String(b.date));
  const roundConflict = (m, round) => !Stats.isKO(m) && D().matches.some(x => x.id !== m.id && !Stats.isKO(x) && x.round === round &&
    [x.home_id, x.away_id].some(id => id === m.home_id || id === m.away_id));

  /* ---------- formulários reutilizáveis ---------- */
  const teamForm = (t = {}) => `<form data-form="team"><input type="hidden" name="id" value="${esc(t.id || "")}">
    <div class="form-grid">
      <label>Nome do clube*<input name="name" required value="${esc(t.name || "")}" placeholder="Ex.: Tigres FC"></label>
      <label>Sigla<input name="short" maxlength="4" value="${esc(t.short || "")}" placeholder="TIG"></label>
      <label>Grupo<input name="grp" maxlength="2" value="${esc(t.grp || "")}" placeholder="A"></label>
      <button class="btn">${t.id ? "Salvar" : "Adicionar clube"}</button>
    </div></form>`;

  const playerForm = (p = {}) => `<form data-form="player"><input type="hidden" name="id" value="${esc(p.id || "")}">
    <div class="form-grid">
      <label>Clube*<select name="team_id" required>${teamOptions(p.team_id || filterTeam)}</select></label>
      <label>Nome do jogador*<input name="name" required value="${esc(p.name || "")}"></label>
      <label>CPF* (chave única)<input name="cpf" required inputmode="numeric" maxlength="14" placeholder="000.000.000-00" value="${esc(p.cpf ? Cpf.format(p.cpf) : "")}"></label>
      <button class="btn">${p.id ? "Salvar" : "Adicionar jogador"}</button>
    </div></form>`;

  /* linha de partida (usada em Jogos e Mata-mata): rodada e data/hora editáveis na própria linha */
  const matchRow = (m) => {
    const ko = Stats.isKO(m);
    const pens = m.home_pen != null && m.away_pen != null ? ` <span class="muted small">(${esc(m.home_pen)}-${esc(m.away_pen)} pên.)</span>` : "";
    return `<tr>
      <td class="l">${ko ? `<span class="tag">${esc(m.phase)}</span>` :
        `${m.grp ? `<span class="tag">G${esc(m.grp)}</span> ` : ""}<input class="inl n" type="number" min="1" value="${esc(m.round ?? "")}" data-inline="round" data-id="${m.id}" title="Rodada">`}</td>
      <td class="l"><input class="inl" type="datetime-local" value="${esc((m.date || "").slice(0, 16))}" data-inline="date" data-id="${m.id}"></td>
      <td class="l">${esc(team(m.home_id)?.name || "?")} x ${esc(team(m.away_id)?.name || "?")}</td>
      <td><strong>${Stats.started(m) ? esc(m.home_score ?? 0) + " x " + esc(m.away_score ?? 0) : "—"}</strong>${pens}</td>
      <td>${statusPill(m.status)}</td>
      <td><div class="row-actions"><button class="btn sm" data-act="edit-match" data-id="${m.id}">${m.status === "em_andamento" ? "Gerenciar jogo" : "Abrir"}</button>
        <button class="btn danger sm" data-act="del-match" data-id="${m.id}">Excluir</button></div></td></tr>`;
  };
  const matchTable = (list) => `<div class="table-wrap"><table><thead><tr><th class="l">Rodada</th><th class="l">Data e hora</th><th class="l">Jogo</th><th>Placar</th><th>Status</th><th></th></tr></thead>
    <tbody>${list.map(matchRow).join("")}</tbody></table></div>`;

  /* ---------- telas ---------- */
  const views = {
    /* ============ CAMPEONATO ============ */
    campeonato() {
      const t = T(), teams = sortedTeams(), n = teams.length, isG = t.format === "grupos";
      const names = [...new Set(teams.map(x => x.grp).filter(Boolean))].sort();
      const letters = Array.from({ length: Math.max(Math.ceil(n / 4), names.length, 2) }, (_, i) => Tournament.groupName(i));
      const v = Tournament.validateGroups(D().teams, 4);
      const gm = D().matches.filter(m => !Stats.isKO(m));
      const phases = Stats.koPhases(D());
      const rounds = gm.length ? Math.max(...gm.map(m => m.round || 0)) : 0;
      const item = (ok, text) => `<li class="${ok ? "okline" : "todo"}">${ok ? "✔" : "○"} ${text}</li>`;

      const groupBoxes = isG ? [...names, ...(teams.some(x => !x.grp) ? [""] : [])].map(g => {
        const members = teams.filter(x => (x.grp || "") === g);
        const bad = g && members.length !== 4;
        return `<div class="gbox ${bad ? "bad" : ""}"><h3><span>${g ? "Grupo " + esc(g) : "Sem grupo"}</span><span class="tag">${members.length}${g ? "/4" : ""}</span></h3>
          ${members.map(x => `<div class="grow">${badge(x)}<span>${esc(x.name)}</span>
            <select data-teamgrp="${x.id}" title="Mudar de grupo"><option value="">—</option>${letters.map(L => `<option ${x.grp === L ? "selected" : ""}>${L}</option>`).join("")}</select></div>`).join("")}</div>`;
      }).join("") : "";

      return `<div class="card"><h2>Progresso</h2><ul class="checklist">
          ${item(!!D().tournament.length, "Formato do campeonato definido (" + (isG ? "fase de grupos + mata-mata" : "direto no mata-mata") + ")")}
          ${isG ? item(v.ok, v.ok ? `Grupos definidos (${v.names.length} grupo(s) de 4 clubes)` : "Grupos de 4 clubes: " + esc(v.msg)) : ""}
          ${isG ? item(gm.length > 0, gm.length ? `Jogos da fase de grupos sorteados (${gm.length} jogos em ${rounds} rodada(s))` : "Jogos da fase de grupos ainda não sorteados") : ""}
          ${item(phases.length > 0, phases.length ? "Mata-mata gerado: " + phases.map(p => esc(p.label)).join(" → ") : "Mata-mata ainda não gerado (aba Mata-mata)")}
        </ul></div>

        <div class="card"><h2>1. Formato do campeonato</h2>
          <form data-form="format">
            <div class="choice-grid">
              <label class="choice ${isG ? "sel" : ""}"><input type="radio" name="format" value="grupos" ${isG ? "checked" : ""}>
                <b>Fase de grupos + mata-mata</b><span class="muted small">Grupos de 4 clubes (todos contra todos). Os melhores de cada grupo avançam para a 2ª fase, o mata-mata.</span></label>
              <label class="choice ${!isG ? "sel" : ""}"><input type="radio" name="format" value="mata-mata" ${!isG ? "checked" : ""}>
                <b>Direto no mata-mata</b><span class="muted small">Todos os clubes entram na chave, com sorteio aleatório dos confrontos.</span></label>
            </div>
            <div class="form-grid only-groups" style="margin-top:12px" ${isG ? "" : "hidden"}>
              <label>Clubes por grupo<input value="4 (fixo)" disabled></label>
              <label>Classificam por grupo<select name="advance"><option value="2" ${t.advance === 2 ? "selected" : ""}>Os 2 melhores</option><option value="1" ${t.advance === 1 ? "selected" : ""}>Só o 1º colocado</option></select></label>
              <label>Jogos da fase de grupos<select name="legs"><option value="ida" ${t.legs === "ida" ? "selected" : ""}>Só ida</option><option value="ida-volta" ${t.legs === "ida-volta" ? "selected" : ""}>Ida e volta</option></select></label>
            </div>
            <div style="margin-top:12px"><button class="btn">Salvar formato</button></div>
          </form></div>

        ${isG ? `<div class="card"><h2>2. Critérios de desempate</h2>
          <p class="muted small">Quando clubes empatam em pontos, a ordem abaixo decide. Use as setas para escolher qual é o 1º critério, o próximo e assim por diante.</p>
          <ol class="tb-list">${t.tiebreakers.map((k, i) => `<li class="tb-item"><span class="tb-n">${i + 1}</span>
            <div class="tb-text"><b>${esc(Stats.TB_INFO[k].label)}</b><small>${esc(Stats.TB_INFO[k].desc)}</small></div>
            <button class="btn ghost sm" data-act="tb-up" data-i="${i}" ${i === 0 ? "disabled" : ""} title="Subir">↑</button>
            <button class="btn ghost sm" data-act="tb-down" data-i="${i}" ${i === t.tiebreakers.length - 1 ? "disabled" : ""} title="Descer">↓</button></li>`).join("")}</ol>
          <div style="margin-top:10px"><button class="btn ghost sm" data-act="tb-reset">Restaurar ordem do futebol profissional</button></div></div>

        <div class="card"><h2>3. Grupos</h2>
          ${n < 4 ? `<div class="warn">Cadastre ao menos 4 clubes na aba Clubes para formar grupos.</div>` :
            n % 4 ? `<div class="warn">Você tem ${n} clubes. Para grupos de 4, o total precisa ser múltiplo de 4 (faltam ${4 - (n % 4)} ou sobram ${n % 4}).</div>` : ""}
          <div class="toolbar"><button class="btn" data-act="draw-groups" ${n < 4 || n % 4 ? "disabled" : ""}>🎲 Sortear grupos</button>
            <span class="muted small">${n} clubes → ${Math.ceil(n / 4)} grupo(s). Depois do sorteio você pode mover qualquer clube de grupo.</span></div>
          ${groupBoxes ? `<div class="groups-grid">${groupBoxes}</div>` : ""}</div>

        <div class="card"><h2>4. Jogos da fase de grupos</h2>
          <p class="muted small">O sorteio agenda até 4 jogos por dia, nos horários 08:00, 10:00, 14:00 e 16:00. Todo clube que jogar terá o dia seguinte de descanso. Modo atual: <strong>${t.legs === "ida" ? "só ida" : "ida e volta"}</strong> (altere no passo 1).</p>
          <form data-form="gen-group-matches"><div class="form-grid">
            <label>Data inicial da programação<input type="date" name="start" required></label>
            <label>Intervalo entre rodadas (dias)<input type="number" name="interval" min="1" value="7" required></label>
            <button class="btn" ${v.ok ? "" : "disabled"}>🎲 Sortear jogos</button></div></form>
          ${v.ok ? "" : `<p class="muted small" style="margin:8px 0 0">Defina os grupos (cada um com 4 clubes) para liberar o sorteio.</p>`}</div>`
        : `<div class="card"><h2>2. Chaveamento</h2><p class="muted">Neste formato os clubes entram direto na chave. Sorteie os confrontos na aba <strong>Mata-mata</strong>.</p>
          <button class="btn" data-goto="matamata">Ir para Mata-mata →</button></div>`}`;
    },

    /* ============ CLUBES ============ */
    clubes() {
      const ts = sortedTeams();
      return `<div class="card"><h2>${ts.length ? "Novo clube" : "Cadastre o primeiro clube"}</h2>${teamForm()}</div>
        ${ts.length ? `<div class="table-wrap"><table><thead><tr><th>#</th><th class="l">Clube</th><th>Sigla</th><th>Grupo</th><th>Jogadores</th><th></th></tr></thead><tbody>
        ${ts.map((t, i) => `<tr><td>${i + 1}</td><td class="l"><div class="team-cell">${badge(t)}<strong>${esc(t.name)}</strong></div></td>
          <td>${esc(t.short || "—")}</td><td>${esc(t.grp || "—")}</td>
          <td>${D().players.filter(p => p.team_id === t.id).length}</td>
          <td><div class="row-actions"><button class="btn sm" data-roster="${t.id}">Ver jogadores</button>
          ${D().players.some(p => p.team_id === t.id) ? `<button class="btn ghost sm" data-act="download-roster" data-id="${t.id}">Baixar súmula</button>` : ""}
          <button class="btn ghost sm" data-act="logo-team" data-id="${t.id}">${t.logo ? "Alterar logo" : "Adicionar logo"}</button>
          <button class="btn ghost sm" data-act="edit-team" data-id="${t.id}">Editar</button>
          <button class="btn danger sm" data-act="del-team" data-id="${t.id}">Excluir</button></div></td></tr>`).join("")}
        </tbody></table></div>` : ""}`;
    },

    /* ============ JOGADORES ============ */
    jogadores() {
      if (!D().teams.length) return empty("Cadastre ao menos um clube antes de adicionar jogadores.");
      const term = norm(q), termDigits = Cpf.clean(q);
      const ps = D().players.filter(p => (!filterTeam || p.team_id === filterTeam) &&
        (!term || norm(p.name).includes(term) || (termDigits && (p.cpf || "").includes(termDigits))))
        .sort((a, b) => (team(a.team_id)?.name || "").localeCompare(team(b.team_id)?.name || "") || (a.number ?? 999) - (b.number ?? 999));
      return `<div class="card"><h2>Novo jogador</h2>${playerForm()}
        <p class="muted small" style="margin:10px 0 0">O <strong>CPF</strong> é a chave única do atleta: o mesmo CPF não pode estar em dois clubes. Ele só aparece aqui no painel, nunca no site dos usuários.
        Para cadastrar vários de uma vez, use a aba <strong>Adicionar jogador</strong>.</p></div>
        <div class="toolbar"><select data-filter="team">${teamOptions(filterTeam, true)}</select>
          <input data-filter="q" placeholder="Buscar por nome ou CPF" value="${esc(q)}">
          <span class="muted small">${ps.length} jogador(es)</span><span class="spacer"></span>
          <button class="btn ghost sm" data-act="export-players">Exportar CSV</button></div>
        ${ps.length ? `<div class="table-wrap"><table><thead><tr><th>Nº</th><th class="l">Jogador</th><th class="l">CPF</th><th class="l">Clube</th><th class="l">Posição</th><th>⚽</th><th>🟨</th><th>🟥</th><th></th></tr></thead><tbody>
        ${ps.map(p => { const s = Stats.playerSummary(D(), p.id); return `<tr><td>${esc(p.number ?? "")}</td>
          <td class="l"><button class="linkbtn" data-player="${p.id}">${esc(p.name)}</button></td>
          <td class="l">${p.cpf ? esc(Cpf.format(p.cpf)) : '<span class="pill red">sem CPF</span>'}</td>
          <td class="l"><div class="team-cell">${badge(team(p.team_id))}${esc(team(p.team_id)?.name || "")}</div></td>
          <td class="l">${esc(p.position || "")}</td><td>${s.gols}</td><td>${s.amarelos}</td><td>${s.vermelhos}</td>
          <td><div class="row-actions"><button class="btn ghost sm" data-act="edit-player" data-id="${p.id}">Editar</button>
          <button class="btn danger sm" data-act="del-player" data-id="${p.id}">Excluir</button></div></td></tr>`; }).join("")}
        </tbody></table></div>` : empty("Nenhum jogador encontrado.")}`;
    },

    /* ============ IMPORTAR ============ */
    importar() {
      const prev = importRows;
      let preview = "";
      if (prev) {
        const ok = prev.filter(r => r.status === "ok" || r.status === "novo-clube");
        const dup = prev.filter(r => r.status === "duplicado").length, err = prev.filter(r => r.status === "erro").length;
        preview = `<div class="card"><h2>Pré-visualização</h2>
          <p><span class="pill green">${ok.length} serão importados</span>
          ${dup ? ` <span class="pill yellow">${dup} já cadastrados (ignorados)</span>` : ""}
          ${err ? ` <span class="pill red">${err} com erro (não serão importados)</span>` : ""}</p>
          <div class="table-wrap" style="max-height:360px;overflow:auto"><table><thead><tr><th>Linha</th><th class="l">Clube</th><th class="l">CPF</th><th class="l">Nome</th><th class="l">Situação</th></tr></thead><tbody>
          ${prev.map(r => `<tr><td>${r.line}</td><td class="l">${esc(r.team)}</td><td class="l">${esc(r.cpf ? Cpf.format(r.cpf) : "")}</td><td class="l">${esc(r.name)}</td>
            <td class="l" style="white-space:normal">${r.status === "erro" ? `<span class="pill red">${esc(r.msg)}</span>` : r.status === "duplicado" ? '<span class="pill yellow">já cadastrado neste clube</span>'
              : r.status === "novo-clube" ? '<span class="pill green">ok · cria o clube</span>' : '<span class="pill green">ok</span>'}</td></tr>`).join("")}
          </tbody></table></div>
          <div class="toolbar" style="margin:12px 0 0"><button class="btn" data-act="import-confirm" ${ok.length ? "" : "disabled"}>Importar ${ok.length} jogador(es)</button>
          <button class="btn ghost" data-act="import-clear">Cancelar</button></div></div>`;
      }
      return `<div class="card"><h2>Importar jogadores por planilha</h2>
        <p class="muted">Envie um arquivo <strong>.xlsx</strong>, <strong>.xls</strong> ou <strong>.csv</strong> com as colunas
        <code>Clube</code>, <code>CPF</code> e <code>Nome</code> (a primeira linha é o cabeçalho).</p>
        <ul class="muted small" style="margin:0 0 12px;padding-left:18px">
          <li>O <strong>CPF é obrigatório e único</strong>: um atleta não pode entrar em dois clubes. Linhas com CPF inválido, repetido na planilha ou já cadastrado em <em>outro</em> clube são barradas.</li>
          <li>Se o Excel tirar os zeros à esquerda do CPF, o sistema completa automaticamente.</li>
          <li>Clubes que ainda não existem são criados automaticamente.</li></ul>
        <div class="dz"><input type="file" id="import-file" accept=".xlsx,.xls,.csv,.txt"></div>
        <div class="toolbar" style="margin:12px 0 0"><button class="btn ghost sm" data-act="download-template">⬇ Baixar modelo de planilha (CSV)</button></div></div>
        <div class="card"><h2>Cadastrar jogador manualmente</h2>
          <p class="muted small">Preencha os mesmos dados da planilha: clube, CPF e nome do jogador. O CPF deve ser válido e não pode estar cadastrado em outro clube.</p>
          <form data-form="player">
            <div class="form-grid">
              <label>Clube*<select name="team_id" required>${teamOptions("", false)}</select></label>
              <label>CPF*<input name="cpf" required inputmode="numeric" maxlength="14" placeholder="000.000.000-00"></label>
              <label>Nome do jogador*<input name="name" required placeholder="Nome completo"></label>
              <button class="btn" ${D().teams.length ? "" : "disabled"}>Cadastrar jogador</button>
            </div>
          </form>
          ${D().teams.length ? "" : '<p class="muted small">Cadastre um clube primeiro na aba Clubes para poder vincular o jogador.</p>'}
        </div>${preview}`;
    },

    /* ============ JOGOS ============ */
    jogos() {
      const t = T();
      let ms = [...D().matches];
      if (fStage !== "todos") ms = ms.filter(m => (fStage === "mata-mata") === Stats.isKO(m));
      if (fStatus !== "todos") ms = ms.filter(m => m.status === fStatus);
      ms.sort(cmpMatch);
      const live = D().matches.filter(m => m.status === "em_andamento");
      const canCreate = t.format === "grupos" && D().teams.length >= 2;
      return `${live.length ? `<div class="card" style="border-color:#7f1d1d"><h2>🔴 Em andamento</h2><div class="livebar">${live.map(m =>
          `<button class="btn danger" data-act="edit-match" data-id="${m.id}">${esc(team(m.home_id)?.short || "?")} ${esc(m.home_score ?? 0)} x ${esc(m.away_score ?? 0)} ${esc(team(m.away_id)?.short || "?")} — gerenciar</button>`).join("")}</div></div>` : ""}
        ${canCreate ? `<div class="card"><h2>Definir confronto manualmente</h2>
          <p class="muted small">Escolha os clubes e <strong>em qual rodada</strong> eles se enfrentam. Os sorteios automáticos ficam na aba Campeonato.</p>
          <form data-form="match"><div class="form-grid">
            <label>Rodada*<input type="number" name="round" min="1" required value="${(D().matches.filter(m => !Stats.isKO(m)).sort(cmpMatch).at(-1)?.round) || 1}"></label>
            <label>Data e hora<input type="datetime-local" name="date"></label>
            <label>Mandante*<select name="home_id" required>${teamOptions("")}</select></label>
            <label>Visitante*<select name="away_id" required>${teamOptions("")}</select></label>
            <button class="btn">Criar jogo</button></div></form></div>` : ""}
        <div class="toolbar"><select data-filter="stage"><option value="todos">Todas as fases</option>
            <option value="grupos" ${fStage === "grupos" ? "selected" : ""}>Fase de grupos</option><option value="mata-mata" ${fStage === "mata-mata" ? "selected" : ""}>Mata-mata</option></select>
          <select data-filter="status"><option value="todos">Todos os status</option>
            ${Object.entries(UI.STATUS).map(([k, l]) => `<option value="${k}" ${fStatus === k ? "selected" : ""}>${l}</option>`).join("")}</select>
          <span class="muted small">${ms.length} jogo(s) · edite rodada e data/hora direto na tabela</span></div>
        ${ms.length ? matchTable(ms) : empty(D().matches.length ? "Nenhum jogo com esses filtros." : "Nenhum jogo criado ainda. Sorteie na aba Campeonato.")}`;
    },

    /* ============ MATA-MATA ============ */
    matamata() {
      const t = T(), phases = Stats.koPhases(D()), champ = Stats.champion(D(), t.ko_byes);
      let html = "";
      const startForm = (action, btn) => `<form data-form="${action}"><div class="form-grid">
        <label>Data e hora do 1º jogo (opcional)<input type="datetime-local" name="start"></label>
        <button class="btn">${btn}</button></div></form>`;

      if (!phases.length) {
        if (t.format === "grupos") {
          const gm = D().matches.filter(m => !Stats.isKO(m)), done = gm.length > 0 && gm.every(m => m.status === "concluido");
          const qs = Stats.qualifiers(D(), rules, t.tiebreakers, t.advance);
          html += `<div class="card"><h2>2ª fase: mata-mata</h2>
            <p class="muted">Avançam os <strong>${t.advance} melhores de cada grupo</strong>, pela classificação com os critérios de desempate definidos. Com 2 grupos, o 1º de um grupo enfrenta o 2º do outro.</p>
            ${!gm.length ? `<div class="warn">Sorteie os jogos da fase de grupos antes (aba Campeonato).</div>` :
              !done ? `<div class="warn">A fase de grupos ainda não terminou (${gm.filter(m => m.status === "concluido").length}/${gm.length} jogos concluídos). Os classificados abaixo são os atuais.</div>` : ""}
            ${qs.length ? `<div class="table-wrap" style="margin-bottom:12px"><table><thead><tr><th class="l">Grupo</th><th>Pos.</th><th class="l">Clube</th><th>P</th><th>SG</th></tr></thead><tbody>
              ${qs.map(x => `<tr><td class="l">${esc(x.group || "—")}</td><td>${x.pos}º</td><td class="l"><div class="team-cell">${badge(x.team)}${esc(x.team.name)}</div></td><td class="pts">${x.p}</td><td>${x.sg}</td></tr>`).join("")}</tbody></table></div>` : ""}
            ${gm.length ? startForm("ko-first", "Gerar 1ª fase do mata-mata") : ""}</div>`;
        } else {
          html += `<div class="card"><h2>Mata-mata direto</h2>
            <p class="muted">Os ${D().teams.length} clubes cadastrados são sorteados de forma aleatória na chave. Se o número não for potência de 2, alguns clubes sorteados avançam direto (folga).</p>
            ${D().teams.length < 2 ? `<div class="warn">Cadastre ao menos 2 clubes.</div>` : startForm("ko-first", "🎲 Sortear chave")}</div>`;
        }
        return html;
      }

      if (champ) html += `<div class="card champion"><div class="trophy">🏆</div><h2 style="margin:4px 0">Campeão</h2>
        <div class="team-cell" style="justify-content:center">${badge(champ)}<strong style="font-size:1.3rem">${esc(champ.name)}</strong></div></div>`;

      const last = phases[phases.length - 1];
      const winners = last.matches.map(Stats.winnerOf);
      const resolved = winners.every(Boolean);
      const byes = last.no === 1 ? t.ko_byes : [];
      const parts = [...byes, ...winners.filter(Boolean)];
      if (!champ) {
        if (!resolved) html += `<div class="warn">Conclua todos os jogos da fase <strong>${esc(last.label)}</strong> para gerar a próxima. Em caso de empate, informe os pênaltis dentro do jogo.</div>`;
        else if (parts.length >= 2) html += `<div class="card"><h2>Próxima fase: ${esc(Tournament.phaseLabel(parts.length))}</h2>
          <p class="muted small">Classificados: ${parts.map(id => esc(team(id)?.name || "?")).join(", ")}.</p>${startForm("ko-next", "Gerar próxima fase")}</div>`;
      }
      if (t.format === "grupos" && last.no === 1 && t.ko_byes.length) {
        html += `<p class="muted small">Avançam direto (folga na 1ª fase): ${t.ko_byes.map(id => esc(team(id)?.name || "?")).join(", ")}.</p>`;
      }
      html += phases.map(p => `<h2 style="margin:16px 0 8px">${esc(p.label)}</h2>${matchTable(p.matches)}`).join("");
      html += `<div style="margin-top:18px"><button class="btn danger sm" data-act="reset-ko">Refazer mata-mata (apaga esta chave)</button></div>`;
      return html;
    },

    /* ============ SUSPENSÕES ============ */
    suspensoes() {
      if (!D().players.length) return empty("Cadastre jogadores antes de registrar suspensões.");
      const ps = [...D().players].sort((a, b) => a.name.localeCompare(b.name));
      const list = D().suspensions;
      return `<div class="card"><h2>Registrar suspensão manual</h2><p class="muted small">As suspensões por cartões são geradas automaticamente: 2 amarelos acumulados ou 1 vermelho. Também é possível registrar uma punição manualmente.</p><form data-form="suspension"><div class="form-grid">
          <label>Jogador*<select name="player_id" required><option value="">Selecione…</option>
            ${ps.map(p => `<option value="${p.id}">${esc(p.name)} — ${esc(team(p.team_id)?.name || "")}</option>`).join("")}</select></label>
          <label>Motivo<input name="reason" placeholder="Ex.: 3 cartões amarelos"></label>
          <label>Nº de jogos<input type="number" name="games" min="1" value="1"></label>
          <button class="btn">Adicionar</button></div></form></div>
        ${list.length ? `<div class="table-wrap"><table><thead><tr><th class="l">Jogador</th><th class="l">Clube</th><th class="l">Motivo</th><th>Jogos</th><th>Situação</th><th></th></tr></thead><tbody>
        ${list.map(s => `<tr><td class="l"><strong>${esc(player(s.player_id)?.name || "?")}</strong></td>
          <td class="l">${esc(team(player(s.player_id)?.team_id)?.name || "")}</td><td class="l" style="white-space:normal">${esc(s.reason || "—")}</td>
          <td>${esc(s.games || 1)}</td><td><span class="pill ${s.active ? "red" : "green"}">${s.active ? "Suspenso" : "Cumprida"}</span>${s.automatic ? '<div class="muted small">Automática</div>' : '<div class="muted small">Manual</div>'}</td>
          <td><div class="row-actions"><button class="btn ghost sm" data-act="toggle-susp" data-id="${s.id}">${s.active ? "Marcar cumprida" : "Reativar"}</button>
          <button class="btn danger sm" data-act="del-susp" data-id="${s.id}">Excluir</button></div></td></tr>`).join("")}
        </tbody></table></div>` : empty("Nenhuma suspensão registrada.")}
        <p class="muted small" style="margin-top:12px">💡 As punições automáticas são vinculadas aos cartões registrados nas partidas. Use “Marcar cumprida” após o atleta cumprir a suspensão.</p>`;
    },

    /* ============ OBSERVAÇÕES ============ */
    obs() {
      const ns = [...D().notes].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
      return `<div class="card"><h2>Nova observação / aviso</h2><form data-form="note" style="display:grid;gap:10px">
          <label>Título<input name="title" placeholder="Ex.: Mudança de horário"></label>
          <label>Texto*<textarea name="text" rows="3" required></textarea></label>
          <div><button class="btn">Publicar</button></div></form>
          <p class="muted small" style="margin:10px 0 0">Observações específicas de um jogo são editadas dentro do próprio jogo, em <strong>Jogos e resultados</strong>.</p></div>
        ${ns.length ? ns.map(n => `<div class="card note"><div class="toolbar" style="margin:0"><h3 style="margin:0">${esc(n.title || "Aviso")}</h3><span class="spacer"></span>
          <button class="btn danger sm" data-act="del-note" data-id="${n.id}">Excluir</button></div>
          <p style="margin:6px 0 0;white-space:pre-wrap">${esc(n.text)}</p></div>`).join("") : empty("Nenhuma observação publicada.")}`;
    },

    /* ============ DADOS ============ */
    dados() {
      const api = CONFIG.dataMode === "api";
      return `<div class="card"><h2>Sincronização com o banco de dados</h2>
        <p>Modo atual: <span class="pill ${api ? "green" : "yellow"}">${api ? "API / banco de dados" : "Local (navegador)"}</span></p>
        ${api ? `<p class="muted small">Endereço da API: <code>${esc(CONFIG.apiBaseUrl)}</code></p>`
          : `<p class="muted small">No modo local os dados (inclusive o CPF dos atletas) ficam salvos apenas neste navegador. Quando o banco estiver definido, altere <code>dataMode</code> para <code>"api"</code> em <code>js/config.js</code> e siga o <code>README.md</code>.</p>`}
        <p class="muted small">E-mail vinculado ao administrador: <strong>${esc(CONFIG.adminEmail || "(não configurado)")}</strong></p></div>
        <div class="card"><h2>Backup</h2><div class="toolbar" style="margin:0">
          <button class="btn ghost" data-act="export-json">⬇ Exportar tudo (JSON)</button>
          <label style="display:inline-block"><span class="btn ghost" style="display:inline-block;cursor:pointer">⬆ Restaurar de JSON</span>
            <input type="file" id="json-file" accept=".json" hidden></label></div>
          <p class="muted small" style="margin:10px 0 0">O backup contém os CPFs: guarde em local seguro.</p></div>
        ${api ? "" : `<div class="card"><h2>Ferramentas de teste</h2><div class="toolbar" style="margin:0">
          <button class="btn ghost" data-act="seed">Carregar dados de exemplo</button>
          <button class="btn danger" data-act="clear-all">Apagar todos os dados</button></div>
          <p class="muted small" style="margin:10px 0 0">“Carregar exemplo” substitui os dados atuais por 8 clubes (2 grupos de 4), jogos sorteados, uma partida em andamento e CPFs fictícios.</p></div>`}`;
    }
  };

  /* ============ Janela da partida: status, placar, gols e cartões ============ */
  function matchDialog(id) {
    const m = Store.get("matches", id); if (!m) return;
    const h = team(m.home_id), a = team(m.away_id), st = Stats.started(m), ko = Stats.isKO(m);
    const evs = D().events.filter(e => e.match_id === id).sort((x, y) => (x.minute || 0) - (y.minute || 0));
    const sq = (tid) => D().players.filter(p => p.team_id === tid).sort((x, y) => (x.number ?? 999) - (y.number ?? 999));
    const opt = (tid) => `<optgroup label="${esc(team(tid)?.name || "")}">${sq(tid).map(p => `<option value="${p.id}">${esc(p.number != null ? p.number + " · " : "")}${esc(p.name)}</option>`).join("")}</optgroup>`;
    const seg = Object.entries(UI.STATUS).map(([k, l]) =>
      `<button type="button" class="${m.status === k ? "on " + k : ""}" data-act="set-status" data-id="${id}" data-status="${k}">${l}</button>`).join("");
    const side = (tm, key) => `<div><div class="muted small">${esc(tm?.name || "?")}</div><div class="big">${esc(m[key] ?? 0)}</div></div>`;
    openDialog(`<h2>${esc(h?.name)} x ${esc(a?.name)}</h2>
      <p class="muted small" style="margin:0">${ko ? esc(m.phase) : (m.grp ? "Grupo " + esc(m.grp) + " · " : "") + "Rodada " + esc(m.round ?? "-")} · ${fmtDate(m.date)}</p>
      <div class="seg">${seg}</div>
      ${st ? `<div class="score-ctl">${side(h, "home_score")}<div class="big muted">x</div>${side(a, "away_score")}</div>
        <p class="muted small" style="text-align:center;margin:0">O placar só é atualizado quando um gol é registrado com o jogador responsável selecionado.</p>`
        : `<p class="muted">Mude o status para <strong>Em andamento</strong> para lançar placar, gols e cartões.</p>`}
      <form data-form="matchinfo" style="margin-top:14px"><input type="hidden" name="id" value="${id}">
        <div class="form-grid">
          ${ko ? "" : `<label>Rodada<input type="number" name="round" min="1" value="${esc(m.round ?? "")}"></label>`}
          <label>Data e hora<input type="datetime-local" name="date" value="${esc((m.date || "").slice(0, 16))}"></label>
          ${ko && st ? `<label>Pênaltis ${esc(h?.short || "mandante")}<input type="number" min="0" name="home_pen" value="${esc(m.home_pen ?? "")}"></label>
            <label>Pênaltis ${esc(a?.short || "visitante")}<input type="number" min="0" name="away_pen" value="${esc(m.away_pen ?? "")}"></label>` : ""}</div>
        <label style="margin-top:10px">Observações do jogo<textarea name="notes" rows="2">${esc(m.notes || "")}</textarea></label>
        <div style="margin-top:10px"><button class="btn">Salvar dados do jogo</button></div></form>
      ${st ? `<h3 style="margin-top:18px">Gols e cartões</h3>
        ${evs.length ? `<div class="table-wrap"><table><tbody>${evs.map(e => `<tr><td style="width:50px">${e.minute != null ? esc(e.minute) + "'" : ""}</td>
          <td class="l">${Shared.icon[e.type] || ""} ${esc(Shared.evLabel[e.type] || e.type)}</td>
          <td class="l">${esc(player(e.player_id)?.name || "?")} <span class="muted">(${esc(team(e.team_id)?.short || team(e.team_id)?.name || "")})</span></td>
          <td><button class="btn danger sm" data-act="del-event" data-id="${e.id}" data-match="${id}">✕</button></td></tr>`).join("")}</tbody></table></div>`
          : '<p class="muted small">Nenhum evento registrado.</p>'}
        <form data-form="event" style="margin-top:12px"><input type="hidden" name="match_id" value="${id}">
          <div class="form-grid">
            <label>Jogador<select name="player_id" required><option value="">Selecione…</option>${opt(m.home_id)}${opt(m.away_id)}</select></label>
            <label>Evento<select name="type">${Object.entries(Shared.evLabel).map(([k, v]) => `<option value="${k}">${v}</option>`).join("")}</select></label>
            <label>Minuto<input type="number" name="minute" min="0" max="130"></label>
            <button class="btn">Adicionar</button></div></form>` : ""}
      <div class="toolbar" style="margin:16px 0 0"><span class="spacer"></span><button class="btn ghost" data-act="close">Fechar</button></div>`);
  }

  /* ============ Importação de planilha ============ */
  function parseCSV(text) {
    text = text.replace(/^﻿/, "");
    const first = text.split(/\r?\n/)[0] || "";
    const delim = (first.match(/;/g) || []).length > (first.match(/,/g) || []).length ? ";" : ",";
    const rows = []; let row = [], cur = "", inQ = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (inQ) { if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else inQ = false; } else cur += c; }
      else if (c === '"') inQ = true;
      else if (c === delim) { row.push(cur); cur = ""; }
      else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; row.push(cur); rows.push(row); row = []; cur = ""; }
      else cur += c;
    }
    if (cur !== "" || row.length) { row.push(cur); rows.push(row); }
    const header = (rows[0] || []).map(h => h.trim());
    return rows.slice(1).filter(r => r.some(c => c.trim())).map(r => Object.fromEntries(header.map((h, i) => [h, (r[i] || "").trim()])));
  }

  async function readSpreadsheet(file) {
    const ext = file.name.split(".").pop().toLowerCase();
    if (ext === "csv" || ext === "txt") return parseCSV(await file.text());
    if (!window.XLSX) throw new Error("A biblioteca de planilhas não carregou (sem internet?). Salve a planilha como .csv e tente de novo.");
    const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
    return XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: "", raw: false });
  }

  const ALIASES = {
    team: ["clube", "time", "equipe", "team", "club"],
    name: ["nome", "jogador", "atleta", "player", "name"],
    cpf: ["cpf", "documento", "cpf do atleta"],
    number: ["numero", "n", "n°", "nº", "camisa", "num", "#"],
    position: ["posicao", "pos", "position"]
  };
  const pick = (row, key) => {
    for (const [h, v] of Object.entries(row)) if (ALIASES[key].includes(norm(h))) return String(v).trim();
    return "";
  };

  /* CPF é a chave: valida formato/dígitos, bloqueia repetição na planilha e CPF já usado em OUTRO clube */
  function buildPreview(rawRows) {
    const teamByName = new Map(D().teams.map(t => [norm(t.name), t]));
    const byCpf = new Map(D().players.filter(p => p.cpf).map(p => [p.cpf, p]));
    const seen = new Map();
    return rawRows.map((r, i) => {
      const row = { line: i + 2, team: pick(r, "team"), name: pick(r, "name"), cpf: Cpf.norm(pick(r, "cpf")), position: pick(r, "position"), status: "ok" };
      if (!row.team) return { ...row, status: "erro", msg: "Clube vazio" };
      if (!row.name) return { ...row, status: "erro", msg: "Nome vazio" };
      if (!row.cpf) return { ...row, status: "erro", msg: "CPF vazio" };
      if (!Cpf.valid(row.cpf)) return { ...row, status: "erro", msg: "CPF inválido" };
      const ex = byCpf.get(row.cpf);
      if (ex) {
        const exTeam = team(ex.team_id);
        return norm(exTeam?.name) === norm(row.team) ? { ...row, status: "duplicado" }
          : { ...row, status: "erro", msg: `CPF já está no clube "${exTeam?.name || "?"}" (${ex.name})` };
      }
      const prev = seen.get(row.cpf);
      if (prev) return norm(prev.team) === norm(row.team) ? { ...row, status: "duplicado" }
        : { ...row, status: "erro", msg: `CPF repetido na linha ${prev.line} (clube "${prev.team}")` };
      seen.set(row.cpf, row);
      return teamByName.has(norm(row.team)) ? row : { ...row, status: "novo-clube" };
    });
  }

  async function confirmImport() {
    const ok = importRows.filter(r => r.status === "ok" || r.status === "novo-clube");
    const teamByName = new Map(D().teams.map(t => [norm(t.name), t]));
    for (const r of ok) {
      if (!teamByName.has(norm(r.team))) {
        const t = await Store.add("teams", { name: r.team, short: r.team.slice(0, 3).toUpperCase(), grp: "" });
        teamByName.set(norm(r.team), t);
      }
    }
    await Store.addMany("players", ok.map(r => ({ team_id: teamByName.get(norm(r.team)).id, name: r.name, cpf: r.cpf, position: r.position })));
    toast(ok.length + " jogador(es) importado(s)!"); importRows = null; current = "jogadores"; filterTeam = ""; q = ""; render();
  }

  /* ============ Formulários ============ */
  const deleteGroupMatches = async () => { for (const m of D().matches.filter(m => !Stats.isKO(m))) await Store.removeMatch(m.id); };

  async function syncAutomaticSuspensions(playerId) {
    const playerEvents = D().events
      .filter(e => e.player_id === playerId && (e.type === "amarelo" || e.type === "vermelho"))
      .sort((a, b) => {
        const ma = Store.get("matches", a.match_id), mb = Store.get("matches", b.match_id);
        return String(ma?.date || "").localeCompare(String(mb?.date || "")) ||
          (int(ma?.round) - int(mb?.round)) || (int(a.minute) - int(b.minute)) ||
          String(a.id).localeCompare(String(b.id));
      });
    const triggers = [];
    let yellows = 0;
    for (const ev of playerEvents) {
      if (ev.type === "vermelho") triggers.push({ event_id: ev.id, reason: "Cartão vermelho", games: 1 });
      if (ev.type === "amarelo") {
        yellows++;
        if (yellows % 2 === 0) triggers.push({ event_id: ev.id, reason: "2 cartões amarelos acumulados", games: 1 });
      }
    }
    const wanted = new Set(triggers.map(t => t.event_id));
    for (const s of D().suspensions.filter(s => s.automatic && s.player_id === playerId)) {
      if (!wanted.has(s.event_id)) await Store.remove("suspensions", s.id);
    }
    for (const t of triggers) {
      const exists = D().suspensions.some(s => s.automatic && s.event_id === t.event_id);
      if (!exists) await Store.add("suspensions", {
        player_id: playerId, reason: t.reason, games: t.games, active: true,
        automatic: true, event_id: t.event_id
      });
    }
  }

  const handlers = {
    async format(f) {
      await Store.saveTournament({ format: f.format, advance: int(f.advance) || 2, legs: f.legs || "ida" });
      toast("Formato salvo.");
    },
    async "gen-group-matches"(f) {
      const t = T(), v = Tournament.validateGroups(D().teams, 4);
      if (!v.ok) throw new Error(v.msg);
      if (!f.start) throw new Error("Informe a data inicial da programação.");
      const existing = D().matches.filter(m => !Stats.isKO(m));
      if (existing.length && !confirm(`Já existem ${existing.length} jogos da fase de grupos. Sortear de novo apaga esses jogos e seus gols/cartões. Continuar?`)) return;
      await deleteGroupMatches();
      const ms = Tournament.groupMatches(D().teams, { legs: t.legs, start: f.start, intervalDays: int(f.interval) || 7 });
      await Store.addMany("matches", ms);
      toast(`${ms.length} jogos sorteados em ${Math.max(...ms.map(m => m.round))} rodada(s).`);
    },
    async "ko-first"(f) {
      const t = T(); let q2, fromGroups = false;
      if (t.format === "grupos") {
        fromGroups = true;
        q2 = Stats.qualifiers(D(), rules, t.tiebreakers, t.advance).map(x => ({ id: x.team.id, grp: x.group, rank: x.pos, p: x.p, sg: x.sg, gp: x.gp }));
      } else q2 = D().teams.map(x => ({ id: x.id, grp: "", rank: 1, p: 0, sg: 0, gp: 0 }));
      if (q2.length < 2) throw new Error("São necessários ao menos 2 clubes classificados.");
      const r = Tournament.koFirstRound(q2, fromGroups);
      const ms = Tournament.koMatches(r.pairs, { phase: Tournament.phaseLabel(r.size), phase_no: 1, round: 1 })
        .map((m, i) => ({ ...m, date: stamp(f.start, i) }));
      await Store.addMany("matches", ms);
      await Store.saveTournament({ ko_byes: r.byes });
      toast(`${Tournament.phaseLabel(r.size)} gerada.`);
    },
    async "ko-next"(f) {
      const t = T(), phases = Stats.koPhases(D()), last = phases[phases.length - 1];
      const winners = last.matches.map(Stats.winnerOf);
      if (!winners.every(Boolean)) throw new Error("Conclua todos os jogos da fase atual.");
      const byes = last.no === 1 ? t.ko_byes : [];
      const parts = [...byes, ...winners];
      if (parts.length < 2) throw new Error("Não há clubes suficientes para uma nova fase.");
      const pairs = Tournament.koNextRound(parts, byes.length > 0);
      const ms = Tournament.koMatches(pairs, { phase: Tournament.phaseLabel(parts.length), phase_no: last.no + 1, round: last.no + 1 })
        .map((m, i) => ({ ...m, date: stamp(f.start, i) }));
      await Store.addMany("matches", ms);
      if (byes.length) await Store.saveTournament({ ko_byes: [] });
      toast(`${Tournament.phaseLabel(parts.length)} gerada.`);
    },
    async team(f) {
      if (!f.name.trim()) throw new Error("Informe o nome do clube.");
      if (D().teams.some(t => norm(t.name) === norm(f.name) && t.id !== f.id)) throw new Error("Já existe um clube com esse nome.");
      const data = { name: f.name.trim(), short: (f.short || f.name.slice(0, 3)).toUpperCase(), grp: (f.grp || "").trim().toUpperCase() };
      f.id ? await Store.update("teams", f.id, data) : await Store.add("teams", data);
      toast("Clube salvo."); closeDialog();
    },
    async player(f) {
      const cpf = Cpf.norm(f.cpf);
      if (!f.team_id || !f.name.trim()) throw new Error("Informe clube e nome.");
      if (!Cpf.valid(cpf)) throw new Error("CPF inválido. Confira os 11 dígitos.");
      const dup = D().players.find(p => p.cpf === cpf && p.id !== f.id);
      if (dup) throw new Error(`Este CPF já está cadastrado em "${team(dup.team_id)?.name || "?"}" (${dup.name}). Um atleta não pode estar em dois clubes.`);
      const data = { team_id: f.team_id, name: f.name.trim(), cpf };
      f.id ? await Store.update("players", f.id, data) : await Store.add("players", data);
      toast("Jogador salvo."); closeDialog();
    },
    async match(f) {
      const t = T(), round = int(f.round);
      if (!f.home_id || !f.away_id) throw new Error("Escolha os dois clubes.");
      if (f.home_id === f.away_id) throw new Error("Mandante e visitante devem ser diferentes.");
      if (!round || round < 1) throw new Error("Informe a rodada.");
      const h = team(f.home_id), a = team(f.away_id);
      if (h.grp && a.grp && h.grp !== a.grp) throw new Error(`Na fase de grupos os clubes precisam ser do mesmo grupo (${h.name}: ${h.grp}, ${a.name}: ${a.grp}).`);
      const same = D().matches.filter(m => !Stats.isKO(m) && [m.home_id, m.away_id].includes(f.home_id) && [m.home_id, m.away_id].includes(f.away_id));
      if (same.length >= (t.legs === "ida-volta" ? 2 : 1)) throw new Error(`${h.name} e ${a.name} já se enfrentam na rodada ${same[0].round}. ${t.legs === "ida" ? "O campeonato está em modo só ida." : "Já há ida e volta."}`);
      const draft = { id: "_", home_id: f.home_id, away_id: f.away_id, stage: "grupos" };
      if (roundConflict(draft, round)) throw new Error(`Um dos clubes já joga na rodada ${round}.`);
      await Store.add("matches", Tournament.baseMatch({ grp: h.grp && h.grp === a.grp ? h.grp : "", round, date: f.date || null, home_id: f.home_id, away_id: f.away_id }));
      toast("Jogo criado.");
    },
    async matchinfo(f) {
      const m = Store.get("matches", f.id), patch = { date: f.date || null, notes: (f.notes || "").trim() };
      if (!Stats.isKO(m) && f.round != null) {
        const r = int(f.round);
        if (!r || r < 1) throw new Error("Informe uma rodada válida.");
        if (roundConflict(m, r)) throw new Error(`Um dos clubes já joga na rodada ${r}.`);
        patch.round = r;
      }
      if (f.home_pen !== undefined) { patch.home_pen = int(f.home_pen); patch.away_pen = int(f.away_pen); }
      await Store.update("matches", f.id, patch);
      toast("Dados do jogo salvos."); matchDialog(f.id);
    },
    async event(f) {
      const p = player(f.player_id); if (!p) throw new Error("Escolha o jogador.");
      const m = Store.get("matches", f.match_id);
      if (p.team_id !== m.home_id && p.team_id !== m.away_id) throw new Error("O jogador não pertence a nenhum dos clubes desta partida.");
      const ev = await Store.add("events", { match_id: f.match_id, player_id: p.id, team_id: p.team_id, type: f.type, minute: int(f.minute) });
      if (f.type === "amarelo" || f.type === "vermelho") await syncAutomaticSuspensions(p.id);
      const beneficiary = Stats.benefitTeam(m, ev);
      if (beneficiary) {
        const key = beneficiary === m.home_id ? "home_score" : "away_score";
        await Store.update("matches", m.id, { [key]: (m[key] ?? 0) + 1 });
      }
      toast(f.type === "gol" || f.type === "gol_contra" ? "Gol registrado — placar atualizado." : "Cartão registrado."); matchDialog(f.match_id);
    },
    async suspension(f) {
      if (!f.player_id) throw new Error("Escolha o jogador.");
      await Store.add("suspensions", { player_id: f.player_id, reason: f.reason.trim(), games: int(f.games) || 1, active: true });
      toast("Suspensão registrada.");
    },
    async note(f) {
      await Store.add("notes", { title: f.title.trim(), text: f.text.trim(), created_at: new Date().toISOString() });
      toast("Observação publicada.");
    }
  };

  document.addEventListener("submit", async (e) => {
    const form = e.target.closest("form[data-form]"); if (!form) return;
    e.preventDefault();
    try { await handlers[form.dataset.form](Object.fromEntries(new FormData(form))); render(); }
    catch (err) { toast(err.message || "Erro ao salvar", true); }
  });

  /* ============ Ações de clique ============ */
  const actions = {
    close: () => closeDialog(),
    "edit-team": (b) => openDialog(`<h2>Editar clube</h2>${teamForm(team(b.dataset.id))}`),
    "download-roster": async (b) => downloadRosterPdf(b.dataset.id),
    "logo-team": (b) => openTeamLogoEditor(b.dataset.id),
    "del-team": async (b) => {
      const t = team(b.dataset.id);
      if (confirm(`Excluir "${t.name}" e TODOS os seus jogadores, jogos e eventos?`)) { await Store.removeTeam(t.id); toast("Clube excluído."); }
    },
    "edit-player": (b) => openDialog(`<h2>Editar jogador</h2>${playerForm(player(b.dataset.id))}`),
    "del-player": async (b) => { if (confirm("Excluir este jogador?")) { await Store.removePlayer(b.dataset.id); toast("Jogador excluído."); } },
    "edit-match": (b) => matchDialog(b.dataset.id),
    "del-match": async (b) => { if (confirm("Excluir este jogo e seus eventos?")) { await Store.removeMatch(b.dataset.id); toast("Jogo excluído."); } },
    "reset-ko": async () => {
      if (!confirm("Apagar todo o mata-mata (jogos, gols e cartões dessa fase)? A fase de grupos não é alterada.")) return;
      for (const m of D().matches.filter(Stats.isKO)) await Store.removeMatch(m.id);
      await Store.saveTournament({ ko_byes: [] }); toast("Mata-mata apagado.");
    },
    "set-status": async (b) => {
      const m = Store.get("matches", b.dataset.id), s = b.dataset.status;
      if (m.status === s) return;
      const patch = { status: s };
      if (s === "nao_iniciado") {
        if ((m.home_score != null || D().events.some(e => e.match_id === m.id)) && !confirm("Voltar para “Não iniciado” apaga o placar (os gols e cartões lançados são mantidos). Continuar?")) return;
        Object.assign(patch, { home_score: null, away_score: null, home_pen: null, away_pen: null });
      } else if (m.home_score == null || m.away_score == null) {
        const sc = Stats.scoreFromEvents(m, D().events); patch.home_score = sc.home; patch.away_score = sc.away;
      }
      if (s === "concluido" && Stats.isKO(m) && !Stats.winnerOf({ ...m, ...patch }))
        throw new Error("No mata-mata o jogo não pode terminar empatado: informe os pênaltis em “Salvar dados do jogo”.");
      await Store.update("matches", m.id, patch);
      toast("Status: " + UI.STATUS[s] + "."); matchDialog(m.id);
    },
    score: async (b) => {
      const m = Store.get("matches", b.dataset.id), key = b.dataset.side;
      await Store.update("matches", m.id, { [key]: Math.max(0, (m[key] ?? 0) + int(b.dataset.d)) }); matchDialog(m.id);
    },
    "del-event": async (b) => {
      const ev = Store.get("events", b.dataset.id), m = Store.get("matches", b.dataset.match);
      const beneficiary = Stats.benefitTeam(m, ev);
      await Store.remove("events", ev.id);
      if (ev.type === "amarelo" || ev.type === "vermelho") await syncAutomaticSuspensions(ev.player_id);
      if (beneficiary) {
        const key = beneficiary === m.home_id ? "home_score" : "away_score";
        await Store.update("matches", m.id, { [key]: Math.max(0, (m[key] ?? 0) - 1) });
      }
      matchDialog(m.id);
    },
    "tb-up": async (b) => moveTB(int(b.dataset.i), -1),
    "tb-down": async (b) => moveTB(int(b.dataset.i), 1),
    "tb-reset": async () => { await Store.saveTournament({ tiebreakers: [...Stats.DEFAULT_TB] }); toast("Ordem padrão restaurada."); },
    "draw-groups": async () => {
      const n = D().teams.length;
      if (n < 4 || n % 4) throw new Error(`Para grupos de 4 clubes o total deve ser múltiplo de 4 (você tem ${n}).`);
      const hasGM = D().matches.some(m => !Stats.isKO(m));
      if (hasGM && !confirm("Já existem jogos da fase de grupos. Sortear novos grupos apaga esses jogos (e gols/cartões). Continuar?")) return;
      if (hasGM) await deleteGroupMatches();
      const map = Tournament.drawGroups(D().teams.map(t => t.id), 4);
      for (const t of D().teams) await Store.update("teams", t.id, { grp: map[t.id] });
      toast("Grupos sorteados. Agora sorteie os jogos (passo 4).");
    },
    "toggle-susp": async (b) => { const s = Store.get("suspensions", b.dataset.id); await Store.update("suspensions", s.id, { active: !s.active }); },
    "del-susp": async (b) => { await Store.remove("suspensions", b.dataset.id); },
    "del-note": async (b) => { if (confirm("Excluir esta observação?")) await Store.remove("notes", b.dataset.id); },
    "import-confirm": () => confirmImport(),
    "import-clear": () => { importRows = null; },
    "download-template": () => download("modelo-jogadores-atualizado.csv",
      "﻿Clube;CPF;Nome\r\nTigres FC;" + Cpf.format(Cpf.make(111222333)) + ";Carlos Silva\r\nTigres FC;" + Cpf.format(Cpf.make(444555666)) + ";Diego Souza\r\nÁguias United;" + Cpf.format(Cpf.make(777888999)) + ";Rafael Lima\r\n", "text/csv;charset=utf-8"),
    "export-players": () => download("jogadores.csv", "﻿Clube;CPF;Nome\r\n" +
      D().players.map(p => [team(p.team_id)?.name, p.cpf ? Cpf.format(p.cpf) : "", p.name].map(csvCell).join(";")).join("\r\n"), "text/csv;charset=utf-8"),
    "export-json": () => download("campeonato-backup-" + new Date().toISOString().slice(0, 10) + ".json", Store.exportJSON(), "application/json"),
    seed: async () => { if (confirm("Isso substitui os dados atuais pelos dados de exemplo. Continuar?")) { await Store.seedDemo(); toast("Dados de exemplo carregados."); } },
    "clear-all": async () => { if (confirm("Apagar TODOS os dados? Essa ação não pode ser desfeita.")) { await Store.clearAll(); toast("Dados apagados."); } }
  };

  async function moveTB(i, dir) {
    const arr = [...T().tiebreakers], j = i + dir;
    if (j < 0 || j >= arr.length) return;
    [arr[i], arr[j]] = [arr[j], arr[i]];
    await Store.saveTournament({ tiebreakers: arr });
  }

  document.addEventListener("click", async (e) => {
    const g = e.target.closest("[data-goto]");
    if (g) { current = g.dataset.goto; render(); window.scrollTo({ top: 0 }); return; }
    const b = e.target.closest("[data-act]"); if (!b || !actions[b.dataset.act]) return;
    try { await actions[b.dataset.act](b); render(); }
    catch (err) { toast(err.message || "Erro", true); }
  });

  /* ============ Campos que salvam ao mudar ============ */
  document.addEventListener("change", async (e) => {
    const el = e.target;
    try {
      if (el.matches("[data-filter=team]")) { filterTeam = el.value; render(); }
      else if (el.matches("[data-filter=stage]")) { fStage = el.value; render(); }
      else if (el.matches("[data-filter=status]")) { fStatus = el.value; render(); }
      else if (el.name === "format" && el.type === "radio") {
        const form = el.closest("form");
        form.querySelectorAll(".choice").forEach(c => c.classList.toggle("sel", c.querySelector("input").checked));
        form.querySelectorAll(".only-groups").forEach(x => (x.hidden = el.value !== "grupos"));
      }
      else if (el.dataset.teamgrp) { await Store.update("teams", el.dataset.teamgrp, { grp: el.value }); render(); }
      else if (el.dataset.inline) {
        const m = Store.get("matches", el.dataset.id);
        if (el.dataset.inline === "date") { await Store.update("matches", m.id, { date: el.value || null }); toast("Data e hora salvas."); }
        else {
          const r = int(el.value);
          if (!r || r < 1) { render(); throw new Error("Informe uma rodada válida."); }
          if (roundConflict(m, r)) { render(); throw new Error(`Um dos clubes já joga na rodada ${r}.`); }
          await Store.update("matches", m.id, { round: r }); toast("Rodada alterada.");
        }
        render();
      }
      else if (el.id === "import-file" && el.files[0]) {
        importRows = buildPreview(await readSpreadsheet(el.files[0]));
        if (!importRows.length) { importRows = null; throw new Error("A planilha está vazia."); }
        render();
      }
      else if (el.id === "json-file" && el.files[0]) {
        if (!confirm("Restaurar o backup substitui todos os dados atuais. Continuar?")) return;
        await Store.importJSON(await el.files[0].text()); toast("Backup restaurado."); render();
      }
    } catch (err) { toast(err.message || "Erro", true); }
  });

  document.addEventListener("input", (e) => {
    if (!e.target.matches("[data-filter=q]")) return;
    q = e.target.value; render();
    const n = $("view").querySelector("[data-filter=q]");
    if (n) { n.focus(); n.setSelectionRange(n.value.length, n.value.length); }
  });

  /* ============ Navegação e início ============ */
  function render() {
    $("tabs").innerHTML = TABS.map(([k, l]) => `<button class="tab ${k === current ? "active" : ""}" data-tab="${k}">${l}</button>`).join("");
    $("view").innerHTML = views[current]();
  }
  $("tabs").addEventListener("click", (e) => {
    const b = e.target.closest("[data-tab]"); if (!b) return;
    current = b.dataset.tab; render();
  });
  $("logout-btn").onclick = () => { Auth.logout(); location.reload(); };

  async function showApp() {
    const s = Auth.session();
    $("login-screen").hidden = true; $("app").hidden = false;
    $("who-name").textContent = s.email || s.name;
    try { await Store.load(); render(); }
    catch (err) { $("view").innerHTML = empty("Não foi possível carregar os dados: " + err.message); }
  }

  $("app-name").textContent = CONFIG.appName;
  $("admin-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target));
    $("login-err").textContent = "";
    try {
      if (await Auth.adminLogin(f.username.trim(), f.password)) showApp();
      else $("login-err").textContent = "Não foi possível entrar. Confira seu e-mail e sua senha e tente novamente.";
    } catch (err) {
      $("login-err").textContent = err.message || "Não foi possível concluir o acesso. Tente novamente em instantes.";
    }
  });

  if (Auth.isAdmin()) showApp(); else $("login-screen").hidden = false;
})();
