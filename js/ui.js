/* ============================================================
   NEON SOUL - ui.js
   Screens, menus, HUD. All DOM driven; the canvas stays behind.
   ============================================================ */
(function (NS) {
  "use strict";
  var U = NS.U, Save = NS.Save, A = NS.Audio;

  var UI = {
    current: "boot",
    prev: null,
    fromPause: false,
    _hudT: 0
  };

  var el = {};

  function cache() {
    ["hud", "touch-controls", "hp-fill", "hp-ghost", "hp-text", "shield-bar", "shield-fill",
      "soul-fill", "soul-text", "zone-name", "room-track", "coin-run", "timer", "combo-display",
      "combo-num", "state-text", "state-indicator", "boss-bar-wrap", "boss-name", "boss-fill", "boss-ghost",
      "boss-phases", "toast-wrap", "fps-meter", "w-coins", "w-shards", "w-level", "xp-fill", "xp-text",
      "best-line", "char-list", "meta-list", "shop-list", "mission-list", "ach-list", "ach-count",
      "stats-list", "settings-list", "map-zone", "map-progress", "map-nodes", "map-stats",
      "reward-title", "reward-sub", "reward-cards", "reward-reroll", "reroll-count",
      "event-icon", "event-title", "event-text", "event-choices", "runshop-items", "runshop-coins",
      "pause-stats", "build-stats", "build-upgrades", "go-title", "go-sub", "go-score", "go-grid",
      "go-rewards", "unlock-pop", "unlock-ico", "unlock-kind", "unlock-name", "badge-missions",
      "cd-dash", "cd-ability", "cd-shift", "tb-shift", "tb-attack", "boot-fill", "boot-tip", "btn-boot",
      "flash-layer"
    ].forEach(function (id) { el[id] = U.$(id); });
  }

  // ============================================================
  //  SCREEN MANAGEMENT
  // ============================================================
  UI.showScreen = function (name) {
    U.qsa(".screen").forEach(function (s) { s.classList.remove("active"); });
    var s = U.$("screen-" + name);
    if (s) s.classList.add("active");
    UI.current = name;
  };
  UI.hideScreens = function () {
    U.qsa(".screen").forEach(function (s) { s.classList.remove("active"); });
    UI.current = "game";
  };

  UI.go = function (name) {
    A.sfx("click");
    if (name === "menu") { UI.renderMenu(); UI.showScreen("menu"); NS.Audio.music("menu"); return; }
    if (name === "play") { NS.Game.startRun(); return; }
    if (name === "characters") UI.renderChars();
    if (name === "meta") UI.renderMeta();
    if (name === "shop") UI.renderShop(UI._shopTab || "chars");
    if (name === "missions") UI.renderMissions(UI._misTab || "daily");
    if (name === "achievements") UI.renderAch();
    if (name === "stats") UI.renderStats();
    if (name === "settings") UI.renderSettings();
    UI.showScreen(name);
  };

  UI.back = function () {
    A.sfx("back");
    if (UI.fromPause) {
      UI.fromPause = false;
      UI.showScreen("pause");
      return;
    }
    UI.renderMenu();
    UI.showScreen("menu");
  };

  // ============================================================
  //  TOASTS / POPUPS
  // ============================================================
  UI.toast = function (msg, cls) {
    if (!el["toast-wrap"]) return;
    var t = U.el("div", "toast" + (cls ? " " + cls : ""), U.esc(msg));
    el["toast-wrap"].appendChild(t);
    setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 2000);
    while (el["toast-wrap"].children.length > 4) el["toast-wrap"].removeChild(el["toast-wrap"].firstChild);
  };

  var popQ = [], popBusy = false;
  UI.popup = function (kind, name, ico) {
    popQ.push({ kind: kind, name: name, ico: ico });
    drainPop();
  };
  function drainPop() {
    if (popBusy || !popQ.length || !el["unlock-pop"]) return;
    popBusy = true;
    var p = popQ.shift();
    el["unlock-kind"].textContent = p.kind;
    el["unlock-name"].textContent = p.name;
    el["unlock-ico"].textContent = p.ico || "★";
    el["unlock-pop"].classList.remove("hidden");
    setTimeout(function () {
      el["unlock-pop"].classList.add("hidden");
      popBusy = false;
      drainPop();
    }, 2400);
  }

  UI.flash = function (alpha, color) {
    var f = el["flash-layer"];
    if (!f) return;
    f.style.background = color || "#fff";
    f.style.opacity = alpha;
    setTimeout(function () { f.style.opacity = 0; }, 60);
  };

  // ============================================================
  //  MAIN MENU
  // ============================================================
  UI.renderMenu = function () {
    var d = Save.data;
    el["w-coins"].textContent = U.fmt(d.coins);
    el["w-shards"].textContent = U.fmt(d.shards);
    el["w-level"].textContent = d.level;
    var need = Save.xpForLevel(d.level);
    el["xp-fill"].style.width = (d.xp / need * 100) + "%";
    el["xp-text"].textContent = U.fmt(d.xp) + " / " + U.fmt(need) + " XP";
    el["best-line"].textContent = "RÉCORD: " + U.fmt(d.stats.bestScore) + "  ·  ZONA MÁX: " + d.stats.bestZone;
    U.qsa(".w-coins").forEach(function (e) { e.textContent = U.fmt(d.coins); });
    U.qsa(".w-shards").forEach(function (e) { e.textContent = U.fmt(d.shards); });
    UI.refreshBadges();
  };

  UI.refreshBadges = function () {
    if (!el["badge-missions"]) return;
    var n = NS.Missions.pending();
    el["badge-missions"].textContent = n;
    el["badge-missions"].classList.toggle("hidden", n === 0);
  };

  // ============================================================
  //  CHARACTERS
  // ============================================================
  function portrait(ch, skin) {
    var c = document.createElement("canvas");
    c.width = 128; c.height = 128;
    var ctx = c.getContext("2d");
    NS.Chars.draw(ctx, ch, 64, 64, 34, 2.05, { state: "fury", aim: -Math.PI / 2, skin: skin });
    return c;
  }

  UI.renderChars = function () {
    var box = el["char-list"];
    box.innerHTML = "";
    var sel = Save.data.equip.char;
    NS.Chars.list.forEach(function (ch) {
      var owned = Save.owns("chars", ch.id);
      var card = U.el("div", "char-card" + (sel === ch.id ? " selected" : "") + (owned ? "" : " locked"));
      var pw = U.el("div", "char-portrait");
      pw.appendChild(portrait(ch, owned && sel === ch.id ? NS.Shop.currentSkin() : null));
      card.appendChild(pw);

      var info = U.el("div", "char-info");
      info.innerHTML =
        '<div class="char-name">' + U.esc(ch.name) + (owned ? "" : " 🔒") + '</div>' +
        '<div class="char-role">' + U.esc(ch.role) + '</div>' +
        '<div class="char-desc">' + U.esc(ch.desc) + '</div>' +
        '<div class="stat-bars">' +
        bar("VIDA", ch.bars.vida) + bar("DAÑO", ch.bars.dano) +
        bar("VELOC", ch.bars.velocidad) + bar("TÉCNICA", ch.bars.tecnica) +
        '</div>' +
        '<div class="char-ability"><b>' + ch.ability.icon + " " + U.esc(ch.ability.name) + '</b><br>' + U.esc(ch.ability.desc) + '</div>' +
        '<div class="char-shift"><b>◐ ' + U.esc(ch.shift.name) + '</b><br>' + U.esc(ch.shift.desc) + '</div>';

      var acts = U.el("div", "char-actions");
      if (owned) {
        if (sel === ch.id) {
          acts.appendChild(U.el("span", "pill ok", "EQUIPADO"));
        } else {
          var b = U.el("button", "btn btn-primary", "SELECCIONAR");
          U.on(b, "click", function () {
            NS.Shop.equip("chars", ch.id);
            A.sfx("upgrade");
            UI.renderChars();
          });
          acts.appendChild(b);
        }
      } else {
        var note = U.el("div", "char-desc", U.esc(ch.unlockNote));
        info.appendChild(note);
        var bb = U.el("button", "btn", "COMPRAR ◈ " + U.fmt(ch.price));
        if (Save.data.coins < ch.price) bb.disabled = true;
        U.on(bb, "click", function () {
          var r = NS.Shop.buy("chars", ch.id);
          if (r === "ok") {
            A.sfx("unlock");
            UI.popup("DESBLOQUEADO", ch.name);
            NS.Missions.event("charUnlock", 1);
            NS.Ach.check();
            UI.renderChars(); UI.renderMenu();
          } else { A.sfx("error"); UI.toast("MONEDAS INSUFICIENTES", "bad"); }
        });
        acts.appendChild(bb);
      }
      info.appendChild(acts);
      card.appendChild(info);
      box.appendChild(card);
    });
  };

  function bar(label, v) {
    return '<span>' + label + '</span><span class="sb"><i style="width:' + Math.round(v * 100) + '%"></i></span>';
  }

  // ============================================================
  //  META TREE
  // ============================================================
  UI.renderMeta = function () {
    var box = el["meta-list"];
    box.innerHTML = "";
    var head = U.el("div", "empty-note",
      "Gasta FRAGMENTOS (❖) para reforzar a todos tus personajes de forma permanente.<br>Ganas fragmentos derrotando jefes, subiendo de nivel y completando misiones.");
    box.appendChild(head);

    NS.Meta.NODES.forEach(function (n) {
      var lv = NS.Meta.level(n.id);
      var cost = NS.Meta.cost(n.id);
      var row = U.el("div", "meta-node" + (cost === null ? " maxed" : ""));
      var pips = "";
      for (var i = 0; i < n.max; i++) pips += '<span class="pip' + (i < lv ? " on" : "") + '"></span>';
      row.innerHTML =
        '<div class="meta-ico">' + n.ico + '</div>' +
        '<div class="meta-main">' +
        '<div class="meta-name">' + U.esc(n.name) + ' <small style="color:var(--cyan)">' + U.esc(n.fmt(lv)) + '</small></div>' +
        '<div class="meta-desc">' + U.esc(n.desc) + '</div>' +
        '<div class="meta-pips">' + pips + '</div>' +
        '</div>';
      var btn = U.el("button", "btn meta-buy");
      if (cost === null) { btn.textContent = "MÁX"; btn.disabled = true; }
      else {
        btn.innerHTML = "❖ " + cost;
        btn.className += Save.data.shards >= cost ? " btn-primary" : "";
        if (Save.data.shards < cost) btn.disabled = true;
        U.on(btn, "click", function () {
          if (NS.Meta.buy(n.id)) {
            A.sfx("upgrade");
            UI.toast(n.name + " MEJORADO", "good");
            NS.Ach.check();
            UI.renderMeta(); UI.renderMenu();
          } else { A.sfx("error"); }
        });
      }
      row.appendChild(btn);
      box.appendChild(row);
    });
  };

  // ============================================================
  //  SHOP
  // ============================================================
  UI.renderShop = function (tab) {
    UI._shopTab = tab;
    U.qsa("#shop-tabs .tab").forEach(function (t) { t.classList.toggle("active", t.dataset.tab === tab); });
    var box = el["shop-list"];
    box.innerHTML = "";
    var grid = U.el("div", "shop-grid");
    box.appendChild(grid);

    if (tab === "chars") {
      NS.Chars.list.forEach(function (ch) {
        var owned = Save.owns("chars", ch.id);
        var card = U.el("div", "shop-card" + (owned ? " owned" : "") + (Save.data.equip.char === ch.id ? " equipped" : ""));
        var pw = U.el("div", "shop-prev");
        pw.appendChild(portrait(ch, null));
        card.appendChild(pw);
        card.appendChild(U.el("div", "shop-name", U.esc(ch.name)));
        card.appendChild(U.el("div", "shop-desc", U.esc(ch.role + " · " + (owned ? "Desbloqueado" : ch.unlockNote))));
        card.appendChild(shopBtn("chars", ch.id, ch.price, owned, Save.data.equip.char === ch.id));
        grid.appendChild(card);
      });
    } else if (tab === "skins") {
      NS.Shop.SKINS.forEach(function (sk) {
        var owned = Save.owns("skins", sk.id);
        var card = U.el("div", "shop-card" + (owned ? " owned" : "") + (Save.data.equip.skin === sk.id ? " equipped" : ""));
        var pw = U.el("div", "shop-prev");
        pw.appendChild(portrait(NS.Chars.selected(), sk.main ? sk : null));
        card.appendChild(pw);
        card.appendChild(U.el("div", "shop-name", U.esc(sk.name)));
        card.appendChild(U.el("div", "shop-desc", U.esc(sk.desc)));
        card.appendChild(shopBtn("skins", sk.id, sk.price, owned, Save.data.equip.skin === sk.id));
        grid.appendChild(card);
      });
    } else if (tab === "fx") {
      NS.Shop.FX.forEach(function (f) {
        var owned = Save.owns("fx", f.id);
        var card = U.el("div", "shop-card" + (owned ? " owned" : "") + (Save.data.equip.fx === f.id ? " equipped" : ""));
        var pw = U.el("div", "shop-prev");
        pw.appendChild(U.el("div", "fx-ico", f.ico));
        pw.firstChild.style.color = f.color === "rainbow" ? "#ff2fb9" : (f.color || "#25e0ff");
        card.appendChild(pw);
        card.appendChild(U.el("div", "shop-name", U.esc(f.name)));
        card.appendChild(U.el("div", "shop-desc", U.esc(f.desc)));
        card.appendChild(shopBtn("fx", f.id, f.price, owned, Save.data.equip.fx === f.id));
        grid.appendChild(card);
      });
    } else {
      NS.Shop.BOOSTS.forEach(function (b) {
        var owned = NS.Shop.hasBoost(b.id);
        var card = U.el("div", "shop-card" + (owned ? " owned" : ""));
        var pw = U.el("div", "shop-prev");
        pw.appendChild(U.el("div", "fx-ico", b.ico));
        card.appendChild(pw);
        card.appendChild(U.el("div", "shop-name", U.esc(b.name)));
        card.appendChild(U.el("div", "shop-desc", U.esc(b.desc)));
        card.appendChild(shopBtn("boost", b.id, b.price, owned, false));
        grid.appendChild(card);
      });
    }
  };

  function shopBtn(kind, id, price, owned, equipped) {
    var b = U.el("button", "btn");
    if (equipped) { b.textContent = "EQUIPADO"; b.disabled = true; b.className = "btn btn-ghost"; return b; }
    if (owned) {
      if (kind === "boost") { b.textContent = "ACTIVO"; b.disabled = true; b.className = "btn btn-ghost"; return b; }
      b.textContent = "EQUIPAR"; b.className = "btn btn-primary";
      U.on(b, "click", function () {
        NS.Shop.equip(kind, id);
        A.sfx("click");
        UI.renderShop(UI._shopTab);
      });
      return b;
    }
    b.innerHTML = "◈ " + U.fmt(price);
    if (Save.data.coins < price) b.disabled = true; else b.className = "btn btn-primary";
    U.on(b, "click", function () {
      var r = NS.Shop.buy(kind, id);
      if (r === "ok") {
        A.sfx("unlock");
        UI.toast("COMPRADO", "good");
        if (kind === "chars") { NS.Missions.event("charUnlock", 1); NS.Ach.check(); }
        UI.renderShop(UI._shopTab);
        UI.renderMenu();
      } else { A.sfx("error"); UI.toast("MONEDAS INSUFICIENTES", "bad"); }
    });
    return b;
  }

  // ============================================================
  //  MISSIONS
  // ============================================================
  UI.renderMissions = function (tab) {
    UI._misTab = tab;
    U.qsa("#mission-tabs .tab").forEach(function (t) { t.classList.toggle("active", t.dataset.tab === tab); });
    var m = NS.Missions.ensure();
    var arr = tab === "daily" ? m.daily : m.perm;
    var box = el["mission-list"];
    box.innerHTML = "";

    if (tab === "daily") {
      var s = NS.Missions.timeToReset();
      var h = Math.floor(s / 3600), mi = Math.floor((s % 3600) / 60);
      box.appendChild(U.el("div", "empty-note", "Se renuevan en " + h + "h " + mi + "m"));
    }

    arr.forEach(function (q) {
      var row = U.el("div", "row mission-row" + (q.done ? " done" : "") + (q.claimed ? " claimed" : ""));
      var rw = [];
      if (q.rw.coins) rw.push("◈ " + q.rw.coins);
      if (q.rw.shards) rw.push("❖ " + q.rw.shards);
      if (q.rw.xp) rw.push(q.rw.xp + " XP");
      row.innerHTML =
        '<div class="r-ico">' + (q.claimed ? "✓" : (q.done ? "★" : "○")) + '</div>' +
        '<div class="r-main">' +
        '<div class="r-name">' + U.esc(q.txt) + '</div>' +
        '<div class="r-desc">' + U.esc(rw.join("  ")) + '</div>' +
        '<div class="progress-mini"><div style="width:' + Math.min(100, q.prog / q.goal * 100) + '%"></div></div>' +
        '<div class="r-desc">' + U.fmt(q.prog) + " / " + U.fmt(q.goal) + '</div>' +
        '</div>';
      var side = U.el("div", "r-side");
      if (q.claimed) side.appendChild(U.el("span", "pill ok", "HECHO"));
      else if (q.done) {
        var b = U.el("button", "btn btn-primary", "COBRAR");
        b.style.minHeight = "38px";
        U.on(b, "click", function () {
          if (NS.Missions.claim(tab, q.id)) {
            UI.toast("RECOMPENSA OBTENIDA", "good");
            UI.renderMissions(tab); UI.renderMenu();
          }
        });
        side.appendChild(b);
      } else side.appendChild(U.el("span", "pill", "EN CURSO"));
      row.appendChild(side);
      box.appendChild(row);
    });
  };

  // ============================================================
  //  ACHIEVEMENTS
  // ============================================================
  UI.renderAch = function () {
    var box = el["ach-list"];
    box.innerHTML = "";
    el["ach-count"].textContent = NS.Ach.total() + "/" + NS.Ach.count;
    var grid = U.el("div", "ach-grid");
    NS.Ach.LIST.forEach(function (a) {
      var on = NS.Ach.unlocked(a.id);
      var c = U.el("div", "ach-card" + (on ? " unlocked" : ""));
      c.innerHTML =
        '<div class="ach-ico">' + a.ico + '</div>' +
        '<div class="ach-name">' + U.esc(a.name) + '</div>' +
        '<div class="ach-desc">' + U.esc(a.desc) + '</div>' +
        (on ? '<div class="ach-desc" style="color:var(--gold)">◈ ' + (a.coins || 0) + (a.shards ? "  ❖ " + a.shards : "") + '</div>' : "");
      grid.appendChild(c);
    });
    box.appendChild(grid);
  };

  // ============================================================
  //  STATS
  // ============================================================
  UI.renderStats = function () {
    var s = Save.data.stats;
    var box = el["stats-list"];
    box.innerHTML = "";
    var grid = U.el("div", "stat-grid");
    var rows = [
      ["INCURSIONES", s.runs], ["MUERTES", s.deaths], ["VICTORIAS", s.wins],
      ["ENEMIGOS", s.kills], ["ÉLITES", s.eliteKills], ["JEFES", s.bossKills],
      ["MEJOR PUNTUACIÓN", U.fmt(s.bestScore)], ["MEJOR ZONA", s.bestZone], ["MEJOR COMBO", "x" + s.bestCombo],
      ["SALAS", s.roomsCleared], ["DETONACIONES", s.detonations], ["SOUL SHIFTS", s.shifts],
      ["ESQUIVAS", s.dashes], ["MEJORAS", s.upgradesTaken], ["MONEDAS TOTALES", U.fmt(s.totalCoins)],
      ["TIEMPO JUGADO", U.time(s.totalTime)], ["MEJOR TIEMPO", U.time(s.bestTime)], ["NIVEL", Save.data.level]
    ];
    rows.forEach(function (r) {
      var b = U.el("div", "stat-box");
      b.innerHTML = '<div class="stat-val">' + r[1] + '</div><div class="stat-key">' + r[0] + '</div>';
      grid.appendChild(b);
    });
    box.appendChild(grid);
  };

  // ============================================================
  //  SETTINGS
  // ============================================================
  UI.renderSettings = function () {
    var box = el["settings-list"];
    box.innerHTML = "";
    var st = Save.data.settings;

    box.appendChild(slider("MÚSICA", st.music, function (v) { st.music = v; A.applyVolumes(); Save.saveSoon(); }));
    box.appendChild(slider("EFECTOS", st.sfx, function (v) { st.sfx = v; A.applyVolumes(); Save.saveSoon(); A.sfx("click"); }));
    box.appendChild(toggle("VIBRACIÓN", "Sólo en dispositivos compatibles", st.vibrate, function (v) {
      st.vibrate = v; Save.saveSoon(); if (v) A.vibrate(40);
    }));
    box.appendChild(slider("SACUDIDA DE CÁMARA", st.shake, function (v) { st.shake = v; Save.saveSoon(); }, 0, 1.5));
    box.appendChild(seg("CALIDAD", ["low", "auto", "high"], ["BAJA", "AUTO", "ALTA"], st.quality, function (v) {
      st.quality = v; Save.saveSoon(); NS.Render.resize();
    }));
    box.appendChild(seg("JOYSTICK", ["left", "right"], ["IZQUIERDA", "DERECHA"], st.stickSide, function (v) {
      st.stickSide = v; Save.saveSoon();
      document.body.classList.toggle("stick-right", v === "right");
    }));
    box.appendChild(toggle("APUNTADO AUTOMÁTICO", "Apunta al enemigo más cercano", st.autoAim, function (v) { st.autoAim = v; Save.saveSoon(); }));
    box.appendChild(toggle("NÚMEROS DE DAÑO", "", st.damageNumbers, function (v) { st.damageNumbers = v; Save.saveSoon(); }));
    box.appendChild(toggle("MOSTRAR FPS", "", st.showFps, function (v) {
      st.showFps = v; Save.saveSoon();
      el["fps-meter"].classList.toggle("hidden", !v);
    }));
    box.appendChild(toggle("CONTROLES TÁCTILES", "Forzar joystick en PC", document.body.classList.contains("force-touch"), function (v) {
      document.body.classList.toggle("force-touch", v);
      NS.Input.setTouchMode(v || NS.Input.touchMode);
      if (NS.Game.state === "playing") NS.Input.showTouch(v || NS.Input.touchMode);
    }));

    var ctrl = U.el("div", "row");
    ctrl.innerHTML = '<div class="r-main"><div class="r-name">CONTROLES PC</div><div class="r-desc">' +
      'WASD / Flechas: mover<br>Ratón: apuntar · Clic izq / J: atacar (mantén para carga)<br>' +
      'Clic der / K: esquiva · ESPACIO: habilidad<br>SHIFT: Soul Shift · ESC: pausa</div></div>';
    box.appendChild(ctrl);

    var reset = U.el("button", "btn btn-danger", "BORRAR PROGRESO (RESET SAVE)");
    reset.style.width = "100%";
    reset.style.marginTop = "10px";
    var armed = false;
    U.on(reset, "click", function () {
      if (!armed) {
        armed = true;
        reset.textContent = "¿SEGURO? PULSA OTRA VEZ";
        A.sfx("error");
        setTimeout(function () { armed = false; reset.textContent = "BORRAR PROGRESO (RESET SAVE)"; }, 3500);
        return;
      }
      Save.reset();
      A.sfx("error");
      UI.toast("PROGRESO BORRADO", "bad");
      NS.Missions.ensure();
      UI.renderSettings(); UI.renderMenu();
    });
    box.appendChild(reset);

    var ver = U.el("div", "empty-note", "NEON SOUL v1.0.0 — hecho con HTML5 Canvas + Web Audio");
    box.appendChild(ver);
  };

  function slider(label, val, cb, min, max) {
    var row = U.el("div", "set-row");
    row.appendChild(U.el("div", "set-label", label));
    var i = document.createElement("input");
    i.type = "range"; i.min = min === undefined ? 0 : min; i.max = max === undefined ? 1 : max;
    i.step = "0.05"; i.value = val;
    U.on(i, "input", function () { cb(parseFloat(i.value)); });
    row.appendChild(i);
    return row;
  }
  function toggle(label, sub, val, cb) {
    var row = U.el("div", "set-row");
    row.appendChild(U.el("div", "set-label", label + (sub ? "<small>" + sub + "</small>" : "")));
    var s = U.el("div", "switch" + (val ? " on" : ""), "<i></i>");
    U.on(s, "click", function () {
      var on = !s.classList.contains("on");
      s.classList.toggle("on", on);
      A.sfx("click");
      cb(on);
    });
    row.appendChild(s);
    return row;
  }
  function seg(label, vals, labels, cur, cb) {
    var row = U.el("div", "set-row");
    row.appendChild(U.el("div", "set-label", label));
    var s = U.el("div", "seg");
    vals.forEach(function (v, i) {
      var b = U.el("button", cur === v ? "on" : "", labels[i]);
      U.on(b, "click", function () {
        U.qsa("button", s).forEach(function (x) { x.classList.remove("on"); });
        b.classList.add("on");
        A.sfx("click");
        cb(v);
      });
      s.appendChild(b);
    });
    row.appendChild(s);
    return row;
  }

  // ============================================================
  //  MAP
  // ============================================================
  UI.showMap = function (G) {
    var zone = G.zone;
    el["map-zone"].textContent = "ZONA " + zone.id + " — " + zone.name;
    var prog = el["map-progress"];
    prog.innerHTML = "";
    for (var i = 0; i < G.mapSteps.length; i++) {
      var d = U.el("div", "mp" + (i < G.stepIdx ? " done" : "") + (i === G.mapSteps.length - 1 ? " boss" : ""));
      prog.appendChild(d);
    }
    var box = el["map-nodes"];
    box.innerHTML = "";
    var choices = G.mapSteps[G.stepIdx] || [{ type: "boss" }];
    choices.forEach(function (c) {
      var info = NS.Proc.NODE_INFO[c.type];
      var b = U.el("button", "node-card t-" + c.type);
      b.innerHTML =
        '<div class="node-ico">' + info.ico + '</div>' +
        '<div class="node-name">' + info.name + '</div>' +
        '<div class="node-desc">' + info.desc + '</div>';
      U.on(b, "click", function () {
        A.sfx("click");
        G.enterNode(c);
      });
      box.appendChild(b);
    });
    var p = G.player;
    el["map-stats"].innerHTML =
      "<span>♥ " + Math.ceil(p.hp) + "/" + p.maxHp + "</span>" +
      "<span>◈ " + U.fmt(G.coins) + "</span>" +
      "<span>✦ DAÑO " + Math.round(p.baseDmg) + "</span>" +
      "<span>SALA " + (G.stepIdx + 1) + "/" + G.mapSteps.length + "</span>";
    UI.showScreen("map");
  };

  // ============================================================
  //  REWARD (upgrade choice)
  // ============================================================
  UI.showReward = function (G, offers, opts) {
    opts = opts || {};
    el["reward-title"].textContent = opts.title || "ELIGE UNA MEJORA";
    el["reward-sub"].textContent = opts.sub || "Sala despejada";
    var box = el["reward-cards"];
    box.innerHTML = "";
    var p = G.player;

    offers.forEach(function (u) {
      var rar = NS.Upgrades.RAR[u.rarity];
      var have = p.ups[u.id] || 0;
      var syn = NS.Upgrades.synergyHint(u, p);
      var b = U.el("button", "up-card " + rar.cls);
      b.innerHTML =
        '<div class="up-ico">' + u.icon + '</div>' +
        '<div class="up-rar">' + rar.label + '</div>' +
        '<div class="up-name">' + U.esc(u.name) + '</div>' +
        '<div class="up-desc">' + U.esc(u.desc) + '</div>' +
        (syn ? '<div class="up-syn">✦ ' + syn + '</div>' : "") +
        (have ? '<div class="up-have">TIENES x' + have + '</div>' : "");
      U.on(b, "click", function () { G.takeUpgrade(u); });
      box.appendChild(b);
    });

    var rr = el["reward-reroll"];
    el["reroll-count"].textContent = G.rerolls;
    rr.disabled = G.rerolls <= 0;
    UI.showScreen("reward");
  };

  // ============================================================
  //  EVENT
  // ============================================================
  UI.showEvent = function (G, ev) {
    el["event-icon"].textContent = ev.ico;
    el["event-title"].textContent = ev.title;
    el["event-text"].textContent = ev.text;
    var box = el["event-choices"];
    box.innerHTML = "";
    ev.choices.forEach(function (c) {
      if (c.show && !c.show(G)) return;
      var b = U.el("button", "btn");
      b.innerHTML = "<span>" + U.esc(c.label) + "</span><small>" + U.esc(c.desc) + "</small>";
      U.on(b, "click", function () {
        A.sfx("click");
        c.run(G);
      });
      box.appendChild(b);
    });
    UI.showScreen("event");
  };

  // ============================================================
  //  RUN SHOP
  // ============================================================
  UI.showRunShop = function (G, items) {
    el["runshop-coins"].textContent = U.fmt(G.coins);
    var box = el["runshop-items"];
    box.innerHTML = "";
    items.forEach(function (it, idx) {
      var card = U.el("div", "rs-card " + (it.rarCls || "rar-common") + (it.sold ? " sold" : ""));
      card.innerHTML =
        '<div class="up-ico" style="font-size:26px">' + it.icon + '</div>' +
        '<div class="shop-name">' + U.esc(it.name) + '</div>' +
        '<div class="shop-desc">' + U.esc(it.desc) + '</div>' +
        '<div class="rs-price">◈ ' + it.price + '</div>';
      var b = U.el("button", "btn" + (G.coins >= it.price ? " btn-primary" : ""), it.sold ? "VENDIDO" : "COMPRAR");
      if (it.sold || G.coins < it.price) b.disabled = true;
      U.on(b, "click", function () { G.buyRunItem(idx); });
      card.appendChild(b);
      box.appendChild(card);
    });
    UI.showScreen("runshop");
  };

  // ============================================================
  //  PAUSE / BUILD
  // ============================================================
  UI.showPause = function (G) {
    var p = G.player;
    el["pause-stats"].innerHTML =
      psBox("VIDA", Math.ceil(p.hp) + "/" + p.maxHp) +
      psBox("DAÑO", Math.round(p.baseDmg)) +
      psBox("ZONA", G.zone.id) +
      psBox("SALA", (G.stepIdx + 1) + "/" + G.mapSteps.length) +
      psBox("COMBO", "x" + G.bestCombo) +
      psBox("TIEMPO", U.time(G.stats.time));
    UI.showScreen("pause");
  };
  function psBox(k, v) { return '<div class="ps-box"><div class="ps-val">' + v + '</div><div class="ps-key">' + k + '</div></div>'; }

  UI.showBuild = function (G) {
    var p = G.player;
    el["build-stats"].innerHTML =
      psBox("VIDA", Math.ceil(p.hp) + "/" + p.maxHp) +
      psBox("DAÑO", Math.round(p.baseDmg)) +
      psBox("CADENCIA", (1 / p.baseAtkCd).toFixed(1) + "/s") +
      psBox("CRÍTICO", Math.round(p.crit * 100) + "%") +
      psBox("VELOCIDAD", Math.round(p.baseSpeed)) +
      psBox("PROYECTILES", p.projCount) +
      psBox("ALMA", Math.round(p.soulMax)) +
      psBox("ESCUDO", Math.round(p.maxShield()));
    var box = el["build-upgrades"];
    box.innerHTML = "";
    var any = false;
    for (var id in p.ups) {
      if (!p.ups[id]) continue;
      any = true;
      var u = NS.Upgrades.get(id);
      if (!u) continue;
      var chip = U.el("div", "bu-chip " + NS.Upgrades.RAR[u.rarity].cls);
      chip.innerHTML = "<b>" + u.icon + "</b> " + U.esc(u.name) + (p.ups[id] > 1 ? " x" + p.ups[id] : "");
      box.appendChild(chip);
    }
    if (!any) box.appendChild(U.el("div", "empty-note", "Todavía no tienes mejoras."));
    UI.showScreen("build");
  };

  // ============================================================
  //  GAME OVER
  // ============================================================
  UI.showGameOver = function (G, res) {
    el["go-title"].textContent = res.win ? "NEXUS PURGADO" : "ALMA DISUELTA";
    el["go-title"].classList.toggle("win", !!res.win);
    el["go-sub"].textContent = res.win
      ? "Has purgado el núcleo. El Nexus volverá... más fuerte."
      : ("Caíste en " + G.zone.name + " · sala " + (G.stepIdx + 1));
    el["go-score"].textContent = U.fmt(res.score);
    el["go-grid"].innerHTML =
      psBox("ENEMIGOS", G.stats.kills) +
      psBox("ZONA", G.zone.id) +
      psBox("TIEMPO", U.time(G.stats.time)) +
      psBox("MEJOR COMBO", "x" + G.bestCombo) +
      psBox("JEFES", G.stats.bosses) +
      psBox("DETONACIONES", G.stats.detonations);

    var rw = el["go-rewards"];
    rw.innerHTML = "";
    rw.appendChild(rwRow("◈ MONEDAS", res.coins));
    rw.appendChild(rwRow("❖ FRAGMENTOS", res.shards));
    rw.appendChild(rwRow("XP", res.xp));
    if (res.levelUps) rw.appendChild(rwRow("★ SUBIDA DE NIVEL", res.levelUps));
    UI.showScreen("gameover");
  };
  function rwRow(k, v) {
    var d = U.el("div", "go-rw");
    d.innerHTML = "<span>" + k + "</span><b>+" + U.fmt(v) + "</b>";
    return d;
  }

  // ============================================================
  //  HUD (called every frame, throttled internally)
  // ============================================================
  UI.hudShow = function (on) {
    el["hud"].classList.toggle("hidden", !on);
    var touch = NS.Input.touchMode || document.body.classList.contains("force-touch");
    el["touch-controls"].classList.toggle("hidden", !(on && touch));
  };

  var lastHp = -1, lastSoul = -1, lastCoin = -1, ghostHp = 1;
  UI.hud = function (G, dt) {
    var p = G.player;
    if (!p) return;
    UI._hudT += dt;

    var hpF = U.clamp(p.hp / p.maxHp, 0, 1);
    if (hpF !== lastHp) {
      el["hp-fill"].style.width = (hpF * 100) + "%";
      el["hp-text"].textContent = Math.ceil(Math.max(0, p.hp)) + "/" + p.maxHp;
      el["hp-fill"].parentNode.classList.toggle("low", hpF < 0.3);
      lastHp = hpF;
    }
    ghostHp = ghostHp > hpF ? Math.max(hpF, ghostHp - dt * 0.35) : hpF;
    el["hp-ghost"].style.width = (ghostHp * 100) + "%";

    var ms = p.maxShield();
    if (ms > 0) {
      el["shield-bar"].classList.remove("hidden");
      el["shield-fill"].style.width = (U.clamp(p.shield / ms, 0, 1) * 100) + "%";
    } else el["shield-bar"].classList.add("hidden");

    var sF = U.clamp(p.soul / p.soulMax, 0, 1);
    if (Math.abs(sF - lastSoul) > 0.004) {
      el["soul-fill"].style.width = (sF * 100) + "%";
      lastSoul = sF;
    }
    el["soul-text"].textContent = (p.state === "soul" ? "ALMA " : "FURIA ") + Math.round(p.soul);
    el["state-text"].textContent = p.state === "soul" ? "ALMA" : "FURIA";

    if (G.coins !== lastCoin) { el["coin-run"].textContent = U.fmt(G.coins); lastCoin = G.coins; }
    if (UI._hudT > 0.25) {
      UI._hudT = 0;
      el["timer"].textContent = U.time(G.stats.time);
    }

    // combo
    var cd = el["combo-display"];
    if (G.combo >= 3) {
      cd.classList.add("on");
      el["combo-num"].textContent = G.combo;
    } else cd.classList.remove("on");

    // cooldown rings
    setCd(el["cd-dash"], p.dashCharge >= 1 ? 0 : 1 - p.dashTimer / p.dashCdV);
    setCd(el["cd-ability"], p.abilityCd > 0 ? p.abilityCd / p.abilityCdV : 0);
    var cost = p.ch.mods.shiftCost * p.s.shiftCostMul;
    var shiftReady = p.state === "soul" || p.soul >= cost + 5;
    setCd(el["cd-shift"], shiftReady ? 0 : 1 - p.soul / (cost + 5));
    el["tb-shift"].classList.toggle("ready", shiftReady && p.state === "fury");
    el["tb-attack"].classList.toggle("charging", p.chargeReady);

    // boss bar
    if (G.boss && !G.boss.dead) {
      el["boss-bar-wrap"].classList.remove("hidden");
      el["boss-name"].textContent = G.boss.name;
      var bf = U.clamp(G.boss.hp / G.boss.maxHp, 0, 1);
      el["boss-fill"].style.width = (bf * 100) + "%";
      if (!UI._bossGhost || UI._bossGhost < bf) UI._bossGhost = bf;
      UI._bossGhost = Math.max(bf, UI._bossGhost - dt * 0.25);
      el["boss-ghost"].style.width = (UI._bossGhost * 100) + "%";
      if (el["boss-phases"].childElementCount !== G.boss.phaseCount) {
        el["boss-phases"].innerHTML = "";
        for (var i = 0; i < G.boss.phaseCount; i++) el["boss-phases"].appendChild(U.el("div", "bp"));
      }
      U.qsa(".bp", el["boss-phases"]).forEach(function (d, i) {
        d.classList.toggle("on", i <= G.boss.phase);
      });
    } else {
      el["boss-bar-wrap"].classList.add("hidden");
      UI._bossGhost = 1;
    }

    // room track
    if (G.roomTrackDirty) {
      G.roomTrackDirty = false;
      var rt = el["room-track"];
      rt.innerHTML = "";
      for (var k = 0; k < G.mapSteps.length; k++) {
        var cls = "rt";
        if (k < G.stepIdx) cls += " done";
        else if (k === G.stepIdx) cls += " cur";
        if (k === G.mapSteps.length - 1) cls += " boss";
        rt.appendChild(U.el("div", cls));
      }
      el["zone-name"].textContent = G.zone.name;
    }
  };
  function setCd(node, frac) {
    if (!node) return;
    node.style.setProperty("--cd", U.clamp(frac, 0, 1) * 100 + "%");
  }

  UI.fps = function (v) {
    if (!Save.data.settings.showFps) return;
    el["fps-meter"].textContent = v + " FPS · " + NS.Particles.count() + "p";
  };

  // ============================================================
  //  BOOT + BINDINGS
  // ============================================================
  UI.init = function () {
    cache();
    if (Save.data.settings.stickSide === "right") document.body.classList.add("stick-right");
    if (Save.data.settings.showFps) el["fps-meter"].classList.remove("hidden");

    U.qsa("[data-go]").forEach(function (b) {
      U.on(b, "click", function () { UI.go(b.dataset.go); });
    });
    U.qsa("[data-back]").forEach(function (b) {
      U.on(b, "click", function () { UI.back(); });
    });
    U.qsa("#shop-tabs .tab").forEach(function (t) {
      U.on(t, "click", function () { A.sfx("click"); UI.renderShop(t.dataset.tab); });
    });
    U.qsa("#mission-tabs .tab").forEach(function (t) {
      U.on(t, "click", function () { A.sfx("click"); UI.renderMissions(t.dataset.tab); });
    });

    U.on(U.$("btn-pause"), "click", function () { NS.Game.togglePause(); });
    U.on(U.$("pause-resume"), "click", function () { A.sfx("click"); NS.Game.togglePause(); });
    U.on(U.$("pause-build"), "click", function () { A.sfx("click"); UI.showBuild(NS.Game); });
    U.on(U.$("build-close"), "click", function () { A.sfx("back"); UI.showScreen("pause"); });
    U.on(U.$("pause-settings"), "click", function () {
      A.sfx("click"); UI.fromPause = true; UI.renderSettings(); UI.showScreen("settings");
    });
    U.on(U.$("pause-quit"), "click", function () { A.sfx("back"); NS.Game.quitRun(); });
    U.on(U.$("go-retry"), "click", function () { A.sfx("click"); NS.Game.startRun(); });
    U.on(U.$("go-menu"), "click", function () { A.sfx("back"); NS.Game.toMenu(); });
    U.on(U.$("reward-reroll"), "click", function () { NS.Game.rerollReward(); });
    U.on(U.$("runshop-leave"), "click", function () { A.sfx("back"); NS.Game.leaveRunShop(); });
  };

  NS.UI = UI;
})(window.NS);
