/* ============================================================
   NEON SOUL - levels.js
   Zone definitions: palette, enemy pools, hazards, bosses
   -> To add/modify a zone: edit NS.Levels.zones
   ============================================================ */
(function (NS) {
  "use strict";

  var zones = [
    {
      id: 1, name: "NEON DISTRICT", sub: "Distrito comercial colapsado",
      rooms: 5,
      palette: {
        bg0: "#07050f", bg1: "#120a24", grid: "rgba(37,224,255,.10)",
        wall: "#25e0ff", accent: "#ff2fb9", fog: "rgba(37,224,255,.05)"
      },
      enemies: ["runner", "shooter", "hunter"],
      lateEnemies: ["bomber"],
      hazards: ["pylon"],
      miniboss: "elite",
      boss: "watcher",
      hpMul: 1, dmgMul: 1, spawnMul: 1
    },
    {
      id: 2, name: "DEAD MARKET", sub: "Bazar de datos podridos",
      rooms: 5,
      palette: {
        bg0: "#080610", bg1: "#1a1206", grid: "rgba(255,197,61,.09)",
        wall: "#ffc53d", accent: "#3dffa8", fog: "rgba(255,197,61,.05)"
      },
      enemies: ["runner", "shooter", "bomber", "leech"],
      lateEnemies: ["hunter", "guardian"],
      hazards: ["pylon", "spikes"],
      miniboss: "elite",
      boss: "broker",
      hpMul: 1.35, dmgMul: 1.18, spawnMul: 1.12
    },
    {
      id: 3, name: "INDUSTRIAL HELL", sub: "Fundición del Nexus",
      rooms: 6,
      palette: {
        bg0: "#0b0508", bg1: "#26090a", grid: "rgba(255,90,40,.10)",
        wall: "#ff5a28", accent: "#ffc53d", fog: "rgba(255,58,85,.06)"
      },
      enemies: ["runner", "tank", "guardian", "bomber", "shooter"],
      lateEnemies: ["berserker", "leech"],
      hazards: ["vent", "spikes", "pylon"],
      miniboss: "elite",
      boss: "forge",
      hpMul: 1.85, dmgMul: 1.4, spawnMul: 1.22
    },
    {
      id: 4, name: "SKY RUINS", sub: "Plataformas suspendidas",
      rooms: 6,
      palette: {
        bg0: "#06060f", bg1: "#150c2e", grid: "rgba(155,92,255,.12)",
        wall: "#9b5cff", accent: "#bff6ff", fog: "rgba(155,92,255,.06)"
      },
      enemies: ["phantom", "hunter", "shooter", "berserker", "runner"],
      lateEnemies: ["tank", "guardian", "leech"],
      hazards: ["void", "pylon"],
      miniboss: "elite",
      boss: "valkyr",
      hpMul: 2.5, dmgMul: 1.65, spawnMul: 1.3
    },
    {
      id: 5, name: "NEXUS CORE", sub: "El corazón que lo devora todo",
      rooms: 6,
      palette: {
        bg0: "#0a0410", bg1: "#2a0630", grid: "rgba(255,47,185,.13)",
        wall: "#ff2fb9", accent: "#ffffff", fog: "rgba(255,47,185,.07)"
      },
      enemies: ["runner", "shooter", "hunter", "bomber", "phantom", "leech", "guardian", "tank", "berserker"],
      lateEnemies: ["phantom", "berserker", "guardian"],
      hazards: ["beam", "vent", "void"],
      miniboss: "elite",
      boss: "avatar",
      hpMul: 3.4, dmgMul: 1.95, spawnMul: 1.42
    }
  ];

  var L = {
    zones: zones,
    count: zones.length,
    get: function (i) {
      if (i <= zones.length) return zones[i - 1];
      // endless mode: recycle the core with escalating numbers
      var base = zones[zones.length - 1];
      var over = i - zones.length;
      return {
        id: i, name: "NEXUS OVERLOAD " + over, sub: "Bucle infinito",
        rooms: 6, palette: base.palette,
        enemies: base.enemies, lateEnemies: base.lateEnemies, hazards: base.hazards,
        miniboss: "elite", boss: ["avatar", "watcher", "forge", "valkyr", "broker"][over % 5],
        hpMul: base.hpMul * (1 + over * 0.85),
        dmgMul: base.dmgMul * (1 + over * 0.32),
        spawnMul: base.spawnMul * (1 + over * 0.1),
        endless: true
      };
    },
    // global difficulty curve applied on top of zone multipliers
    curve: function (zone, roomIdx) {
      return 1 + (zone - 1) * 0.06 + roomIdx * 0.035;
    }
  };

  NS.Levels = L;
})(window.NS);
