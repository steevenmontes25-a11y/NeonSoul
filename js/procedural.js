/* ============================================================
   NEON SOUL - procedural.js
   Run map generation + room layout + wave composition.
   Guarantees: every step is completable, arena never sealed,
   spawn point always clear.
   ============================================================ */
(function (NS) {
  "use strict";
  var U = NS.U;

  var COST = {
    runner: 1, shooter: 1.5, hunter: 2, bomber: 1.6, leech: 2,
    phantom: 3, guardian: 3, tank: 4, berserker: 3, sentry: 2
  };

  var NODE_INFO = {
    combat: { name: "COMBATE", ico: "⚔", desc: "Enemigos + mejora" },
    elite: { name: "ÉLITE", ico: "☠", desc: "Enemigo poderoso, gran recompensa" },
    event: { name: "ANOMALÍA", ico: "⚙", desc: "Suceso impredecible" },
    shop: { name: "MERCADER", ico: "⛁", desc: "Gasta tus monedas" },
    rest: { name: "SANTUARIO", ico: "✚", desc: "Recupera vida y alma" },
    treasure: { name: "RELIQUIA", ico: "◈", desc: "Mejora garantizada" },
    miniboss: { name: "GUARDIÁN", ico: "☉", desc: "Miniboss de la zona" },
    boss: { name: "JEFE", ico: "☢", desc: "El señor de la zona" }
  };

  var Pr = {
    NODE_INFO: NODE_INFO,

    /* Build the list of steps for a zone. Each step = array of node choices. */
    buildZoneMap: function (zoneDef, rng) {
      var steps = [];
      var n = zoneDef.rooms;
      var usedShop = false, usedRest = false;
      for (var i = 0; i < n; i++) {
        var choices = [];
        var isMini = (i === n - 2);
        if (isMini) {
          // guardian step: always the miniboss, but let the player pick the flavour
          choices.push({ type: "miniboss", tag: "elite" });
          choices.push({ type: "miniboss", tag: "double" });
        } else {
          // first choice is always a fight -> guarantees progress
          choices.push({ type: rng.chance(0.22) ? "elite" : "combat" });
          var pool = ["combat", "event", "treasure"];
          if (!usedShop && i >= 1) pool.push("shop");
          if (!usedRest && i >= 2) pool.push("rest");
          var second = rng.pick(pool);
          if (second === "shop") usedShop = true;
          if (second === "rest") usedRest = true;
          choices.push({ type: second });
          if (rng.chance(0.55)) {
            var third = rng.pick(["combat", "event", "elite", "treasure", "rest"]);
            if (third === "rest" && usedRest) third = "combat";
            if (third === "rest") usedRest = true;
            choices.push({ type: third });
          }
        }
        steps.push(choices);
      }
      steps.push([{ type: "boss" }]);
      return steps;
    },

    /* Obstacle layout for a room. arena = {x,y,w,h,cx,cy} */
    makeRoom: function (opts) {
      var rng = opts.rng, arena = opts.arena, zone = opts.zone;
      var obstacles = [];
      var isBoss = opts.nodeType === "boss";
      var isCalm = opts.nodeType === "shop" || opts.nodeType === "rest" || opts.nodeType === "event";

      var count = isBoss ? rng.int(0, 2) : (isCalm ? rng.int(0, 2) : rng.int(2, 6));
      var minD = 150;                       // keep away from the player spawn (center)
      var tries = 0;

      while (obstacles.length < count && tries++ < 120) {
        var kind = rng.pick(zone.hazards.concat(["pylon", "pylon"]));
        if (isBoss && (kind === "beam" || kind === "vent")) kind = "pylon";
        var r = kind === "pylon" ? rng.range(26, 52) : rng.range(34, 60);
        var x = rng.range(arena.x + r + 70, arena.x + arena.w - r - 70);
        var y = rng.range(arena.y + r + 70, arena.y + arena.h - r - 70);
        if (U.dist(x, y, arena.cx, arena.cy) < minD + r) continue;
        var ok = true;
        for (var i = 0; i < obstacles.length; i++) {
          if (U.dist(x, y, obstacles[i].x, obstacles[i].y) < r + obstacles[i].r + 90) { ok = false; break; }
        }
        if (!ok) continue;
        obstacles.push(makeObstacle(kind, x, y, r, rng, zone));
      }

      return {
        obstacles: obstacles,
        waves: isBoss || isCalm ? [] : Pr.makeWaves(opts)
      };
    },

    /* Wave composition with a difficulty budget. */
    makeWaves: function (opts) {
      var rng = opts.rng, zone = opts.zone, idx = opts.roomIdx, type = opts.nodeType;
      var pool = zone.enemies.slice();
      if (idx >= 2 && zone.lateEnemies) pool = pool.concat(zone.lateEnemies);

      var budget = (5 + zone.id * 3.4 + idx * 2.2) * (zone.spawnMul || 1);
      if (type === "elite") budget *= 0.75;
      if (type === "miniboss") budget *= 0.9;

      var waveCount = type === "miniboss" ? 2 : (idx >= 3 ? 3 : 2);
      var waves = [];
      for (var w = 0; w < waveCount; w++) {
        var wb = budget * (w === 0 ? 0.55 : (w === 1 ? 0.75 : 0.95));
        var list = [];
        var guard = 0;
        while (wb > 0.9 && guard++ < 40) {
          var t = rng.pick(pool);
          var c = COST[t] || 2;
          if (c > wb + 0.6) continue;
          list.push(t);
          wb -= c;
        }
        if (!list.length) list.push("runner");
        waves.push(list);
      }

      // special guests
      if (type === "elite") waves[waves.length - 1].elite = rng.pick(pool);
      if (type === "miniboss") waves[waves.length - 1].elite = rng.pick(pool.concat(["tank", "berserker", "guardian"]));

      return waves;
    },

    /* Random spawn position at a safe distance from the player. */
    spawnPos: function (arena, px, py, rng, minDist) {
      minDist = minDist || 190;
      for (var i = 0; i < 40; i++) {
        var x = (rng ? rng.range(arena.x + 60, arena.x + arena.w - 60) : U.rand(arena.x + 60, arena.x + arena.w - 60));
        var y = (rng ? rng.range(arena.y + 60, arena.y + arena.h - 60) : U.rand(arena.y + 60, arena.y + arena.h - 60));
        if (U.dist(x, y, px, py) > minDist) return { x: x, y: y };
      }
      return { x: arena.x + arena.w * 0.15, y: arena.y + arena.h * 0.15 };
    }
  };

  function makeObstacle(kind, x, y, r, rng, zone) {
    var o = {
      kind: kind, x: x, y: y, r: r, solid: true, dps: 0, t: rng.range(0, 6),
      color: zone.palette.wall, active: true, phase: rng.range(0, 6.28)
    };
    if (kind === "spikes") { o.solid = false; o.dps = 14; o.color = "#ff3a55"; }
    else if (kind === "vent") { o.solid = false; o.dps = 0; o.color = "#ff8a3d"; o.cycle = rng.range(2.6, 4.2); }
    else if (kind === "void") { o.solid = true; o.void = true; o.color = "#0a0614"; }
    else if (kind === "beam") {
      o.solid = false; o.color = "#ff2fb9"; o.len = rng.range(160, 280);
      o.speed = rng.range(0.4, 0.9) * (rng.chance(0.5) ? 1 : -1); o.angle = rng.range(0, 6.28);
      o.r = 18;
    }
    return o;
  }

  NS.Proc = Pr;
})(window.NS);
