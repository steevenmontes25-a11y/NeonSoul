/* ============================================================
   NEON SOUL - meta.js
   Permanent progression tree (spent with SHARDS).
   Deliberately capped so the player gets stronger but the game
   never becomes trivial: full tree is roughly +45% power.
   ============================================================ */
(function (NS) {
  "use strict";
  var Save = NS.Save;

  var NODES = [
    { id: "vitality", name: "VITALIDAD", ico: "♥", max: 8, base: 3, step: 2,
      desc: "+14 vida máxima por nivel", fmt: function (l) { return "+" + (l * 14) + " VIDA"; } },
    { id: "power", name: "POTENCIA", ico: "✦", max: 8, base: 4, step: 3,
      desc: "+5% de daño por nivel", fmt: function (l) { return "+" + (l * 5) + "% DAÑO"; } },
    { id: "swift", name: "AGILIDAD", ico: "➤", max: 6, base: 4, step: 3,
      desc: "+3% de velocidad por nivel", fmt: function (l) { return "+" + (l * 3) + "% VEL"; } },
    { id: "soulwell", name: "POZO DE ALMA", ico: "◐", max: 6, base: 5, step: 3,
      desc: "+8% de alma máxima por nivel", fmt: function (l) { return "+" + (l * 8) + "% ALMA"; } },
    { id: "precision", name: "PRECISIÓN", ico: "◈", max: 6, base: 5, step: 3,
      desc: "+2% de crítico por nivel", fmt: function (l) { return "+" + (l * 2) + "% CRIT"; } },
    { id: "fortune", name: "FORTUNA", ico: "◆", max: 5, base: 4, step: 3,
      desc: "+10% de monedas por nivel", fmt: function (l) { return "+" + (l * 10) + "% MONEDAS"; } },
    { id: "aegis", name: "ÉGIDA", ico: "⛊", max: 4, base: 7, step: 5,
      desc: "+10 de escudo regenerable por nivel", fmt: function (l) { return "+" + (l * 10) + " ESCUDO"; } },
    { id: "armor", name: "BLINDAJE", ico: "⛨", max: 5, base: 6, step: 4,
      desc: "+3% de reducción de daño por nivel", fmt: function (l) { return "+" + (l * 3) + "% ARMADURA"; } },
    { id: "luck", name: "SUERTE", ico: "✤", max: 4, base: 8, step: 6,
      desc: "Mejores rarezas en las recompensas", fmt: function (l) { return "+" + l + " SUERTE"; } },
    { id: "phoenix", name: "FÉNIX", ico: "✚", max: 2, base: 22, step: 22,
      desc: "Revives una vez más por partida", fmt: function (l) { return l + " REVIVIR"; } }
  ];

  var byId = {};
  NODES.forEach(function (n) { byId[n.id] = n; });

  var M = {
    NODES: NODES,
    level: function (id) { return (Save.data.meta[id] || 0); },
    cost: function (id) {
      var n = byId[id], l = M.level(id);
      if (l >= n.max) return null;
      return n.base + n.step * l;
    },
    canBuy: function (id) {
      var c = M.cost(id);
      return c !== null && Save.data.shards >= c;
    },
    buy: function (id) {
      var c = M.cost(id);
      if (c === null || !Save.spendShards(c)) return false;
      Save.data.meta[id] = M.level(id) + 1;
      Save.save();
      return true;
    },
    bonus: function () {
      var m = Save.data.meta;
      return {
        hpFlat: (m.vitality || 0) * 14,
        dmg: (m.power || 0) * 0.05,
        speed: (m.swift || 0) * 0.03,
        soul: (m.soulwell || 0) * 0.08,
        crit: (m.precision || 0) * 0.02,
        coin: (m.fortune || 0) * 0.10,
        shield: (m.aegis || 0) * 10,
        armor: (m.armor || 0) * 0.03,
        luck: (m.luck || 0) * 1,
        revive: (m.phoenix || 0)
      };
    },
    totalSpent: function () {
      var t = 0;
      NODES.forEach(function (n) {
        var l = M.level(n.id);
        for (var i = 0; i < l; i++) t += n.base + n.step * i;
      });
      return t;
    }
  };

  NS.Meta = M;
})(window.NS);
