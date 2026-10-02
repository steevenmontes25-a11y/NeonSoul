/* ============================================================
   NEON SOUL - characters.js
   Playable characters: stats, abilities, Soul Shift variants, art
   -> To add a character: push a new entry into NS.Chars.list
   ============================================================ */
(function (NS) {
  "use strict";
  var U = NS.U;

  /* Base stat reference (100 hp, 250 speed, 10 dmg = the baseline).
     attackRate is SECONDS between shots (lower = faster). */
  var list = [
    {
      id: "soulrunner",
      name: "SOULRUNNER",
      role: "EQUILIBRADO",
      desc: "El primer despertado. Sin debilidades claras, domina el ritmo entre ALMA y FURIA.",
      colors: { main: "#25e0ff", glow: "#9b5cff", trail: "#25e0ff" },
      price: 0,
      unlockNote: "Disponible desde el inicio",
      stats: {
        maxHp: 100, speed: 252, damage: 10, attackRate: 0.27, critChance: 0.08, critMult: 2,
        projectiles: 1, projSpeed: 620, range: 430, soulMax: 100, soulRegen: 13, soulDrain: 15,
        dashCd: 1.05, dashCharges: 2, abilityCd: 7, armor: 0, pickupRange: 95
      },
      bars: { vida: 0.6, dano: 0.55, velocidad: 0.6, tecnica: 0.7 },
      ability: {
        name: "PULSO NEXUS",
        desc: "Onda expansiva que empuja y daña a todo alrededor. En FURIA detona todas las marcas cercanas.",
        icon: "◎"
      },
      shift: {
        name: "EQUILIBRIO",
        desc: "ALMA: +45% velocidad, marcas normales. FURIA: +55% daño. Cambio barato."
      },
      mods: { markPerHit: 1, detoMult: 1, soulSpeed: 1.45, furyDmg: 1.55, shiftCost: 12 }
    },
    {
      id: "vela",
      name: "VELA",
      role: "VELOZ",
      desc: "Cazadora de datos. Golpea rápido y flojo, pero marca a todo el mundo antes de que reaccione.",
      colors: { main: "#3dffa8", glow: "#25e0ff", trail: "#3dffa8" },
      price: 2600,
      unlockNote: "Se desbloquea al alcanzar la ZONA 3",
      unlock: function (save) { return save.stats.bestZone >= 3; },
      stats: {
        maxHp: 78, speed: 306, damage: 7.2, attackRate: 0.185, critChance: 0.14, critMult: 2,
        projectiles: 1, projSpeed: 720, range: 400, soulMax: 120, soulRegen: 15, soulDrain: 11,
        dashCd: 0.72, dashCharges: 3, abilityCd: 5.5, armor: -0.08, pickupRange: 130
      },
      bars: { vida: 0.32, dano: 0.36, velocidad: 0.95, tecnica: 0.8 },
      ability: {
        name: "ECO FANTASMA",
        desc: "Se desvanece y reaparece atravesando a los enemigos, marcando a todos los que cruza.",
        icon: "✵"
      },
      shift: {
        name: "DISOLUCIÓN",
        desc: "ALMA: aplica 2 marcas por golpe y gasta menos alma. FURIA: las detonaciones encadenan."
      },
      mods: { markPerHit: 2, detoMult: 0.85, detoChain: true, soulSpeed: 1.6, furyDmg: 1.4, shiftCost: 8 }
    },
    {
      id: "brutus",
      name: "BRUTUS",
      role: "DEMOLEDOR",
      desc: "Chatarra de guerra reanimada. Lento, enorme y capaz de borrar una sala de un solo estallido.",
      colors: { main: "#ff8a3d", glow: "#ff3a55", trail: "#ff8a3d" },
      price: 4200,
      unlockNote: "Se desbloquea derrotando 2 jefes distintos",
      unlock: function (save) { return save.stats.bossKills >= 2; },
      stats: {
        maxHp: 148, speed: 206, damage: 16.5, attackRate: 0.44, critChance: 0.05, critMult: 2.3,
        projectiles: 1, projSpeed: 540, range: 400, soulMax: 90, soulRegen: 11, soulDrain: 17,
        dashCd: 1.5, dashCharges: 1, abilityCd: 9, armor: 0.14, pickupRange: 90
      },
      bars: { vida: 0.95, dano: 0.92, velocidad: 0.28, tecnica: 0.45 },
      ability: {
        name: "IMPACTO SÍSMICO",
        desc: "Golpea el suelo: daño masivo en área, aturde y genera esquirlas de placa.",
        icon: "▣"
      },
      shift: {
        name: "SOBRECARGA",
        desc: "ALMA: gana escudo al entrar. FURIA: +95% daño y detonaciones con radio enorme."
      },
      mods: { markPerHit: 1, detoMult: 1.5, detoRadius: 1.6, soulSpeed: 1.3, furyDmg: 1.95, shiftCost: 16, soulShield: 22 }
    },
    {
      id: "nullecho",
      name: "NULL//ECHO",
      role: "ANÓMALO",
      desc: "Algo que el NEXUS copió mal. Vive con poca vida pero convierte cada marca en un desastre.",
      colors: { main: "#ff2fb9", glow: "#ffffff", trail: "#ff2fb9" },
      price: 9000,
      unlockNote: "Se desbloquea completando la ZONA 5",
      unlock: function (save) { return save.stats.wins >= 1; },
      stats: {
        maxHp: 64, speed: 274, damage: 11.5, attackRate: 0.25, critChance: 0.2, critMult: 2.6,
        projectiles: 1, projSpeed: 660, range: 440, soulMax: 140, soulRegen: 18, soulDrain: 9,
        dashCd: 0.9, dashCharges: 2, abilityCd: 6.5, armor: -0.15, pickupRange: 150
      },
      bars: { vida: 0.18, dano: 0.7, velocidad: 0.75, tecnica: 1 },
      ability: {
        name: "COLAPSO",
        desc: "Crea una singularidad que atrae enemigos y proyectiles, y luego revienta.",
        icon: "◉"
      },
      shift: {
        name: "PARADOJA",
        desc: "ALMA: 3 marcas por golpe. FURIA: detonaciones dobles. El alma se gasta muy despacio."
      },
      mods: { markPerHit: 3, detoMult: 1.25, detoChain: true, soulSpeed: 1.5, furyDmg: 1.6, shiftCost: 7 }
    }
  ];

  var byId = {};
  list.forEach(function (c) { byId[c.id] = c; });

  var C = {
    list: list,
    get: function (id) { return byId[id] || list[0]; },
    selected: function () { return C.get(NS.Save.data.equip.char); },
    isOwned: function (id) { return NS.Save.owns("chars", id); },
    // returns true if the play-unlock condition is met (free unlock path)
    checkUnlocks: function () {
      var got = [];
      list.forEach(function (c) {
        if (NS.Save.owns("chars", c.id)) return;
        if (c.unlock && c.unlock(NS.Save.data)) {
          NS.Save.unlock("chars", c.id);
          got.push(c);
        }
      });
      return got;
    }
  };

  /* ------------------------------------------------------------
     Vector art. Every character is drawn procedurally, no assets.
     t = time seconds, opt = { state:'fury'|'soul', moving, aim, skin }
     ------------------------------------------------------------ */
  C.draw = function (ctx, ch, x, y, r, t, opt) {
    opt = opt || {};
    var skin = opt.skin || null;
    var main = (skin && skin.main) || ch.colors.main;
    var glow = (skin && skin.glow) || ch.colors.glow;
    if (skin && skin.rainbow) {
      main = "hsl(" + Math.floor((t * 160) % 360) + ",100%,66%)";
      glow = "hsl(" + Math.floor((t * 160 + 140) % 360) + ",100%,72%)";
    }
    var isSoul = opt.state === "soul";
    var aim = opt.aim === undefined ? -Math.PI / 2 : opt.aim;
    var bob = Math.sin(t * (opt.moving ? 11 : 4)) * (opt.moving ? r * 0.10 : r * 0.05);

    ctx.save();
    ctx.translate(x, y + bob);

    // ground shadow
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = "#000";
    ctx.beginPath();
    ctx.ellipse(0, r * 0.95 - bob, r * 0.72, r * 0.26, 0, 0, U.TAU);
    ctx.fill();
    ctx.globalAlpha = 1;

    ctx.save();
    ctx.rotate(aim + Math.PI / 2);

    var c1 = isSoul ? "#bff6ff" : main;
    var c2 = isSoul ? main : glow;

    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = isSoul ? 0.42 : 0.3;
    ctx.fillStyle = c2;
    ctx.beginPath(); ctx.arc(0, 0, r * 1.5, 0, U.TAU); ctx.fill();
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;

    // body silhouette per character
    ctx.lineWidth = Math.max(1.6, r * 0.14);
    ctx.strokeStyle = c1;
    ctx.fillStyle = isSoul ? "rgba(20,40,60,.55)" : "rgba(14,8,26,.85)";
    ctx.shadowColor = c1; ctx.shadowBlur = r * 0.8;

    if (ch.id === "brutus") {
      ctx.beginPath();
      ctx.moveTo(0, -r * 1.12);
      ctx.lineTo(r * 0.88, -r * 0.3);
      ctx.lineTo(r * 0.72, r * 0.9);
      ctx.lineTo(-r * 0.72, r * 0.9);
      ctx.lineTo(-r * 0.88, -r * 0.3);
      ctx.closePath();
      ctx.fill(); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-r * 0.95, -r * 0.55); ctx.lineTo(-r * 1.25, r * 0.15);
      ctx.moveTo(r * 0.95, -r * 0.55); ctx.lineTo(r * 1.25, r * 0.15);
      ctx.stroke();
    } else if (ch.id === "vela") {
      ctx.beginPath();
      ctx.moveTo(0, -r * 1.35);
      ctx.lineTo(r * 0.62, r * 0.25);
      ctx.lineTo(0, r * 0.85);
      ctx.lineTo(-r * 0.62, r * 0.25);
      ctx.closePath();
      ctx.fill(); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-r * 0.62, r * 0.2); ctx.lineTo(-r * 1.15, r * 0.62);
      ctx.moveTo(r * 0.62, r * 0.2); ctx.lineTo(r * 1.15, r * 0.62);
      ctx.stroke();
    } else if (ch.id === "nullecho") {
      ctx.beginPath();
      for (var i = 0; i < 6; i++) {
        var a = -Math.PI / 2 + i * U.TAU / 6;
        var rr = r * (i % 2 ? 0.72 : 1.15) * (1 + Math.sin(t * 6 + i) * 0.06);
        var px = Math.cos(a) * rr, py = Math.sin(a) * rr;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill(); ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.moveTo(0, -r * 1.22);
      ctx.lineTo(r * 0.78, r * 0.18);
      ctx.lineTo(r * 0.44, r * 0.92);
      ctx.lineTo(-r * 0.44, r * 0.92);
      ctx.lineTo(-r * 0.78, r * 0.18);
      ctx.closePath();
      ctx.fill(); ctx.stroke();
    }

    // core eye
    ctx.shadowBlur = r * 1.1;
    ctx.fillStyle = isSoul ? "#eafcff" : c2;
    ctx.beginPath();
    ctx.ellipse(0, -r * 0.18, r * 0.3, r * 0.19, 0, 0, U.TAU);
    ctx.fill();

    // muzzle
    ctx.shadowBlur = 0;
    ctx.strokeStyle = c2;
    ctx.lineWidth = Math.max(1.4, r * 0.11);
    ctx.beginPath();
    ctx.moveTo(0, -r * 1.05);
    ctx.lineTo(0, -r * 1.5);
    ctx.stroke();

    ctx.restore();
    ctx.restore();
  };

  NS.Chars = C;
})(window.NS);
