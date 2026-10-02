/* ============================================================
   NEON SOUL - shop.js
   Everything is bought with COINS earned by playing.
   No real-money transactions anywhere in this game.
   ============================================================ */
(function (NS) {
  "use strict";
  var Save = NS.Save;

  var SKINS = [
    { id: "default", name: "ESTÁNDAR", price: 0, desc: "El aspecto original.", main: null, glow: null },
    { id: "deepblue", name: "AZUL PROFUNDO", price: 700, desc: "Frío como el vacío.", main: "#2f7bff", glow: "#25e0ff", bullet: "#7ec8ff" },
    { id: "blood", name: "SANGRE", price: 950, desc: "Marcado por la guerra.", main: "#ff3a55", glow: "#ff8a3d", bullet: "#ff6b7d" },
    { id: "virus", name: "VIRUS", price: 1300, desc: "Código corrupto vivo.", main: "#3dffa8", glow: "#a6ff3d", bullet: "#c4ff6b" },
    { id: "gold", name: "ORO NEXUS", price: 2100, desc: "Lujo en un mundo muerto.", main: "#ffc53d", glow: "#fff2b0", bullet: "#ffd76b" },
    { id: "void", name: "VACÍO", price: 2800, desc: "Absorbe la luz a su paso.", main: "#8b5cf6", glow: "#2b1055", bullet: "#c4a0ff" },
    { id: "mono", name: "MONOCROMO", price: 1600, desc: "Elegancia sin color.", main: "#e9e4ff", glow: "#9a90c0", bullet: "#ffffff" },
    { id: "prism", name: "PRISMA", price: 3800, desc: "Cambia de color al moverte.", main: "#ff2fb9", glow: "#25e0ff", bullet: "#ffffff", rainbow: true }
  ];

  var FX = [
    { id: "default", name: "ESTELA BÁSICA", price: 0, desc: "Partículas del personaje.", ico: "○", color: null },
    { id: "ember", name: "BRASAS", price: 900, desc: "Chispas ardientes al moverte.", ico: "♨", color: "#ff8a3d" },
    { id: "frost", name: "ESCARCHA", price: 1100, desc: "Cristales helados.", ico: "❄", color: "#a9f3ff" },
    { id: "voidfx", name: "GRIETA", price: 1500, desc: "Fragmentos de vacío.", ico: "◇", color: "#9b5cff" },
    { id: "prismfx", name: "ESPECTRO", price: 2400, desc: "Estela multicolor.", ico: "✦", color: "rainbow" }
  ];

  var BOOSTS = [
    { id: "reroll", name: "CHIP DE REINTENTO", price: 1500, ico: "↻", desc: "+1 reroll de mejoras en cada incursión." },
    { id: "soulstart", name: "ALMA CARGADA", price: 900, ico: "◐", desc: "Empiezas cada incursión con el alma llena." },
    { id: "startshield", name: "PLACA INICIAL", price: 2000, ico: "⛊", desc: "Empiezas con 25 de escudo regenerable." },
    { id: "lucky", name: "OJO DE LA SUERTE", price: 2600, ico: "✤", desc: "La primera elección de mejora muestra 4 cartas." },
    { id: "magnet", name: "IMÁN PERMANENTE", price: 1200, ico: "⦿", desc: "+25% de radio de recogida siempre." },
    { id: "dash", name: "MOTOR EXTRA", price: 4200, ico: "»", desc: "+1 carga de esquiva en todas las incursiones." },
    { id: "insurance", name: "SEGURO NEXUS", price: 3200, ico: "⚕", desc: "Conservas +25% de monedas al morir." }
  ];

  var skinById = {}, fxById = {}, boostById = {};
  SKINS.forEach(function (s) { skinById[s.id] = s; });
  FX.forEach(function (f) { fxById[f.id] = f; });
  BOOSTS.forEach(function (b) { boostById[b.id] = b; });

  var S = {
    SKINS: SKINS, FX: FX, BOOSTS: BOOSTS,
    skin: function (id) { return skinById[id] || SKINS[0]; },
    fx: function (id) { return fxById[id] || FX[0]; },
    boost: function (id) { return boostById[id]; },
    currentSkin: function () {
      var s = skinById[Save.data.equip.skin] || SKINS[0];
      return s.main ? s : null;
    },
    currentFx: function () { return fxById[Save.data.equip.fx] || FX[0]; },
    hasBoost: function (id) { return !!Save.data.boost[id]; },

    buy: function (kind, id) {
      var item, price;
      if (kind === "chars") {
        item = NS.Chars.get(id); price = item.price;
        if (Save.owns("chars", id)) return "owned";
      } else if (kind === "skins") {
        item = skinById[id]; price = item.price;
        if (Save.owns("skins", id)) return "owned";
      } else if (kind === "fx") {
        item = fxById[id]; price = item.price;
        if (Save.owns("fx", id)) return "owned";
      } else {
        item = boostById[id]; price = item.price;
        if (Save.data.boost[id]) return "owned";
      }
      if (!item) return "missing";
      if (Save.data.coins < price) return "poor";
      Save.spendCoins(price);
      if (kind === "boost") { Save.data.boost[id] = 1; }
      else { Save.unlock(kind, id); }
      Save.save();
      return "ok";
    },

    equip: function (kind, id) {
      if (kind === "chars") { Save.equip("char", id); }
      else if (kind === "skins") { Save.equip("skin", id); }
      else if (kind === "fx") { Save.equip("fx", id); }
    }
  };

  NS.Shop = S;
})(window.NS);
