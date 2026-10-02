/* ============================================================
   NEON SOUL - missions.js
   Daily missions (reroll every day) + permanent missions.
   Progress is driven by Missions.event(type, amount).
   ============================================================ */
(function (NS) {
  "use strict";
  var U = NS.U, Save = NS.Save;

  // event types: kill, eliteKill, bossKill, coin, room, shift, deto, combo,
  //              zone, run, upgrade, dash, survive(seconds), win, damage
  var DAILY_TMPL = [
    { id: "d_kill", ev: "kill", goals: [60, 90, 140], txt: function (g) { return "Derrota a " + g + " enemigos"; }, rw: { coins: 220, xp: 90 } },
    { id: "d_coin", ev: "coin", goals: [300, 500, 800], txt: function (g) { return "Consigue " + g + " monedas en incursiones"; }, rw: { coins: 260, xp: 80 } },
    { id: "d_time", ev: "survive", goals: [180, 300, 480], txt: function (g) { return "Sobrevive " + Math.round(g / 60) + " minutos en total"; }, rw: { coins: 240, xp: 110 } },
    { id: "d_shift", ev: "shift", goals: [25, 40, 60], txt: function (g) { return "Usa Soul Shift " + g + " veces"; }, rw: { coins: 200, xp: 100 } },
    { id: "d_deto", ev: "deto", goals: [20, 35, 55], txt: function (g) { return "Detona marcas " + g + " veces"; }, rw: { coins: 280, xp: 120 } },
    { id: "d_room", ev: "room", goals: [8, 12, 18], txt: function (g) { return "Despeja " + g + " salas"; }, rw: { coins: 230, xp: 95 } },
    { id: "d_elite", ev: "eliteKill", goals: [3, 5, 8], txt: function (g) { return "Elimina " + g + " élites"; }, rw: { coins: 300, xp: 130 } },
    { id: "d_combo", ev: "combo", goals: [15, 22, 30], txt: function (g) { return "Alcanza un combo de x" + g; }, rw: { coins: 260, xp: 110 }, best: true },
    { id: "d_boss", ev: "bossKill", goals: [1, 2, 3], txt: function (g) { return "Derrota a " + g + " jefe(s)"; }, rw: { coins: 420, shards: 2, xp: 200 } },
    { id: "d_up", ev: "upgrade", goals: [12, 18, 26], txt: function (g) { return "Obtén " + g + " mejoras en partida"; }, rw: { coins: 210, xp: 90 } }
  ];

  var PERM = [
    { id: "p_boss1", ev: "bossKill", goal: 1, txt: "Derrota a tu primer jefe", rw: { coins: 500, shards: 3, xp: 250 } },
    { id: "p_combo20", ev: "combo", goal: 20, best: true, txt: "Consigue un combo de x20", rw: { coins: 400, shards: 2, xp: 200 } },
    { id: "p_char", ev: "charUnlock", goal: 1, txt: "Desbloquea un personaje nuevo", rw: { coins: 600, shards: 3, xp: 300 } },
    { id: "p_score", ev: "score", goal: 25000, best: true, txt: "Alcanza 25.000 puntos en una partida", rw: { coins: 800, shards: 4, xp: 400 } },
    { id: "p_kill500", ev: "kill", goal: 500, txt: "Elimina 500 enemigos", rw: { coins: 700, shards: 3, xp: 350 } },
    { id: "p_zone3", ev: "zone", goal: 3, best: true, txt: "Llega a la ZONA 3", rw: { coins: 550, shards: 3, xp: 260 } },
    { id: "p_zone5", ev: "zone", goal: 5, best: true, txt: "Llega al NEXUS CORE (zona 5)", rw: { coins: 1200, shards: 6, xp: 600 } },
    { id: "p_win", ev: "win", goal: 1, txt: "Completa una incursión entera", rw: { coins: 2000, shards: 12, xp: 1200 } },
    { id: "p_deto100", ev: "deto", goal: 150, txt: "Detona marcas 150 veces", rw: { coins: 650, shards: 3, xp: 320 } },
    { id: "p_elite25", ev: "eliteKill", goal: 25, txt: "Elimina 25 élites", rw: { coins: 720, shards: 4, xp: 360 } },
    { id: "p_runs20", ev: "run", goal: 20, txt: "Juega 20 incursiones", rw: { coins: 900, shards: 4, xp: 420 } },
    { id: "p_coins10k", ev: "coin", goal: 10000, txt: "Acumula 10.000 monedas", rw: { coins: 1000, shards: 5, xp: 500 } }
  ];

  function today() {
    var d = new Date();
    return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();
  }

  var Mi = {
    PERM: PERM,

    ensure: function () {
      var m = Save.data.missions;
      if (m.day !== today() || !m.daily || !m.daily.length) {
        m.day = today();
        var tmpls = U.pickMany(DAILY_TMPL, 3);
        m.daily = tmpls.map(function (t) {
          var tier = U.randInt(0, t.goals.length - 1);
          var g = t.goals[tier];
          return {
            id: t.id, ev: t.ev, goal: g, prog: 0, done: false, claimed: false,
            best: !!t.best, txt: t.txt(g),
            rw: { coins: Math.round(t.rw.coins * (1 + tier * 0.35)), shards: t.rw.shards || 0, xp: Math.round((t.rw.xp || 0) * (1 + tier * 0.3)) }
          };
        });
        Save.save();
      }
      if (!m.perm || !m.perm.length) {
        m.perm = PERM.map(function (p) {
          return { id: p.id, ev: p.ev, goal: p.goal, prog: 0, done: false, claimed: false, best: !!p.best, txt: p.txt, rw: p.rw };
        });
        Save.save();
      } else if (m.perm.length !== PERM.length) {
        // new missions added in an update: append the missing ones
        PERM.forEach(function (p) {
          if (!m.perm.some(function (x) { return x.id === p.id; })) {
            m.perm.push({ id: p.id, ev: p.ev, goal: p.goal, prog: 0, done: false, claimed: false, best: !!p.best, txt: p.txt, rw: p.rw });
          }
        });
        Save.save();
      }
      return m;
    },

    event: function (type, amount) {
      amount = amount === undefined ? 1 : amount;
      var m = Mi.ensure();
      var changed = false;
      [m.daily, m.perm].forEach(function (arr) {
        arr.forEach(function (q) {
          if (q.done || q.ev !== type) return;
          if (q.best) { if (amount > q.prog) { q.prog = amount; changed = true; } }
          else { q.prog += amount; changed = true; }
          if (q.prog >= q.goal) {
            q.prog = q.goal;
            q.done = true;
            NS.UI.popup("MISIÓN", q.txt);
            NS.Audio.sfx("unlock");
          }
        });
      });
      if (changed) Save.saveSoon();
      NS.UI.refreshBadges();
    },

    claim: function (kind, id) {
      var m = Mi.ensure();
      var arr = kind === "daily" ? m.daily : m.perm;
      for (var i = 0; i < arr.length; i++) {
        var q = arr[i];
        if (q.id !== id) continue;
        if (!q.done || q.claimed) return false;
        q.claimed = true;
        if (q.rw.coins) Save.addCoins(q.rw.coins);
        if (q.rw.shards) Save.addShards(q.rw.shards);
        if (q.rw.xp) {
          var ups = Save.addXp(q.rw.xp);
          if (ups) NS.UI.popup("NIVEL " + Save.data.level, "+ " + (ups * 2) + " fragmentos");
        }
        Save.save();
        NS.Audio.sfx("coin");
        return true;
      }
      return false;
    },

    pending: function () {
      var m = Mi.ensure(), n = 0;
      m.daily.forEach(function (q) { if (q.done && !q.claimed) n++; });
      m.perm.forEach(function (q) { if (q.done && !q.claimed) n++; });
      return n;
    },

    timeToReset: function () {
      var now = new Date();
      var end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0);
      return Math.max(0, (end - now) / 1000);
    }
  };

  NS.Missions = Mi;
})(window.NS);
