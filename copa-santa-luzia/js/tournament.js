/* ============================================================
   SORTEIOS E CHAVEAMENTO
   Grupos de 4 · jogos da fase de grupos (todos contra todos) ·
   mata-mata (primeira fase e fases seguintes).
   Funções puras: devolvem dados; quem grava é o painel do admin.
   ============================================================ */
(function () {
  const shuffle = (arr) => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  };
  const groupName = (i) => String.fromCharCode(65 + i);
  const pad = (n) => String(n).padStart(2, "0");
  const fmtLocal = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const pow2ceil = (n) => { let p = 1; while (p < n) p *= 2; return p; };

  /* ---- Grupos ---- */
  function drawGroups(teamIds, size = 4) {
    const map = {};
    shuffle(teamIds).forEach((id, i) => (map[id] = groupName(Math.floor(i / size))));
    return map;
  }

  function validateGroups(teams, size = 4) {
    const groups = {}; let missing = 0;
    teams.forEach(t => { if (!t.grp) missing++; else (groups[t.grp] = groups[t.grp] || []).push(t.id); });
    const names = Object.keys(groups).sort();
    const bad = names.filter(n => groups[n].length !== size);
    let msg = "";
    if (teams.length < size) msg = `Cadastre ao menos ${size} clubes.`;
    else if (missing) msg = `${missing} clube(s) sem grupo. Use "Sortear grupos" na aba Campeonato.`;
    else if (bad.length) msg = `Cada grupo precisa ter exatamente ${size} clubes (ajuste: ${bad.join(", ")}).`;
    return { ok: !msg, msg, groups, names };
  }

  /* ---- Todos contra todos (método do círculo) ---- */
  function roundRobin(ids) {
    const t = [...ids]; if (t.length % 2) t.push(null);
    const n = t.length, rounds = [];
    for (let r = 0; r < n - 1; r++) {
      const pairs = [];
      for (let i = 0; i < n / 2; i++) {
        const a = t[i], b = t[n - 1 - i];
        if (a && b) pairs.push(Math.random() < 0.5 ? [a, b] : [b, a]);
      }
      rounds.push(pairs);
      t.splice(1, 0, t.pop());
    }
    return rounds;
  }

  const baseMatch = (o) => ({
    stage: "grupos", grp: "", phase: "Fase de grupos", phase_no: 0, round: 1, date: null,
    home_id: null, away_id: null, home_score: null, away_score: null, home_pen: null, away_pen: null,
    status: "nao_iniciado", notes: "", ...o
  });

  /* Sorteia os confrontos e agenda até 4 partidas por dia.
     Cada clube precisa descansar pelo menos um dia entre partidas. */
  function groupMatches(teams, { legs = "ida", start = null } = {}) {
    const groups = {};
    teams.forEach(t => { if (t.grp) (groups[t.grp] = groups[t.grp] || []).push(t.id); });
    const names = Object.keys(groups).sort();
    const per = {};
    names.forEach(g => {
      let rounds = roundRobin(shuffle(groups[g]));
      if (legs === "ida-volta") rounds = rounds.concat(rounds.map(r => r.map(([a, b]) => [b, a])));
      per[g] = rounds;
    });

    const maxR = Math.max(0, ...names.map(g => per[g].length));
    const pending = [];
    for (let r = 0; r < maxR; r++) {
      names.forEach(g => (per[g][r] || []).forEach(([h, a]) => pending.push({ grp: g, h, a, round: r + 1 })));
    }

    const times = ["08:00", "10:00", "14:00", "16:00"];
    const lastPlayed = new Map();
    const out = [];
    let dayOffset = 0;
    const firstDay = start ? new Date(start.length === 10 ? start + "T00:00:00" : start) : null;
    if (firstDay && Number.isNaN(firstDay.getTime())) throw new Error("Data inicial inválida.");

    while (pending.length) {
      const playedToday = new Set();
      let slot = 0;
      while (slot < times.length) {
        const idx = pending.findIndex(game =>
          !playedToday.has(game.h) && !playedToday.has(game.a) &&
          lastPlayed.get(game.h) !== dayOffset - 1 &&
          lastPlayed.get(game.a) !== dayOffset - 1
        );
        if (idx < 0) break;
        const [game] = pending.splice(idx, 1);
        let date = null;
        if (firstDay) {
          const d = new Date(firstDay);
          d.setDate(d.getDate() + dayOffset);
          const [hh, mm] = times[slot].split(":").map(Number);
          d.setHours(hh, mm, 0, 0);
          date = fmtLocal(d);
        }
        out.push(baseMatch({ grp: game.grp, round: game.round, date, home_id: game.h, away_id: game.a }));
        playedToday.add(game.h); playedToday.add(game.a);
        lastPlayed.set(game.h, dayOffset); lastPlayed.set(game.a, dayOffset);
        slot++;
      }
      if (pending.length) dayOffset++;
    }
    return out;
  }

  /* ---- Mata-mata ---- */
  function phaseLabel(slots) {
    return { 2: "Final", 4: "Semifinal", 8: "Quartas de final", 16: "Oitavas de final", 32: "16-avos de final" }[slots] || `Fase de ${slots}`;
  }

  /* Primeira fase. q = [{id, grp, rank, p, sg, gp}]. fromGroups: usa o desempenho na fase de grupos;
     senão, sorteio puro. Se o nº de clubes não for potência de 2, os melhores recebem "bye". */
  function koFirstRound(q, fromGroups) {
    const n = q.length, size = pow2ceil(n), byeCount = size - n;
    const seeds = fromGroups
      ? [...q].sort((a, b) => a.rank - b.rank || b.p - a.p || b.sg - a.sg || b.gp - a.gp)
      : shuffle(q);
    const byes = seeds.slice(0, byeCount).map(x => x.id);
    const playing = seeds.slice(byeCount);
    const groups = [...new Set(q.map(x => x.grp))].sort();
    const cross = fromGroups && byeCount === 0 && groups.length >= 2 && groups.length % 2 === 0 &&
      q.length === groups.length * 2 && q.every(x => x.rank <= 2);
    const pairs = [];
    if (cross) {
      const get = (g, r) => q.find(x => x.grp === g && x.rank === r).id;
      for (let i = 0; i < groups.length; i += 2) {
        const A = groups[i], B = groups[i + 1];
        pairs.push([get(A, 1), get(B, 2)], [get(B, 1), get(A, 2)]);   // 1º de um grupo x 2º do outro
      }
    } else {
      for (let i = 0; i < playing.length / 2; i++) pairs.push([playing[i].id, playing[playing.length - 1 - i].id]);
      if (fromGroups) {
        /* evita reencontro de clubes do mesmo grupo na 1ª fase, quando possível */
        const gOf = (id) => (q.find(x => x.id === id) || {}).grp;
        pairs.forEach((p, i) => {
          if (gOf(p[0]) !== gOf(p[1])) return;
          for (let j = 0; j < pairs.length; j++) {
            if (j === i) continue;
            if (gOf(p[0]) !== gOf(pairs[j][1]) && gOf(pairs[j][0]) !== gOf(p[1])) { [p[1], pairs[j][1]] = [pairs[j][1], p[1]]; break; }
          }
        });
      }
    }
    return { pairs, byes, size };
  }

  /* Fases seguintes: vencedores (e clubes que folgaram). */
  function koNextRound(teamIds, hasByes) {
    const pairs = [];
    if (hasByes) for (let i = 0; i < teamIds.length / 2; i++) pairs.push([teamIds[i], teamIds[teamIds.length - 1 - i]]);
    else for (let i = 0; i + 1 < teamIds.length; i += 2) pairs.push([teamIds[i], teamIds[i + 1]]);
    return pairs;
  }

  const koMatches = (pairs, { phase, phase_no, round }) =>
    pairs.map(([h, a]) => baseMatch({ stage: "mata-mata", grp: "", phase, phase_no, round, home_id: h, away_id: a }));

  window.Tournament = { shuffle, drawGroups, validateGroups, roundRobin, groupMatches, phaseLabel, koFirstRound, koNextRound, koMatches, baseMatch, fmtLocal, groupName };
})();
