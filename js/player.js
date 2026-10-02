/* ============================================================
   NEON SOUL - player.js
   The player entity and the SOUL SHIFT mechanic.

   SOUL SHIFT (core identity):
     ALMA  -> fast, evasive, weak hits that stack SOUL MARKS
     FURIA -> slow, heavy hits that DETONATE those marks
   Mastering when to swap is the whole game.
   ============================================================ */
(function (NS) {
  "use strict";
  var U = NS.U, P = NS.Particles, Cb = NS.Combat, A = NS.Audio;

  var CHARGE_TIME = 0.75;   // seconds of holding ATTACK to unlock the heavy shot

  function baseStats() {
    return {
      hpMul: 1, hpFlat: 0, regen: 0, speedMul: 1, dmgMul: 1, atkSpdMul: 1,
      crit: 0, critMul: 0, proj: 0, projSpeedMul: 1, projSizeMul: 1, pierce: 0,
      rangeMul: 1, dashCdMul: 1, dashCharges: 0, abilityCdMul: 1,
      soulMaxMul: 1, soulRegenMul: 1, soulDrainMul: 1, shiftCostMul: 1,
      markBonus: 0, detoMul: 1, detoRadMul: 1,
      lifesteal: 0, thorns: 0, armor: 0, luck: 0, magnetMul: 1,
      fire: 0, shock: 0, frost: 0, explode: 0, homing: 0, orbitals: 0, revive: 0,
      shieldMax: 0, shieldRegen: 0, dashDmg: 0, shiftBurst: 1,
      coinMul: 1, xpMul: 1, spread: 0, bounce: 0,
      chargeSpeed: 1, chargeDmg: 0
    };
  }

  function Player(charId, skin) {
    this.ch = NS.Chars.get(charId);
    this.skin = skin || null;
    this.fx = NS.Shop.currentFx();
    this.s = baseStats();
    this.flags = {};
    this.ups = {};

    var meta = NS.Meta.bonus();
    this.meta = meta;
    this.s.hpFlat += meta.hpFlat;
    this.s.dmgMul += meta.dmg;
    this.s.speedMul += meta.speed;
    this.s.crit += meta.crit;
    this.s.soulMaxMul += meta.soul;
    this.s.armor += meta.armor;
    this.s.luck += meta.luck;
    this.s.coinMul += meta.coin;
    this.s.revive += meta.revive;
    this.s.shieldMax += meta.shield;
    if (meta.shield > 0) this.s.shieldRegen += 5;

    this.x = 0; this.y = 0; this.vx = 0; this.vy = 0;
    this.r = this.ch.id === "brutus" ? 19 : 16;
    this.aim = -Math.PI / 2;
    this.facing = -Math.PI / 2;

    this.state = "fury";
    this.soul = 0;
    this.shiftCd = 0;
    this.shiftLock = 0;

    this.atkCd = 0;
    this.charge = 0;
    this.charging = false;
    this.chargeReady = false;

    this.dashCharge = 0; this.dashTimer = 0; this.dashT = 0; this.dashDir = { x: 0, y: -1 };
    this.dashHits = [];
    this.abilityCd = 0; this.abilityT = 0;

    this.invuln = 0;
    this.hitFlash = 0;
    this.dead = false;
    this.revived = 0;
    this.judgeCount = 0;
    this.orbAngle = 0;
    this.noHitTimer = 0;
    this.shield = 0;
    this.t = 0;
    this.killsThisRun = 0;

    this.recalc();
    this.hp = this.maxHp;
    this.shield = this.maxShield();
    this.soul = this.soulMax * 0.5;
  }

  Player.prototype.recalc = function () {
    var st = this.ch.stats, s = this.s;
    this.maxHp = Math.max(1, Math.round((st.maxHp + s.hpFlat) * s.hpMul));
    this.baseSpeed = st.speed * s.speedMul;
    this.baseDmg = st.damage * s.dmgMul;
    this.baseAtkCd = st.attackRate / Math.max(0.2, s.atkSpdMul);
    this.crit = U.clamp(st.critChance + s.crit, 0, 0.95);
    this.critMul = st.critMult + s.critMul;
    this.soulMax = Math.round(st.soulMax * s.soulMaxMul);
    this.projCount = 1 + s.proj;
    this.projSpeed = st.projSpeed * s.projSpeedMul;
    this.range = st.range * s.rangeMul;
    this.dashMax = st.dashCharges + s.dashCharges;
    this.dashCdV = st.dashCd * s.dashCdMul;
    this.abilityCdV = st.abilityCd * s.abilityCdMul;
    this.pickup = st.pickupRange * s.magnetMul;
    if (this.hp !== undefined) this.hp = Math.min(this.hp, this.maxHp);
    if (this.dashCharge === undefined) this.dashCharge = this.dashMax;
  };

  Player.prototype.maxShield = function () { return this.s.shieldMax; };

  /* Colour for movement/dash trails. Driven by the cosmetic FX bought in the shop. */
  Player.prototype.trailColor = function () {
    var fx = this.fx;
    if (fx && fx.color === "rainbow") {
      return "hsl(" + Math.floor((this.t * 220) % 360) + ",100%,65%)";
    }
    if (fx && fx.color) return fx.color;
    if (this.state === "soul") return "#25e0ff";
    return (this.skin && this.skin.glow) || this.ch.colors.trail;
  };

  Player.prototype.heal = function (n) {
    if (this.dead) return 0;
    var before = this.hp;
    this.hp = Math.min(this.maxHp, this.hp + n);
    var got = this.hp - before;
    if (got > 0.5) {
      P.text(this.x, this.y - this.r - 6, "+" + Math.round(got), { color: "#3dffa8", size: 15 });
      P.spark(this.x, this.y, 6, { color: "#3dffa8", speed: 110, life: 0.4, size: 2.6 });
    }
    return got;
  };

  // ---------------- state helpers ----------------
  Player.prototype.isSoul = function () { return this.state === "soul"; };

  Player.prototype.stateSpeedMul = function () {
    if (this.state === "soul") {
      var m = this.ch.mods.soulSpeed;
      if (this.flags.eternal) m += 0.3;
      return m;
    }
    return this.flags.furyEngine ? 1 + 0.15 * this.flags.furyEngine : 1;
  };
  Player.prototype.stateDmgMul = function () {
    if (this.state === "soul") return 0.5;
    var m = this.ch.mods.furyDmg;
    if (this.flags.berserk && this.hp / this.maxHp < 0.4) m += 0.6;
    return m;
  };
  Player.prototype.stateAtkMul = function () {
    if (this.state === "soul") return 1.45;
    return this.flags.furyEngine ? 1 + 0.3 * this.flags.furyEngine : 1;
  };

  // ---------------- soul shift ----------------
  Player.prototype.trySoulShift = function () {
    if (this.dead || this.shiftCd > 0) return false;
    var cost = this.ch.mods.shiftCost * this.s.shiftCostMul;
    if (this.state === "fury") {
      if (this.soul < cost + 5) {
        A.sfx("error");
        NS.Game.toast("ALMA INSUFICIENTE", "bad");
        return false;
      }
      this.soul -= cost;
      this.state = "soul";
      A.sfx("shiftSoul");
      if (this.ch.mods.soulShield) this.shield = Math.min(this.maxShield() + this.ch.mods.soulShield, this.shield + this.ch.mods.soulShield);
    } else {
      this.state = "fury";
      A.sfx("shiftFury");
    }
    this.shiftCd = 0.32;
    this.invuln = Math.max(this.invuln, 0.34);
    NS.Game.stats.shifts++;
    NS.Save.bump("shifts");
    document.body.classList.toggle("state-soul", this.state === "soul");

    // SHIFT BURST
    var rad = 105 * this.s.shiftBurst;
    var dmg = this.baseDmg * 1.3 * this.s.shiftBurst;
    var col = this.state === "soul" ? "#25e0ff" : "#ff2fb9";
    P.ring(this.x, this.y, { r0: 8, r1: rad, color: col, life: 0.35, w: 5 });
    P.ring(this.x, this.y, { r0: 4, r1: rad * 0.6, color: "#fff", life: 0.22, w: 2 });
    P.spark(this.x, this.y, 22, { color: col, speed: rad * 4.5, life: 0.5, size: 3.6 });
    NS.Game.addShake(5);
    A.vibrate(28);

    var es = NS.Game.enemies;
    for (var i = 0; i < es.length; i++) {
      var e = es[i];
      if (e.dead) continue;
      if (U.dist2(this.x, this.y, e.x, e.y) <= (rad + e.r) * (rad + e.r)) {
        Cb.damageEnemy(e, dmg, { angle: U.angle(this.x, this.y, e.x, e.y), knock: 260 });
        if (this.state === "soul") Cb.addMark(e, 1);
        else if (e.marks > 0) Cb.detonate(e, this);
      }
    }
    // shift-cancel enemy bullets nearby
    var bs = Cb.bullets;
    for (var j = 0; j < bs.length; j++) {
      var b = bs[j];
      if (b.owner === 1 && !b.dead && U.dist2(this.x, this.y, b.x, b.y) < rad * rad * 0.7) {
        b.dead = true;
        P.spark(b.x, b.y, 3, { color: col, speed: 120, life: 0.24, size: 2.4 });
      }
    }
    NS.Game.onShift(this.state);
    return true;
  };

  // ---------------- attacking ----------------
  Player.prototype.getAimAngle = function () {
    var I = NS.Input;
    if (I.hasAim) return Math.atan2(I.aimY, I.aimX);
    // auto-aim to nearest enemy
    if (NS.Save.data.settings.autoAim) {
      var e = Cb.nearestEnemy(this.x, this.y, this.range * 1.35);
      if (e) return U.angle(this.x, this.y, e.x, e.y);
    }
    if (I.mx || I.my) return Math.atan2(I.my, I.mx);
    return this.facing;
  };

  Player.prototype.fire = function (charged) {
    var ang = this.getAimAngle();
    this.facing = ang;
    var n = this.projCount + (charged ? 1 : 0);
    var spread = (0.12 + this.s.spread) * (n > 1 ? 1 : 0);
    var dmgMul = charged ? (1.9 + this.s.chargeDmg) : 1;
    var dmg = this.baseDmg * this.stateDmgMul() * dmgMul / Math.sqrt(Math.max(1, n * 0.6));
    var size = (charged ? 1.85 : 1) * this.s.projSizeMul;
    var col = this.state === "soul" ? "#7ee8ff" : (this.skin && this.skin.bullet) || this.ch.colors.main;
    if (charged) col = "#ffd23d";

    for (var i = 0; i < n; i++) {
      var off = n === 1 ? 0 : (i - (n - 1) / 2) * spread;
      var a = ang + off + U.rand(-0.02, 0.02);
      Cb.spawn({
        x: this.x + Math.cos(a) * (this.r + 6), y: this.y + Math.sin(a) * (this.r + 6),
        vx: Math.cos(a) * this.projSpeed * (charged ? 0.82 : 1),
        vy: Math.sin(a) * this.projSpeed * (charged ? 0.82 : 1),
        r: 5 * size, dmg: dmg, owner: 0, color: col,
        life: this.range / this.projSpeed + (charged ? 0.4 : 0),
        pierce: this.s.pierce + (charged ? 2 : 0),
        bounce: this.s.bounce, homing: this.s.homing,
        crit: false, knock: charged ? 180 : 60,
        kind: charged ? "orb" : "bolt",
        marks: charged ? 3 : 1
      });
    }
    // recoil
    this.vx -= Math.cos(ang) * (charged ? 130 : 26);
    this.vy -= Math.sin(ang) * (charged ? 130 : 26);
    P.spark(this.x + Math.cos(ang) * this.r, this.y + Math.sin(ang) * this.r, charged ? 8 : 3, {
      color: col, speed: charged ? 260 : 120, life: 0.22, size: 2.6, dir: ang, spread: 0.8
    });
    A.sfx(charged ? "shootHeavy" : "shoot", { gap: 0.02 });
    if (charged) { NS.Game.addShake(3); A.vibrate(18); }
  };

  // Called from Combat when one of our bullets hits an enemy
  Player.prototype.onBulletHit = function (b, e) {
    var crit = Math.random() < this.crit;
    var dmg = b.dmg * (crit ? this.critMul : 1);
    var ang = Math.atan2(b.vy, b.vx);

    if (this.state === "soul") {
      Cb.addMark(e, (this.ch.mods.markPerHit + this.s.markBonus) * (b.marks > 1 ? b.marks : 1));
    }

    Cb.damageEnemy(e, dmg, { crit: crit, angle: ang, knock: b.knock });

    if (this.state === "fury" && e.marks > 0 && !e.dead) Cb.detonate(e, this);

    this.applyElements(e, dmg, ang);
    if (crit && this.s.explode) {
      Cb.explosion(e.x, e.y, 70 + this.s.explode * 16, dmg * 0.7, { color: "#ffd23d", shake: 2, knock: 80 });
    }
  };

  Player.prototype.applyElements = function (e, dmg, ang) {
    var s = this.s;
    if (s.fire > 0) Cb.applyBurn(e, dmg * 0.22 * s.fire, this.flags.inferno ? 4.4 : 2.4);
    if (s.frost > 0) Cb.applyChill(e, Math.min(0.55, 0.16 * s.frost), 1.8);
    if (s.shock > 0 && Math.random() < 0.3 + 0.1 * s.shock) {
      Cb.chain(e.x, e.y, dmg * 0.45 * s.shock, this.flags.tempest ? 4 : 2, e);
    }
  };

  Player.prototype.onDealDamage = function (dmg, e, opts) {
    // soul economy: FURIA feeds on aggression
    if (this.state === "fury") this.soul = Math.min(this.soulMax, this.soul + dmg * 0.09);
    else this.soul = Math.min(this.soulMax, this.soul + dmg * 0.02);

    if (this.s.lifesteal > 0) {
      var h = dmg * this.s.lifesteal;
      if (h > 0.3) this.hp = Math.min(this.maxHp, this.hp + h);
    }
    if (this.flags.judgement && !opts.noJudge) {
      this.judgeCount++;
      if (this.judgeCount >= 12) {
        this.judgeCount = 0;
        var t = Cb.nearestEnemy(this.x, this.y, 600) || e;
        if (t) {
          NS.Game.addBolt(t.x, t.y - 400, t.x, t.y, "#fff");
          Cb.explosion(t.x, t.y, 120, this.baseDmg * 6, { color: "#fff", shake: 8, elem: 2 });
          A.sfx("detonate");
        }
      }
    }
  };

  Player.prototype.onKill = function (e) {
    this.killsThisRun++;
    if (this.state === "fury") this.soul = Math.min(this.soulMax, this.soul + 6);
  };

  Player.prototype.onDetonate = function (stacks, total) {
    NS.Game.bestDetonation = Math.max(NS.Game.bestDetonation, stacks);
    this.soul = Math.min(this.soulMax, this.soul + stacks * 1.6);
  };

  // ---------------- dash ----------------
  Player.prototype.tryDash = function () {
    if (this.dead || this.dashCharge < 1 || this.dashT > 0) return false;
    var dir;
    if (NS.Input.mx || NS.Input.my) dir = U.norm(NS.Input.mx, NS.Input.my);
    else dir = { x: Math.cos(this.facing), y: Math.sin(this.facing) };
    this.dashCharge -= 1;
    this.dashT = 0.2;
    this.dashDir = dir;
    this.invuln = Math.max(this.invuln, 0.3);
    this.dashHits.length = 0;
    A.sfx("dash");
    A.vibrate(12);
    NS.Save.bump("dashes");
    NS.Game.stats.dashes++;
    P.ring(this.x, this.y, { r0: this.r, r1: this.r * 3.2, color: this.trailColor(), life: 0.28, w: 3 });
    return true;
  };

  // ---------------- ability ----------------
  Player.prototype.tryAbility = function () {
    if (this.dead || this.abilityCd > 0) return false;
    this.abilityCd = this.abilityCdV;
    A.sfx("ability");
    A.vibrate(35);
    var id = this.ch.id;
    var dmgBase = this.baseDmg * this.stateDmgMul();

    if (id === "soulrunner") {
      var rad = 200;
      P.ring(this.x, this.y, { r0: 10, r1: rad, color: "#25e0ff", life: 0.45, w: 6 });
      P.ring(this.x, this.y, { r0: 6, r1: rad * 0.7, color: "#ff2fb9", life: 0.3, w: 3 });
      P.spark(this.x, this.y, 26, { color: "#9b5cff", speed: 460, life: 0.55, size: 3.6 });
      NS.Game.addShake(7);
      var es = NS.Game.enemies;
      for (var i = 0; i < es.length; i++) {
        var e = es[i];
        if (e.dead) continue;
        if (U.dist2(this.x, this.y, e.x, e.y) < (rad + e.r) * (rad + e.r)) {
          Cb.damageEnemy(e, dmgBase * 2.4, { angle: U.angle(this.x, this.y, e.x, e.y), knock: 420 });
          if (this.state === "soul") Cb.addMark(e, 2);
          else if (e.marks > 0) Cb.detonate(e, this);
        }
      }
      Cb.clearEnemyBullets(true);

    } else if (id === "vela") {
      var ang = this.getAimAngle();
      var dist = 330;
      var sx = this.x, sy = this.y;
      this.x += Math.cos(ang) * dist;
      this.y += Math.sin(ang) * dist;
      NS.Game.clampToArena(this);
      this.invuln = Math.max(this.invuln, 0.45);
      for (var k = 0; k < 14; k++) {
        var tx = U.lerp(sx, this.x, k / 14), ty = U.lerp(sy, this.y, k / 14);
        P.orb(tx, ty, { color: "#3dffa8", size: 12, life: 0.35 });
      }
      var es2 = NS.Game.enemies;
      for (var j = 0; j < es2.length; j++) {
        var e2 = es2[j];
        if (e2.dead) continue;
        if (distToSegment(e2.x, e2.y, sx, sy, this.x, this.y) < e2.r + 46) {
          Cb.damageEnemy(e2, dmgBase * 1.8, { angle: ang, knock: 180 });
          Cb.addMark(e2, 3);
          if (this.state === "fury" && e2.marks > 0) Cb.detonate(e2, this);
        }
      }
      A.sfx("portal");

    } else if (id === "brutus") {
      var rad2 = 250;
      NS.Game.addShake(12);
      P.ring(this.x, this.y, { r0: 12, r1: rad2, color: "#ff8a3d", life: 0.5, w: 8 });
      P.explosion(this.x, this.y, rad2 * 0.8, "#ff5a28");
      var es3 = NS.Game.enemies;
      for (var m = 0; m < es3.length; m++) {
        var e3 = es3[m];
        if (e3.dead) continue;
        if (U.dist2(this.x, this.y, e3.x, e3.y) < (rad2 + e3.r) * (rad2 + e3.r)) {
          Cb.damageEnemy(e3, dmgBase * 3.1, { angle: U.angle(this.x, this.y, e3.x, e3.y), knock: 520 });
          Cb.applyShock(e3, 1.4);
          if (this.state === "fury" && e3.marks > 0) Cb.detonate(e3, this);
        }
      }
      for (var q = 0; q < 12; q++) {
        var qa = q * U.TAU / 12;
        Cb.spawn({
          x: this.x, y: this.y, vx: Math.cos(qa) * 420, vy: Math.sin(qa) * 420,
          r: 6, dmg: dmgBase * 0.8, owner: 0, color: "#ff8a3d", life: 0.7, pierce: 2, marks: 1
        });
      }
      Cb.clearEnemyBullets(true);

    } else { // nullecho
      var vx = this.x + Math.cos(this.getAimAngle()) * 170;
      var vy = this.y + Math.sin(this.getAimAngle()) * 170;
      NS.Game.addVortex(vx, vy, 210, 1.5, dmgBase * 0.9, true);
      A.sfx("portal");
    }
    return true;
  };

  function distToSegment(px, py, x1, y1, x2, y2) {
    var dx = x2 - x1, dy = y2 - y1;
    var l2 = dx * dx + dy * dy;
    if (l2 < 1e-6) return U.dist(px, py, x1, y1);
    var t = U.clamp(((px - x1) * dx + (py - y1) * dy) / l2, 0, 1);
    return U.dist(px, py, x1 + t * dx, y1 + t * dy);
  }

  // ---------------- damage ----------------
  Player.prototype.takeDamage = function (amount, opts) {
    opts = opts || {};
    if (this.dead || this.invuln > 0 || this.dashT > 0) return;
    if (!isFinite(amount) || amount <= 0) return;
    var G = NS.Game;

    var armor = U.clamp(this.s.armor + (this.ch.stats.armor || 0), -0.5, 0.8);
    var dmg = Math.max(1, amount * (1 - armor) * (G.dmgTakenMul || 1));

    // shield first
    if (this.shield > 0) {
      var absorbed = Math.min(this.shield, dmg);
      this.shield -= absorbed;
      dmg -= absorbed;
      P.ring(this.x, this.y, { r0: this.r, r1: this.r * 2.6, color: "#25e0ff", life: 0.3, w: 3 });
      A.sfx("shield");
      if (dmg <= 0.5) {
        this.invuln = 0.45;
        this.noHitTimer = 0;
        return;
      }
    }

    this.hp -= dmg;
    this.invuln = 0.72;
    this.hitFlash = 0.28;
    this.noHitTimer = 0;
    G.combo = 0;
    G.comboT = 0;

    if (opts.knock) {
      this.vx += Math.cos(opts.angle) * opts.knock;
      this.vy += Math.sin(opts.angle) * opts.knock;
    }

    P.text(this.x, this.y - this.r - 8, "-" + Math.round(dmg), { color: "#ff3a55", size: 17, crit: true });
    P.spark(this.x, this.y, 10, { color: "#ff3a55", speed: 220, life: 0.4, size: 3 });
    A.sfx("hurt");
    if (!opts.noShake) G.addShake(6);
    G.flash(0.35, "#ff3a55");
    A.vibrate(55);
    G.stats.damageTaken += dmg;

    document.body.classList.add("hurt");
    var self = this;
    clearTimeout(this._hurtTo);
    this._hurtTo = setTimeout(function () { document.body.classList.remove("hurt"); }, 180);

    // thorns
    if (this.s.thorns > 0) {
      Cb.explosion(this.x, this.y, 130, dmg * this.s.thorns * 2.5, { color: "#ff2fb9", shake: 2, knock: 200 });
    }

    if (this.hp <= 0) this.die();
  };

  Player.prototype.die = function () {
    if (this.dead) return;
    if (this.s.revive > 0) {
      this.s.revive--;
      this.revived++;
      this.hp = this.maxHp * 0.5;
      this.invuln = 2.2;
      this.shield = this.maxShield();
      P.ring(this.x, this.y, { r0: 10, r1: 300, color: "#ffc53d", life: 0.7, w: 7 });
      NS.Game.addShake(14);
      NS.Game.flash(0.8, "#ffc53d");
      A.sfx("levelup");
      NS.Game.toast("SEGUNDA VIDA", "good");
      if (this.flags.martyr) {
        Cb.explosion(this.x, this.y, 420, this.baseDmg * 14, { color: "#ffc53d", shake: 16 });
      }
      return;
    }
    this.dead = true;
    this.hp = 0;
    A.sfx("death");
    NS.Game.addShake(16);
    NS.Game.flash(0.9, "#ff3a55");
    P.explosion(this.x, this.y, 180, this.ch.colors.main);
    P.spark(this.x, this.y, 50, { color: "#fff", speed: 420, life: 1, size: 4, kind: 2 });
    A.vibrate([60, 40, 120]);
    NS.Game.onPlayerDeath();
  };

  // ---------------- per-frame ----------------
  Player.prototype.update = function (dt, G) {
    this.t += dt;
    var I = NS.Input;

    if (this.dead) return;

    if (this.invuln > 0) this.invuln -= dt;
    if (this.hitFlash > 0) this.hitFlash -= dt;
    if (this.shiftCd > 0) this.shiftCd -= dt;
    if (this.atkCd > 0) this.atkCd -= dt;
    if (this.abilityCd > 0) this.abilityCd -= dt;
    this.noHitTimer += dt;

    // regen
    if (this.s.regen > 0) this.hp = Math.min(this.maxHp, this.hp + this.s.regen * dt);
    if (this.s.shieldRegen > 0 && this.noHitTimer > 3.5 && this.shield < this.maxShield()) {
      this.shield = Math.min(this.maxShield(), this.shield + this.s.shieldRegen * dt);
    }

    // dash charges
    if (this.dashCharge < this.dashMax) {
      this.dashTimer += dt;
      if (this.dashTimer >= this.dashCdV) { this.dashTimer = 0; this.dashCharge++; }
    } else this.dashTimer = 0;

    // ---- SOUL economy ----
    if (this.state === "soul") {
      var drain = this.ch.stats.soulDrain * this.s.soulDrainMul * dt;
      this.soul -= drain;
      if (this.soul <= 0) {
        this.soul = 0;
        this.state = "fury";
        document.body.classList.remove("state-soul");
        A.sfx("shiftFury");
        P.ring(this.x, this.y, { r0: 6, r1: 90, color: "#ff2fb9", life: 0.3, w: 4 });
        NS.Game.toast("ALMA AGOTADA", "bad");
      }
      if (Math.random() < dt * 22) P.trail(this.x, this.y, this.trailColor(), this.r * 0.8, 0.3);
    } else {
      this.soul = Math.min(this.soulMax, this.soul + this.ch.stats.soulRegen * this.s.soulRegenMul * dt);
    }

    // ---- input: actions ----
    if (I.shiftPressed) this.trySoulShift();
    if (I.dashPressed) this.tryDash();
    if (I.abilityPressed) this.tryAbility();

    /* Attack model:
       - holding ATTACK auto-fires at the normal rate (slightly slower while charging)
       - the same hold fills the CHARGE meter; releasing a full meter fires the heavy shot
       This way "hold to shoot" always works and charging is a bonus, never a trap. */
    if (I.attack) {
      this.charge += dt * this.s.chargeSpeed;
      if (!this.charging && this.charge > 0.04) this.charging = true;
      if (this.charge >= CHARGE_TIME && !this.chargeReady) {
        this.chargeReady = true;
        A.sfx("chargeReady");
        P.ring(this.x, this.y, { r0: this.r * 2.4, r1: this.r * 1.2, color: "#ffd23d", life: 0.3, w: 3 });
      }
      if (this.charging && this.charge > 0.12 && Math.random() < dt * 26) {
        var ca = Math.random() * U.TAU;
        P.orb(this.x + Math.cos(ca) * 40, this.y + Math.sin(ca) * 40,
          { color: this.chargeReady ? "#ffd23d" : "#9b5cff", size: 5, life: 0.25, vx: -Math.cos(ca) * 130, vy: -Math.sin(ca) * 130 });
      }
      if (this.atkCd <= 0) {
        this.atkCd = this.baseAtkCd / this.stateAtkMul() * (this.chargeReady ? 1.55 : 1.15);
        this.fire(false);
      }
    } else {
      if (this.charging) {
        if (this.chargeReady) {
          this.fire(true);
          this.atkCd = this.baseAtkCd / this.stateAtkMul() * 1.6;
        }
        this.charging = false;
        this.chargeReady = false;
        this.charge = 0;
      }
    }

    // ---- movement ----
    var speed = this.baseSpeed * this.stateSpeedMul();
    if (this.charging && this.chargeReady) speed *= 0.55;

    if (this.dashT > 0) {
      this.dashT -= dt;
      var ds = this.baseSpeed * 3.4;
      this.vx = this.dashDir.x * ds;
      this.vy = this.dashDir.y * ds;
      P.trail(this.x, this.y, this.trailColor(), this.r * 1.1, 0.26);
      if (this.s.dashDmg > 0) {
        var es = G.enemies;
        for (var i = 0; i < es.length; i++) {
          var e = es[i];
          if (e.dead || this.dashHits.indexOf(e.id) >= 0) continue;
          if (U.dist2(this.x, this.y, e.x, e.y) < (this.r + e.r + 6) * (this.r + e.r + 6)) {
            this.dashHits.push(e.id);
            Cb.damageEnemy(e, this.s.dashDmg * (1 + this.s.dmgMul * 0.5), { angle: Math.atan2(this.dashDir.y, this.dashDir.x), knock: 240 });
            Cb.addMark(e, 1);
          }
        }
      }
    } else {
      var tx = I.mx * speed, ty = I.my * speed;
      var accel = (I.mx || I.my) ? 14 : 11;
      this.vx = U.damp(this.vx, tx, accel, dt);
      this.vy = U.damp(this.vy, ty, accel, dt);
    }

    this.x += this.vx * dt;
    this.y += this.vy * dt;

    if (I.mx || I.my) this.facing = Math.atan2(I.my, I.mx);
    this.aim = U.rotateToward(this.aim, this.getAimAngle(), 18 * dt);

    G.clampToArena(this, true);
    G.avoidObstacles(this, true);

    // ---- orbitals ----
    if (this.s.orbitals > 0) {
      this.orbAngle += dt * (this.flags.blender ? 4.4 : 2.2);
      var n = this.s.orbitals, rad = 78;
      for (var o = 0; o < n; o++) {
        var a = this.orbAngle + o * U.TAU / n;
        var ox = this.x + Math.cos(a) * rad, oy = this.y + Math.sin(a) * rad;
        if (Math.random() < dt * 14) P.trail(ox, oy, "#9b5cff", 6, 0.2);
        var es2 = G.enemies;
        for (var k = 0; k < es2.length; k++) {
          var e2 = es2[k];
          if (e2.dead || e2.orbCd > 0) continue;
          if (U.dist2(ox, oy, e2.x, e2.y) < (e2.r + 13) * (e2.r + 13)) {
            e2.orbCd = 0.45;
            Cb.damageEnemy(e2, this.baseDmg * 0.55 * this.stateDmgMul(), { angle: a, knock: 90 });
            if (this.state === "soul") Cb.addMark(e2, 1);
            if (this.flags.blender) Cb.applyBurn(e2, this.baseDmg * 0.2, 2);
          }
        }
      }
    }

    document.body.classList.toggle("lowhp", this.hp / this.maxHp < 0.3);
  };

  // ---------------- draw ----------------
  Player.prototype.draw = function (ctx) {
    var blink = this.invuln > 0 && Math.floor(this.t * 22) % 2 === 0;
    ctx.save();
    if (blink) ctx.globalAlpha = 0.45;
    if (this.hitFlash > 0) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = this.hitFlash * 2;
      ctx.fillStyle = "#ff3a55";
      ctx.beginPath(); ctx.arc(this.x, this.y, this.r * 2.2, 0, U.TAU); ctx.fill();
      ctx.restore();
    }

    // charge indicator
    if (this.charging && this.charge > 0.12) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      var k = U.clamp(this.charge / CHARGE_TIME, 0, 1);
      ctx.strokeStyle = this.chargeReady ? "#ffd23d" : "#9b5cff";
      ctx.lineWidth = 3;
      ctx.globalAlpha = 0.9;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.r * 1.9, -Math.PI / 2, -Math.PI / 2 + k * U.TAU);
      ctx.stroke();
      ctx.restore();
    }

    NS.Chars.draw(ctx, this.ch, this.x, this.y, this.r, this.t, {
      state: this.state, moving: Math.abs(this.vx) + Math.abs(this.vy) > 40,
      aim: this.aim, skin: this.skin
    });

    // shield bubble
    if (this.shield > 0) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.strokeStyle = "#25e0ff";
      ctx.globalAlpha = 0.35 + Math.sin(this.t * 4) * 0.12;
      ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(this.x, this.y, this.r * 1.9, 0, U.TAU); ctx.stroke();
      ctx.restore();
    }

    // orbitals
    if (this.s.orbitals > 0) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      var n = this.s.orbitals;
      for (var o = 0; o < n; o++) {
        var a = this.orbAngle + o * U.TAU / n;
        var ox = this.x + Math.cos(a) * 78, oy = this.y + Math.sin(a) * 78;
        ctx.fillStyle = this.flags.blender ? "#ff8a3d" : "#9b5cff";
        ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 14;
        ctx.beginPath(); ctx.arc(ox, oy, 7, 0, U.TAU); ctx.fill();
      }
      ctx.restore();
    }
    ctx.restore();
  };

  NS.Player = Player;
})(window.NS);
