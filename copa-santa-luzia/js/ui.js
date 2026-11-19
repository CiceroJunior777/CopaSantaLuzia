/* Utilitários de interface compartilhados */
(function () {
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const fmtDate = (iso) => {
    if (!iso) return "Data a definir";
    const d = new Date(iso);
    if (isNaN(d)) return esc(iso);
    return d.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" }) + " · " +
      d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  };

  const badge = (team) => {
    if (!team) return "";
    const identity = [team.name, team.short].filter(Boolean).join(" ")
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .toLowerCase().replace(/[^a-z0-9]/g, "");
    if (identity.includes("buriti")) {
      return `<span class="badge badge-image badge-buriti"><img src="assets/Buriti-ec.png" alt="Escudo Buriti EC" loading="eager"></span>`;
    }
    return `<span class="badge" style="background:${esc(team.color || "#64748b")}">${esc((team.short || team.name).slice(0, 3).toUpperCase())}</span>`;
  };

  let toastTimer;
  const toast = (msg, isError) => {
    let t = document.getElementById("toast");
    if (!t) { t = document.createElement("div"); t.id = "toast"; document.body.appendChild(t); }
    t.textContent = msg; t.className = "show" + (isError ? " error" : "");
    clearTimeout(toastTimer); toastTimer = setTimeout(() => (t.className = ""), 3600);
  };

  const empty = (msg) => `<div class="empty">${esc(msg)}</div>`;

  /* Status das partidas */
  const STATUS = { nao_iniciado: "Não iniciado", em_andamento: "Em andamento", concluido: "Concluído" };
  const statusPill = (s) =>
    `<span class="status ${esc(s)}">${s === "em_andamento" ? '<i class="live-dot"></i>' : ""}${esc(STATUS[s] || s)}</span>`;

  /* CPF: chave única do atleta (nunca exibido na página do usuário) */
  const Cpf = {
    clean: (s) => String(s == null ? "" : s).replace(/\D/g, ""),
    /* normaliza: só dígitos; se perdeu zeros à esquerda (Excel), completa até 11 */
    norm(s) { let d = this.clean(s); if (d.length > 0 && d.length < 11) d = d.padStart(11, "0"); return d; },
    valid(s) {
      const d = this.clean(s);
      if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
      const dv = (len) => { let sum = 0; for (let i = 0; i < len; i++) sum += +d[i] * (len + 1 - i); const r = (sum * 10) % 11; return r === 10 ? 0 : r; };
      return dv(9) === +d[9] && dv(10) === +d[10];
    },
    format(s) { const d = this.clean(s); return d.length === 11 ? d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4") : d; },
    /* gera CPF válido (usado só nos dados de exemplo e no modelo de planilha) */
    make(base) {
      const d = String(base).padStart(9, "0").slice(-9).split("").map(Number);
      const dv = (arr) => { let sum = 0; arr.forEach((x, i) => (sum += x * (arr.length + 1 - i))); const r = (sum * 10) % 11; return r === 10 ? 0 : r; };
      const d1 = dv(d), d2 = dv([...d, d1]);
      return d.join("") + d1 + d2;
    }
  };

  window.UI = { esc, fmtDate, badge, toast, empty, STATUS, statusPill, Cpf };
})();
