/* ============================================================
   NEON SOUL - storage.js
   localStorage persistence, save schema, wallet & progression
   ============================================================ */
(function (NS) {
  "use strict";
  var U = NS.U;
  var KEY = "neonsoul_save_v1";

  var S = {};

  S.defaults = function () {
    return {
      v: 1,
      coins: 0,
      shards: 0,
      xp: 0,
      level: 1,
      chars: { soulrunner: 1 },
      skins: { default: 1 },
      fx: { default: 1 },
      equip: { char: "soulrunner", skin: "default", fx: "default" },
      meta: {},
      boost: {},
      stats: {
        runs: 0, deaths: 0, kills: 0, bossKills: 0, eliteKills: 0,
        bestScore: 0, bestZone: 1, bestCombo: 0, bestTime: 0,
        totalCoins: 0, totalTime: 0, shifts: 0, dashes: 0,
        detonations: 0, roomsCleared: 0, upgradesTaken: 0, wins: 0
      },
      ach: {},
      missions: { day: "", daily: [], perm: null },
      settings: {
        music: 0.55, sfx: 0.8, vibrate: true, shake: 1,
        quality: "auto", showFps: false, stickSide: "left",
        btnScale: 1, autoAim: true, damageNumbers: true
      }
    };
  };

  S.data = S.defaults();

  S.load = function () {
    var raw = null;
    try { raw = localStorage.getItem(KEY); } catch (e) { raw = null; }
    var def = S.defaults();
    if (!raw) { S.data = def; return S.data; }
    var parsed;
    try { parsed = JSON.parse(raw); } catch (e) { parsed = null; }
    if (!parsed || typeof parsed !== "object") { S.data = def; return S.data; }
    S.data = deepMerge(def, parsed);
    // sanity
    if (!S.data.chars.soulrunner) S.data.chars.soulrunner = 1;
    if (!S.data.skins.default) S.data.skins.default = 1;
    if (!S.data.equip.char || !S.data.chars[S.data.equip.char]) S.data.equip.char = "soulrunner";
    if (!S.data.equip.skin || !S.data.skins[S.data.equip.skin]) S.data.equip.skin = "default";
    if (!S.data.equip.fx || !S.data.fx[S.data.equip.fx]) S.data.equip.fx = "default";
    S.data.coins = Math.max(0, S.data.coins | 0);
    S.data.shards = Math.max(0, S.data.shards | 0);
    return S.data;
  };

  function deepMerge(base, over) {
    var out = Array.isArray(base) ? base.slice() : {}, k;
    if (!Array.isArray(base)) for (k in base) if (base.hasOwnProperty(k)) out[k] = base[k];
    if (Array.isArray(over)) return over.slice();
    for (k in over) {
      if (!over.hasOwnProperty(k)) continue;
      var bv = base ? base[k] : undefined, ov = over[k];
      if (ov && typeof ov === "object" && !Array.isArray(ov) && bv && typeof bv === "object" && !Array.isArray(bv)) {
        out[k] = deepMerge(bv, ov);
      } else {
        out[k] = ov;
      }
    }
    return out;
  }

  var saveTimer = null;
  S.save = function () {
    try { localStorage.setItem(KEY, JSON.stringify(S.data)); return true; }
    catch (e) { return false; }
  };
  S.saveSoon = function () {
    if (saveTimer) return;
    saveTimer = setTimeout(function () { saveTimer = null; S.save(); }, 450);
  };
  S.reset = function () {
    try { localStorage.removeItem(KEY); } catch (e) { }
    S.data = S.defaults();
    S.save();
  };

  // ---------- wallet ----------
  S.addCoins = function (n) {
    n = Math.max(0, Math.round(n));
    S.data.coins += n;
    S.data.stats.totalCoins += n;
    S.saveSoon();
    return n;
  };
  S.spendCoins = function (n) {
    if (S.data.coins < n) return false;
    S.data.coins -= n; S.saveSoon(); return true;
  };
  S.addShards = function (n) {
    n = Math.max(0, Math.round(n));
    S.data.shards += n; S.saveSoon(); return n;
  };
  S.spendShards = function (n) {
    if (S.data.shards < n) return false;
    S.data.shards -= n; S.saveSoon(); return true;
  };

  // ---------- xp / level ----------
  S.xpForLevel = function (lv) { return Math.round(100 + (lv - 1) * 85 + Math.pow(lv - 1, 1.75) * 16); };
  S.addXp = function (n) {
    n = Math.max(0, Math.round(n));
    S.data.xp += n;
    var ups = 0;
    while (S.data.xp >= S.xpForLevel(S.data.level)) {
      S.data.xp -= S.xpForLevel(S.data.level);
      S.data.level++;
      ups++;
      S.data.shards += 2;
    }
    S.saveSoon();
    return ups;
  };

  // ---------- ownership ----------
  S.owns = function (kind, id) { return !!(S.data[kind] && S.data[kind][id]); };
  S.unlock = function (kind, id) {
    if (!S.data[kind]) S.data[kind] = {};
    if (S.data[kind][id]) return false;
    S.data[kind][id] = 1;
    S.save();
    return true;
  };
  S.equip = function (kind, id) {
    S.data.equip[kind] = id;
    S.saveSoon();
  };

  // ---------- stats ----------
  S.bump = function (key, n) {
    if (S.data.stats[key] === undefined) S.data.stats[key] = 0;
    S.data.stats[key] += (n === undefined ? 1 : n);
    S.saveSoon();
  };
  S.best = function (key, v) {
    if (S.data.stats[key] === undefined) S.data.stats[key] = 0;
    if (v > S.data.stats[key]) { S.data.stats[key] = v; S.saveSoon(); return true; }
    return false;
  };

  // ---------- settings ----------
  S.set = function (key, val) { S.data.settings[key] = val; S.saveSoon(); };
  S.get = function (key) { return S.data.settings[key]; };

  NS.Save = S;
})(window.NS);
