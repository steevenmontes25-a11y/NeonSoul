/* ============================================================
   NEON SOUL - enemies.js
   10 enemy archetypes + elite modifier
   -> To add an enemy: add an entry to TYPES {init, ai, draw}
      and reference its key from levels.js zone pools.
   ============================================================ */
(function (NS) {
  "use strict";
  var U = NS.U, P = NS.Particles, Cb = NS.Combat, A = NS.Audio;

  var nextId = 1;

  var TYPES = {
    /* ---------------------------------------------------- RUNNER */
    runner: {
      name: "RUNNER", hp: 26, speed: 168, r: 14, dmg: 9, color: "#ff5f7a", xp: 3, coin: 2,
      init: function (e) { e.lungeCd = U.rand(1, 2.4); e.lunging = 0; },
      ai: function (e, dt, p) {
        var d = U.norm(p.x - e.x, p.y - e.y);
        if (e.lunging > 0) {
          e.lunging -= dt;
          e.vx = U.damp(e.vx, e.aimX * e.speed * 3.1, 6, dt);
          e.vy = U.damp(e.vy, e.aimY * e.speed * 3.1, 6, dt);
          if (Math.random() < 0.5) P.trail(e.x, e.y, e.color, e.r * 0.8, 0.2);
        } else {
          e.lungeCd -= dt;
          e.vx = U.damp(e.vx, d.x * e.speed, 5, dt);
          e.vy = U.damp(e.vy, d.y * e.speed, 5, dt);
          if (e.lungeCd <= 0 && d.m < 300) {
            e.lungeCd = U.rand(1.8, 3.2);
            e.lunging = 0.34;
            e.aimX = d.x; e.aimY = d.y;
            e.windup = 0.18;
            P.ring(e.x, e.y, { r0: e.r, r1: e.r * 2.4, color: e.color, life: 0.22, w: 2 });
          }
        }
      },
      draw: function (ctx, e, t) {
        drawPoly(ctx, e, 3, e.r * 1.25, t * 3 + e.seed, e.lunging > 0 ? 1.25 : 1);
      }
    },

    /* ---------------------------------------------------- SHOOTER */
    shooter: {
      name: "SHOOTER", hp: 22, speed: 92, r: 13, dmg: 8, color: "#ffc53d", xp: 4, coin: 3,
      init: function (e) { e.shotCd = U.rand(0.8, 1.8); e.burst = 0; e.prefer = U.rand(200, 280); },
      ai: function (e, dt, p) {
        var d = U.norm(p.x - e.x, p.y - e.y);
        var want = d.m < e.prefer - 40 ? -1 : (d.m > e.prefer + 40 ? 1 : 0);
        var strafe = Math.sin(e.t * 0.9 + e.seed) * 0.55;
        e.vx = U.damp(e.vx, (d.x * want - d.y * strafe) * e.speed, 4, dt);
        e.vy = U.damp(e.vy, (d.y * want + d.x * strafe) * e.speed, 4, dt);
        e.shotCd -= dt;
        if (e.shotCd <= 0 && d.m < 460 && NS.Game.hasLineOfSight(e, p)) {
          if (e.burst <= 0) { e.burst = 3; e.aimA = Math.atan2(d.y, d.x); }
          e.burst--;
          e.shotCd = e.burst > 0 ? 0.12 : U.rand(1.5, 2.4);
          shoot(e, e.aimA + U.rand(-0.09, 0.09), 330, e.dmg, { color: e.color, r: 6 });
        }
      },
      draw: function (ctx, e, t) {
        drawPoly(ctx, e, 5, e.r * 1.15, t * 1.4 + e.seed, 1);
      }
    },

    /* ---------------------------------------------------- TANK */
    tank: {
      name: "TANK", hp: 120, speed: 62, r: 25, dmg: 16, color: "#ff5a28", xp: 9, coin: 7,
      heavy: true, armor: 0.2,
      init: function (e) { e.slamCd = 3.4; e.slamT = 0; },
      ai: function (e, dt, p) {
        var d = U.norm(p.x - e.x, p.y - e.y);
        if (e.slamT > 0) {
          e.slamT -= dt;
          e.vx *= 0.8; e.vy *= 0.8;
          if (e.slamT <= 0) {
            Cb.explosion(e.x, e.y, 128, e.dmg * 1.3, { owner: 1, color: "#ff5a28", shake: 7 });
            NS.Game.addShake(7);
          }
        } else {
          e.vx = U.damp(e.vx, d.x * e.speed, 2.6, dt);
          e.vy = U.damp(e.vy, d.y * e.speed, 2.6, dt);
          e.slamCd -= dt;
          if (e.slamCd <= 0 && d.m < 150) {
            e.slamCd = U.rand(4, 6);
            e.slamT = 0.75;
            NS.Game.addTelegraph(e.x, e.y, 128, 0.75, "#ff5a28");
            A.sfx("warn");
          }
        }
      },
      draw: function (ctx, e, t) {
        drawPoly(ctx, e, 6, e.r, t * 0.6 + e.seed, e.slamT > 0 ? 1 + (0.75 - e.slamT) : 1);
      }
    },

    /* ---------------------------------------------------- HUNTER */
    hunter: {
      name: "HUNTER", hp: 34, speed: 150, r: 15, dmg: 12, color: "#9b5cff", xp: 6, coin: 4,
      init: function (e) { e.orbitDir = U.chance(0.5) ? 1 : -1; e.diveCd = U.rand(2, 3.4); e.diving = 0; },
      ai: function (e, dt, p) {
        var d = U.norm(p.x - e.x, p.y - e.y);
        if (e.diving > 0) {
          e.diving -= dt;
          e.vx = U.damp(e.vx, e.aimX * e.speed * 2.8, 7, dt);
          e.vy = U.damp(e.vy, e.aimY * e.speed * 2.8, 7, dt);
          P.trail(e.x, e.y, e.color, e.r * 0.7, 0.22);
        } else {
          var tx = -d.y * e.orbitDir, ty = d.x * e.orbitDir;
          var pull = d.m > 230 ? 1 : (d.m < 150 ? -0.7 : 0);
          e.vx = U.damp(e.vx, (tx + d.x * pull) * e.speed, 4.5, dt);
          e.vy = U.damp(e.vy, (ty + d.y * pull) * e.speed, 4.5, dt);
          e.diveCd -= dt;
          if (e.diveCd <= 0) {
            e.diveCd = U.rand(2.6, 4.2);
            e.diving = 0.45;
            e.aimX = d.x; e.aimY = d.y;
            P.ring(e.x, e.y, { r0: e.r, r1: e.r * 3, color: e.color, life: 0.25, w: 2 });
            A.sfx("dash");
          }
        }
      },
      draw: function (ctx, e, t) {
        drawArrow(ctx, e, t);
      }
    },

    /* ---------------------------------------------------- BOMBER */
    bomber: {
      name: "BOMBER", hp: 24, speed: 128, r: 16, dmg: 26, color: "#ff3a55", xp: 5, coin: 4,
      explodeOnDeath: true,
      init: function (e) { e.fuse = -1; },
      ai: function (e, dt, p) {
        var d = U.norm(p.x - e.x, p.y - e.y);
        if (e.fuse < 0) {
          e.vx = U.damp(e.vx, d.x * e.speed, 3.4, dt);
          e.vy = U.damp(e.vy, d.y * e.speed, 3.4, dt);
          if (d.m < 92) {
            e.fuse = 0.72;
            NS.Game.addTelegraph(e.x, e.y, 112, 0.72, "#ff3a55");
            A.sfx("warn");
          }
        } else {
          e.fuse -= dt;
          e.vx *= 0.88; e.vy *= 0.88;
          e.blink = Math.sin(e.fuse * 40) > 0;
          if (e.fuse <= 0) {
            Cb.explosion(e.x, e.y, 112, e.dmg, { owner: 1, color: "#ff3a55" });
            e.hp = 0; e.noDeathExplode = true;
            Cb.killEnemy(e, {});
          }
        }
      },
      draw: function (ctx, e, t) {
        ctx.save();
        if (e.blink) { ctx.globalCompositeOperation = "lighter"; }
        drawPoly(ctx, e, 8, e.r, t * 2 + e.seed, e.fuse >= 0 ? 1.15 + Math.sin(e.fuse * 30) * 0.12 : 1);
        ctx.restore();
      }
    },

    /* ---------------------------------------------------- PHANTOM */
    phantom: {
      name: "PHANTOM", hp: 40, speed: 122, r: 15, dmg: 11, color: "#bff6ff", xp: 8, coin: 6,
      init: function (e) { e.vanishCd = U.rand(2, 3.6); e.vanish = 0; e.alpha = 1; },
      ai: function (e, dt, p) {
        var d = U.norm(p.x - e.x, p.y - e.y);
        if (e.vanish > 0) {
          e.vanish -= dt;
          e.alpha = U.damp(e.alpha, 0.12, 8, dt);
          e.untargetable = true;
          e.vx = U.damp(e.vx, d.x * e.speed * 2, 4, dt);
          e.vy = U.damp(e.vy, d.y * e.speed * 2, 4, dt);
          if (e.vanish <= 0) {
            e.untargetable = false;
            // reappear behind the player
            var a = U.angle(p.x, p.y, e.x, e.y);
            e.x = p.x + Math.cos(a) * 110; e.y = p.y + Math.sin(a) * 110;
            NS.Game.clampToArena(e);
            P.ring(e.x, e.y, { r0: 4, r1: 60, color: e.color, life: 0.3, w: 3 });
            A.sfx("portal");
            for (var i = -1; i <= 1; i++) shoot(e, U.angle(e.x, e.y, p.x, p.y) + i * 0.24, 300, e.dmg, { color: e.color, r: 6 });
          }
        } else {
          e.alpha = U.damp(e.alpha, 1, 8, dt);
          e.vx = U.damp(e.vx, d.x * e.speed, 3, dt);
          e.vy = U.damp(e.vy, d.y * e.speed, 3, dt);
          e.vanishCd -= dt;
          if (e.vanishCd <= 0) {
            e.vanishCd = U.rand(3.4, 5.2);
            e.vanish = 1.1;
            P.spark(e.x, e.y, 10, { color: e.color, speed: 160, life: 0.4, size: 2.6 });
          }
        }
      },
      draw: function (ctx, e, t) {
        ctx.save();
        ctx.globalAlpha = e.alpha === undefined ? 1 : e.alpha;
        drawPoly(ctx, e, 4, e.r * 1.2, t * 1.1 + e.seed, 1);
        ctx.restore();
      }
    },

    /* ---------------------------------------------------- LEECH */
    leech: {
      name: "LEECH", hp: 30, speed: 142, r: 13, dmg: 5, color: "#3dffa8", xp: 6, coin: 5,
      init: function (e) { e.latched = 0; e.drained = 0; },
      ai: function (e, dt, p) {
        var d = U.norm(p.x - e.x, p.y - e.y);
        if (e.latched > 0) {
          e.latched -= dt;
          e.x = U.damp(e.x, p.x, 9, dt);
          e.y = U.damp(e.y, p.y, 9, dt);
          e.drainT = (e.drainT || 0) - dt;
          if (e.drainT <= 0) {
            e.drainT = 0.5;
            p.soul = Math.max(0, p.soul - 7);
            p.takeDamage(e.dmg, { angle: U.angle(e.x, e.y, p.x, p.y), knock: 0, noShake: true });
            P.spark(p.x, p.y, 4, { color: e.color, speed: 90, life: 0.3, size: 2.2 });
            e.hp = Math.min(e.maxHp, e.hp + 4);
          }
          if (e.latched <= 0) {
            e.fleeT = 2.2;
          }
        } else if (e.fleeT > 0) {
          e.fleeT -= dt;
          e.vx = U.damp(e.vx, -d.x * e.speed * 1.2, 3, dt);
          e.vy = U.damp(e.vy, -d.y * e.speed * 1.2, 3, dt);
        } else {
          e.vx = U.damp(e.vx, d.x * e.speed, 3.6, dt);
          e.vy = U.damp(e.vy, d.y * e.speed, 3.6, dt);
          if (d.m < e.r + p.r + 6) {
            e.latched = 1.6;
            A.sfx("warn");
          }
        }
      },
      draw: function (ctx, e, t) {
        drawBlob(ctx, e, t);
        if (e.latched > 0) {
          var p = NS.Game.player;
          ctx.save();
          ctx.globalCompositeOperation = "lighter";
          ctx.strokeStyle = e.color; ctx.lineWidth = 2; ctx.globalAlpha = 0.7;
          ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(p.x, p.y); ctx.stroke();
          ctx.restore();
        }
      }
    },

    /* ---------------------------------------------------- GUARDIAN */
    guardian: {
      name: "GUARDIAN", hp: 70, speed: 78, r: 20, dmg: 13, color: "#25e0ff", xp: 10, coin: 8,
      init: function (e) { e.shieldHp = 60 * (e.elite ? 2 : 1); e.shotCd = 1.6; e.face = 0; },
      ai: function (e, dt, p) {
        var d = U.norm(p.x - e.x, p.y - e.y);
        e.face = U.rotateToward(e.face, Math.atan2(d.y, d.x), 2.6 * dt);
        var want = d.m > 210 ? 1 : (d.m < 120 ? -0.5 : 0);
        e.vx = U.damp(e.vx, d.x * e.speed * want, 3, dt);
        e.vy = U.damp(e.vy, d.y * e.speed * want, 3, dt);
        e.shotCd -= dt;
        if (e.shotCd <= 0 && d.m < 420) {
          e.shotCd = U.rand(1.8, 2.8);
          shoot(e, e.face, 210, e.dmg, { color: e.color, r: 9, kind: "orb", life: 3 });
        }
      },
      onHit: function (e, angle) {
        // frontal shield blocks
        if (e.shieldHp > 0 && Math.abs(U.angleDiff(e.face, angle + Math.PI)) < 1.1) return 0.12;
        return 1;
      },
      draw: function (ctx, e, t) {
        drawPoly(ctx, e, 6, e.r, e.face, 1);
        if (e.shieldHp > 0) {
          ctx.save();
          ctx.globalCompositeOperation = "lighter";
          ctx.strokeStyle = "#a9f3ff";
          ctx.globalAlpha = 0.55 + Math.sin(t * 5) * 0.12;
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.arc(e.x, e.y, e.r * 1.6, e.face - 1.1, e.face + 1.1);
          ctx.stroke();
          ctx.restore();
        }
      }
    },

    /* ---------------------------------------------------- BERSERKER */
    berserker: {
      name: "BERSERKER", hp: 56, speed: 108, r: 18, dmg: 14, color: "#ff2fb9", xp: 9, coin: 7,
      init: function (e) { e.raged = false; e.swingCd = 1.4; },
      ai: function (e, dt, p) {
        var d = U.norm(p.x - e.x, p.y - e.y);
        if (!e.raged && e.hp < e.maxHp * 0.42) {
          e.raged = true;
          e.speed *= 1.85; e.dmg *= 1.5;
          e.color = "#ff3a55";
          P.ring(e.x, e.y, { r0: e.r, r1: e.r * 4.5, color: "#ff3a55", life: 0.45, w: 4 });
          A.sfx("bossRoar");
          NS.Game.addShake(4);
        }
        e.vx = U.damp(e.vx, d.x * e.speed, 3.2, dt);
        e.vy = U.damp(e.vy, d.y * e.speed, 3.2, dt);
        if (e.raged) {
          P.trail(e.x, e.y, "#ff3a55", e.r * 0.6, 0.3);
          e.swingCd -= dt;
          if (e.swingCd <= 0 && d.m < 220) {
            e.swingCd = 2.2;
            for (var i = 0; i < 6; i++) shoot(e, Math.atan2(d.y, d.x) + i * U.TAU / 6, 190, e.dmg * 0.6, { color: "#ff3a55", r: 6 });
          }
        }
      },
      draw: function (ctx, e, t) {
        drawSpiky(ctx, e, t, e.raged);
      }
    },

    /* ---------------------------------------------------- SENTRY (static turret) */
    sentry: {
      name: "SENTRY", hp: 46, speed: 0, r: 17, dmg: 10, color: "#ffc53d", xp: 7, coin: 6,
      heavy: true,
      init: function (e) { e.rot = 0; e.shotCd = 1.2; },
      ai: function (e, dt, p) {
        e.vx = e.vy = 0;
        e.rot += dt * 1.1;
        e.shotCd -= dt;
        if (e.shotCd <= 0) {
          e.shotCd = 1.5;
          for (var i = 0; i < 4; i++) shoot(e, e.rot + i * Math.PI / 2, 190, e.dmg, { color: e.color, r: 6 });
        }
      },
      draw: function (ctx, e, t) { drawPoly(ctx, e, 4, e.r, e.rot, 1); }
    }
  };

  // ---------------- helpers ----------------
  function shoot(e, angle, speed, dmg, o) {
    o = o || {};
    Cb.spawn({
      x: e.x + Math.cos(angle) * (e.r + 4), y: e.y + Math.sin(angle) * (e.r + 4),
      vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
      r: o.r || 6, dmg: dmg * (NS.Game.dmgMul || 1), owner: 1,
      color: o.color || "#ff3a55", life: o.life || 3.4, kind: o.kind || "bolt",
      knock: o.knock || 90, srcBoss: !!o.srcBoss, bounce: o.bounce || 0
    });
    A.sfx("shoot", { gap: 0.06 });
  }
  NS.enemyShoot = shoot;

  // ---------------- drawing primitives ----------------
  function bodyStyle(ctx, e) {
    var flash = e.flash > 0;
    ctx.lineWidth = Math.max(1.5, e.r * 0.16);
    ctx.strokeStyle = flash ? "#ffffff" : e.color;
    ctx.fillStyle = flash ? "rgba(255,255,255,.75)" : "rgba(10,6,18,.82)";
    ctx.shadowColor = e.color;
    ctx.shadowBlur = e.r * (e.elite ? 1.3 : 0.75);
  }

  function drawPoly(ctx, e, sides, r, rot, scale) {
    ctx.save();
    bodyStyle(ctx, e);
    ctx.translate(e.x, e.y);
    ctx.rotate(rot || 0);
    ctx.scale(scale || 1, scale || 1);
    ctx.beginPath();
    for (var i = 0; i < sides; i++) {
      var a = -Math.PI / 2 + i * U.TAU / sides;
      var px = Math.cos(a) * r, py = Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.restore();
  }

  function drawArrow(ctx, e, t) {
    ctx.save();
    bodyStyle(ctx, e);
    ctx.translate(e.x, e.y);
    ctx.rotate(Math.atan2(e.vy, e.vx));
    ctx.beginPath();
    ctx.moveTo(e.r * 1.4, 0);
    ctx.lineTo(-e.r * 0.8, e.r * 0.95);
    ctx.lineTo(-e.r * 0.3, 0);
    ctx.lineTo(-e.r * 0.8, -e.r * 0.95);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.restore();
  }

  function drawBlob(ctx, e, t) {
    ctx.save();
    bodyStyle(ctx, e);
    ctx.translate(e.x, e.y);
    ctx.beginPath();
    for (var i = 0; i <= 12; i++) {
      var a = i / 12 * U.TAU;
      var rr = e.r * (1 + Math.sin(a * 3 + t * 5 + e.seed) * 0.16);
      var px = Math.cos(a) * rr, py = Math.sin(a) * rr;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.restore();
  }

  function drawSpiky(ctx, e, t, raged) {
    ctx.save();
    bodyStyle(ctx, e);
    ctx.translate(e.x, e.y);
    ctx.rotate(t * (raged ? 3 : 0.8) + e.seed);
    ctx.beginPath();
    for (var i = 0; i < 10; i++) {
      var a = i * U.TAU / 10;
      var rr = e.r * (i % 2 ? 0.62 : 1.18);
      var px = Math.cos(a) * rr, py = Math.sin(a) * rr;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.restore();
  }

  // ---------------- factory ----------------
  var E = {
    TYPES: TYPES,

    create: function (type, x, y, opts) {
      opts = opts || {};
      var def = TYPES[type] || TYPES.runner;
      var G = NS.Game;
      var hpScale = opts.hpMul || 1, dmgScale = opts.dmgMul || 1;
      var e = {
        id: nextId++, type: type, def: def, name: def.name,
        x: x, y: y, vx: 0, vy: 0, kx: 0, ky: 0,
        r: def.r * (opts.elite ? 1.5 : 1),
        maxHp: Math.round(def.hp * hpScale * (opts.elite ? 3.2 : 1)),
        speed: def.speed * (opts.elite ? 0.92 : 1),
        dmg: def.dmg * dmgScale * (opts.elite ? 1.45 : 1),
        color: opts.elite ? "#ffc53d" : def.color,
        baseColor: def.color,
        xp: def.xp * (opts.elite ? 5 : 1),
        coin: def.coin * (opts.elite ? 6 : 1),
        elite: !!opts.elite,
        heavy: !!def.heavy,
        armor: (def.armor || 0) + (opts.elite ? 0.12 : 0),
        shield: 0, shieldHp: 0,
        marks: 0, markPulse: 0,
        flash: 0, hitT: 0, t: 0, seed: U.rand(0, 10),
        contactCd: 0,
        dead: false, spawning: 0.55,
        status: { burnT: 0, burnDps: 0, burnTick: 0, chillT: 0, chill: 0, shockT: 0 },
        eliteCd: 3.5
      };
      e.hp = e.maxHp;
      if (def.init) def.init(e);
      return e;
    },

    update: function (e, dt, p, G) {
      e.t += dt;
      if (e.flash > 0) e.flash -= dt;
      if (e.hitT > 0) e.hitT -= dt;
      if (e.markPulse > 0) e.markPulse -= dt;

      if (e.spawning > 0) {
        e.spawning -= dt;
        if (e.spawning < 0) e.spawning = 0;
        e.vx = e.vy = 0;
        return;
      }

      Cb.updateStatus(e, dt);
      if (e.dead) return;

      var slow = e.status.chillT > 0 ? (1 - e.status.chill) : 1;
      if (e.status.shockT > 0) slow *= 0.55;

      // AI
      if (e.def.ai) e.def.ai(e, dt, p, G);

      // elite extra: periodic radial burst
      if (e.elite) {
        e.eliteCd -= dt;
        if (e.eliteCd <= 0) {
          e.eliteCd = U.rand(4, 6);
          var base = U.angle(e.x, e.y, p.x, p.y);
          for (var i = 0; i < 8; i++) NS.enemyShoot(e, base + i * U.TAU / 8, 210, e.dmg * 0.55, { color: "#ffc53d", r: 7 });
          P.ring(e.x, e.y, { r0: e.r, r1: e.r * 3.4, color: "#ffc53d", life: 0.35, w: 3 });
        }
      }

      // knockback decay
      e.x += (e.vx * slow + e.kx) * dt;
      e.y += (e.vy * slow + e.ky) * dt;
      e.kx *= Math.exp(-7 * dt); e.ky *= Math.exp(-7 * dt);

      // separation (cheap): push apart from a few neighbours
      var es = G.enemies;
      var step = Math.max(1, (es.length / 14) | 0);
      for (var j = (e.id % step); j < es.length; j += step) {
        var o = es[j];
        if (o === e || o.dead || o.spawning > 0) continue;
        var dx = e.x - o.x, dy = e.y - o.y;
        var rr = e.r + o.r;
        var d2 = dx * dx + dy * dy;
        if (d2 > 0.01 && d2 < rr * rr) {
          var d = Math.sqrt(d2);
          var push = (rr - d) * (e.heavy ? 0.1 : 0.6);
          e.x += dx / d * push; e.y += dy / d * push;
        }
      }

      G.clampToArena(e);
      G.avoidObstacles(e);

      // contact damage
      if (e.contactCd > 0) e.contactCd -= dt;
      if (!p.dead && e.contactCd <= 0 && e.type !== "leech") {
        var pr = e.r + p.r * 0.85;
        if (U.dist2(e.x, e.y, p.x, p.y) < pr * pr) {
          e.contactCd = 0.65;
          p.takeDamage(e.dmg, { angle: U.angle(e.x, e.y, p.x, p.y), knock: 190 });
          if (!e.heavy) {
            var a = U.angle(p.x, p.y, e.x, e.y);
            e.kx += Math.cos(a) * 170; e.ky += Math.sin(a) * 170;
          }
        }
      }
    },

    draw: function (ctx, e, t) {
      if (e.spawning > 0) {
        var k = 1 - e.spawning / 0.55;
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        ctx.strokeStyle = e.color;
        ctx.globalAlpha = 0.85;
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(e.x, e.y, e.r * (2.4 - k * 1.4), 0, U.TAU); ctx.stroke();
        ctx.globalAlpha = k * 0.7;
        ctx.fillStyle = e.color;
        ctx.beginPath(); ctx.arc(e.x, e.y, e.r * k, 0, U.TAU); ctx.fill();
        ctx.restore();
        return;
      }

      // chill tint
      if (e.status.chillT > 0) {
        ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = 0.28;
        ctx.fillStyle = "#a9f3ff";
        ctx.beginPath(); ctx.arc(e.x, e.y, e.r * 1.35, 0, U.TAU); ctx.fill();
        ctx.restore();
      }
      if (e.status.burnT > 0 && Math.random() < 0.4) {
        P.spark(e.x + U.rand(-e.r, e.r), e.y + U.rand(-e.r, e.r), 1, { color: "#ff8a3d", speed: 30, life: 0.35, size: 2, vy: -50 });
      }

      e.def.draw(ctx, e, t);

      // elite crown ring
      if (e.elite) {
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        ctx.strokeStyle = "#ffc53d"; ctx.lineWidth = 2; ctx.globalAlpha = 0.6 + Math.sin(t * 4) * 0.2;
        ctx.beginPath(); ctx.arc(e.x, e.y, e.r * 1.45, 0, U.TAU); ctx.stroke();
        ctx.restore();
      }

      // marks
      if (e.marks > 0) drawMarks(ctx, e, t);

      // hp bar for tough enemies
      if ((e.maxHp > 60 || e.elite) && e.hp < e.maxHp) {
        var w = e.r * 2.2, h = 3.5;
        ctx.save();
        ctx.fillStyle = "rgba(0,0,0,.65)";
        ctx.fillRect(e.x - w / 2, e.y - e.r - 11, w, h);
        ctx.fillStyle = e.elite ? "#ffc53d" : "#ff5f7a";
        ctx.fillRect(e.x - w / 2, e.y - e.r - 11, w * (e.hp / e.maxHp), h);
        ctx.restore();
      }
    },

    drawMarks: drawMarks
  };

  function drawMarks(ctx, e, t) {
    var n = e.marks;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    var pulse = e.markPulse > 0 ? 1 + e.markPulse * 2 : 1;
    ctx.strokeStyle = "#25e0ff";
    ctx.lineWidth = 1.6;
    ctx.globalAlpha = 0.9;
    for (var i = 0; i < n; i++) {
      var a = t * 2.2 + i * U.TAU / Math.max(3, n);
      var rr = e.r * 1.5 * pulse;
      var px = e.x + Math.cos(a) * rr, py = e.y + Math.sin(a) * rr;
      ctx.beginPath();
      ctx.moveTo(px - 3, py); ctx.lineTo(px + 3, py);
      ctx.moveTo(px, py - 3); ctx.lineTo(px, py + 3);
      ctx.stroke();
    }
    ctx.restore();
  }

  NS.Enemies = E;
})(window.NS);
