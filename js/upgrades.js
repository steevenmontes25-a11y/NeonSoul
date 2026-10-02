/* ============================================================
   NEON SOUL - upgrades.js
   Run upgrades (temporary, lost on death) + synergies
   -> To add an upgrade: push into LIST. apply(p) mutates p.s (stats)
      and p.flags. rarity drives drop weight.
   ============================================================ */
(function (NS) {
  "use strict";
  var U = NS.U;

  var RAR = {
    common: { w: 100, label: "COMUN", cls: "rar-common" },
    rare: { w: 46, label: "RARO", cls: "rar-rare" },
    epic: { w: 18, label: "EPICO", cls: "rar-epic" },
    legendary: { w: 5, label: "LEGENDARIO", cls: "rar-legendary" }
  };

  var LIST = [
    /* ---------------- COMMON ---------------- */
    { id: "core", name: "NÚCLEO AFILADO", icon: "✦", rarity: "common", tags: ["dmg"], max: 8,
      desc: "+18% daño", apply: function (p) { p.s.dmgMul += 0.18; } },
    { id: "legs", name: "PIERNAS LIGERAS", icon: "➤", rarity: "common", tags: ["move"], max: 6,
      desc: "+12% velocidad de movimiento", apply: function (p) { p.s.speedMul += 0.12; } },
    { id: "pulse", name: "PULSO RÁPIDO", icon: "⚡", rarity: "common", tags: ["atk"], max: 8,
      desc: "+15% cadencia de ataque", apply: function (p) { p.s.atkSpdMul += 0.15; } },
    { id: "plate", name: "PLACA BLINDADA", icon: "⛨", rarity: "common", tags: ["hp"], max: 8,
      desc: "+25 vida máxima (y cura 25)", apply: function (p) { p.s.hpFlat += 25; p.heal(25); } },
    { id: "lens", name: "LENTE DE FRACTURA", icon: "◈", rarity: "common", tags: ["crit"], max: 6,
      desc: "+8% probabilidad crítica", apply: function (p) { p.s.crit += 0.08; } },
    { id: "soulfeed", name: "RECARGA DE ALMA", icon: "◐", rarity: "common", tags: ["soul"], max: 6,
      desc: "+25% regeneración de alma", apply: function (p) { p.s.soulRegenMul += 0.25; } },
    { id: "magnet", name: "IMÁN NEXUS", icon: "⦿", rarity: "common", tags: ["eco"], max: 4,
      desc: "+70% radio de recogida, +10% monedas", apply: function (p) { p.s.magnetMul += 0.7; p.s.coinMul += 0.1; } },
    { id: "dense", name: "MUNICIÓN DENSA", icon: "⬤", rarity: "common", tags: ["proj"], max: 5,
      desc: "+22% tamaño de proyectil, +10% daño", apply: function (p) { p.s.projSizeMul += 0.22; p.s.dmgMul += 0.1; } },
    { id: "reflex", name: "REFLEJO", icon: "↻", rarity: "common", tags: ["dash"], max: 5,
      desc: "-16% enfriamiento de esquiva", apply: function (p) { p.s.dashCdMul *= 0.84; } },
    { id: "markup", name: "MARCA PERSISTENTE", icon: "✹", rarity: "common", tags: ["mark"], max: 4,
      desc: "+1 marca por golpe en ALMA", apply: function (p) { p.s.markBonus += 1; } },
    { id: "reach", name: "ALCANCE EXTENDIDO", icon: "↔", rarity: "common", tags: ["proj"], max: 4,
      desc: "+25% alcance, +15% velocidad de proyectil", apply: function (p) { p.s.rangeMul += 0.25; p.s.projSpeedMul += 0.15; } },
    { id: "regen", name: "TEJIDO VIVO", icon: "⚕", rarity: "common", tags: ["hp"], max: 5,
      desc: "+1.3 vida por segundo", apply: function (p) { p.s.regen += 1.3; } },

    /* ---------------- RARE ---------------- */
    { id: "double", name: "DOBLE CAÑÓN", icon: "⟿", rarity: "rare", tags: ["proj", "multishot"], max: 3,
      desc: "+1 proyectil (-12% daño por disparo)", apply: function (p) { p.s.proj += 1; p.s.dmgMul -= 0.12; } },
    { id: "critedge", name: "FILO CRÍTICO", icon: "⚔", rarity: "rare", tags: ["crit"], max: 4,
      desc: "+12% crítico y +0.35 al multiplicador", apply: function (p) { p.s.crit += 0.12; p.s.critMul += 0.35; } },
    { id: "pierce", name: "PERFORANTE", icon: "➳", rarity: "rare", tags: ["proj"], max: 3,
      desc: "Los disparos atraviesan 1 enemigo más", apply: function (p) { p.s.pierce += 1; } },
    { id: "fire", name: "COMBUSTIÓN", icon: "♨", rarity: "rare", tags: ["fire", "elem"], max: 4,
      desc: "Los ataques aplican QUEMADURA (daño en el tiempo)", apply: function (p) { p.s.fire += 1; } },
    { id: "shock", name: "SOBRECARGA", icon: "⚡", rarity: "rare", tags: ["shock", "elem"], max: 4,
      desc: "Los ataques encadenan un RAYO a otro enemigo", apply: function (p) { p.s.shock += 1; } },
    { id: "frost", name: "ESCARCHA", icon: "❄", rarity: "rare", tags: ["frost", "elem"], max: 4,
      desc: "Los ataques RALENTIZAN a los enemigos", apply: function (p) { p.s.frost += 1; } },
    { id: "shield", name: "ESCUDO NEXUS", icon: "⛊", rarity: "rare", tags: ["def"], max: 4,
      desc: "+30 escudo que se recarga si no te golpean", apply: function (p) { p.s.shieldMax += 30; p.s.shieldRegen += 6; p.shield = p.maxShield(); } },
    { id: "vamp", name: "VAMPIRISMO", icon: "✤", rarity: "rare", tags: ["hp"], max: 4,
      desc: "Robas 4% del daño infligido como vida", apply: function (p) { p.s.lifesteal += 0.04; } },
    { id: "thorns", name: "ESPINAS DE DATOS", icon: "✵", rarity: "rare", tags: ["def"], max: 3,
      desc: "Devuelves 30% del daño recibido en área", apply: function (p) { p.s.thorns += 0.3; } },
    { id: "deepsoul", name: "ALMA PROFUNDA", icon: "●", rarity: "rare", tags: ["soul"], max: 4,
      desc: "+35% alma máxima y -20% coste de cambio", apply: function (p) { p.s.soulMaxMul += 0.35; p.s.shiftCostMul *= 0.8; } },
    { id: "deto", name: "DETONADOR", icon: "✹", rarity: "rare", tags: ["mark"], max: 5,
      desc: "+40% daño de detonación de marcas", apply: function (p) { p.s.detoMul += 0.4; } },
    { id: "dashdmg", name: "ESTELA LETAL", icon: "»", rarity: "rare", tags: ["dash"], max: 3,
      desc: "La esquiva daña y marca a quien atraviesas", apply: function (p) { p.s.dashDmg += 14; } },
    { id: "orbit", name: "ORBITAL", icon: "◌", rarity: "rare", tags: ["orbit"], max: 3,
      desc: "+1 fragmento que orbita y daña", apply: function (p) { p.s.orbitals += 1; } },
    { id: "shiftwave", name: "ONDA DE CAMBIO", icon: "◎", rarity: "rare", tags: ["shift"], max: 4,
      desc: "+80% radio y daño de la explosión al cambiar", apply: function (p) { p.s.shiftBurst += 0.8; } },
    { id: "dualheart", name: "CORAZÓN DOBLE", icon: "♥", rarity: "rare", tags: ["hp"], max: 4,
      desc: "+45 vida máxima y +7% armadura", apply: function (p) { p.s.hpFlat += 45; p.s.armor += 0.07; p.heal(45); } },
    { id: "frenzy", name: "CADENCIA FRENÉTICA", icon: "≋", rarity: "rare", tags: ["atk"], max: 4,
      desc: "+30% cadencia, -8% daño", apply: function (p) { p.s.atkSpdMul += 0.3; p.s.dmgMul -= 0.08; } },
    { id: "greed", name: "HAMBRE DE NEXUS", icon: "◆", rarity: "rare", tags: ["eco"], max: 4,
      desc: "+30% monedas y +20% XP obtenidos", apply: function (p) { p.s.coinMul += 0.3; p.s.xpMul += 0.2; } },
    { id: "dashplus", name: "MOTOR DE SALTO", icon: "⇉", rarity: "rare", tags: ["dash"], max: 2,
      desc: "+1 carga de esquiva", apply: function (p) { p.s.dashCharges += 1; } },

    /* ---------------- EPIC ---------------- */
    { id: "markstorm", name: "TORMENTA DE MARCAS", icon: "❂", rarity: "epic", tags: ["mark"], max: 2,
      desc: "Al detonar, los enemigos cercanos reciben 2 marcas", apply: function (p) { p.flags.markStorm = (p.flags.markStorm || 0) + 1; } },
    { id: "unstable", name: "NÚCLEO INESTABLE", icon: "☢", rarity: "epic", tags: ["dmg"], max: 3,
      desc: "+50% daño, -15% vida máxima", apply: function (p) { p.s.dmgMul += 0.5; p.s.hpMul -= 0.15; } },
    { id: "triplesoul", name: "TRIPLE ALMA", icon: "✵", rarity: "epic", tags: ["mark"], max: 2,
      desc: "+2 marcas por golpe en ALMA", apply: function (p) { p.s.markBonus += 2; } },
    { id: "volley", name: "ANDANADA", icon: "∴", rarity: "epic", tags: ["proj", "multishot"], max: 2,
      desc: "+2 proyectiles con dispersión amplia", apply: function (p) { p.s.proj += 2; p.s.spread += 0.12; } },
    { id: "furyengine", name: "MOTOR DE FURIA", icon: "▲", rarity: "epic", tags: ["shift"], max: 2,
      desc: "En FURIA: +30% cadencia y +15% velocidad", apply: function (p) { p.flags.furyEngine = (p.flags.furyEngine || 0) + 1; } },
    { id: "ghostbody", name: "CUERPO FANTASMA", icon: "◌", rarity: "epic", tags: ["shift", "def"], max: 1,
      desc: "En ALMA los proyectiles enemigos te atraviesan", apply: function (p) { p.flags.ghostBody = 1; } },
    { id: "critboom", name: "EXPLOSIVO", icon: "✹", rarity: "epic", tags: ["crit", "aoe"], max: 3,
      desc: "Los críticos provocan una explosión", apply: function (p) { p.s.explode += 1; } },
    { id: "revive", name: "SEGUNDA VIDA", icon: "✚", rarity: "epic", tags: ["def"], max: 2,
      desc: "Revives una vez con 50% de vida", apply: function (p) { p.s.revive += 1; } },
    { id: "timeloop", name: "BUCLE TEMPORAL", icon: "⌛", rarity: "epic", tags: ["ability"], max: 3,
      desc: "-30% enfriamiento de habilidad", apply: function (p) { p.s.abilityCdMul *= 0.7; } },
    { id: "heavycharge", name: "CARGADOR PESADO", icon: "▰", rarity: "epic", tags: ["charge"], max: 2,
      desc: "El ataque cargado carga el doble de rápido y pega +60%", apply: function (p) { p.s.chargeSpeed += 1; p.s.chargeDmg += 0.6; } },
    { id: "homing", name: "GUIADO NEXUS", icon: "⟳", rarity: "epic", tags: ["proj"], max: 2,
      desc: "Tus proyectiles persiguen a los enemigos", apply: function (p) { p.s.homing += 1; } },

    /* ---------------- LEGENDARY ---------------- */
    { id: "overdrive", name: "NEXUS OVERDRIVE", icon: "✹", rarity: "legendary", tags: ["dmg"], max: 1,
      desc: "+65% daño, +25% velocidad, -25% vida máxima",
      apply: function (p) { p.s.dmgMul += 0.65; p.s.speedMul += 0.25; p.s.hpMul -= 0.25; } },
    { id: "eternal", name: "ALMA ETERNA", icon: "♾", rarity: "legendary", tags: ["soul", "shift"], max: 1,
      desc: "El estado ALMA gasta 65% menos y te da +30% velocidad extra",
      apply: function (p) { p.s.soulDrainMul *= 0.35; p.flags.eternal = 1; } },
    { id: "judgement", name: "JUICIO", icon: "☇", rarity: "legendary", tags: ["dmg"], max: 1,
      desc: "Cada 12 impactos cae un rayo devastador", apply: function (p) { p.flags.judgement = 1; } },
    { id: "resonance", name: "RESONANCIA", icon: "≋", rarity: "legendary", tags: ["mark"], max: 1,
      desc: "Detonar propaga la explosión a TODOS los enemigos marcados", apply: function (p) { p.flags.resonance = 1; } },
    { id: "singularity", name: "SINGULARIDAD", icon: "◉", rarity: "legendary", tags: ["aoe"], max: 1,
      desc: "Los enemigos muertos implosionan: atraen y dañan", apply: function (p) { p.flags.singularity = 1; } },

    /* ---------------- SYNERGY (conditional) ---------------- */
    { id: "inferno", name: "INFIERNO", icon: "♨", rarity: "epic", tags: ["fire", "syn"], max: 1,
      desc: "La QUEMADURA se propaga a enemigos cercanos y dura el doble",
      req: function (p) { return p.s.fire > 0; }, apply: function (p) { p.flags.inferno = 1; p.s.fire += 1; } },
    { id: "tempest", name: "TEMPESTAD", icon: "⚡", rarity: "epic", tags: ["shock", "syn"], max: 1,
      desc: "Las cadenas eléctricas saltan al doble de enemigos y pueden crítico",
      req: function (p) { return p.s.shock > 0; }, apply: function (p) { p.flags.tempest = 1; p.s.shock += 1; } },
    { id: "absolute", name: "CERO ABSOLUTO", icon: "❄", rarity: "epic", tags: ["frost", "syn"], max: 1,
      desc: "Los enemigos ralentizados reciben +45% de daño",
      req: function (p) { return p.s.frost > 0; }, apply: function (p) { p.flags.absolute = 1; } },
    { id: "swarm", name: "ENJAMBRE", icon: "∷", rarity: "epic", tags: ["proj", "syn"], max: 1,
      desc: "+2 proyectiles más y los disparos rebotan una vez",
      req: function (p) { return p.s.proj >= 2; }, apply: function (p) { p.s.proj += 2; p.s.bounce += 1; p.s.dmgMul -= 0.1; } },
    { id: "martyr", name: "MÁRTIR", icon: "✚", rarity: "legendary", tags: ["def", "syn"], max: 1,
      desc: "Al revivir borras la pantalla con una explosión brutal",
      req: function (p) { return p.s.revive > 0; }, apply: function (p) { p.flags.martyr = 1; p.s.revive += 1; } },
    { id: "blender", name: "LICUADORA", icon: "◌", rarity: "epic", tags: ["orbit", "syn"], max: 1,
      desc: "+2 orbitales, giran el doble de rápido y queman",
      req: function (p) { return p.s.orbitals >= 1; }, apply: function (p) { p.s.orbitals += 2; p.flags.blender = 1; } },
    { id: "avarice", name: "AVARICIA", icon: "◆", rarity: "epic", tags: ["eco", "syn"], max: 1,
      desc: "+60% monedas y cada moneda recogida cura 1 de vida",
      req: function (p) { return p.s.coinMul >= 1.25; }, apply: function (p) { p.s.coinMul += 0.6; p.flags.avarice = 1; } },
    { id: "berserk", name: "SANGRE FRÍA", icon: "☠", rarity: "epic", tags: ["dmg", "syn"], max: 1,
      desc: "Con menos del 40% de vida infliges +60% de daño",
      req: function (p) { return p.s.hpMul < 1 || p.s.dmgMul >= 1.6; }, apply: function (p) { p.flags.berserk = 1; } }
  ];

  var byId = {};
  LIST.forEach(function (u) { byId[u.id] = u; });

  var Up = {
    LIST: LIST, RAR: RAR,
    get: function (id) { return byId[id]; },

    /* Pick `n` distinct offers for a player. Luck raises rare+ odds. */
    roll: function (p, n, opts) {
      opts = opts || {};
      var luck = (p && p.s ? p.s.luck : 0) + (opts.luck || 0);
      var pool = LIST.filter(function (u) {
        var owned = (p.ups[u.id] || 0);
        if (owned >= (u.max || 99)) return false;
        if (u.req && !u.req(p)) return false;
        if (opts.onlyTags) {
          var ok = false;
          for (var i = 0; i < u.tags.length; i++) if (opts.onlyTags.indexOf(u.tags[i]) >= 0) ok = true;
          if (!ok) return false;
        }
        return true;
      });
      var out = [];
      var guard = 0;
      while (out.length < n && pool.length && guard++ < 200) {
        var pickIdx = -1;
        var total = 0, i;
        for (i = 0; i < pool.length; i++) total += weightOf(pool[i], luck);
        var r = Math.random() * total;
        for (i = 0; i < pool.length; i++) {
          r -= weightOf(pool[i], luck);
          if (r <= 0) { pickIdx = i; break; }
        }
        if (pickIdx < 0) pickIdx = pool.length - 1;
        out.push(pool[pickIdx]);
        pool.splice(pickIdx, 1);
      }
      return out;
    },

    /* Text hint shown on a card when the player already has synergy pieces */
    synergyHint: function (u, p) {
      var t = u.tags;
      if (t.indexOf("syn") >= 0) return "SINERGIA ACTIVA";
      if (t.indexOf("fire") >= 0 && p.s.fire > 0) return "+ COMBUSTIÓN";
      if (t.indexOf("shock") >= 0 && p.s.shock > 0) return "+ SOBRECARGA";
      if (t.indexOf("frost") >= 0 && p.s.frost > 0) return "+ ESCARCHA";
      if (t.indexOf("multishot") >= 0 && p.s.proj >= 1) return "+ MULTIDISPARO";
      if (t.indexOf("mark") >= 0 && p.s.markBonus > 0) return "+ MARCAS";
      if (t.indexOf("crit") >= 0 && p.s.crit >= 0.25) return "+ CRÍTICO";
      if (t.indexOf("orbit") >= 0 && p.s.orbitals > 0) return "+ ORBITALES";
      return null;
    },

    apply: function (p, u) {
      p.ups[u.id] = (p.ups[u.id] || 0) + 1;
      u.apply(p);
      p.recalc();
      NS.Save.bump("upgradesTaken");
    }
  };

  function weightOf(u, luck) {
    var w = RAR[u.rarity].w;
    if (u.rarity !== "common") w *= (1 + luck * 0.55);
    if (u.tags.indexOf("syn") >= 0) w *= 2.1; // synergies are exciting: show them
    return w;
  }

  NS.Upgrades = Up;
})(window.NS);
