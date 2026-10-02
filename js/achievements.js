/* ============================================================
   NEON SOUL - achievements.js
   26 achievements. Ach.check() is cheap and called on events.
   Each unlock pays out coins + shards.
   ============================================================ */
(function (NS) {
  "use strict";
  var Save = NS.Save;

  // r = live run stats (NS.Game.stats) or {} outside a run
  var LIST = [
    { id: "first_blood", name: "PRIMERA SANGRE", ico: "⚔", desc: "Elimina a tu primer enemigo",
      test: function (s) { return s.kills >= 1; }, coins: 50 },
    { id: "first_step", name: "PRIMER PASO", ico: "➤", desc: "Despeja tu primera sala",
      test: function (s) { return s.roomsCleared >= 1; }, coins: 60 },
    { id: "no_fear", name: "SIN MIEDO", ico: "☠", desc: "Derrota a un enemigo élite",
      test: function (s) { return s.eliteKills >= 1; }, coins: 120 },
    { id: "combo20", name: "COMBO X20", ico: "≋", desc: "Alcanza un combo de 20",
      test: function (s) { return s.bestCombo >= 20; }, coins: 180 },
    { id: "combo50", name: "IMPARABLE", ico: "⚡", desc: "Alcanza un combo de 50",
      test: function (s) { return s.bestCombo >= 50; }, coins: 400, shards: 2 },
    { id: "slayer", name: "MATADOR", ico: "⚔", desc: "Elimina 250 enemigos",
      test: function (s) { return s.kills >= 250; }, coins: 300 },
    { id: "slayer2", name: "EXTERMINIO", ico: "☠", desc: "Elimina 1500 enemigos",
      test: function (s) { return s.kills >= 1500; }, coins: 900, shards: 4 },
    { id: "survivor", name: "SOBREVIVIENTE", ico: "⌛", desc: "Sobrevive 5 minutos en una incursión",
      test: function (s, r) { return (r.time || 0) >= 300; }, coins: 250 },
    { id: "shift_master", name: "MAESTRO DEL SOUL SHIFT", ico: "◐", desc: "Cambia de estado 30 veces en una incursión",
      test: function (s, r) { return (r.shifts || 0) >= 30; }, coins: 300, shards: 1 },
    { id: "unstoppable", name: "INTOCABLE", ico: "⛨", desc: "Despeja una sala sin recibir daño",
      test: function (s, r) { return (r.perfectRooms || 0) >= 1; }, coins: 150 },
    { id: "perfect5", name: "PERFECCIONISTA", ico: "✦", desc: "5 salas perfectas en una incursión",
      test: function (s, r) { return (r.perfectRooms || 0) >= 5; }, coins: 450, shards: 2 },
    { id: "chaos", name: "CAOS", ico: "☢", desc: "Elimina 10 enemigos en 3 segundos",
      test: function (s, r) { return (r.chaosPeak || 0) >= 10; }, coins: 300, shards: 1 },
    { id: "boss1", name: "CAZADOR", ico: "☉", desc: "Derrota a tu primer jefe",
      test: function (s) { return s.bossKills >= 1; }, coins: 250, shards: 1 },
    { id: "boss5", name: "MATAJEFES", ico: "☉", desc: "Derrota a 5 jefes",
      test: function (s) { return s.bossKills >= 5; }, coins: 700, shards: 3 },
    { id: "untouchable_boss", name: "SIN UN RASGUÑO", ico: "✳", desc: "Derrota a un jefe sin recibir daño",
      test: function (s, r) { return (r.perfectBoss || 0) >= 1; }, coins: 800, shards: 4 },
    { id: "zone3", name: "EXPLORADOR", ico: "◈", desc: "Llega a la ZONA 3",
      test: function (s) { return s.bestZone >= 3; }, coins: 300 },
    { id: "nexus_king", name: "REY DEL NEXUS", ico: "♛", desc: "Completa las 5 zonas",
      test: function (s) { return s.wins >= 1; }, coins: 2500, shards: 15 },
    { id: "rich", name: "MAGNATE", ico: "◆", desc: "Acumula 5.000 monedas en total",
      test: function (s) { return s.totalCoins >= 5000; }, coins: 400 },
    { id: "detonator", name: "DETONADOR", ico: "✹", desc: "Detona 10 marcas de un solo golpe",
      test: function (s, r) { return (r.bestDeto || 0) >= 10; }, coins: 350, shards: 2 },
    { id: "soul_eater", name: "DEVORA-ALMAS", ico: "◑", desc: "Detona marcas 500 veces",
      test: function (s) { return s.detonations >= 500; }, coins: 800, shards: 4 },
    { id: "speed_demon", name: "VELOCIDAD PURA", ico: "»", desc: "Realiza 200 esquivas",
      test: function (s) { return s.dashes >= 200; }, coins: 300 },
    { id: "collector", name: "COLECCIONISTA", ico: "✵", desc: "Desbloquea 3 personajes",
      test: function (s) { var n = 0; for (var k in Save.data.chars) if (Save.data.chars[k]) n++; return n >= 3; }, coins: 500, shards: 2 },
    { id: "builder", name: "ARQUITECTO", ico: "⚙", desc: "Consigue 15 mejoras en una incursión",
      test: function (s, r) { return (r.upgrades || 0) >= 15; }, coins: 350 },
    { id: "legend", name: "LEYENDA VIVA", ico: "★", desc: "Consigue una mejora LEGENDARIA",
      test: function (s, r) { return (r.legendaries || 0) >= 1; }, coins: 400, shards: 2 },
    { id: "glass", name: "CAÑÓN DE CRISTAL", ico: "◉", desc: "Supera +150% de daño en una incursión",
      test: function (s, r) { return (r.maxDmgMul || 1) >= 2.5; }, coins: 450, shards: 2 },
    { id: "marathon", name: "MARATÓN", ico: "∞", desc: "Juega 25 incursiones",
      test: function (s) { return s.runs >= 25; }, coins: 600, shards: 3 },
    { id: "apex", name: "CIMA DEL NEXUS", ico: "☢", desc: "Consigue 50.000 puntos",
      test: function (s) { return s.bestScore >= 50000; }, coins: 1200, shards: 6 }
  ];

  var A = {
    LIST: LIST,
    count: LIST.length,
    unlocked: function (id) { return !!Save.data.ach[id]; },
    total: function () {
      var n = 0;
      for (var i = 0; i < LIST.length; i++) if (Save.data.ach[LIST[i].id]) n++;
      return n;
    },
    check: function (runStats) {
      var r = runStats || (NS.Game && NS.Game.stats) || {};
      var s = Save.data.stats;
      var got = [];
      for (var i = 0; i < LIST.length; i++) {
        var a = LIST[i];
        if (Save.data.ach[a.id]) continue;
        var ok = false;
        try { ok = a.test(s, r); } catch (e) { ok = false; }
        if (ok) {
          Save.data.ach[a.id] = 1;
          if (a.coins) Save.addCoins(a.coins);
          if (a.shards) Save.addShards(a.shards);
          got.push(a);
        }
      }
      if (got.length) {
        Save.save();
        got.forEach(function (a, i) {
          setTimeout(function () {
            NS.UI.popup("LOGRO", a.name);
            NS.Audio.sfx("unlock");
          }, i * 900);
        });
      }
      return got;
    }
  };

  NS.Ach = A;
})(window.NS);
