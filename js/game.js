/* ============================================================
   NEON SOUL - game.js
   Run orchestration: zones, rooms, waves, hazards, loot,
   rewards, events, economy and the main update loop.
   ============================================================ */
(function (NS) {
  "use strict";
  var U = NS.U, P = NS.Particles, Cb = NS.Combat, A = NS.Audio, Save = NS.Save;

  var G = {
    state: "boot",          // boot | menu | playing | paused | map | reward | event | runshop | gameover
    player: null,
    boss: null,
    enemies: [],
    obstacles: [],
    loot: [],
    zones: [],              // persistent damage fields
    telegraphs: [],
    beams: [],
    vortex: [],
    bolts: [],
    arena: { x: 0, y: 0, w: 760, h: 760, cx: 380, cy: 380 },
    arenaShrink: 1,

    zone: null, zoneIdx: 1,
    mapSteps: [], stepIdx: 0, node: null,
    rng: null,
    waves: [], waveIdx: 0, waveDelay: 0, roomActive: false,
    roomClearT: 0, roomPerfect: true,
    exitPortal: null,
    rerolls: 2, rewardOffers: null,
    runShopItems: null,
    coins: 0, runShards: 0,
    combo: 0, comboT: 0, bestCombo: 0,
    dmgMul: 1, dmgTakenMul: 1,
    bestDetonation: 0,
    roomTrackDirty: true,
    killTimes: [],
    stats: null,
    endless: false
  };

  function freshStats() {
    return {
      kills: 0, time: 0, damageDealt: 0, damageTaken: 0, shifts: 0, dashes: 0,
      detonations: 0, bosses: 0, perfectRooms: 0, upgrades: 0, legendaries: 0,
      maxDmgMul: 1, chaosPeak: 0, bestDeto: 0, perfectBoss: 0, rooms: 0, coins: 0
    };
  }

  // ============================================================
  //  ARENA
  // ============================================================
  G.recomputeArena = function () {
    var R = NS.Render;
    var pad = 22;
    var w = (R.fullW - pad * 2) * G.arenaShrink;
    var h = (R.fullH - pad * 2) * G.arenaShrink;
    G.arena.w = w; G.arena.h = h;
    G.arena.x = (R.fullW - w) / 2;
    G.arena.y = (R.fullH - h) / 2;
    G.arena.cx = G.arena.x + w / 2;
    G.arena.cy = G.arena.y + h / 2;
  };

  G.shrinkArena = function (f) {
    G.arenaShrink = Math.max(0.55, G.arenaShrink * f);
    G.recomputeArena();
    P.ring(G.arena.cx, G.arena.cy, { r0: G.arena.w, r1: G.arena.w * 0.5, color: "#ff3a55", life: 0.6, w: 6 });
    G.addShake(9);
  };

  G.clampToArena = function (e, isPlayer) {
    var a = G.arena, r = e.r || 12;
    if (e.x < a.x + r) { e.x = a.x + r; if (isPlayer) e.vx = Math.max(0, e.vx); }
    if (e.x > a.x + a.w - r) { e.x = a.x + a.w - r; if (isPlayer) e.vx = Math.min(0, e.vx); }
    if (e.y < a.y + r) { e.y = a.y + r; if (isPlayer) e.vy = Math.max(0, e.vy); }
    if (e.y > a.y + a.h - r) { e.y = a.y + a.h - r; if (isPlayer) e.vy = Math.min(0, e.vy); }
  };

  G.avoidObstacles = function (e, isPlayer) {
    for (var i = 0; i < G.obstacles.length; i++) {
      var o = G.obstacles[i];
      if (!o.solid) continue;
      var rr = o.r + (e.r || 12);
      var dx = e.x - o.x, dy = e.y - o.y;
      var d2 = dx * dx + dy * dy;
      if (d2 < rr * rr && d2 > 0.0001) {
        var d = Math.sqrt(d2);
        e.x = o.x + dx / d * rr;
        e.y = o.y + dy / d * rr;
        if (isPlayer) { e.vx *= 0.6; e.vy *= 0.6; }
      }
    }
  };

  G.hasLineOfSight = function (a, b) {
    for (var i = 0; i < G.obstacles.length; i++) {
      var o = G.obstacles[i];
      if (!o.solid) continue;
      if (segCircle(a.x, a.y, b.x, b.y, o.x, o.y, o.r)) return false;
    }
    return true;
  };
  function segCircle(x1, y1, x2, y2, cx, cy, r) {
    var dx = x2 - x1, dy = y2 - y1;
    var l2 = dx * dx + dy * dy;
    if (l2 < 1e-6) return U.dist2(x1, y1, cx, cy) < r * r;
    var t = U.clamp(((cx - x1) * dx + (cy - y1) * dy) / l2, 0, 1);
    var px = x1 + t * dx, py = y1 + t * dy;
    return U.dist2(px, py, cx, cy) < r * r;
  }

  // ============================================================
  //  EFFECT HELPERS (used by enemies / bosses / player)
  // ============================================================
  G.addShake = function (n) { NS.Render.addShake(n); };
  G.flash = function (a, c) { NS.UI.flash(a, c); };
  G.toast = function (m, c) { NS.UI.toast(m, c); };

  G.addTelegraph = function (x, y, r, dur, color, dmg) {
    G.telegraphs.push({ x: x, y: y, r: r, t: dur, dur: dur, color: color || "#ff3a55", dmg: dmg || 0 });
  };
  G.addZone = function (x, y, r, dur, dps, color) {
    G.zones.push({ x: x, y: y, r: r, t: dur, dur: dur, dps: dps, color: color || "#ff5a28", seed: U.rand(0, 10), tick: 0 });
  };
  G.addBeam = function (cfg) {
    var b = {
      x: cfg.x, y: cfg.y, angle: cfg.angle, len: cfg.len || 1000, width: cfg.width || 20,
      dur: cfg.dur || 1.2, t: cfg.dur || 1.2, dmg: cfg.dmg || 10,
      color: cfg.color || "#ff2fb9", tele: cfg.tele || 0, delay: cfg.delay || 0,
      hitCd: 0, dead: false
    };
    G.beams.push(b);
    return b;
  };
  G.addVortex = function (x, y, r, dur, dmg, friendly) {
    G.vortex.push({ x: x, y: y, r: r, t: dur, dur: dur, dmg: dmg || 0, friendly: !!friendly, tick: 0 });
  };
  G.addBolt = function (x1, y1, x2, y2, color) {
    G.bolts.push({ x1: x1, y1: y1, x2: x2, y2: y2, color: color || "#7ee8ff", t: 0.22, dur: 0.22, seed: U.rand(0, 99) });
  };

  // ============================================================
  //  SPAWNING & LOOT
  // ============================================================
  G.spawnEnemy = function (type, x, y, opts) {
    if (G.enemies.length > 70) return null;
    opts = opts || {};
    var zone = G.zone || NS.Levels.get(1);
    var curve = NS.Levels.curve(zone.id, G.stepIdx);
    var e = NS.Enemies.create(type, x, y, {
      elite: opts.elite,
      hpMul: (zone.hpMul || 1) * curve,
      dmgMul: (zone.dmgMul || 1) * curve
    });
    G.clampToArena(e);
    G.enemies.push(e);
    P.ring(x, y, { r0: 4, r1: e.r * 2.6, color: e.color, life: 0.4, w: 2 });
    return e;
  };

  G.dropCoin = function (x, y, val) {
    G.loot.push({
      kind: "coin", x: x, y: y, vx: U.rand(-90, 90), vy: U.rand(-90, 90),
      r: 7, val: val, color: "#ffc53d", seed: U.rand(0, 10), life: 22
    });
  };

  G.dropLoot = function (e) {
    var p = G.player;
    var n = Math.max(1, Math.round(e.coin * 0.34));
    var val = Math.max(1, Math.round(e.coin / n * (p ? p.s.coinMul : 1)));
    for (var i = 0; i < Math.min(n, 6); i++) G.dropCoin(e.x + U.rand(-12, 12), e.y + U.rand(-12, 12), val);

    if (U.chance(e.elite ? 0.85 : 0.055)) {
      G.loot.push({ kind: "heart", x: e.x, y: e.y, vx: U.rand(-60, 60), vy: U.rand(-60, 60), r: 9, val: Math.round(p.maxHp * 0.1), color: "#ff5f7a", seed: U.rand(0, 10), life: 26 });
    }
    if (U.chance(e.elite ? 0.6 : 0.08)) {
      G.loot.push({ kind: "soul", x: e.x, y: e.y, vx: U.rand(-60, 60), vy: U.rand(-60, 60), r: 8, val: 25, color: "#25e0ff", seed: U.rand(0, 10), life: 26 });
    }
    if (e.elite && U.chance(0.35)) {
      G.loot.push({ kind: "shard", x: e.x, y: e.y, vx: 0, vy: 0, r: 8, val: 1, color: "#bff6ff", seed: U.rand(0, 10), life: 40 });
    }
    // XP is granted immediately (no pickup needed)
    G.runXp += e.xp * (p ? p.s.xpMul : 1);
  };

  // ============================================================
  //  COMBO
  // ============================================================
  G.addCombo = function () {
    G.combo++;
    G.comboT = 3.2;
    if (G.combo > G.bestCombo) {
      G.bestCombo = G.combo;
      Save.best("bestCombo", G.combo);
    }
    var el = document.getElementById("combo-display");
    if (el && G.combo >= 3) {
      el.classList.remove("hit");
      void el.offsetWidth;
      el.classList.add("hit");
    }
    // chaos tracking: kills in the last 3 seconds
    var now = G.stats.time;
    G.killTimes.push(now);
    while (G.killTimes.length && now - G.killTimes[0] > 3) G.killTimes.shift();
    if (G.killTimes.length > G.stats.chaosPeak) G.stats.chaosPeak = G.killTimes.length;
  };

  G.onShift = function (state) {
    NS.Render.zoomTarget = state === "soul" ? 1.04 : 0.97;
    setTimeout(function () { NS.Render.zoomTarget = 1; }, 220);
  };

  // ============================================================
  //  RUN LIFECYCLE
  // ============================================================
  G.startRun = function () {
    NS.Audio.resume();
    G.state = "playing";
    G.stats = freshStats();
    G.runXp = 0;
    G.coins = 0;
    G.runShards = 0;
    G.combo = 0; G.comboT = 0; G.bestCombo = 0;
    G.bestDetonation = 0;
    G.killTimes.length = 0;
    G.endless = false;
    G.zoneIdx = 1;
    G.arenaShrink = 1;
    G.dmgMul = 1; G.dmgTakenMul = 1;
    clearEntities();
    G.recomputeArena();

    var skin = NS.Shop.currentSkin();
    G.player = new NS.Player(Save.data.equip.char, skin);
    G.player.x = G.arena.cx;
    G.player.y = G.arena.cy;

    // permanent shop boosts
    G.rerolls = 2 + (NS.Shop.hasBoost("reroll") ? 1 : 0);
    if (NS.Shop.hasBoost("soulstart")) G.player.soul = G.player.soulMax;
    if (NS.Shop.hasBoost("startshield")) {
      G.player.s.shieldMax += 25; G.player.s.shieldRegen += 5;
      G.player.shield = G.player.maxShield();
    }
    if (NS.Shop.hasBoost("magnet")) { G.player.s.magnetMul += 0.25; }
    if (NS.Shop.hasBoost("dash")) { G.player.s.dashCharges += 1; }
    G.player.recalc();
    G.player.dashCharge = G.player.dashMax;
    G.player.hp = G.player.maxHp;

    document.body.classList.remove("state-soul");
    Save.bump("runs");
    NS.Missions.event("run", 1);

    buildZone();
    NS.UI.hudShow(true);
    NS.UI.showMap(G);
    G.state = "map";
    A.music("combat");
  };

  function buildZone() {
    G.zone = NS.Levels.get(G.zoneIdx);
    G.rng = new U.RNG((Date.now() ^ (G.zoneIdx * 7919)) >>> 0);
    G.mapSteps = NS.Proc.buildZoneMap(G.zone, G.rng);
    G.stepIdx = 0;
    G.roomTrackDirty = true;
    Save.best("bestZone", G.zoneIdx);
    NS.Missions.event("zone", G.zoneIdx);
  }

  function clearEntities() {
    G.enemies.length = 0;
    G.obstacles.length = 0;
    G.loot.length = 0;
    G.zones.length = 0;
    G.telegraphs.length = 0;
    G.beams.length = 0;
    G.vortex.length = 0;
    G.bolts.length = 0;
    G.boss = null;
    G.exitPortal = null;
    Cb.clear();
    P.clear();
  }

  // ---------------- node entry ----------------
  G.enterNode = function (choice) {
    G.node = choice;
    var type = choice.type;
    clearEntities();
    G.arenaShrink = 1;
    G.recomputeArena();
    G.roomPerfect = true;
    G.roomClearT = 0;
    G.roomActive = false;

    var room = NS.Proc.makeRoom({
      rng: G.rng, arena: G.arena, zone: G.zone,
      nodeType: type, roomIdx: G.stepIdx
    });
    G.obstacles = room.obstacles;

    // spawn in the middle: on phones the lower area is covered by the thumbs
    G.player.x = G.arena.cx;
    G.player.y = G.arena.cy + G.arena.h * 0.08;
    G.player.vx = G.player.vy = 0;
    G.player.invuln = 1;
    NS.Input.releaseAll();

    if (type === "event") { doEvent(); return; }
    if (type === "shop") { openRunShop(); return; }
    if (type === "rest") { doRest(); return; }
    if (type === "treasure") { doTreasure(); return; }

    // fighting rooms
    G.waves = room.waves;
    G.waveIdx = 0;
    G.waveDelay = 0.7;
    G.roomActive = true;

    if (type === "boss") {
      A.music("boss");
      spawnBoss();
    } else {
      A.music("combat");
      if (type === "miniboss") G.toast("GUARDIÁN DE LA ZONA", "bad");
    }

    NS.UI.hideScreens();
    G.state = "playing";
    G.roomTrackDirty = true;
  };

  function spawnBoss() {
    var zone = G.zone;
    var curve = 1 + (G.zoneIdx - 1) * 0.1;
    var b = NS.Boss.create(zone.boss, G.arena.cx, G.arena.y + G.arena.h * 0.24, {
      hpMul: (zone.endless ? zone.hpMul * 0.45 : 1) * curve,
      dmgMul: (zone.dmgMul || 1) * 0.85
    });
    G.boss = b;
    G.enemies.push(b);
    G.toast(b.name + " — " + b.title, "bad");
    A.sfx("portal");
  }

  // ---------------- wave management ----------------
  function updateWaves(dt) {
    if (!G.roomActive) return;
    var alive = 0;
    for (var i = 0; i < G.enemies.length; i++) if (!G.enemies[i].dead) alive++;

    if (G.waveIdx < G.waves.length) {
      // next wave once the room is nearly clear (keeps the pace up without dogpiling)
      if (alive <= 2) G.waveDelay -= dt;
      if (G.waveDelay <= 0) {
        spawnWave(G.waves[G.waveIdx]);
        G.waveIdx++;
        G.waveDelay = 4.2;
      }
    } else if (alive === 0 && G.roomClearT <= 0) {
      roomCleared();
    }
  }

  function spawnWave(list) {
    var a = G.arena, p = G.player;
    for (var i = 0; i < list.length; i++) {
      var pos = NS.Proc.spawnPos(a, p.x, p.y, null, 210);
      G.spawnEnemy(list[i], pos.x, pos.y);
    }
    if (list.elite) {
      var ep = NS.Proc.spawnPos(a, p.x, p.y, null, 260);
      var e = G.spawnEnemy(list.elite, ep.x, ep.y, { elite: true });
      if (e) {
        G.toast("☠ ÉLITE: " + e.name, "bad");
        A.sfx("bossRoar");
      }
    }
    if (G.waveIdx > 0) G.toast("OLEADA " + (G.waveIdx + 1), null);
  }

  function roomCleared() {
    G.roomClearT = 1.25;
    G.roomActive = false;
    G.stats.rooms++;
    Save.bump("roomsCleared");
    NS.Missions.event("room", 1);
    if (G.roomPerfect) {
      G.stats.perfectRooms++;
      G.toast("SALA PERFECTA", "good");
    } else {
      G.toast("SALA DESPEJADA", "good");
    }
    A.sfx("upgrade");
    // magnet all loot
    for (var i = 0; i < G.loot.length; i++) G.loot[i].magnet = true;
    if (G.boss) {
      G.stats.bosses++;
      Save.bump("bossKills");
      NS.Missions.event("bossKill", 1);
      if (G.roomPerfect) G.stats.perfectBoss++;
      G.runShards += G.boss.shards || 3;   // XP already granted by dropLoot on kill
      for (var k = 0; k < 24; k++) {
        G.dropCoin(G.boss.x + U.rand(-90, 90), G.boss.y + U.rand(-90, 90), Math.round(G.boss.coin / 24));
      }
      G.toast("JEFE DERROTADO  +" + (G.boss.shards || 3) + " FRAGMENTOS", "good");
      G.boss = null;
    }
    NS.Ach.check(G.stats);
  }

  function onRoomComplete() {
    var type = G.node ? G.node.type : "combat";
    if (type === "boss") {
      // portal to next zone
      G.exitPortal = { x: G.arena.cx, y: G.arena.cy, r: 46 };
      G.toast("ENTRA EN EL PORTAL", "good");
      A.music("victory");
      return;
    }
    var count = 3 + (NS.Shop.hasBoost("lucky") && G.stats.upgrades === 0 ? 1 : 0);
    var offers = NS.Upgrades.roll(G.player, count, { luck: type === "elite" || type === "miniboss" ? 1.5 : 0 });
    if (!offers.length) { advanceStep(); return; }
    G.rewardOffers = offers;
    G.state = "reward";
    NS.UI.showReward(G, offers, {
      title: type === "miniboss" ? "BOTÍN DEL GUARDIÁN" : "ELIGE UNA MEJORA",
      sub: type === "elite" ? "Élite derrotada · mejor rareza" : "Sala despejada"
    });
  }

  G.takeUpgrade = function (u) {
    A.sfx("upgrade");
    NS.Upgrades.apply(G.player, u);
    G.stats.upgrades++;
    if (u.rarity === "legendary") G.stats.legendaries++;
    G.stats.maxDmgMul = Math.max(G.stats.maxDmgMul, G.player.s.dmgMul);
    NS.Missions.event("upgrade", 1);
    NS.Ach.check(G.stats);
    G.toast(u.name, "good");
    advanceStep();
  };

  G.rerollReward = function () {
    if (G.rerolls <= 0 || G.state !== "reward") return;
    G.rerolls--;
    A.sfx("click");
    var offers = NS.Upgrades.roll(G.player, G.rewardOffers.length, {});
    G.rewardOffers = offers;
    NS.UI.showReward(G, offers, {});
  };

  function advanceStep() {
    G.stepIdx++;
    G.roomTrackDirty = true;
    clearEntities();
    if (G.stepIdx >= G.mapSteps.length) {
      zoneComplete();
      return;
    }
    G.state = "map";
    NS.UI.showMap(G);
  }

  function zoneComplete() {
    G.zoneIdx++;
    if (G.zoneIdx > NS.Levels.count && !G.endless) {
      Save.bump("wins");
      NS.Missions.event("win", 1);
      NS.Ach.check(G.stats);
      askEndless();
      return;
    }
    G.toast("ZONA COMPLETADA", "good");
    buildZone();
    G.state = "map";
    NS.UI.showMap(G);
  }

  function askEndless() {
    G.state = "event";
    NS.UI.showEvent(G, {
      ico: "☢",
      title: "EL NÚCLEO HA CAÍDO",
      text: "El NEXUS se resquebraja. Puedes escapar con todo lo que llevas... o adentrarte en el bucle infinito, donde la ciudad se regenera más fuerte cada vez.",
      choices: [
        {
          label: "ESCAPAR", desc: "Termina la incursión como victoria y conserva TODO el botín.",
          run: function () { endRun(true); }
        },
        {
          label: "SOBRECARGA (SIN FIN)", desc: "Continúa en zonas infinitas. El botín sigue creciendo, la muerte sigue costando.",
          run: function () {
            G.endless = true;
            G.toast("MODO SOBRECARGA", "bad");
            buildZone();
            G.state = "map";
            NS.UI.showMap(G);
          }
        }
      ]
    });
  }

  // ---------------- rest / treasure / event / shop ----------------
  function doRest() {
    G.state = "event";
    var p = G.player;
    NS.UI.showEvent(G, {
      ico: "✚",
      title: "SANTUARIO",
      text: "Una cápsula médica intacta entre los escombros. Sólo puedes usar una función antes de que se apague.",
      choices: [
        {
          label: "REPARAR", desc: "Recupera el 45% de tu vida máxima.",
          run: function () { p.heal(p.maxHp * 0.45); A.sfx("heal"); advanceStep(); }
        },
        {
          label: "SOBRECARGAR ALMA", desc: "Alma al máximo y +18 de vida máxima permanente.",
          run: function () { p.s.hpFlat += 18; p.recalc(); p.heal(18); p.soul = p.soulMax; A.sfx("shiftSoul"); advanceStep(); }
        },
        {
          label: "RECALIBRAR", desc: "+2 rerolls de mejora y recupera el 15% de vida.",
          run: function () { G.rerolls += 2; p.heal(p.maxHp * 0.15); A.sfx("click"); advanceStep(); }
        }
      ]
    });
  }

  function doTreasure() {
    var offers = NS.Upgrades.roll(G.player, 3, { luck: 3 });
    if (!offers.length) { advanceStep(); return; }
    G.rewardOffers = offers;
    G.state = "reward";
    NS.UI.showReward(G, offers, { title: "RELIQUIA NEXUS", sub: "Rarezas mejoradas" });
  }

  var EVENTS = [
    {
      ico: "⚙", title: "TERMINAL CORRUPTA",
      text: "Una terminal aún funciona. Puede inyectar código directamente en tu núcleo... o freírte.",
      choices: [
        { label: "INYECTAR CÓDIGO", desc: "+25% de daño permanente, pierdes 20% de vida actual.",
          run: function (G) { G.player.s.dmgMul += 0.25; G.player.recalc(); G.player.hp *= 0.8; A.sfx("upgrade"); advanceStep(); } },
        { label: "EXTRAER DATOS", desc: "Consigue 180 monedas.",
          run: function (G) { G.coins += 180; A.sfx("coin"); advanceStep(); } },
        { label: "IGNORAR", desc: "Sigues tu camino sin riesgos.",
          run: function () { advanceStep(); } }
      ]
    },
    {
      ico: "◉", title: "FUENTE DE ALMA",
      text: "Un géiser de energía NEXUS brota del asfalto. Puedes beber de él, pero el Nexus siempre cobra algo.",
      choices: [
        { label: "BEBER", desc: "+30% de alma máxima y alma llena.",
          run: function (G) { G.player.s.soulMaxMul += 0.3; G.player.recalc(); G.player.soul = G.player.soulMax; A.sfx("shiftSoul"); advanceStep(); } },
        { label: "CONTAMINARSE", desc: "+2 marcas por golpe, -15% vida máxima.",
          run: function (G) { G.player.s.markBonus += 2; G.player.s.hpMul -= 0.15; G.player.recalc(); A.sfx("detonate"); advanceStep(); } },
        { label: "SELLARLA", desc: "Recupera 35% de vida.",
          run: function (G) { G.player.heal(G.player.maxHp * 0.35); A.sfx("heal"); advanceStep(); } }
      ]
    },
    {
      ico: "☠", title: "EMBOSCADA",
      text: "Sombras se mueven entre los contenedores. Puedes rodear la zona o cobrar la recompensa.",
      choices: [
        { label: "LUCHAR", desc: "Oleada dura. Recompensa: mejora + 250 monedas.",
          run: function (G) { startAmbush(); } },
        { label: "RODEAR", desc: "Evitas el peligro, pierdes 60 monedas de material.",
          run: function (G) { G.coins = Math.max(0, G.coins - 60); advanceStep(); } }
      ]
    },
    {
      ico: "⛊", title: "FORJA IMPROVISADA",
      text: "Piezas de dron esparcidas. Puedes montar algo útil si sacrificas recursos.",
      choices: [
        { label: "BLINDAJE", desc: "+35 vida máxima y +5% armadura.",
          run: function (G) { G.player.s.hpFlat += 35; G.player.s.armor += 0.05; G.player.recalc(); G.player.heal(35); A.sfx("shield"); advanceStep(); } },
        { label: "CAÑÓN", desc: "+1 proyectil, -10% cadencia.",
          run: function (G) { G.player.s.proj += 1; G.player.s.atkSpdMul -= 0.1; G.player.recalc(); A.sfx("shootHeavy"); advanceStep(); } },
        { label: "MOTOR", desc: "+15% velocidad y +1 carga de esquiva.",
          run: function (G) { G.player.s.speedMul += 0.15; G.player.s.dashCharges += 1; G.player.recalc(); G.player.dashCharge = G.player.dashMax; A.sfx("dash"); advanceStep(); } }
      ]
    },
    {
      ico: "◈", title: "TRATO DEL NEXUS",
      text: "Una voz sin cuerpo te ofrece poder. Siempre hay letra pequeña.",
      choices: [
        { label: "ACEPTAR", desc: "+40% daño, pero recibes +20% de daño el resto de la incursión.",
          run: function (G) { G.player.s.dmgMul += 0.4; G.dmgTakenMul = 1.2; G.player.recalc(); A.sfx("bossRoar"); advanceStep(); } },
        { label: "NEGOCIAR", desc: "Cambia 120 monedas por una mejora aleatoria.",
          show: function (G) { return G.coins >= 120; },
          run: function (G) {
            G.coins -= 120;
            var offers = NS.Upgrades.roll(G.player, 1, { luck: 2 });
            if (offers.length) { NS.Upgrades.apply(G.player, offers[0]); G.toast(offers[0].name, "good"); }
            A.sfx("upgrade");
            advanceStep();
          } },
        { label: "RECHAZAR", desc: "Recupera 25% de vida por tu determinación.",
          run: function (G) { G.player.heal(G.player.maxHp * 0.25); advanceStep(); } }
      ]
    }
  ];

  function doEvent() {
    G.state = "event";
    var ev = U.pick(EVENTS);
    NS.UI.showEvent(G, ev);
  }

  function startAmbush() {
    NS.UI.hideScreens();
    G.state = "playing";
    G.roomActive = true;
    G.waves = NS.Proc.makeWaves({ rng: G.rng, zone: G.zone, roomIdx: G.stepIdx + 2, nodeType: "elite" });
    G.waveIdx = 0;
    G.waveDelay = 0.4;
    G.node = { type: "combat", ambush: true };
    G.ambushReward = true;
    A.music("combat");
  }

  // ---------------- run shop ----------------
  function openRunShop() {
    var items = [];
    var offers = NS.Upgrades.roll(G.player, 3, { luck: 1 });
    offers.forEach(function (u) {
      var priceBase = { common: 95, rare: 170, epic: 260, legendary: 420 }[u.rarity];
      items.push({
        kind: "up", up: u, icon: u.icon, name: u.name, desc: u.desc,
        price: Math.round(priceBase * (1 + G.zoneIdx * 0.12)),
        rarCls: NS.Upgrades.RAR[u.rarity].cls
      });
    });
    items.push({ kind: "heal", icon: "⚕", name: "KIT MÉDICO", desc: "Recupera el 45% de tu vida.", price: Math.round(110 * (1 + G.zoneIdx * 0.1)), rarCls: "rar-common" });
    items.push({ kind: "reroll", icon: "↻", name: "REROLL", desc: "+2 rerolls de mejora.", price: 130, rarCls: "rar-rare" });
    items.push({ kind: "shield", icon: "⛊", name: "PLACA NEXUS", desc: "+25 de escudo regenerable.", price: 240, rarCls: "rar-rare" });
    G.runShopItems = items;
    G.state = "runshop";
    NS.UI.showRunShop(G, items);
  }

  G.buyRunItem = function (idx) {
    var it = G.runShopItems[idx];
    if (!it || it.sold || G.coins < it.price) { A.sfx("error"); return; }
    G.coins -= it.price;
    it.sold = true;
    A.sfx("coin");
    if (it.kind === "up") {
      NS.Upgrades.apply(G.player, it.up);
      G.stats.upgrades++;
      if (it.up.rarity === "legendary") G.stats.legendaries++;
      NS.Missions.event("upgrade", 1);
      G.toast(it.up.name, "good");
    } else if (it.kind === "heal") {
      G.player.heal(G.player.maxHp * 0.45);
    } else if (it.kind === "reroll") {
      G.rerolls += 2;
    } else if (it.kind === "shield") {
      G.player.s.shieldMax += 25;
      G.player.s.shieldRegen += 5;
      G.player.shield = G.player.maxShield();
    }
    NS.UI.showRunShop(G, G.runShopItems);
  };

  G.leaveRunShop = function () { advanceStep(); };

  // ============================================================
  //  PAUSE / QUIT / DEATH
  // ============================================================
  G.togglePause = function () {
    if (G.state === "playing") {
      G.state = "paused";
      NS.Input.releaseAll();
      A.sfx("back");
      NS.UI.showPause(G);
    } else if (G.state === "paused") {
      G.state = "playing";
      NS.UI.hideScreens();
      A.sfx("click");
    }
  };

  G.quitRun = function () {
    endRun(false, true);
  };

  G.onPlayerDeath = function () {
    Save.bump("deaths");
    setTimeout(function () { endRun(false); }, 1100);
  };

  function endRun(win, abandoned) {
    if (G.state === "gameover") return;
    G.state = "gameover";
    NS.Input.releaseAll();
    NS.UI.hudShow(false);

    var s = G.stats;
    var score = Math.round(
      s.kills * 12 + s.bosses * 1800 + G.zoneIdx * 900 + G.coins * 1.4 +
      G.bestCombo * 28 + s.rooms * 120 + (win ? 5000 : 0)
    );

    var keep = win ? 1 : (0.6 + (NS.Shop.hasBoost("insurance") ? 0.25 : 0));
    if (abandoned) keep = Math.min(keep, 0.55);
    var coins = Math.round(G.coins * keep);
    var shards = G.runShards + (win ? 8 : 0);
    var xp = Math.round(G.runXp + score * 0.05);

    Save.addCoins(coins);
    Save.addShards(shards);
    var levelUps = Save.addXp(xp);
    Save.best("bestScore", score);
    Save.best("bestTime", Math.round(s.time));
    Save.bump("totalTime", Math.round(s.time));

    NS.Missions.event("coin", coins);
    NS.Missions.event("survive", Math.round(s.time));
    NS.Missions.event("combo", G.bestCombo);
    NS.Missions.event("score", score);
    s.bestDeto = G.bestDetonation;
    NS.Ach.check(s);

    var unlocked = NS.Chars.checkUnlocks();
    unlocked.forEach(function (c, i) {
      setTimeout(function () { NS.UI.popup("PERSONAJE", c.name, "✵"); }, 500 + i * 900);
      NS.Missions.event("charUnlock", 1);
    });

    if (levelUps) A.sfx("levelup");
    Save.save();
    A.music("menu");
    NS.UI.showGameOver(G, { win: win, score: score, coins: coins, shards: shards, xp: xp, levelUps: levelUps });
  }

  G.toMenu = function () {
    G.state = "menu";
    clearEntities();
    G.player = null;
    NS.UI.hudShow(false);
    NS.UI.renderMenu();
    NS.UI.showScreen("menu");
    A.music("menu");
    document.body.classList.remove("state-soul", "lowhp", "hurt");
  };

  // ============================================================
  //  UPDATE
  // ============================================================
  G.update = function (dt) {
    NS.Render.updateShake(dt);

    if (G.state !== "playing") {
      // keep light effects alive behind menus
      P.update(Math.min(dt, 0.05));
      updateBolts(dt);
      return;
    }

    var p = G.player;
    G.stats.time += dt;

    NS.Input.update();
    if (NS.Input.pausePressed) { G.togglePause(); NS.Input.endFrame(); return; }

    p.update(dt, G);

    // enemies
    var i, e;
    for (i = 0; i < G.enemies.length; i++) {
      e = G.enemies[i];
      if (e.dead) continue;
      if (e.orbCd > 0) e.orbCd -= dt;
      if (e.isBoss) NS.Boss.update(e, dt, p, G);
      else NS.Enemies.update(e, dt, p, G);
    }
    // sweep dead (G.boss stays referenced until the room is resolved so its
    // rewards are always paid out, no matter which frame it died on)
    var n = 0;
    for (i = 0; i < G.enemies.length; i++) {
      if (!G.enemies[i].dead) G.enemies[n++] = G.enemies[i];
    }
    G.enemies.length = n;

    Cb.update(dt);
    updateObstacles(dt);
    updateHazards(dt);
    updateLoot(dt);
    updateBolts(dt);
    P.update(dt);

    // combo decay
    if (G.comboT > 0) {
      G.comboT -= dt;
      if (G.comboT <= 0) G.combo = 0;
    }

    // room progression
    updateWaves(dt);
    if (G.roomClearT > 0) {
      G.roomClearT -= dt;
      if (G.roomClearT <= 0) {
        if (G.ambushReward) {
          G.ambushReward = false;
          G.coins += 250;
          G.toast("+250 MONEDAS", "good");
        }
        onRoomComplete();
      }
    }

    // exit portal
    if (G.exitPortal && U.dist2(p.x, p.y, G.exitPortal.x, G.exitPortal.y) < 60 * 60) {
      G.exitPortal = null;
      A.sfx("portal");
      advanceStep();
    }

    NS.Input.endFrame();
  };

  function updateObstacles(dt) {
    var p = G.player;
    for (var i = 0; i < G.obstacles.length; i++) {
      var o = G.obstacles[i];
      o.t += dt;
      if (o.kind === "spikes") {
        if (U.dist2(p.x, p.y, o.x, o.y) < (o.r + p.r * 0.6) * (o.r + p.r * 0.6)) {
          o.tick = (o.tick || 0) - dt;
          if (o.tick <= 0) { o.tick = 0.6; p.takeDamage(o.dps, { noShake: true }); }
        }
      } else if (o.kind === "vent") {
        var phase = (o.t % o.cycle) / o.cycle;
        var wasOn = o.ventOn;
        o.ventOn = phase > 0.72;
        if (o.ventOn && !wasOn) {
          P.explosion(o.x, o.y, o.r * 1.4, "#ff8a3d");
          A.sfx("explode");
          if (U.dist2(p.x, p.y, o.x, o.y) < (o.r + p.r) * (o.r + p.r)) {
            p.takeDamage(16 * (G.zone.dmgMul || 1), { angle: U.angle(o.x, o.y, p.x, p.y), knock: 180 });
          }
          for (var k = 0; k < G.enemies.length; k++) {
            var en = G.enemies[k];
            if (!en.dead && U.dist2(en.x, en.y, o.x, o.y) < (o.r + en.r) * (o.r + en.r)) {
              Cb.damageEnemy(en, 18, { angle: U.angle(o.x, o.y, en.x, en.y), knock: 160, elem: 1 });
            }
          }
        }
      } else if (o.kind === "beam") {
        o.angle += o.speed * dt;
        var d = distToSeg(p.x, p.y, o.x, o.y, o.x + Math.cos(o.angle) * o.len, o.y + Math.sin(o.angle) * o.len);
        if (d < p.r + 7) {
          o.tick = (o.tick || 0) - dt;
          if (o.tick <= 0) { o.tick = 0.5; p.takeDamage(12 * (G.zone.dmgMul || 1), { noShake: true }); }
        }
      }
    }
  }

  function distToSeg(px, py, x1, y1, x2, y2) {
    var dx = x2 - x1, dy = y2 - y1;
    var l2 = dx * dx + dy * dy;
    if (l2 < 1e-6) return U.dist(px, py, x1, y1);
    var t = U.clamp(((px - x1) * dx + (py - y1) * dy) / l2, 0, 1);
    return U.dist(px, py, x1 + t * dx, y1 + t * dy);
  }

  function updateHazards(dt) {
    var p = G.player, i, n;

    // telegraphs
    n = 0;
    for (i = 0; i < G.telegraphs.length; i++) {
      var tg = G.telegraphs[i];
      tg.t -= dt;
      if (tg.t <= 0) {
        if (tg.dmg > 0) {
          Cb.explosion(tg.x, tg.y, tg.r, tg.dmg, { owner: 1, color: tg.color, shake: 4 });
        }
        continue;
      }
      G.telegraphs[n++] = tg;
    }
    G.telegraphs.length = n;

    // damage zones
    n = 0;
    for (i = 0; i < G.zones.length; i++) {
      var z = G.zones[i];
      z.t -= dt;
      if (z.t <= 0) continue;
      z.tick -= dt;
      if (z.tick <= 0) {
        z.tick = 0.4;
        if (U.dist2(p.x, p.y, z.x, z.y) < (z.r + p.r * 0.5) * (z.r + p.r * 0.5)) {
          p.takeDamage(z.dps * 0.4, { noShake: true });
        }
      }
      if (Math.random() < dt * 8) {
        P.spark(z.x + U.rand(-z.r, z.r) * 0.7, z.y + U.rand(-z.r, z.r) * 0.7, 1,
          { color: z.color, speed: 30, life: 0.5, size: 2.4, vy: -60 });
      }
      G.zones[n++] = z;
    }
    G.zones.length = n;

    // beams
    n = 0;
    for (i = 0; i < G.beams.length; i++) {
      var b = G.beams[i];
      if (b.dead) continue;
      if (b.delay > 0) { b.delay -= dt; G.beams[n++] = b; continue; }
      if (b.tele > 0) { b.tele -= dt; G.beams[n++] = b; continue; }
      b.t -= dt;
      if (b.t <= 0) continue;
      b.hitCd -= dt;
      var d = distToSeg(p.x, p.y, b.x, b.y, b.x + Math.cos(b.angle) * b.len, b.y + Math.sin(b.angle) * b.len);
      if (d < p.r + b.width * 0.5 && b.hitCd <= 0) {
        b.hitCd = 0.45;
        p.takeDamage(b.dmg, { angle: b.angle + Math.PI / 2, knock: 120 });
      }
      G.beams[n++] = b;
    }
    G.beams.length = n;

    // vortex
    n = 0;
    for (i = 0; i < G.vortex.length; i++) {
      var v = G.vortex[i];
      v.t -= dt;
      if (v.t <= 0) {
        if (v.friendly) {
          Cb.explosion(v.x, v.y, v.r * 0.9, v.dmg * 4, { color: "#ff2fb9", shake: 6, marks: 2 });
        }
        continue;
      }
      // pull
      if (v.friendly) {
        for (var k = 0; k < G.enemies.length; k++) {
          var e = G.enemies[k];
          if (e.dead || e.heavy) continue;
          var dd = U.dist(e.x, e.y, v.x, v.y);
          if (dd < v.r * 1.8 && dd > 1) {
            e.x += (v.x - e.x) / dd * 180 * dt;
            e.y += (v.y - e.y) / dd * 180 * dt;
          }
        }
      } else {
        var pd = U.dist(p.x, p.y, v.x, v.y);
        if (pd < v.r * 1.5 && pd > 1) {
          p.x += (v.x - p.x) / pd * 130 * dt;
          p.y += (v.y - p.y) / pd * 130 * dt;
        }
        v.tick -= dt;
        if (v.tick <= 0 && pd < v.r * 0.5) {
          v.tick = 0.5;
          p.takeDamage(v.dmg, { noShake: true });
        }
      }
      G.vortex[n++] = v;
    }
    G.vortex.length = n;
  }

  function updateBolts(dt) {
    var n = 0;
    for (var i = 0; i < G.bolts.length; i++) {
      var b = G.bolts[i];
      b.t -= dt;
      if (b.t > 0) G.bolts[n++] = b;
    }
    G.bolts.length = n;
  }

  function updateLoot(dt) {
    var p = G.player, n = 0;
    for (var i = 0; i < G.loot.length; i++) {
      var l = G.loot[i];
      l.life -= dt;
      if (l.life <= 0) continue;
      l.x += l.vx * dt; l.y += l.vy * dt;
      l.vx *= Math.exp(-4 * dt); l.vy *= Math.exp(-4 * dt);
      var d = U.dist(l.x, l.y, p.x, p.y);
      var range = p.pickup;
      if (l.magnet || d < range) {
        var pull = l.magnet ? 900 : 520;
        l.x += (p.x - l.x) / Math.max(1, d) * pull * dt;
        l.y += (p.y - l.y) / Math.max(1, d) * pull * dt;
      }
      if (d < p.r + l.r + 6) {
        collect(l);
        continue;
      }
      G.loot[n++] = l;
    }
    G.loot.length = n;
  }

  function collect(l) {
    var p = G.player;
    if (l.kind === "coin") {
      G.coins += l.val;
      G.stats.coins += l.val;
      A.sfx("coin", { gap: 0.02 });
      if (p.flags.avarice) p.heal(1);
      P.spark(l.x, l.y, 3, { color: "#ffc53d", speed: 80, life: 0.25, size: 2 });
    } else if (l.kind === "heart") {
      p.heal(l.val);
      A.sfx("heal");
    } else if (l.kind === "soul") {
      p.soul = Math.min(p.soulMax, p.soul + l.val);
      A.sfx("shiftSoul");
      P.ring(l.x, l.y, { r0: 3, r1: 40, color: "#25e0ff", life: 0.3, w: 2 });
    } else if (l.kind === "shard") {
      G.runShards += l.val;
      A.sfx("unlock");
      G.toast("+" + l.val + " FRAGMENTO", "good");
    }
  }

  // hook: player took damage -> room is no longer perfect
  var origTake = NS.Player.prototype.takeDamage;
  NS.Player.prototype.takeDamage = function (amount, opts) {
    var before = this.hp + this.shield;
    origTake.call(this, amount, opts);
    if (this.hp + this.shield < before) G.roomPerfect = false;
  };

  NS.Game = G;
})(window.NS);
