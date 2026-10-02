/* ============================================================
   NEON SOUL - combat.js
   Damage resolution, projectiles, elemental status, SOUL MARKS
   ============================================================ */
(function (NS) {
  "use strict";
  var U = NS.U, P = NS.Particles, A = NS.Audio;

  var C = {
    bullets: [],
    _free: [],
    MARK_CAP: 10
  };

  function newBullet() {
    return {
      x: 0, y: 0, vx: 0, vy: 0, r: 5, dmg: 1, life: 1, maxLife: 1,
      owner: 0, color: "#fff", pierce: 0, bounce: 0, homing: 0, elem: 0,
      crit: false, dead: true, hitIds: null, knock: 0, size: 1, spin: 0,
      kind: "bolt", wobble: 0, t: 0, marks: 0, srcBoss: false, boom: null
    };
  }

  C.spawn = function (cfg) {
    var b = C._free.length ? C._free.pop() : newBullet();
    b.dead = false;
    b.x = cfg.x; b.y = cfg.y;
    b.vx = cfg.vx; b.vy = cfg.vy;
    b.r = cfg.r || 5;
    b.dmg = cfg.dmg || 1;
    b.maxLife = b.life = cfg.life || 1.6;
    b.owner = cfg.owner || 0;         // 0 = player, 1 = enemy
    b.color = cfg.color || "#fff";
    b.pierce = cfg.pierce || 0;
    b.bounce = cfg.bounce || 0;
    b.homing = cfg.homing || 0;
    b.elem = cfg.elem || 0;
    b.crit = !!cfg.crit;
    b.knock = cfg.knock || 0;
    b.size = cfg.size || 1;
    b.kind = cfg.kind || "bolt";
    b.marks = cfg.marks || 0;
    b.t = 0;
    b.wobble = cfg.wobble || 0;
    b.srcBoss = !!cfg.srcBoss;
    b.boom = cfg.boom || null;
    if (b.hitIds) b.hitIds.length = 0; else b.hitIds = [];
    C.bullets.push(b);
    return b;
  };

  C.clear = function () {
    for (var i = 0; i < C.bullets.length; i++) if (C._free.length < 300) C._free.push(C.bullets[i]);
    C.bullets.length = 0;
  };

  C.clearEnemyBullets = function (fx) {
    for (var i = 0; i < C.bullets.length; i++) {
      var b = C.bullets[i];
      if (b.owner === 1 && !b.dead) {
        b.dead = true;
        if (fx) P.spark(b.x, b.y, 3, { color: b.color, speed: 90, life: 0.25, size: 2.4 });
      }
    }
  };

  // ---------------- damage numbers / helpers ----------------
  function dmgColor(opts) {
    if (opts && opts.elem === 1) return "#ff8a3d";
    if (opts && opts.elem === 2) return "#7ee8ff";
    if (opts && opts.elem === 3) return "#a9f3ff";
    if (opts && opts.deto) return "#ff2fb9";
    if (opts && opts.crit) return "#ffd23d";
    return "#ffffff";
  }

  // ---------------- enemy damage ----------------
  C.damageEnemy = function (e, amount, opts) {
    if (!e || e.dead || e.spawning > 0) return 0;
    if (!isFinite(amount) || amount <= 0) return 0;   // never let a bad number corrupt an entity
    opts = opts || {};
    var G = NS.Game, p = G.player;
    if (e.invuln > 0) {
      P.spark(e.x, e.y, 2, { color: "#fff", speed: 120, life: 0.2, size: 2 });
      return 0;
    }

    var mult = 1;

    // directional shields (guardian)
    if (e.def && e.def.onHit && opts.angle !== undefined && e.shieldHp > 0) {
      var m = e.def.onHit(e, opts.angle);
      if (m < 1) {
        e.shieldHp -= amount;
        mult *= m;
        P.spark(e.x + Math.cos(e.face) * e.r * 1.5, e.y + Math.sin(e.face) * e.r * 1.5, 4,
          { color: "#a9f3ff", speed: 180, life: 0.25, size: 2.6 });
        P.text(e.x, e.y - e.r, "BLOQUEO", { color: "#a9f3ff", size: 11, dmg: true });
        if (e.shieldHp <= 0) {
          e.shieldHp = 0;
          P.ring(e.x, e.y, { r0: e.r, r1: e.r * 3, color: "#a9f3ff", life: 0.35, w: 3 });
          A.sfx("shield");
        }
      }
    }
    if (e.status && e.status.chillT > 0 && p && p.flags.absolute) mult *= 1.45;
    if (e.shield > 0 && !opts.trueDmg) mult *= 0.35;
    if (e.armor) mult *= (1 - e.armor);

    var dmg = Math.max(1, amount * mult);
    e.hp -= dmg;
    e.flash = 0.11;
    e.hitT = 0.14;
    if (opts.knock && !e.heavy) {
      var a = opts.angle !== undefined ? opts.angle : U.angle(p ? p.x : e.x, p ? p.y : e.y, e.x, e.y);
      e.kx = (e.kx || 0) + Math.cos(a) * opts.knock;
      e.ky = (e.ky || 0) + Math.sin(a) * opts.knock;
    }

    // visuals
    if (!opts.silent) {
      var col = dmgColor(opts);
      P.text(e.x, e.y - e.r, (opts.crit ? "" : "") + U.fmt(dmg), {
        color: col, size: opts.deto ? 20 : (opts.crit ? 19 : 14), crit: !!opts.crit || !!opts.deto, dmg: true
      });
      P.spark(e.x, e.y, opts.crit ? 7 : 4, {
        color: col, speed: opts.crit ? 230 : 140, life: 0.3, size: opts.crit ? 3.4 : 2.4,
        dir: opts.angle, spread: 1.6
      });
    }

    if (p) {
      p.onDealDamage(dmg, e, opts);
      G.stats.damageDealt += dmg;
    }

    if (opts.crit) A.sfx("crit"); else if (!opts.silent) A.sfx("hit");

    if (e.hp <= 0) C.killEnemy(e, opts);
    return dmg;
  };

  C.killEnemy = function (e, opts) {
    if (e.dead) return;
    e.dead = true;
    var G = NS.Game, p = G.player;
    var col = e.color || "#fff";

    P.explosion(e.x, e.y, e.r * 2.4, col);
    P.spark(e.x, e.y, e.elite ? 24 : 12, { color: col, speed: 300, life: 0.6, size: 3.4, kind: 2 });
    A.sfx(e.elite || e.isBoss ? "explode" : "kill");
    G.addShake(e.elite ? 5 : 2.4);
    A.vibrate(e.elite ? 40 : 14);

    // singularity: implode
    if (p && p.flags.singularity) {
      G.addVortex(e.x, e.y, 130, 0.45, p.baseDmg * 1.2);
    }

    // drops
    G.dropLoot(e);

    G.stats.kills++;
    NS.Save.bump("kills");
    if (e.elite) NS.Save.bump("eliteKills");
    if (p) p.onKill(e);
    G.addCombo();
  };

  // ---------------- player damage ----------------
  C.damagePlayer = function (amount, opts) {
    var G = NS.Game, p = G.player;
    if (!p || p.dead) return;
    p.takeDamage(amount, opts || {});
  };

  // ---------------- status ----------------
  C.applyBurn = function (e, dps, dur) {
    if (!e || e.dead) return;
    e.status.burnT = Math.max(e.status.burnT, dur);
    e.status.burnDps = Math.max(e.status.burnDps, dps);
  };
  C.applyChill = function (e, power, dur) {
    if (!e || e.dead) return;
    e.status.chillT = Math.max(e.status.chillT, dur);
    e.status.chill = Math.max(e.status.chill, power);
  };
  C.applyShock = function (e, dur) {
    if (!e || e.dead) return;
    e.status.shockT = Math.max(e.status.shockT, dur);
  };

  C.updateStatus = function (e, dt) {
    var s = e.status;
    if (s.burnT > 0) {
      s.burnT -= dt;
      s.burnTick -= dt;
      if (s.burnTick <= 0) {
        s.burnTick = 0.35;
        C.damageEnemy(e, s.burnDps * 0.35, { elem: 1, silent: false, noCombo: true });
        P.spark(e.x, e.y - e.r * 0.4, 2, { color: "#ff8a3d", speed: 50, life: 0.4, size: 2.4, vy: -40 });
        if (NS.Game.player && NS.Game.player.flags.inferno && Math.random() < 0.15) spreadBurn(e);
      }
      if (s.burnT <= 0) s.burnDps = 0;
    }
    if (s.chillT > 0) { s.chillT -= dt; if (s.chillT <= 0) s.chill = 0; }
    if (s.shockT > 0) s.shockT -= dt;
  };

  function spreadBurn(src) {
    var es = NS.Game.enemies;
    for (var i = 0; i < es.length; i++) {
      var o = es[i];
      if (o === src || o.dead) continue;
      if (U.dist2(src.x, src.y, o.x, o.y) < 120 * 120 && o.status.burnT <= 0) {
        C.applyBurn(o, src.status.burnDps * 0.7, 2.2);
        break;
      }
    }
  }

  // ---------------- soul marks ----------------
  C.addMark = function (e, n) {
    if (!e || e.dead || e.isBoss === "immune") return;
    e.marks = Math.min(C.MARK_CAP, (e.marks || 0) + n);
    e.markPulse = 0.25;
    P.spark(e.x, e.y, 2, { color: "#25e0ff", speed: 80, life: 0.3, size: 2.2 });
  };

  C.detonate = function (e, source) {
    var G = NS.Game, p = G.player;
    if (!e || e.dead || !e.marks) return 0;
    var stacks = e.marks;
    e.marks = 0;

    var per = p.baseDmg * p.stateDmgMul() * 0.55 * p.s.detoMul * (p.ch.mods.detoMult || 1);
    var total = per * stacks;
    var radius = (46 + stacks * 9) * p.s.detoRadMul * (p.ch.mods.detoRadius || 1);

    P.ring(e.x, e.y, { r0: 6, r1: radius, color: "#ff2fb9", life: 0.35, w: 5 });
    P.ring(e.x, e.y, { r0: 2, r1: radius * 0.7, color: "#fff", life: 0.22, w: 2 });
    P.spark(e.x, e.y, 14 + stacks * 2, { color: "#ff2fb9", speed: radius * 5, life: 0.5, size: 3.6 });
    A.sfx("detonate");
    G.addShake(3 + stacks * 0.5);
    A.vibrate(20 + stacks * 3);
    G.stats.detonations++;
    NS.Save.bump("detonations");

    C.damageEnemy(e, total, { deto: true, angle: 0 });

    // splash on nearby
    var es = G.enemies, i, o;
    for (i = 0; i < es.length; i++) {
      o = es[i];
      if (o === e || o.dead) continue;
      var d2 = U.dist2(e.x, e.y, o.x, o.y);
      if (d2 <= radius * radius) {
        C.damageEnemy(o, total * 0.55, { deto: true, angle: U.angle(e.x, e.y, o.x, o.y), knock: 90 });
        if (p.flags.markStorm) C.addMark(o, 2);
      } else if (p.flags.resonance && o.marks > 0) {
        // resonance: propagate to every marked enemy on screen
        P.ring(o.x, o.y, { r0: 4, r1: 60, color: "#ff2fb9", life: 0.28, w: 3 });
        C.damageEnemy(o, total * 0.4, { deto: true });
      }
    }

    if (p.ch.mods.detoChain && stacks >= 3) {
      // chain a second smaller pop at a nearby enemy
      var best = C.nearestEnemy(e.x, e.y, 320, e);
      if (best) { C.addMark(best, 1); C.damageEnemy(best, total * 0.35, { deto: true }); }
    }

    p.onDetonate(stacks, total);
    return total;
  };

  // ---------------- area & chain helpers ----------------
  C.explosion = function (x, y, radius, dmg, opts) {
    opts = opts || {};
    var G = NS.Game;
    P.explosion(x, y, radius, opts.color || "#ff8a3d");
    A.sfx("explode");
    G.addShake(opts.shake === undefined ? 5 : opts.shake);
    if (opts.owner === 1) {
      var p = G.player;
      if (p && !p.dead && U.dist2(x, y, p.x, p.y) < (radius + p.r) * (radius + p.r)) {
        C.damagePlayer(dmg, { angle: U.angle(x, y, p.x, p.y), knock: 220 });
      }
      return;
    }
    var es = G.enemies;
    for (var i = 0; i < es.length; i++) {
      var e = es[i];
      if (e.dead) continue;
      var rr = radius + e.r;
      if (U.dist2(x, y, e.x, e.y) <= rr * rr) {
        C.damageEnemy(e, dmg, {
          angle: U.angle(x, y, e.x, e.y), knock: opts.knock || 130,
          elem: opts.elem, crit: opts.crit
        });
        if (opts.marks) C.addMark(e, opts.marks);
      }
    }
  };

  C.chain = function (fromX, fromY, dmg, jumps, exclude) {
    var G = NS.Game, p = G.player;
    var hit = exclude ? [exclude] : [];
    var cx = fromX, cy = fromY;
    for (var j = 0; j < jumps; j++) {
      var t = C.nearestEnemyExcl(cx, cy, 260, hit);
      if (!t) break;
      var crit = p && p.flags.tempest && Math.random() < p.crit;
      P.spark(t.x, t.y, 5, { color: "#7ee8ff", speed: 150, life: 0.3, size: 2.6 });
      G.addBolt(cx, cy, t.x, t.y, "#7ee8ff");
      C.damageEnemy(t, dmg * (crit ? p.critMul : 1), { elem: 2, crit: crit });
      C.applyShock(t, 0.6);
      hit.push(t);
      cx = t.x; cy = t.y;
      dmg *= 0.82;
    }
  };

  C.nearestEnemy = function (x, y, maxDist, exclude) {
    var es = NS.Game.enemies, best = null, bd = maxDist * maxDist;
    for (var i = 0; i < es.length; i++) {
      var e = es[i];
      if (e.dead || e === exclude || e.spawning > 0) continue;
      var d = U.dist2(x, y, e.x, e.y);
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  };
  C.nearestEnemyExcl = function (x, y, maxDist, list) {
    var es = NS.Game.enemies, best = null, bd = maxDist * maxDist;
    for (var i = 0; i < es.length; i++) {
      var e = es[i];
      if (e.dead || e.spawning > 0 || list.indexOf(e) >= 0) continue;
      var d = U.dist2(x, y, e.x, e.y);
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  };

  // ---------------- bullet update ----------------
  C.update = function (dt) {
    var G = NS.Game, p = G.player, arena = G.arena;
    var bs = C.bullets, n = 0;

    for (var i = 0; i < bs.length; i++) {
      var b = bs[i];
      if (b.dead) { if (C._free.length < 300) C._free.push(b); continue; }
      b.t += dt;
      b.life -= dt;
      if (b.life <= 0) { fizzle(b); if (C._free.length < 300) C._free.push(b); continue; }

      // homing
      if (b.homing && b.owner === 0) {
        var tgt = C.nearestEnemy(b.x, b.y, 330);
        if (tgt) {
          var want = U.angle(b.x, b.y, tgt.x, tgt.y);
          var cur = Math.atan2(b.vy, b.vx);
          var sp = Math.hypot(b.vx, b.vy);
          cur = U.rotateToward(cur, want, 5.2 * b.homing * dt);
          b.vx = Math.cos(cur) * sp; b.vy = Math.sin(cur) * sp;
        }
      }
      if (b.wobble) {
        var ang = Math.atan2(b.vy, b.vx) + Math.sin(b.t * 14) * b.wobble * dt * 10;
        var s2 = Math.hypot(b.vx, b.vy);
        b.vx = Math.cos(ang) * s2; b.vy = Math.sin(ang) * s2;
      }

      b.x += b.vx * dt;
      b.y += b.vy * dt;

      // trail
      if (b.owner === 0 || b.srcBoss) {
        if (NS.Particles.quality > 0.5 && b.t % 0.03 < dt) P.trail(b.x, b.y, b.color, b.r * 1.1, 0.18);
      }

      // walls
      if (b.x < arena.x + b.r || b.x > arena.x + arena.w - b.r || b.y < arena.y + b.r || b.y > arena.y + arena.h - b.r) {
        if (b.bounce > 0) {
          b.bounce--;
          if (b.x < arena.x + b.r || b.x > arena.x + arena.w - b.r) b.vx *= -1;
          if (b.y < arena.y + b.r || b.y > arena.y + arena.h - b.r) b.vy *= -1;
          b.x = U.clamp(b.x, arena.x + b.r, arena.x + arena.w - b.r);
          b.y = U.clamp(b.y, arena.y + b.r, arena.y + arena.h - b.r);
          P.spark(b.x, b.y, 3, { color: b.color, speed: 120, life: 0.2, size: 2 });
        } else {
          fizzle(b); if (C._free.length < 300) C._free.push(b); continue;
        }
      }

      // obstacles block bullets
      var blocked = false;
      var obs = G.obstacles;
      for (var oi = 0; oi < obs.length; oi++) {
        var o = obs[oi];
        if (!o.solid) continue;
        var rr = o.r + b.r;
        if (U.dist2(o.x, o.y, b.x, b.y) < rr * rr) { blocked = true; break; }
      }
      if (blocked) { fizzle(b); if (C._free.length < 300) C._free.push(b); continue; }

      // collision
      if (b.owner === 0) {
        var es = G.enemies;
        for (var ei = 0; ei < es.length; ei++) {
          var e = es[ei];
          if (e.dead || e.spawning > 0 || e.invuln > 0) continue;
          if (b.hitIds.indexOf(e.id) >= 0) continue;
          var r2 = (e.r + b.r);
          if (U.dist2(e.x, e.y, b.x, b.y) <= r2 * r2) {
            p.onBulletHit(b, e);
            b.hitIds.push(e.id);
            if (b.pierce > 0) { b.pierce--; b.dmg *= 0.86; }
            else { fizzle(b, e); break; }
          }
        }
      } else {
        if (p && !p.dead && !p.invuln) {
          var ghost = p.state === "soul" && p.flags.ghostBody;
          if (!ghost) {
            var pr = p.r * 0.82 + b.r;
            if (U.dist2(p.x, p.y, b.x, b.y) <= pr * pr) {
              C.damagePlayer(b.dmg, { angle: Math.atan2(b.vy, b.vx), knock: b.knock });
              fizzle(b, p);
              if (C._free.length < 300) C._free.push(b);
              continue;
            }
          }
        }
      }

      if (!b.dead) bs[n++] = b;
      else if (C._free.length < 300) C._free.push(b);
    }
    bs.length = n;
  };

  function fizzle(b, target) {
    if (b.dead) return;
    b.dead = true;
    if (b.boom) {
      C.explosion(b.x, b.y, b.boom.r, b.boom.dmg, {
        owner: b.owner, color: b.color, shake: 4
      });
      b.boom = null;
      return;
    }
    P.spark(b.x, b.y, target ? 5 : 3, {
      color: b.color, speed: target ? 160 : 90, life: 0.24, size: 2.6
    });
  }

  // ---------------- draw ----------------
  C.draw = function (ctx) {
    var bs = C.bullets;
    if (!bs.length) return;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (var i = 0; i < bs.length; i++) {
      var b = bs[i];
      if (b.dead) continue;
      var ang = Math.atan2(b.vy, b.vx);
      var len = b.r * (b.kind === "orb" ? 1.2 : 2.6);
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(ang);
      // glow
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = b.color;
      ctx.beginPath(); ctx.arc(0, 0, b.r * 2.1, 0, U.TAU); ctx.fill();
      ctx.globalAlpha = 1;
      if (b.kind === "orb") {
        ctx.fillStyle = b.color;
        ctx.beginPath(); ctx.arc(0, 0, b.r, 0, U.TAU); ctx.fill();
        ctx.fillStyle = "#fff";
        ctx.globalAlpha = 0.8;
        ctx.beginPath(); ctx.arc(0, 0, b.r * 0.45, 0, U.TAU); ctx.fill();
      } else {
        ctx.fillStyle = b.color;
        ctx.beginPath();
        ctx.moveTo(len, 0);
        ctx.lineTo(-len * 0.5, b.r * 0.9);
        ctx.lineTo(-len * 0.2, 0);
        ctx.lineTo(-len * 0.5, -b.r * 0.9);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "#fff";
        ctx.globalAlpha = 0.85;
        ctx.beginPath(); ctx.arc(0, 0, b.r * 0.42, 0, U.TAU); ctx.fill();
      }
      ctx.restore();
    }
    ctx.restore();
  };

  NS.Combat = C;
})(window.NS);
